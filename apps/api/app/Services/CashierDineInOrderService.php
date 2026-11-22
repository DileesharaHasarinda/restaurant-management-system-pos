<?php

namespace App\Services;

use App\Events\OrderRealtimeUpdated;
use App\Exceptions\QrOrderException;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\RestaurantTable;
use App\Models\TableSession;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class CashierDineInOrderService
{
    public function __construct(
        private readonly TableSessionService $sessionService,
        private readonly QrOrderService $cartService,
        private readonly AuditLogger $auditLogger
    ) {}

    public function create(
        User $actor,
        RestaurantTable $table,
        array $data
    ): array {
        $submissionHash =
            $this->submissionHash(
                actor: $actor,

                table: $table,

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

                    table: $table,

                    submissionHash: $submissionHash
                ),

                'created' =>
                false,
            ];
        }

        try {
            $result =
                DB::transaction(
                    function () use (
                        $actor,
                        $table,
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

                                    table: $table,

                                    submissionHash: $submissionHash
                                ),

                                'created' =>
                                false,
                            ];
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Validate Staff Cart
                        |--------------------------------------------------------------------------
                        |
                        | Laravel remains authoritative for prices and stock.
                        |
                        | Stock is CHECKED here but is NOT deducted here.
                        | Inventory consumption remains part of Send To Kitchen.
                        |--------------------------------------------------------------------------
                        */

                        $prepared =
                            $this
                            ->cartService
                            ->prepareDineInCartForStaff(
                                $data['items']
                            );

                        $this
                            ->cartService
                            ->validatePreparedCartStock(
                                $prepared['requirements']
                            );

                        /*
                        |--------------------------------------------------------------------------
                        | Open / Reuse Table Session
                        |--------------------------------------------------------------------------
                        */

                        $sessionResult =
                            $this
                            ->sessionService
                            ->openForStaff(
                                table: $table,

                                actor: $actor,

                                guestCount: (int)
                                $data['guest_count']
                            );

                        /** @var TableSession $session */
                        $session =
                            $sessionResult['session'];

                        /** @var TableSession $lockedSession */
                        $lockedSession =
                            TableSession::query()
                            ->lockForUpdate()
                            ->findOrFail(
                                $session->id
                            );

                        if (
                            $lockedSession
                            ->status
                            !==
                            TableSession::STATUS_OPEN
                        ) {
                            throw new QrOrderException(
                                message: 'This table session is no longer open.',

                                errorCode: 'TABLE_SESSION_NOT_OPEN',

                                status: 409
                            );
                        }

                        /** @var RestaurantTable $lockedTable */
                        $lockedTable =
                            RestaurantTable::query()
                            ->lockForUpdate()
                            ->findOrFail(
                                $table->id
                            );

                        if (
                            (int)
                            $lockedSession
                                ->table_id
                            !==
                            (int)
                            $lockedTable
                                ->id
                        ) {
                            throw new QrOrderException(
                                message: 'The selected table does not match the active table session.',

                                errorCode: 'TABLE_SESSION_MISMATCH',

                                status: 409
                            );
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Duplicate Check After Locks
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
                                $this
                                    ->validateExisting(
                                        order: $existing,

                                        actor: $actor,

                                        table: $lockedTable,

                                        submissionHash: $submissionHash
                                    ),

                                'created' =>
                                false,
                            ];
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Session Sequence
                        |--------------------------------------------------------------------------
                        */

                        $sequence =
                            (
                                (int)
                                Order::query()
                                    ->where(
                                        'table_session_id',
                                        $lockedSession
                                            ->id
                                    )
                                    ->max(
                                        'session_sequence'
                                    )
                            )
                            +
                            1;

                        /*
                        |--------------------------------------------------------------------------
                        | Create Cashier Dine-In Order
                        |--------------------------------------------------------------------------
                        */

                        $order =
                            Order::query()
                            ->create([
                                'order_number' =>
                                'TMP-'
                                    .
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
                                $lockedSession
                                    ->business_day_id,

                                'table_session_id' =>
                                $lockedSession
                                    ->id,

                                'table_id' =>
                                $lockedTable
                                    ->id,

                                'order_type' =>
                                Order::TYPE_DINE_IN,

                                'order_source' =>
                                Order::SOURCE_CASHIER,

                                'session_sequence' =>
                                $sequence,

                                'table_name_snapshot' =>
                                $lockedTable
                                    ->name,

                                'takeaway_token' =>
                                null,

                                'customer_name' =>
                                $data['customer_name']
                                    ??
                                    null,

                                'customer_phone' =>
                                $data['customer_phone']
                                    ??
                                    null,

                                /*
                                 * Cashier-created orders are trusted
                                 * staff orders, therefore they start
                                 * confirmed.
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

                                'customer_notes' =>
                                $data['notes']
                                    ??
                                    null,

                                'internal_notes' =>
                                null,

                                'created_by' =>
                                $actor
                                    ->id,

                                'confirmed_by' =>
                                $actor
                                    ->id,

                                'confirmed_at' =>
                                now(),
                            ]);

                        /*
                        |--------------------------------------------------------------------------
                        | Final Order Number
                        |--------------------------------------------------------------------------
                        */

                        $order
                            ->order_number =
                            sprintf(
                                'ORD-%s-%06d',

                                now()
                                    ->format(
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

                        $this
                            ->cartService
                            ->savePreparedOrderItems(
                                order: $order,

                                lines: $prepared['lines']
                            );

                        /*
                        |--------------------------------------------------------------------------
                        | Status History
                        |--------------------------------------------------------------------------
                        */

                        OrderStatusHistory::query()
                            ->create([
                                'order_id' =>
                                $order
                                    ->id,

                                'from_status' =>
                                null,

                                'to_status' =>
                                Order::STATUS_CONFIRMED,

                                'changed_by' =>
                                $actor
                                    ->id,

                                'notes' =>
                                'Dine-in order created and confirmed by cashier.',

                                'changed_at' =>
                                now(),
                            ]);

                        /*
                        |--------------------------------------------------------------------------
                        | Table Activity
                        |--------------------------------------------------------------------------
                        */

                        $lockedSession
                            ->last_activity_at =
                            now();

                        $lockedSession
                            ->save();

                        /*
                        |--------------------------------------------------------------------------
                        | Audit
                        |--------------------------------------------------------------------------
                        */

                        $this
                            ->auditLogger
                            ->record(
                                action: 'CASHIER_DINE_IN_ORDER_CREATED',

                                entityType: 'order',

                                entityId: $order
                                    ->id,

                                newValues: [
                                    'order_number' =>
                                    $order
                                        ->order_number,

                                    'order_type' =>
                                    $order
                                        ->order_type,

                                    'order_source' =>
                                    $order
                                        ->order_source,

                                    'status' =>
                                    $order
                                        ->status,

                                    'table_id' =>
                                    $order
                                        ->table_id,

                                    'table_session_id' =>
                                    $order
                                        ->table_session_id,

                                    'grand_total' =>
                                    $order
                                        ->grand_total,
                                ],

                                metadata: [
                                    'guest_count' =>
                                    (int)
                                    $data['guest_count'],
                                ],

                                userId: $actor
                                    ->id
                            );

                        return [
                            'order' =>
                            $this
                                ->cartService
                                ->reloadOrderWithItems(
                                    $order
                                ),

                            'created' =>
                            true,
                        ];
                    },
                    3
                );

            /*
            |--------------------------------------------------------------------------
            | Realtime Invalidation
            |--------------------------------------------------------------------------
            */

            if (
                $result['created']
                &&
                $result['order']
                instanceof Order
            ) {
                try {
                    OrderRealtimeUpdated::dispatch(
                        $result['order'],

                        'CREATED'
                    );
                } catch (
                    Throwable $exception
                ) {
                    report(
                        $exception
                    );
                }
            }

            return $result;
        } catch (
            QueryException $exception
        ) {
            /*
             * client_order_id remains protected by
             * the database unique constraint.
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
                    $this
                        ->validateExisting(
                            order: $existing,

                            actor: $actor,

                            table: $table,

                            submissionHash: $submissionHash
                        ),

                    'created' =>
                    false,
                ];
            }

            throw $exception;
        }
    }

    private function validateExisting(
        Order $order,
        User $actor,
        RestaurantTable $table,
        string $submissionHash
    ): Order {
        if (
            $order->order_type
            !==
            Order::TYPE_DINE_IN
            ||
            $order->order_source
            !==
            Order::SOURCE_CASHIER
            ||
            (int)
            $order->table_id
            !==
            (int)
            $table->id
            ||
            (int)
            $order->created_by
            !==
            (int)
            $actor->id
            ||
            $order->submission_hash
            !==
            $submissionHash
        ) {
            throw new QrOrderException(
                message: 'This client order ID has already been used for a different order submission.',

                errorCode: 'CLIENT_ORDER_ID_CONFLICT',

                status: 409
            );
        }

        return $this
            ->cartService
            ->reloadOrderWithItems(
                $order
            );
    }

    private function submissionHash(
        User $actor,
        RestaurantTable $table,
        array $data
    ): string {
        return hash(
            'sha256',

            json_encode(
                [
                    'actor_id' =>
                    (int)
                    $actor
                        ->id,

                    'table_id' =>
                    (int)
                    $table
                        ->id,

                    'guest_count' =>
                    (int)
                    $data['guest_count'],

                    'customer_name' =>
                    $data['customer_name']
                        ??
                        null,

                    'customer_phone' =>
                    $data['customer_phone']
                        ??
                        null,

                    'notes' =>
                    $data['notes']
                        ??
                        null,

                    'items' =>
                    $this
                        ->normalizeItemsForHash(
                            $data['items']
                        ),
                ],

                JSON_THROW_ON_ERROR
            )
        );
    }

    private function normalizeItemsForHash(
        array $items
    ): array {
        return collect(
            $items
        )
            ->map(
                function (
                    array $item
                ): array {
                    $addons =
                        collect(
                            $item['addons']
                                ??
                                []
                        )
                        ->map(
                            fn(
                                array $addon
                            ): array => [
                                'addon_id' =>
                                (int)
                                $addon['addon_id'],

                                'quantity' =>
                                (int)
                                $addon['quantity'],
                            ]
                        )
                        ->sortBy(
                            'addon_id'
                        )
                        ->values()
                        ->all();

                    return [
                        'menu_item_id' =>
                        (int)
                        $item['menu_item_id'],

                        'variant_id' =>
                        isset(
                            $item['variant_id']
                        )
                            &&
                            $item['variant_id']
                            !==
                            null
                            ? (int)
                            $item['variant_id']
                            : null,

                        'quantity' =>
                        (int)
                        $item['quantity'],

                        'notes' =>
                        $item['notes']
                            ??
                            null,

                        'addons' =>
                        $addons,
                    ];
                }
            )
            ->values()
            ->all();
    }
}
