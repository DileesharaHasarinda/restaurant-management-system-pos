<?php

namespace App\Services;

use App\Exceptions\TableOperationException;
use App\Models\BusinessDay;
use App\Models\RestaurantTable;
use App\Models\TableSession;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TableSessionService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function current(
        RestaurantTable $table
    ): ?TableSession {
        return $table
            ->sessions()
            ->where(
                'status',
                TableSession::STATUS_OPEN
            )
            ->latest('id')
            ->first();
    }

    public function openForStaff(
        RestaurantTable $table,
        User $actor,
        int $guestCount
    ): array {
        return $this->open(
            table: $table,
            guestCount: $guestCount,
            source: TableSession::SOURCE_STAFF,
            actor: $actor
        );
    }

    public function openFromQr(
        RestaurantTable $table,
        int $guestCount = 1
    ): array {
        return $this->open(
            table: $table,
            guestCount: $guestCount,
            source: TableSession::SOURCE_QR_CUSTOMER,
            actor: null
        );
    }

    public function close(
        TableSession $session,
        User $actor,
        ?string $reason = null
    ): TableSession {
        return DatabaseTransaction::run(
            function () use (
                $session,
                $actor,
                $reason
            ): TableSession {
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
                    throw new TableOperationException(
                        message: 'This table session is already closed.',
                        errorCode: 'TABLE_SESSION_NOT_OPEN'
                    );
                }

                /*
                 * Future-proof protection:
                 * active orders block session close.
                 */
                $hasActiveOrders =
                    DB::table('orders')
                    ->where(
                        'table_session_id',
                        $lockedSession->id
                    )
                    ->whereNotIn(
                        'status',
                        [
                            'COMPLETED',
                            'CANCELLED',
                            'REJECTED',
                        ]
                    )
                    ->exists();

                if ($hasActiveOrders) {
                    throw new TableOperationException(
                        message: 'This table session still has active orders.',
                        errorCode: 'TABLE_SESSION_HAS_ACTIVE_ORDERS'
                    );
                }

                /*
                 * Unpaid invoices also block close.
                 */
                $hasUnpaidInvoice =
                    DB::table('invoices')
                    ->where(
                        'table_session_id',
                        $lockedSession->id
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
                    throw new TableOperationException(
                        message: 'This table session has an unpaid invoice.',
                        errorCode: 'TABLE_SESSION_HAS_UNPAID_INVOICE'
                    );
                }

                $table =
                    RestaurantTable::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $lockedSession
                            ->table_id
                    );

                $lockedSession->fill([
                    'status' =>
                    TableSession::STATUS_CLOSED,

                    'closed_at' =>
                    now(),

                    'closed_by' =>
                    $actor->id,

                    'close_reason' =>
                    $reason,

                    'last_activity_at' =>
                    now(),
                ]);

                $lockedSession->save();

                $table->status =
                    $table->is_active
                    ? RestaurantTable::STATUS_AVAILABLE
                    : RestaurantTable::STATUS_OUT_OF_SERVICE;

                $table->save();

                $this->auditLogger
                    ->record(
                        action: 'TABLE_SESSION_CLOSED',

                        entityType: 'table_session',

                        entityId: $lockedSession->id,

                        newValues: [
                            'status' =>
                            TableSession::STATUS_CLOSED,

                            'closed_at' =>
                            $lockedSession
                                ->closed_at
                                ?->toISOString(),

                            'reason' =>
                            $reason,
                        ],

                        metadata: [
                            'table_id' =>
                            $table->id,
                        ],

                        userId: $actor->id
                    );

                return $lockedSession
                    ->refresh();
            }
        );
    }

    private function open(
        RestaurantTable $table,
        int $guestCount,
        string $source,
        ?User $actor
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $table,
                $guestCount,
                $source,
                $actor
            ): array {
                $lockedTable =
                    RestaurantTable::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $table->id
                    );

                if (! $lockedTable->is_active) {
                    throw new TableOperationException(
                        message: 'This table is inactive.',
                        errorCode: 'TABLE_INACTIVE'
                    );
                }

                if (
                    in_array(
                        $lockedTable->status,
                        [
                            RestaurantTable::STATUS_CLEANING,
                            RestaurantTable::STATUS_OUT_OF_SERVICE,
                        ],
                        true
                    )
                ) {
                    throw new TableOperationException(
                        message: 'This table is currently unavailable.',
                        errorCode: 'TABLE_UNAVAILABLE'
                    );
                }

                if (
                    $guestCount
                    > $lockedTable
                    ->capacity
                ) {
                    throw new TableOperationException(
                        message: 'Guest count exceeds the capacity of this table.',
                        errorCode: 'TABLE_CAPACITY_EXCEEDED',
                        status: 422
                    );
                }

                $existing =
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
                    ->first();

                if ($existing) {
                    return [
                        'session' =>
                        $existing,

                        'created' =>
                        false,
                    ];
                }

                $businessDay =
                    BusinessDay::query()
                    ->where(
                        'status',
                        BusinessDay::STATUS_OPEN
                    )
                    ->latest(
                        'opened_at'
                    )
                    ->lockForUpdate()
                    ->first();

                if (! $businessDay) {
                    throw new TableOperationException(
                        message: 'A restaurant business day must be opened before starting a table session.',
                        errorCode: 'BUSINESS_DAY_NOT_OPEN'
                    );
                }

                $session =
                    TableSession::query()
                    ->create([
                        'session_number' =>
                        'TS-' .
                            Str::upper(
                                (string)
                                Str::ulid()
                            ),

                        'public_token' =>
                        bin2hex(
                            random_bytes(
                                24
                            )
                        ),

                        'business_day_id' =>
                        $businessDay->id,

                        'table_id' =>
                        $lockedTable->id,

                        'guest_count' =>
                        $guestCount,

                        'opened_source' =>
                        $source,

                        'status' =>
                        TableSession::STATUS_OPEN,

                        'opened_by' =>
                        $actor?->id,

                        'opened_at' =>
                        now(),

                        'last_activity_at' =>
                        now(),
                    ]);

                $lockedTable->status =
                    RestaurantTable::STATUS_OCCUPIED;

                $lockedTable->save();

                $this->auditLogger
                    ->record(
                        action: 'TABLE_SESSION_OPENED',

                        entityType: 'table_session',

                        entityId: $session->id,

                        newValues: [
                            'table_id' =>
                            $lockedTable->id,

                            'guest_count' =>
                            $guestCount,

                            'opened_source' =>
                            $source,
                        ],

                        userId: $actor?->id
                    );

                return [
                    'session' =>
                    $session,

                    'created' =>
                    true,
                ];
            }
        );
    }
}
