<?php

namespace App\Services;

use App\Exceptions\TakeawayOrderException;
use App\Models\BusinessDay;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class TakeawayOrderService
{
    public function __construct(
        private readonly QrOrderService $cartService,
        private readonly DocumentNumberService $documentNumberService,
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Create Takeaway Order
    |--------------------------------------------------------------------------
    */

    public function create(
        User $actor,
        array $data
    ): array {
        $submissionHash =
            $this->submissionHash(
                actor: $actor,
                data: $data
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Idempotency Check
        |--------------------------------------------------------------------------
        */

        $existing =
            Order::query()
            ->where(
                'client_order_id',
                $data['client_order_id']
            )
            ->first();

        if ($existing) {
            return [
                'order' =>
                $this->validateExisting(
                    order: $existing,
                    actor: $actor,
                    submissionHash: $submissionHash
                ),

                'created' =>
                false,
            ];
        }

        try {
            return DB::transaction(
                function () use (
                    $actor,
                    $data,
                    $submissionHash
                ): array {
                    /*
                    |--------------------------------------------------------------------------
                    | Duplicate Check Inside Transaction
                    |--------------------------------------------------------------------------
                    */

                    $existing =
                        Order::query()
                        ->where(
                            'client_order_id',
                            $data['client_order_id']
                        )
                        ->first();

                    if ($existing) {
                        return [
                            'order' =>
                            $this->validateExisting(
                                order: $existing,
                                actor: $actor,
                                submissionHash: $submissionHash
                            ),

                            'created' =>
                            false,
                        ];
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Business Day
                    |--------------------------------------------------------------------------
                    */

                    /** @var BusinessDay|null $businessDay */
                    $businessDay =
                        BusinessDay::query()
                        ->where(
                            'status',
                            BusinessDay::STATUS_OPEN
                        )
                        ->latest('id')
                        ->lockForUpdate()
                        ->first();

                    if (! $businessDay) {
                        throw new TakeawayOrderException(
                            message: 'A business day must be open before creating a takeaway order.',

                            errorCode: 'BUSINESS_DAY_NOT_OPEN',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Staff Cart Validation
                    |--------------------------------------------------------------------------
                    |
                    | Server-side prices are authoritative.
                    |
                    | Staff ordering does NOT require
                    | is_visible_on_qr.
                    |
                    */

                    $prepared =
                        $this->cartService
                        ->prepareCartForStaff(
                            $data['items']
                        );

                    /*
                     * Availability check only.
                     *
                     * Phase 18 does NOT deduct stock.
                     */
                    $this->cartService
                        ->validatePreparedCartStock(
                            $prepared['requirements']
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Takeaway Token
                    |--------------------------------------------------------------------------
                    */

                    try {
                        $takeawayToken =
                            $this
                            ->documentNumberService
                            ->nextTokenNumber();
                    } catch (
                        RuntimeException $exception
                    ) {
                        throw new TakeawayOrderException(
                            message: 'The takeaway token sequence is not configured correctly.',

                            errorCode: 'TAKEAWAY_TOKEN_SEQUENCE_UNAVAILABLE',

                            status: 500
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Create Confirmed Cashier Order
                    |--------------------------------------------------------------------------
                    */

                    $order =
                        Order::query()
                        ->create([
                            /*
                                 * Temporary unique number.
                                 */
                            'order_number' =>
                            'TMP-' .
                                Str::upper(
                                    (string)
                                    Str::ulid()
                                ),

                            'client_order_id' =>
                            $data['client_order_id'],

                            'submission_hash' =>
                            $submissionHash,

                            'public_status_token' =>
                            null,

                            'business_day_id' =>
                            $businessDay->id,

                            /*
                                 * Takeaway has no table.
                                 */
                            'table_session_id' =>
                            null,

                            'table_id' =>
                            null,

                            'order_type' =>
                            Order::TYPE_TAKEAWAY,

                            'order_source' =>
                            Order::SOURCE_CASHIER,

                            'session_sequence' =>
                            null,

                            'table_name_snapshot' =>
                            null,

                            'takeaway_token' =>
                            $takeawayToken,

                            'customer_name' =>
                            $data['customer_name']
                                ?? null,

                            'customer_phone' =>
                            $data['customer_phone']
                                ?? null,

                            /*
                                 * Cashier-created orders are
                                 * trusted staff orders.
                                 */
                            'status' =>
                            Order::STATUS_CONFIRMED,

                            'subtotal' =>
                            $prepared['subtotal'],

                            'discount_total' =>
                            0,

                            'tax_total' =>
                            0,

                            'service_charge_total' =>
                            0,

                            'grand_total' =>
                            $prepared['subtotal'],

                            'estimated_cost_total' =>
                            $prepared['estimated_cost_total'],

                            /*
                                 * Pickup Notes
                                 */
                            'customer_notes' =>
                            $data['pickup_notes']
                                ?? null,

                            'internal_notes' =>
                            null,

                            'created_by' =>
                            $actor->id,

                            'confirmed_by' =>
                            $actor->id,

                            'confirmed_at' =>
                            now(),
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Human-readable Order Number
                    |--------------------------------------------------------------------------
                    */

                    $order->order_number =
                        sprintf(
                            'ORD-%s-%06d',
                            now()->format(
                                'ymd'
                            ),
                            $order->id
                        );

                    $order->save();

                    /*
                    |--------------------------------------------------------------------------
                    | Order Items
                    |--------------------------------------------------------------------------
                    */

                    $this->cartService
                        ->savePreparedOrderItems(
                            order: $order,
                            lines: $prepared['lines']
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Initial History
                    |--------------------------------------------------------------------------
                    */

                    OrderStatusHistory::query()
                        ->create([
                            'order_id' =>
                            $order->id,

                            'from_status' =>
                            null,

                            'to_status' =>
                            Order::STATUS_CONFIRMED,

                            'changed_by' =>
                            $actor->id,

                            'notes' =>
                            'Takeaway order created by cashier.',

                            'changed_at' =>
                            now(),
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Audit
                    |--------------------------------------------------------------------------
                    */

                    $this->auditLogger
                        ->record(
                            action: 'TAKEAWAY_ORDER_CREATED',

                            entityType: 'order',

                            entityId: $order->id,

                            newValues: [
                                'order_number' =>
                                $order
                                    ->order_number,

                                'takeaway_token' =>
                                $order
                                    ->takeaway_token,

                                'order_type' =>
                                $order
                                    ->order_type,

                                'order_source' =>
                                $order
                                    ->order_source,

                                'status' =>
                                $order
                                    ->status,

                                'grand_total' =>
                                (float)
                                $order
                                    ->grand_total,
                            ],

                            metadata: [
                                'customer_name_provided' =>
                                filled(
                                    $order
                                        ->customer_name
                                ),

                                'customer_phone_provided' =>
                                filled(
                                    $order
                                        ->customer_phone
                                ),
                            ],

                            userId: $actor->id
                        );

                    return [
                        'order' =>
                        $this->cartService
                            ->reloadOrderWithItems(
                                $order
                            ),

                        'created' =>
                        true,
                    ];
                },
                3
            );
        } catch (
            QueryException $exception
        ) {
            /*
             * Race-safe idempotency fallback.
             */
            $existing =
                Order::query()
                ->where(
                    'client_order_id',
                    $data['client_order_id']
                )
                ->first();

            if ($existing) {
                return [
                    'order' =>
                    $this->validateExisting(
                        order: $existing,
                        actor: $actor,
                        submissionHash: $submissionHash
                    ),

                    'created' =>
                    false,
                ];
            }

            throw $exception;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Existing Submission
    |--------------------------------------------------------------------------
    */

    private function validateExisting(
        Order $order,
        User $actor,
        string $submissionHash
    ): Order {
        if (
            $order->order_source
            !== Order::SOURCE_CASHIER
            ||
            $order->order_type
            !== Order::TYPE_TAKEAWAY
        ) {
            throw new TakeawayOrderException(
                message: 'This request identifier is already being used by another order.',

                errorCode: 'CLIENT_ORDER_ID_ALREADY_USED',

                status: 409
            );
        }

        if (
            $order->submission_hash
            !== $submissionHash
        ) {
            throw new TakeawayOrderException(
                message: 'This request identifier has already been used with different takeaway order details.',

                errorCode: 'TAKEAWAY_SUBMISSION_MISMATCH',

                status: 409
            );
        }

        if (
            $order->created_by !== null
            &&
            (int)
            $order->created_by
            !== (int)
            $actor->id
        ) {
            throw new TakeawayOrderException(
                message: 'This takeaway submission belongs to another user.',

                errorCode: 'TAKEAWAY_SUBMISSION_OWNER_MISMATCH',

                status: 409
            );
        }

        return $this->cartService
            ->reloadOrderWithItems(
                $order
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Submission Hash
    |--------------------------------------------------------------------------
    */

    private function submissionHash(
        User $actor,
        array $data
    ): string {
        return hash(
            'sha256',

            json_encode(
                [
                    'type' =>
                    Order::TYPE_TAKEAWAY,

                    'source' =>
                    Order::SOURCE_CASHIER,

                    'actor_id' =>
                    $actor->id,

                    'customer_name' =>
                    $data['customer_name']
                        ?? null,

                    'customer_phone' =>
                    $data['customer_phone']
                        ?? null,

                    'pickup_notes' =>
                    $data['pickup_notes']
                        ?? null,

                    'items' =>
                    $data['items'],
                ],

                JSON_UNESCAPED_UNICODE
                    |
                    JSON_UNESCAPED_SLASHES
                    |
                    JSON_THROW_ON_ERROR
            )
        );
    }
}
