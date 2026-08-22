<?php

namespace App\Services;

use App\Exceptions\OrderLifecycleException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\TableSession;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Facades\DB;

final class OrderLifecycleService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | CONFIRM
    |--------------------------------------------------------------------------
    */

    public function confirm(
        Order $order,
        User $actor,
        ?string $notes = null
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $order,
                $actor,
                $notes
            ): array {
                $locked =
                    $this->lockOrder(
                        $order
                    );

                if (
                    $locked->status
                    === Order::STATUS_CONFIRMED
                ) {
                    return $this->result(
                        $locked,
                        false
                    );
                }

                $this->requireStatus(
                    $locked,
                    [
                        Order::STATUS_PENDING,
                    ],
                    Order::STATUS_CONFIRMED
                );

                $from =
                    $locked->status;

                $locked->status =
                    Order::STATUS_CONFIRMED;

                $locked->confirmed_by =
                    $actor->id;

                $locked->confirmed_at ??=
                    now();

                $locked->save();

                $this->history(
                    order: $locked,
                    from: $from,
                    to: Order::STATUS_CONFIRMED,
                    actor: $actor,
                    notes: $notes
                        ?? 'Order confirmed.'
                );

                $this->audit(
                    order: $locked,
                    actor: $actor,
                    action: 'ORDER_CONFIRMED',
                    from: $from,
                    to: Order::STATUS_CONFIRMED
                );

                return $this->result(
                    $locked,
                    true
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | REJECT
    |--------------------------------------------------------------------------
    |
    | Intended primarily for QR customer PENDING orders.
    |
    */

    public function reject(
        Order $order,
        User $actor,
        string $reason
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $order,
                $actor,
                $reason
            ): array {
                $locked =
                    $this->lockOrder(
                        $order
                    );

                if (
                    $locked->status
                    === Order::STATUS_REJECTED
                ) {
                    return $this->result(
                        $locked,
                        false
                    );
                }

                $this->requireStatus(
                    $locked,
                    [
                        Order::STATUS_PENDING,
                    ],
                    Order::STATUS_REJECTED
                );

                $from =
                    $locked->status;

                $locked->status =
                    Order::STATUS_REJECTED;

                $locked->rejected_by =
                    $actor->id;

                $locked->rejected_at =
                    now();

                $locked->rejection_reason =
                    $reason;

                $locked->save();

                $this->clearBillRequest(
                    $locked
                );

                $this->history(
                    order: $locked,
                    from: $from,
                    to: Order::STATUS_REJECTED,
                    actor: $actor,
                    notes: $reason
                );

                $this->audit(
                    order: $locked,
                    actor: $actor,
                    action: 'ORDER_REJECTED',
                    from: $from,
                    to: Order::STATUS_REJECTED,
                    metadata: [
                        'reason' =>
                        $reason,
                    ]
                );

                return $this->result(
                    $locked,
                    true
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | SEND TO KITCHEN
    |--------------------------------------------------------------------------
    |
    | Phase 17 does NOT:
    |
    | - print KOT
    | - deduct inventory
    |
    | Those will hook into this action later.
    |
    | It DOES mark exactly which active order_items have now
    | entered the kitchen lifecycle.
    |
    */

    public function sendToKitchen(
        Order $order,
        User $actor,
        ?string $notes = null
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $order,
                $actor,
                $notes
            ): array {
                $locked =
                    $this->lockOrder(
                        $order
                    );

                if (
                    ! in_array(
                        $locked->status,
                        [
                            Order::STATUS_CONFIRMED,
                            Order::STATUS_SENT_TO_KITCHEN,
                        ],
                        true
                    )
                ) {
                    throw $this->invalidTransition(
                        $locked,
                        Order::STATUS_SENT_TO_KITCHEN
                    );
                }

                $unsentItems =
                    OrderItem::query()
                    ->where(
                        'order_id',
                        $locked->id
                    )
                    ->where(
                        'status',
                        OrderItem::STATUS_ACTIVE
                    )
                    ->whereNull(
                        'sent_to_kitchen_at'
                    )
                    ->lockForUpdate()
                    ->get();

                /*
                 * Already SENT with no new items:
                 * safely return existing state.
                 */
                if (
                    $locked->status
                    === Order::STATUS_SENT_TO_KITCHEN
                    &&
                    $unsentItems->isEmpty()
                ) {
                    return $this->result(
                        $locked,
                        false,
                        []
                    );
                }

                $sentAt =
                    now();

                $itemIds =
                    $unsentItems
                    ->pluck('id')
                    ->map(
                        fn($id): int =>
                        (int) $id
                    )
                    ->values()
                    ->all();

                if ($itemIds !== []) {
                    OrderItem::query()
                        ->whereIn(
                            'id',
                            $itemIds
                        )
                        ->update([
                            'sent_to_kitchen_at' =>
                            $sentAt,

                            'updated_at' =>
                            $sentAt,
                        ]);
                }

                $from =
                    $locked->status;

                $statusChanged =
                    $from
                    !== Order::STATUS_SENT_TO_KITCHEN;

                if ($statusChanged) {
                    $locked->status =
                        Order::STATUS_SENT_TO_KITCHEN;
                }

                $locked->sent_to_kitchen_at ??=
                    $sentAt;

                $locked->save();

                if ($statusChanged) {
                    $this->history(
                        order: $locked,
                        from: $from,
                        to: Order::STATUS_SENT_TO_KITCHEN,
                        actor: $actor,
                        notes: $notes
                            ?? 'Order sent to kitchen.'
                    );
                }

                $this->auditLogger
                    ->record(
                        action: 'ORDER_SENT_TO_KITCHEN',

                        entityType: 'order',

                        entityId: $locked->id,

                        oldValues: [
                            'status' =>
                            $from,
                        ],

                        newValues: [
                            'status' =>
                            $locked->status,

                            'sent_to_kitchen_at' =>
                            $locked
                                ->sent_to_kitchen_at
                                ?->toISOString(),
                        ],

                        metadata: [
                            'order_number' =>
                            $locked->order_number,

                            'item_ids' =>
                            $itemIds,

                            'item_count' =>
                            count(
                                $itemIds
                            ),
                        ],

                        userId: $actor->id
                    );

                return $this->result(
                    $locked,
                    $statusChanged
                        || $itemIds !== [],
                    $itemIds
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | SERVE
    |--------------------------------------------------------------------------
    */

    public function serve(
        Order $order,
        User $actor,
        ?string $notes = null
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $order,
                $actor,
                $notes
            ): array {
                $locked =
                    $this->lockOrder(
                        $order
                    );

                if (
                    $locked->status
                    === Order::STATUS_SERVED
                ) {
                    return $this->result(
                        $locked,
                        false
                    );
                }

                $this->requireStatus(
                    $locked,
                    [
                        Order::STATUS_SENT_TO_KITCHEN,
                    ],
                    Order::STATUS_SERVED
                );

                $hasUnsentItems =
                    OrderItem::query()
                    ->where(
                        'order_id',
                        $locked->id
                    )
                    ->where(
                        'status',
                        OrderItem::STATUS_ACTIVE
                    )
                    ->whereNull(
                        'sent_to_kitchen_at'
                    )
                    ->exists();

                if ($hasUnsentItems) {
                    throw new OrderLifecycleException(
                        message: 'This order still contains items that have not been sent to the kitchen.',

                        errorCode: 'ORDER_HAS_UNSENT_ITEMS',

                        status: 409
                    );
                }

                $from =
                    $locked->status;

                $locked->status =
                    Order::STATUS_SERVED;

                $locked->served_at ??=
                    now();

                $locked->save();

                $this->history(
                    order: $locked,
                    from: $from,
                    to: Order::STATUS_SERVED,
                    actor: $actor,
                    notes: $notes
                        ?? 'Order marked as served.'
                );

                $this->audit(
                    order: $locked,
                    actor: $actor,
                    action: 'ORDER_SERVED',
                    from: $from,
                    to: Order::STATUS_SERVED
                );

                return $this->result(
                    $locked,
                    true
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | COMPLETE
    |--------------------------------------------------------------------------
    */

    public function complete(
        Order $order,
        User $actor,
        ?string $notes = null
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $order,
                $actor,
                $notes
            ): array {
                $locked =
                    $this->lockOrder(
                        $order
                    );

                if (
                    $locked->status
                    === Order::STATUS_COMPLETED
                ) {
                    return $this->result(
                        $locked,
                        false
                    );
                }

                $this->requireStatus(
                    $locked,
                    [
                        Order::STATUS_SERVED,
                    ],
                    Order::STATUS_COMPLETED
                );

                /*
                 * If an invoice already exists,
                 * it must not still have a balance.
                 *
                 * Phase 17 does not require an invoice
                 * because billing/payment is implemented
                 * later.
                 */
                $hasUnpaidInvoice =
                    DB::table('invoices')
                    ->where(
                        function ($query) use (
                            $locked
                        ): void {
                            $query->where(
                                'order_id',
                                $locked->id
                            );

                            if (
                                $locked
                                ->table_session_id
                            ) {
                                $query->orWhere(
                                    'table_session_id',
                                    $locked
                                        ->table_session_id
                                );
                            }
                        }
                    )
                    ->where(
                        'status',
                        '!=',
                        'VOID'
                    )
                    ->where(
                        'balance_due',
                        '>',
                        0
                    )
                    ->exists();

                if ($hasUnpaidInvoice) {
                    throw new OrderLifecycleException(
                        message: 'This order has an unpaid invoice and cannot be completed.',

                        errorCode: 'ORDER_HAS_UNPAID_INVOICE',

                        status: 409
                    );
                }

                $from =
                    $locked->status;

                $locked->status =
                    Order::STATUS_COMPLETED;

                $locked->completed_at ??=
                    now();

                $locked->save();

                $this->history(
                    order: $locked,
                    from: $from,
                    to: Order::STATUS_COMPLETED,
                    actor: $actor,
                    notes: $notes
                        ?? 'Order completed.'
                );

                $this->audit(
                    order: $locked,
                    actor: $actor,
                    action: 'ORDER_COMPLETED',
                    from: $from,
                    to: Order::STATUS_COMPLETED
                );

                return $this->result(
                    $locked,
                    true
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | CANCEL
    |--------------------------------------------------------------------------
    */

    public function cancel(
        Order $order,
        User $actor,
        string $reason
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $order,
                $actor,
                $reason
            ): array {
                $locked =
                    $this->lockOrder(
                        $order
                    );

                if (
                    $locked->status
                    === Order::STATUS_CANCELLED
                ) {
                    return $this->result(
                        $locked,
                        false
                    );
                }

                $this->requireStatus(
                    $locked,
                    [
                        Order::STATUS_PENDING,
                        Order::STATUS_CONFIRMED,
                        Order::STATUS_SENT_TO_KITCHEN,
                        Order::STATUS_SERVED,
                    ],
                    Order::STATUS_CANCELLED
                );

                $from =
                    $locked->status;

                $cancelledAt =
                    now();

                $locked->status =
                    Order::STATUS_CANCELLED;

                $locked->cancelled_by =
                    $actor->id;

                $locked->cancelled_at =
                    $cancelledAt;

                $locked->cancellation_reason =
                    $reason;

                $locked->save();

                /*
                 * Preserve sent_to_kitchen_at.
                 *
                 * Later cancellation inventory reversal
                 * can therefore identify which items had
                 * actually entered the kitchen.
                 */
                OrderItem::query()
                    ->where(
                        'order_id',
                        $locked->id
                    )
                    ->where(
                        'status',
                        OrderItem::STATUS_ACTIVE
                    )
                    ->update([
                        'status' =>
                        OrderItem::STATUS_CANCELLED,

                        'cancelled_at' =>
                        $cancelledAt,

                        'updated_at' =>
                        $cancelledAt,
                    ]);

                $this->clearBillRequest(
                    $locked
                );

                $this->history(
                    order: $locked,
                    from: $from,
                    to: Order::STATUS_CANCELLED,
                    actor: $actor,
                    notes: $reason
                );

                $this->audit(
                    order: $locked,
                    actor: $actor,
                    action: 'ORDER_CANCELLED',
                    from: $from,
                    to: Order::STATUS_CANCELLED,
                    metadata: [
                        'reason' =>
                        $reason,
                    ]
                );

                return $this->result(
                    $locked,
                    true
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | ADDITIONAL ITEMS
    |--------------------------------------------------------------------------
    |
    | Called AFTER additional items have been attached.
    |
    | Customer QR additions require cashier approval again.
    |
    | Waiter/Cashier additions are authenticated staff,
    | therefore they return the order to CONFIRMED.
    |
    */

    public function reopenForAdditionalItems(
        Order $order,
        ?User $actor,
        string $source
    ): Order {
        return DatabaseTransaction::run(
            function () use (
                $order,
                $actor,
                $source
            ): Order {
                $locked =
                    $this->lockOrder(
                        $order
                    );

                if ($locked->isTerminal()) {
                    throw new OrderLifecycleException(
                        message: 'This order is closed and cannot accept additional items.',

                        errorCode: 'ORDER_NOT_OPEN_FOR_ADDITIONS',

                        status: 409
                    );
                }

                $target =
                    $source
                    === Order::SOURCE_QR_CUSTOMER
                    ? Order::STATUS_PENDING
                    : Order::STATUS_CONFIRMED;

                $from =
                    $locked->status;

                /*
                 * Clear an existing bill request even
                 * when the status itself does not change.
                 */
                $this->clearBillRequest(
                    $locked
                );

                if ($from === $target) {
                    return $locked;
                }

                $locked->status =
                    $target;

                $locked->save();

                $notes =
                    $source
                    === Order::SOURCE_QR_CUSTOMER
                    ? 'Additional customer QR items added. Order requires approval again.'
                    : 'Additional staff items added. Order returned to confirmed state.';

                $this->history(
                    order: $locked,
                    from: $from,
                    to: $target,
                    actor: $actor,
                    notes: $notes
                );

                $this->auditLogger
                    ->record(
                        action: 'ORDER_REOPENED_FOR_ADDITIONAL_ITEMS',

                        entityType: 'order',

                        entityId: $locked->id,

                        oldValues: [
                            'status' =>
                            $from,
                        ],

                        newValues: [
                            'status' =>
                            $target,
                        ],

                        metadata: [
                            'order_number' =>
                            $locked->order_number,

                            'order_source' =>
                            $source,
                        ],

                        userId: $actor?->id
                    );

                return $locked;
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function lockOrder(
        Order $order
    ): Order {
        /** @var Order $locked */
        $locked =
            Order::query()
            ->lockForUpdate()
            ->findOrFail(
                $order->id
            );

        return $locked;
    }

    private function requireStatus(
        Order $order,
        array $allowed,
        string $target
    ): void {
        if (
            ! in_array(
                $order->status,
                $allowed,
                true
            )
        ) {
            throw $this->invalidTransition(
                $order,
                $target
            );
        }
    }

    private function invalidTransition(
        Order $order,
        string $target
    ): OrderLifecycleException {
        return new OrderLifecycleException(
            message: "Order cannot move from {$order->status} to {$target}.",

            errorCode: 'INVALID_ORDER_TRANSITION',

            status: 409
        );
    }

    private function history(
        Order $order,
        ?string $from,
        string $to,
        ?User $actor,
        ?string $notes
    ): void {
        OrderStatusHistory::query()
            ->create([
                'order_id' =>
                $order->id,

                'from_status' =>
                $from,

                'to_status' =>
                $to,

                'changed_by' =>
                $actor?->id,

                'notes' =>
                $notes,

                'changed_at' =>
                now(),
            ]);
    }

    private function audit(
        Order $order,
        User $actor,
        string $action,
        string $from,
        string $to,
        array $metadata = []
    ): void {
        $this->auditLogger
            ->record(
                action: $action,

                entityType: 'order',

                entityId: $order->id,

                oldValues: [
                    'status' =>
                    $from,
                ],

                newValues: [
                    'status' =>
                    $to,
                ],

                metadata: array_merge(
                    [
                        'order_number' =>
                        $order->order_number,

                        'order_source' =>
                        $order->order_source,

                        'order_type' =>
                        $order->order_type,
                    ],
                    $metadata
                ),

                userId: $actor->id
            );
    }

    private function clearBillRequest(
        Order $order
    ): void {
        if (! $order->table_session_id) {
            return;
        }

        TableSession::query()
            ->where(
                'id',
                $order->table_session_id
            )
            ->where(
                'status',
                TableSession::STATUS_OPEN
            )
            ->update([
                'bill_requested_at' =>
                null,

                'bill_requested_by' =>
                null,

                'last_activity_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    private function result(
        Order $order,
        bool $changed,
        array $affectedItemIds = []
    ): array {
        return [
            'order' =>
            $this->loadOrder(
                $order
            ),

            'changed' =>
            $changed,

            /*
             * Later KOT / stock phases will use these
             * exact item IDs.
             */
            'affected_item_ids' =>
            $affectedItemIds,
        ];
    }

    private function loadOrder(
        Order $order
    ): Order {
        return $order
            ->fresh()
            ->load([
                'items' =>
                fn($query) =>
                $query->orderBy(
                    'id'
                ),

                'items.addons' =>
                fn($query) =>
                $query->orderBy(
                    'id'
                ),

                'statusHistories' =>
                fn($query) =>
                $query
                    ->orderBy(
                        'changed_at'
                    )
                    ->orderBy(
                        'id'
                    ),
            ]);
    }
}
