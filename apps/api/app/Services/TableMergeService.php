<?php

namespace App\Services;

use App\Exceptions\TableOperationException;
use App\Models\Order;
use App\Models\RestaurantTable;
use App\Models\TableMerge;
use App\Models\TableSession;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Facades\DB;

final class TableMergeService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function merge(
        User $actor,
        RestaurantTable $primaryTable,
        int $secondaryTableId,
        ?string $reason = null
    ): array {
        /*
        |--------------------------------------------------------------------------
        | Same Table Protection
        |--------------------------------------------------------------------------
        */

        if (
            (int) $primaryTable->id
            === $secondaryTableId
        ) {
            throw new TableOperationException(
                message: 'A table cannot be merged with itself.',

                errorCode: 'SAME_TABLE_MERGE',

                status: 422
            );
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $primaryTable,
                $secondaryTableId,
                $reason
            ): array {
                /*
                |--------------------------------------------------------------------------
                | Lock Both Physical Tables
                |--------------------------------------------------------------------------
                |
                | Stable ID ordering helps prevent
                | competing merge deadlocks.
                |
                */

                $tableIds = [
                    (int) $primaryTable->id,
                    $secondaryTableId,
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

                /** @var RestaurantTable|null $lockedPrimary */
                $lockedPrimary =
                    $tables->get(
                        (int)
                        $primaryTable->id
                    );

                /** @var RestaurantTable|null $secondary */
                $secondary =
                    $tables->get(
                        $secondaryTableId
                    );

                if (! $lockedPrimary) {
                    throw new TableOperationException(
                        message: 'The primary table could not be found.',

                        errorCode: 'PRIMARY_TABLE_NOT_FOUND',

                        status: 404
                    );
                }

                if (! $secondary) {
                    throw new TableOperationException(
                        message: 'The secondary table could not be found.',

                        errorCode: 'SECONDARY_TABLE_NOT_FOUND',

                        status: 404
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Table Availability Validation
                |--------------------------------------------------------------------------
                */

                if (
                    ! $lockedPrimary->is_active
                    ||
                    ! $secondary->is_active
                ) {
                    throw new TableOperationException(
                        message: 'Both tables must be active before they can be merged.',

                        errorCode: 'TABLE_MERGE_INACTIVE_TABLE'
                    );
                }

                if (
                    $lockedPrimary->status
                    !== RestaurantTable::STATUS_OCCUPIED
                    ||
                    $secondary->status
                    !== RestaurantTable::STATUS_OCCUPIED
                ) {
                    throw new TableOperationException(
                        message: 'Both tables must currently be occupied before they can be merged.',

                        errorCode: 'TABLE_MERGE_REQUIRES_OCCUPIED_TABLES'
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Lock Both OPEN Sessions
                |--------------------------------------------------------------------------
                */

                $sessions =
                    TableSession::query()
                    ->whereIn(
                        'table_id',
                        [
                            $lockedPrimary->id,
                            $secondary->id,
                        ]
                    )
                    ->where(
                        'status',
                        TableSession::STATUS_OPEN
                    )
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('table_id');

                /** @var TableSession|null $targetSession */
                $targetSession =
                    $sessions->get(
                        $lockedPrimary->id
                    );

                /** @var TableSession|null $sourceSession */
                $sourceSession =
                    $sessions->get(
                        $secondary->id
                    );

                if (! $targetSession) {
                    throw new TableOperationException(
                        message: 'The selected primary table does not have an active table session.',

                        errorCode: 'PRIMARY_TABLE_HAS_NO_OPEN_SESSION'
                    );
                }

                if (! $sourceSession) {
                    throw new TableOperationException(
                        message: 'The secondary table does not have an active table session.',

                        errorCode: 'SECONDARY_TABLE_HAS_NO_OPEN_SESSION'
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Business Day Protection
                |--------------------------------------------------------------------------
                */

                if (
                    (int)
                    $targetSession
                        ->business_day_id
                    !==
                    (int)
                    $sourceSession
                        ->business_day_id
                ) {
                    throw new TableOperationException(
                        message: 'Tables from different business days cannot be merged.',

                        errorCode: 'TABLE_MERGE_BUSINESS_DAY_MISMATCH'
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Combined Guest Capacity
                |--------------------------------------------------------------------------
                */

                $combinedGuestCount =
                    (int)
                    $targetSession
                        ->guest_count
                    +
                    (int)
                    $sourceSession
                        ->guest_count;

                if (
                    $combinedGuestCount
                    >
                    (int)
                    $lockedPrimary
                        ->capacity
                ) {
                    throw new TableOperationException(
                        message: 'The primary table does not have enough capacity for the combined guest count.',

                        errorCode: 'PRIMARY_TABLE_CAPACITY_EXCEEDED',

                        status: 422
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Existing Invoice Protection
                |--------------------------------------------------------------------------
                |
                | There is currently no customer invoice
                | issuance service.
                |
                | We must NOT merge already-issued financial
                | documents and then create another invoice.
                |
                | VOID invoices remain historical and do not
                | prevent the merge.
                |
                */

                $existingInvoice =
                    DB::table(
                        'invoices'
                    )
                    ->whereIn(
                        'table_session_id',
                        [
                            $targetSession->id,
                            $sourceSession->id,
                        ]
                    )
                    ->where(
                        'status',
                        '!=',
                        'VOID'
                    )
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->first();

                if ($existingInvoice) {
                    throw new TableOperationException(
                        message: 'These tables cannot be merged because an invoice has already been issued for one of the sessions.',

                        errorCode: 'TABLE_MERGE_INVOICE_ALREADY_ISSUED'
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Lock Source Orders
                |--------------------------------------------------------------------------
                */

                $sourceOrders =
                    Order::query()
                    ->where(
                        'table_session_id',
                        $sourceSession->id
                    )
                    ->orderBy(
                        'session_sequence'
                    )
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                /*
                |--------------------------------------------------------------------------
                | Re-sequence Source Orders
                |--------------------------------------------------------------------------
                |
                | Example:
                |
                | Primary:
                |   sequence 1
                |   sequence 2
                |
                | Secondary:
                |   sequence 1
                |   sequence 2
                |
                | After merge:
                |   1, 2, 3, 4
                |
                | Order IDs do NOT change.
                |
                */

                $nextSequence =
                    (int)
                    (
                        Order::query()
                        ->where(
                            'table_session_id',
                            $targetSession->id
                        )
                        ->max(
                            'session_sequence'
                        )
                        ?? 0
                    );

                $movedOrderIds = [];

                foreach (
                    $sourceOrders
                    as $order
                ) {
                    $nextSequence++;

                    $order->table_session_id =
                        $targetSession->id;

                    $order->table_id =
                        $lockedPrimary->id;

                    $order->session_sequence =
                        $nextSequence;

                    $order->table_name_snapshot =
                        $lockedPrimary->name;

                    /*
                     * Intentionally untouched:
                     *
                     * status
                     * customer data
                     * totals
                     * sent_to_kitchen_at
                     * served_at
                     * order items
                     * status histories
                     */
                    $order->save();

                    $movedOrderIds[] =
                        $order->id;
                }

                $mergedAt =
                    now();

                /*
                |--------------------------------------------------------------------------
                | Preserve Bill Request
                |--------------------------------------------------------------------------
                |
                | If either session already requested its
                | bill, the surviving primary session keeps
                | that request.
                |
                | When both requested, preserve the earliest.
                |
                */

                if (
                    $sourceSession
                    ->bill_requested_at
                    &&
                    (
                        ! $targetSession
                            ->bill_requested_at
                        ||
                        $sourceSession
                        ->bill_requested_at
                        ->lt(
                            $targetSession
                                ->bill_requested_at
                        )
                    )
                ) {
                    $targetSession
                        ->bill_requested_at =
                        $sourceSession
                        ->bill_requested_at;

                    $targetSession
                        ->bill_requested_by =
                        $sourceSession
                        ->bill_requested_by;
                }

                /*
                |--------------------------------------------------------------------------
                | Primary Session Survives
                |--------------------------------------------------------------------------
                */

                $targetSession->guest_count =
                    $combinedGuestCount;

                $targetSession->last_activity_at =
                    $mergedAt;

                $targetSession->save();

                /*
                |--------------------------------------------------------------------------
                | Secondary Session Becomes MERGED
                |--------------------------------------------------------------------------
                |
                | It is NOT deleted.
                |
                | table_id also stays pointing to the original
                | secondary table for historical traceability.
                |
                */

                $sourceSession->status =
                    TableSession::STATUS_MERGED;

                $sourceSession
                    ->merged_into_session_id =
                    $targetSession->id;

                $sourceSession->closed_at =
                    $mergedAt;

                $sourceSession->closed_by =
                    $actor->id;

                $sourceSession->close_reason =
                    $reason
                    ??
                    "Merged into {$lockedPrimary->name}.";

                $sourceSession->last_activity_at =
                    $mergedAt;

                $sourceSession->save();

                /*
                |--------------------------------------------------------------------------
                | Physical Table Statuses
                |--------------------------------------------------------------------------
                */

                $lockedPrimary->status =
                    RestaurantTable::STATUS_OCCUPIED;

                $lockedPrimary->save();

                $secondary->status =
                    RestaurantTable::STATUS_AVAILABLE;

                $secondary->save();

                /*
                |--------------------------------------------------------------------------
                | Immutable Merge History
                |--------------------------------------------------------------------------
                */

                $merge =
                    TableMerge::query()
                    ->create([
                        'source_session_id' =>
                        $sourceSession->id,

                        'target_session_id' =>
                        $targetSession->id,

                        'source_table_id' =>
                        $secondary->id,

                        'target_table_id' =>
                        $lockedPrimary->id,

                        'merged_by' =>
                        $actor->id,

                        'reason' =>
                        $reason,

                        'merged_at' =>
                        $mergedAt,
                    ]);

                /*
                |--------------------------------------------------------------------------
                | Audit
                |--------------------------------------------------------------------------
                */

                $this->auditLogger
                    ->record(
                        action: 'TABLE_MERGED',

                        entityType: 'table_session',

                        entityId: $targetSession->id,

                        oldValues: [
                            'primary_session_id' =>
                            $targetSession->id,

                            'primary_table_id' =>
                            $lockedPrimary->id,

                            'primary_guest_count' =>
                            $combinedGuestCount
                                -
                                (int)
                                $sourceSession
                                    ->guest_count,

                            'secondary_session_id' =>
                            $sourceSession->id,

                            'secondary_table_id' =>
                            $secondary->id,

                            'secondary_guest_count' =>
                            (int)
                            $sourceSession
                                ->guest_count,
                        ],

                        newValues: [
                            'primary_session_id' =>
                            $targetSession->id,

                            'primary_table_id' =>
                            $lockedPrimary->id,

                            'combined_guest_count' =>
                            $combinedGuestCount,

                            'secondary_session_status' =>
                            TableSession::STATUS_MERGED,

                            'secondary_table_status' =>
                            RestaurantTable::STATUS_AVAILABLE,
                        ],

                        metadata: [
                            'merge_id' =>
                            $merge->id,

                            'moved_order_ids' =>
                            $movedOrderIds,

                            'orders_moved' =>
                            count(
                                $movedOrderIds
                            ),

                            'reason' =>
                            $reason,

                            /*
                             * This surviving session becomes
                             * the ONE future invoice context.
                             */
                            'final_billing_session_id' =>
                            $targetSession->id,
                        ],

                        userId: $actor->id
                    );

                /*
                |--------------------------------------------------------------------------
                | IMPORTANT
                |--------------------------------------------------------------------------
                |
                | We deliberately do NOT:
                |
                | - create another order
                | - copy order items
                | - recreate order histories
                | - modify sent_to_kitchen_at
                | - create kitchen print jobs
                | - reprint KOTs
                | - deduct stock again
                | - create an invoice during the merge
                |
                */

                return [
                    'merge' =>
                    $merge
                        ->load([
                            'sourceSession',
                            'targetSession',
                            'sourceTable',
                            'targetTable',
                            'mergedBy',
                        ]),

                    'primary_session' =>
                    $targetSession
                        ->refresh()
                        ->load([
                            'table',
                            'orders',
                        ]),

                    'secondary_session' =>
                    $sourceSession
                        ->refresh()
                        ->load([
                            'table',
                            'mergedInto',
                        ]),

                    'orders_moved' =>
                    count(
                        $movedOrderIds
                    ),

                    'moved_order_ids' =>
                    $movedOrderIds,

                    /*
                     * The surviving session is now the only
                     * session from which a final invoice
                     * should later be generated.
                     */
                    'final_billing_session_id' =>
                    $targetSession->id,
                ];
            }
        );
    }
}
