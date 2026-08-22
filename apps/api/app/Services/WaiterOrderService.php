<?php

namespace App\Services;

use App\Exceptions\WaiterOrderException;
use App\Models\Order;
use App\Models\OrderAdditionSubmission;
use App\Models\OrderStatusHistory;
use App\Models\RestaurantTable;
use App\Models\TableSession;
use App\Services\OrderLifecycleService;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class WaiterOrderService
{
    public function __construct(
        private readonly TableSessionService $sessionService,
        private readonly QrOrderService $cartService,
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Create First Waiter Order
    |--------------------------------------------------------------------------
    */

    public function create(
        User $actor,
        RestaurantTable $table,
        array $data
    ): array {
        $submissionHash =
            $this->firstSubmissionHash(
                actor: $actor,
                table: $table,
                items: $data['items']
            );

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
                $this->validateExistingFirstOrder(
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
         * Open or reuse staff table session.
         */
        $sessionResult =
            $this->sessionService
            ->openForStaff(
                table: $table,
                actor: $actor,
                guestCount: 1
            );

        /** @var TableSession $session */
        $session =
            $sessionResult['session'];

        try {
            return DB::transaction(
                function () use (
                    $actor,
                    $table,
                    $session,
                    $data,
                    $submissionHash
                ): array {
                    /** @var TableSession $lockedSession */
                    $lockedSession =
                        TableSession::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $session->id
                        );

                    if (
                        $lockedSession->status
                        !== TableSession::STATUS_OPEN
                    ) {
                        throw new WaiterOrderException(
                            message: 'This table session is no longer open.',

                            errorCode: 'TABLE_SESSION_NOT_OPEN'
                        );
                    }

                    /** @var RestaurantTable $lockedTable */
                    $lockedTable =
                        RestaurantTable::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $table->id
                        );

                    $this->validateTable(
                        $lockedTable
                    );

                    if (
                        (int)
                        $lockedSession->table_id
                        !==
                        (int)
                        $lockedTable->id
                    ) {
                        throw new WaiterOrderException(
                            message: 'The selected table does not match the active table session.',

                            errorCode: 'TABLE_SESSION_MISMATCH'
                        );
                    }

                    /*
                     * Network/double-tap duplicate
                     * check inside transaction.
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
                                ->validateExistingFirstOrder(
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
                     * A table has one active waiter
                     * order. Additional items must
                     * append to it.
                     */
                    $activeWaiterOrder =
                        Order::query()
                        ->where(
                            'table_session_id',
                            $lockedSession->id
                        )
                        ->where(
                            'order_source',
                            Order::SOURCE_WAITER
                        )
                        ->whereNotIn(
                            'status',
                            [
                                Order::STATUS_COMPLETED,
                                Order::STATUS_CANCELLED,
                                Order::STATUS_REJECTED,
                            ]
                        )
                        ->lockForUpdate()
                        ->latest('id')
                        ->first();

                    if ($activeWaiterOrder) {
                        throw new WaiterOrderException(
                            message: 'This table already has an active waiter order. Add the new items to the existing order.',

                            errorCode: 'WAITER_ORDER_ALREADY_EXISTS',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Use Existing Phase 15 Cart Engine
                    |--------------------------------------------------------------------------
                    */

                    $prepared =
                        $this->cartService
                        ->prepareDineInCartForStaff(
                            $data['items']
                        );

                    $this->cartService
                        ->validatePreparedCartStock(
                            $prepared['requirements']
                        );

                    $sequence =
                        (
                            (int)
                            Order::query()
                                ->where(
                                    'table_session_id',
                                    $lockedSession->id
                                )
                                ->max(
                                    'session_sequence'
                                )
                        )
                        + 1;

                    /*
                    |--------------------------------------------------------------------------
                    | Waiter Orders Are Trusted Staff Orders
                    |--------------------------------------------------------------------------
                    |
                    | QR customer -> PENDING
                    |
                    | waiter -> CONFIRMED
                    |
                    */

                    $order =
                        Order::query()
                        ->create([
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

                            'business_day_id' =>
                            $lockedSession
                                ->business_day_id,

                            'table_session_id' =>
                            $lockedSession->id,

                            'table_id' =>
                            $lockedTable->id,

                            'order_type' =>
                            Order::TYPE_DINE_IN,

                            'order_source' =>
                            Order::SOURCE_WAITER,

                            'session_sequence' =>
                            $sequence,

                            'table_name_snapshot' =>
                            $lockedTable->name,

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

                            'created_by' =>
                            $actor->id,

                            'confirmed_by' =>
                            $actor->id,

                            'confirmed_at' =>
                            now(),
                        ]);

                    $order->order_number =
                        sprintf(
                            'ORD-%s-%06d',
                            now()->format(
                                'ymd'
                            ),
                            $order->id
                        );

                    $order->save();

                    $this->cartService
                        ->savePreparedOrderItems(
                            order: $order,
                            lines: $prepared['lines']
                        );

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
                            'Order created by waiter.',

                            'changed_at' =>
                            now(),
                        ]);

                    /*
                     * A newly changed order makes an
                     * old bill request stale.
                     */
                    $this->clearBillRequest(
                        $lockedSession
                    );

                    $lockedSession
                        ->last_activity_at =
                        now();

                    $lockedSession->save();

                    $this->auditLogger
                        ->record(
                            action: 'WAITER_ORDER_CREATED',

                            entityType: 'order',

                            entityId: $order->id,

                            newValues: [
                                'order_number' =>
                                $order->order_number,

                                'status' =>
                                $order->status,

                                'grand_total' =>
                                (float)
                                $order->grand_total,
                            ],

                            metadata: [
                                'table_id' =>
                                $lockedTable->id,

                                'table_session_id' =>
                                $lockedSession->id,
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
                    $this->validateExistingFirstOrder(
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

    /*
    |--------------------------------------------------------------------------
    | Additional Waiter Items
    |--------------------------------------------------------------------------
    */

    public function append(
        User $actor,
        Order $order,
        array $data
    ): array {
        $this->validateWaiterOrder(
            $order
        );

        $submissionHash =
            $this->additionalSubmissionHash(
                actor: $actor,
                order: $order,
                items: $data['items']
            );

        $existingSubmission =
            OrderAdditionSubmission::query()
            ->where(
                'client_submission_id',
                $data['client_submission_id']
            )
            ->first();

        if ($existingSubmission) {
            return [
                'order' =>
                $this->validateExistingAddition(
                    submission: $existingSubmission,

                    order: $order,

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
                    $order,
                    $data,
                    $submissionHash
                ): array {
                    /** @var Order $lockedOrder */
                    $lockedOrder =
                        Order::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $order->id
                        );

                    $this->validateWaiterOrder(
                        $lockedOrder
                    );

                    /** @var TableSession $session */
                    $session =
                        TableSession::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $lockedOrder
                                ->table_session_id
                        );

                    if (
                        $session->status
                        !== TableSession::STATUS_OPEN
                    ) {
                        throw new WaiterOrderException(
                            message: 'This table session is no longer open.',

                            errorCode: 'TABLE_SESSION_NOT_OPEN'
                        );
                    }

                    /** @var RestaurantTable $table */
                    $table =
                        RestaurantTable::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $lockedOrder
                                ->table_id
                        );

                    $this->validateTable(
                        $table
                    );

                    $existingSubmission =
                        OrderAdditionSubmission::query()
                        ->where(
                            'client_submission_id',
                            $data['client_submission_id']
                        )
                        ->first();

                    if ($existingSubmission) {
                        return [
                            'order' =>
                            $this
                                ->validateExistingAddition(
                                    submission: $existingSubmission,

                                    order: $lockedOrder,

                                    submissionHash: $submissionHash
                                ),

                            'created' =>
                            false,
                        ];
                    }

                    $prepared =
                        $this->cartService
                        ->prepareDineInCartForStaff(
                            $data['items']
                        );

                    $this->cartService
                        ->validatePreparedCartStock(
                            $prepared['requirements']
                        );

                    OrderAdditionSubmission::query()
                        ->create([
                            'order_id' =>
                            $lockedOrder->id,

                            'client_submission_id' =>
                            $data['client_submission_id'],

                            'submission_hash' =>
                            $submissionHash,
                        ]);

                    $this->cartService
                        ->savePreparedOrderItems(
                            order: $lockedOrder,
                            lines: $prepared['lines']
                        );

                    $this->cartService
                        ->recalculatePreparedOrder(
                            $lockedOrder
                        );

                    /*
|--------------------------------------------------------------------------
| Phase 17 Lifecycle Re-entry
|--------------------------------------------------------------------------
|
| Waiter is authenticated restaurant staff.
|
| Therefore new waiter items return the cumulative
| order to CONFIRMED instead of PENDING.
|
*/

                    $lockedOrder =
                        app(
                            OrderLifecycleService::class
                        )
                        ->reopenForAdditionalItems(
                            order: $lockedOrder,

                            actor: $actor,

                            source: Order::SOURCE_WAITER
                        );

                    /*
                     * Additional items invalidate an
                     * earlier bill request.
                     */
                    $this->clearBillRequest(
                        $session
                    );

                    $session->last_activity_at =
                        now();

                    $session->save();

                    $this->auditLogger
                        ->record(
                            action: 'WAITER_ORDER_ITEMS_ADDED',

                            entityType: 'order',

                            entityId: $lockedOrder->id,

                            newValues: [
                                'grand_total' =>
                                (float)
                                $lockedOrder
                                    ->fresh()
                                    ->grand_total,
                            ],

                            metadata: [
                                'table_id' =>
                                $table->id,

                                'new_lines' =>
                                count(
                                    $prepared['lines']
                                ),
                            ],

                            userId: $actor->id
                        );

                    return [
                        'order' =>
                        $this->cartService
                            ->reloadOrderWithItems(
                                $lockedOrder
                                    ->fresh()
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
            $existingSubmission =
                OrderAdditionSubmission::query()
                ->where(
                    'client_submission_id',
                    $data['client_submission_id']
                )
                ->first();

            if ($existingSubmission) {
                return [
                    'order' =>
                    $this->validateExistingAddition(
                        submission: $existingSubmission,

                        order: $order,

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
    | Request Bill
    |--------------------------------------------------------------------------
    */

    public function requestBill(
        User $actor,
        RestaurantTable $table
    ): array {
        return DB::transaction(
            function () use (
                $actor,
                $table
            ): array {
                /** @var RestaurantTable $lockedTable */
                $lockedTable =
                    RestaurantTable::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $table->id
                    );

                /** @var TableSession|null $session */
                $session =
                    TableSession::query()
                    ->where(
                        'table_id',
                        $lockedTable->id
                    )
                    ->where(
                        'status',
                        TableSession::STATUS_OPEN
                    )
                    ->latest('id')
                    ->lockForUpdate()
                    ->first();

                if (! $session) {
                    throw new WaiterOrderException(
                        message: 'This table has no open session.',

                        errorCode: 'TABLE_SESSION_NOT_FOUND',

                        status: 409
                    );
                }

                $hasOrders =
                    Order::query()
                    ->where(
                        'table_session_id',
                        $session->id
                    )
                    ->whereNotIn(
                        'status',
                        [
                            Order::STATUS_CANCELLED,
                            Order::STATUS_REJECTED,
                        ]
                    )
                    ->exists();

                if (! $hasOrders) {
                    throw new WaiterOrderException(
                        message: 'There are no active orders to bill for this table.',

                        errorCode: 'TABLE_HAS_NO_ORDERS',

                        status: 409
                    );
                }

                if (
                    $session->bill_requested_at
                    !== null
                ) {
                    return [
                        'session' =>
                        $session,

                        'created' =>
                        false,
                    ];
                }

                $session->bill_requested_at =
                    now();

                $session->bill_requested_by =
                    $actor->id;

                $session->last_activity_at =
                    now();

                $session->save();

                $this->auditLogger
                    ->record(
                        action: 'TABLE_BILL_REQUESTED',

                        entityType: 'table_session',

                        entityId: $session->id,

                        newValues: [
                            'bill_requested_at' =>
                            $session
                                ->bill_requested_at
                                ?->toISOString(),
                        ],

                        metadata: [
                            'table_id' =>
                            $lockedTable->id,
                        ],

                        userId: $actor->id
                    );

                return [
                    'session' =>
                    $session->refresh(),

                    'created' =>
                    true,
                ];
            },
            3
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Validation
    |--------------------------------------------------------------------------
    */

    private function validateTable(
        RestaurantTable $table
    ): void {
        if (! $table->is_active) {
            throw new WaiterOrderException(
                message: 'This table is inactive.',

                errorCode: 'TABLE_INACTIVE',

                status: 409
            );
        }

        if (
            in_array(
                $table->status,
                [
                    RestaurantTable::STATUS_CLEANING,
                    RestaurantTable::STATUS_OUT_OF_SERVICE,
                ],
                true
            )
        ) {
            throw new WaiterOrderException(
                message: 'This table is currently unavailable.',

                errorCode: 'TABLE_UNAVAILABLE',

                status: 409
            );
        }
    }

    private function validateWaiterOrder(
        Order $order
    ): void {
        if (
            $order->order_source
            !== Order::SOURCE_WAITER
        ) {
            throw new WaiterOrderException(
                message: 'Additional waiter items can only be appended to a waiter order.',

                errorCode: 'NOT_WAITER_ORDER',

                status: 409
            );
        }

        if (
            in_array(
                $order->status,
                [
                    Order::STATUS_COMPLETED,
                    Order::STATUS_CANCELLED,
                    Order::STATUS_REJECTED,
                ],
                true
            )
        ) {
            throw new WaiterOrderException(
                message: 'This order is already closed and cannot accept additional items.',

                errorCode: 'ORDER_NOT_OPEN_FOR_ADDITIONS',

                status: 409
            );
        }

        if (
            ! $order->table_session_id
            || ! $order->table_id
        ) {
            throw new WaiterOrderException(
                message: 'This order is not linked to an active restaurant table.',

                errorCode: 'ORDER_TABLE_SESSION_MISSING',

                status: 409
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency
    |--------------------------------------------------------------------------
    */

    private function validateExistingFirstOrder(
        Order $order,
        User $actor,
        RestaurantTable $table,
        string $submissionHash
    ): Order {
        if (
            $order->order_source
            !== Order::SOURCE_WAITER
            ||
            (int) $order->table_id
            !== (int) $table->id
            ||
            (int) $order->created_by
            !== (int) $actor->id
        ) {
            throw new WaiterOrderException(
                message: 'This order submission identifier has already been used.',

                errorCode: 'CLIENT_ORDER_ID_REUSED',

                status: 409
            );
        }

        if (
            ! hash_equals(
                (string)
                $order->submission_hash,
                $submissionHash
            )
        ) {
            throw new WaiterOrderException(
                message: 'This order submission identifier was already used for a different order.',

                errorCode: 'CLIENT_ORDER_ID_REUSED',

                status: 409
            );
        }

        return $this->cartService
            ->reloadOrderWithItems(
                $order
            );
    }

    private function validateExistingAddition(
        OrderAdditionSubmission $submission,
        Order $order,
        string $submissionHash
    ): Order {
        if (
            (int)
            $submission->order_id
            !==
            (int)
            $order->id
        ) {
            throw new WaiterOrderException(
                message: 'This additional-order submission identifier has already been used.',

                errorCode: 'ADDITIONAL_SUBMISSION_ID_REUSED',

                status: 409
            );
        }

        if (
            ! hash_equals(
                (string)
                $submission->submission_hash,
                $submissionHash
            )
        ) {
            throw new WaiterOrderException(
                message: 'This additional-order identifier was already used for different items.',

                errorCode: 'ADDITIONAL_SUBMISSION_ID_REUSED',

                status: 409
            );
        }

        return $this->cartService
            ->reloadOrderWithItems(
                $order
            );
    }

    private function firstSubmissionHash(
        User $actor,
        RestaurantTable $table,
        array $items
    ): string {
        return $this->hash(
            [
                'actor_id' =>
                $actor->id,

                'table_id' =>
                $table->id,

                'items' =>
                $this->canonicalItems(
                    $items
                ),
            ]
        );
    }

    private function additionalSubmissionHash(
        User $actor,
        Order $order,
        array $items
    ): string {
        return $this->hash(
            [
                'actor_id' =>
                $actor->id,

                'order_id' =>
                $order->id,

                'items' =>
                $this->canonicalItems(
                    $items
                ),
            ]
        );
    }

    private function canonicalItems(
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
                                ?? []
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
                            ? (int)
                            $item['variant_id']
                            : null,

                        'quantity' =>
                        (int)
                        $item['quantity'],

                        'special_notes' =>
                        isset(
                            $item['special_notes']
                        )
                            ? trim(
                                (string)
                                $item['special_notes']
                            )
                            : null,

                        'addons' =>
                        $addons,
                    ];
                }
            )
            ->values()
            ->all();
    }

    private function hash(
        array $value
    ): string {
        return hash(
            'sha256',
            json_encode(
                $value,
                JSON_THROW_ON_ERROR
            )
        );
    }

    private function clearBillRequest(
        TableSession $session
    ): void {
        if (
            $session->bill_requested_at
            === null
            &&
            $session->bill_requested_by
            === null
        ) {
            return;
        }

        $session->bill_requested_at =
            null;

        $session->bill_requested_by =
            null;

        $session->save();
    }
}
