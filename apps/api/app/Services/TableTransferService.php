<?php

namespace App\Services;

use App\Exceptions\TableOperationException;
use App\Models\Order;
use App\Models\RestaurantTable;
use App\Models\TableSession;
use App\Models\TableTransfer;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Facades\DB;

final class TableTransferService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function transfer(
        User $actor,
        RestaurantTable $sourceTable,
        int $toTableId,
        ?string $reason = null
    ): array {
        if (
            (int) $sourceTable->id
            === $toTableId
        ) {
            throw new TableOperationException(
                message: 'The source and destination tables cannot be the same.',

                errorCode: 'SAME_TABLE_TRANSFER',

                status: 422
            );
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $sourceTable,
                $toTableId,
                $reason
            ): array {
                /*
                |--------------------------------------------------------------------------
                | Lock Both Tables In Stable ID Order
                |--------------------------------------------------------------------------
                |
                | Stable ordering reduces the chance of
                | deadlocks when two transfers happen
                | at nearly the same time.
                |
                */

                $tableIds = [
                    (int) $sourceTable->id,
                    $toTableId,
                ];

                sort(
                    $tableIds
                );

                $tables =
                    RestaurantTable::query()
                    ->whereIn(
                        'id',
                        $tableIds
                    )
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                /** @var RestaurantTable|null $lockedSource */
                $lockedSource =
                    $tables->get(
                        (int)
                        $sourceTable->id
                    );

                /** @var RestaurantTable|null $destination */
                $destination =
                    $tables->get(
                        $toTableId
                    );

                if (! $lockedSource) {
                    throw new TableOperationException(
                        message: 'The source table could not be found.',

                        errorCode: 'SOURCE_TABLE_NOT_FOUND',

                        status: 404
                    );
                }

                if (! $destination) {
                    throw new TableOperationException(
                        message: 'The destination table could not be found.',

                        errorCode: 'DESTINATION_TABLE_NOT_FOUND',

                        status: 404
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Lock Active Source Session
                |--------------------------------------------------------------------------
                */

                /** @var TableSession|null $session */
                $session =
                    TableSession::query()
                    ->where(
                        'table_id',
                        $lockedSource->id
                    )
                    ->where(
                        'status',
                        TableSession::STATUS_OPEN
                    )
                    ->latest('id')
                    ->lockForUpdate()
                    ->first();

                if (! $session) {
                    throw new TableOperationException(
                        message: 'The source table does not have an active table session.',

                        errorCode: 'SOURCE_TABLE_HAS_NO_OPEN_SESSION'
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Destination Validation
                |--------------------------------------------------------------------------
                */

                if (! $destination->is_active) {
                    throw new TableOperationException(
                        message: 'The destination table is inactive.',

                        errorCode: 'DESTINATION_TABLE_INACTIVE'
                    );
                }

                if (
                    $destination->status
                    !== RestaurantTable::STATUS_AVAILABLE
                ) {
                    throw new TableOperationException(
                        message: 'The destination table is not available.',

                        errorCode: 'DESTINATION_TABLE_UNAVAILABLE'
                    );
                }

                /*
                 * Defensive check in addition to table status.
                 */
                $destinationSession =
                    TableSession::query()
                    ->where(
                        'table_id',
                        $destination->id
                    )
                    ->where(
                        'status',
                        TableSession::STATUS_OPEN
                    )
                    ->lockForUpdate()
                    ->first();

                if ($destinationSession) {
                    throw new TableOperationException(
                        message: 'The destination table already has an active session.',

                        errorCode: 'DESTINATION_TABLE_HAS_OPEN_SESSION'
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Capacity Validation
                |--------------------------------------------------------------------------
                */

                if (
                    (int) $session->guest_count
                    >
                    (int) $destination->capacity
                ) {
                    throw new TableOperationException(
                        message: 'The destination table does not have enough capacity for this table session.',

                        errorCode: 'DESTINATION_TABLE_CAPACITY_EXCEEDED',

                        status: 422
                    );
                }

                $transferredAt =
                    now();

                /*
                |--------------------------------------------------------------------------
                | Move Existing Session
                |--------------------------------------------------------------------------
                |
                | IMPORTANT:
                |
                | The SAME table_sessions row is retained.
                |
                */

                $session->table_id =
                    $destination->id;

                $session->last_activity_at =
                    $transferredAt;

                $session->save();

                /*
                |--------------------------------------------------------------------------
                | Move Existing Orders
                |--------------------------------------------------------------------------
                |
                | No new order is created.
                |
                | Order IDs, totals, customer data,
                | statuses and kitchen timestamps remain.
                |
                */

                $ordersMoved =
                    Order::query()
                    ->where(
                        'table_session_id',
                        $session->id
                    )
                    ->update([
                        'table_id' =>
                        $destination->id,

                        /*
                         * Future displays / additional KOTs
                         * should use the customer's current
                         * physical table.
                         */
                        'table_name_snapshot' =>
                        $destination->name,

                        'updated_at' =>
                        $transferredAt,
                    ]);

                /*
                |--------------------------------------------------------------------------
                | Move Current Bill Display
                |--------------------------------------------------------------------------
                |
                | Invoice ID, session, order, customer,
                | totals and payment data are untouched.
                |
                | Only a current non-void / non-paid bill's
                | table display snapshot changes.
                |
                */

                $billsUpdated =
                    DB::table(
                        'invoices'
                    )
                    ->where(
                        'table_session_id',
                        $session->id
                    )
                    ->where(
                        'status',
                        '!=',
                        'VOID'
                    )
                    ->where(
                        'payment_status',
                        '!=',
                        'PAID'
                    )
                    ->update([
                        'table_name_snapshot' =>
                        $destination->name,

                        'updated_at' =>
                        $transferredAt,
                    ]);

                /*
                |--------------------------------------------------------------------------
                | Update Physical Table Statuses
                |--------------------------------------------------------------------------
                */

                $lockedSource->status =
                    $lockedSource->is_active
                    ? RestaurantTable::STATUS_AVAILABLE
                    : RestaurantTable::STATUS_OUT_OF_SERVICE;

                $lockedSource->save();

                $destination->status =
                    RestaurantTable::STATUS_OCCUPIED;

                $destination->save();

                /*
                |--------------------------------------------------------------------------
                | Immutable Transfer Record
                |--------------------------------------------------------------------------
                */

                $transfer =
                    TableTransfer::query()
                    ->create([
                        'table_session_id' =>
                        $session->id,

                        'from_table_id' =>
                        $lockedSource->id,

                        'to_table_id' =>
                        $destination->id,

                        'transferred_by' =>
                        $actor->id,

                        'reason' =>
                        $reason,

                        'transferred_at' =>
                        $transferredAt,
                    ]);

                /*
                |--------------------------------------------------------------------------
                | Audit
                |--------------------------------------------------------------------------
                */

                $this->auditLogger
                    ->record(
                        action: 'TABLE_TRANSFERRED',

                        entityType: 'table_session',

                        entityId: $session->id,

                        oldValues: [
                            'table_id' =>
                            $lockedSource->id,

                            'table_name' =>
                            $lockedSource->name,
                        ],

                        newValues: [
                            'table_id' =>
                            $destination->id,

                            'table_name' =>
                            $destination->name,
                        ],

                        metadata: [
                            'transfer_id' =>
                            $transfer->id,

                            'orders_moved' =>
                            $ordersMoved,

                            'bills_updated' =>
                            $billsUpdated,

                            'reason' =>
                            $reason,
                        ],

                        userId: $actor->id
                    );

                /*
                |--------------------------------------------------------------------------
                | IMPORTANT
                |--------------------------------------------------------------------------
                |
                | We intentionally DO NOT:
                |
                | - create another table session
                | - create another order
                | - duplicate order items
                | - modify sent_to_kitchen_at
                | - create kitchen_print_jobs
                | - resend previous kitchen tickets
                |
                */

                return [
                    'transfer' =>
                    $transfer
                        ->load([
                            'fromTable',
                            'toTable',
                            'transferredBy',
                        ]),

                    'session' =>
                    $session
                        ->refresh()
                        ->load([
                            'table',
                            'orders',
                        ]),

                    'orders_moved' =>
                    $ordersMoved,

                    'bills_updated' =>
                    $billsUpdated,
                ];
            }
        );
    }
}
