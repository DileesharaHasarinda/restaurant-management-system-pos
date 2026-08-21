<?php

namespace App\Services;

use App\Exceptions\TableOperationException;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class TableManagementService
{
    public function __construct(
        private readonly TableQrCodeService $qrCodeService,
        private readonly AuditLogger $auditLogger
    ) {}

    public function create(
        User $actor,
        array $data
    ): RestaurantTable {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): RestaurantTable {
                $number =
                    (int)
                    $data['table_number'];

                $table =
                    RestaurantTable::query()
                    ->create([
                        'table_number' =>
                        $number,

                        'code' =>
                        $this
                            ->codeForNumber(
                                $number
                            ),

                        'name' =>
                        $this
                            ->nameForTable(
                                $number,
                                $data['name']
                                    ?? null
                            ),

                        'area' =>
                        $data['area']
                            ?? null,

                        'capacity' =>
                        $data['capacity'],

                        'status' =>
                        RestaurantTable::STATUS_AVAILABLE,

                        'qr_ordering_enabled' =>
                        $data['qr_ordering_enabled']
                            ?? true,

                        'sort_order' =>
                        $number,

                        'is_active' =>
                        true,

                        'notes' =>
                        $data['notes']
                            ?? null,
                    ]);

                $this
                    ->qrCodeService
                    ->createToken(
                        $table,
                        $actor
                    );

                $this->auditLogger
                    ->record(
                        action: 'TABLE_CREATED',

                        entityType: 'table',

                        entityId: $table->id,

                        newValues: $table
                            ->toArray(),

                        userId: $actor->id
                    );

                return $table
                    ->load([
                        'activeQrToken',
                        'openSession',
                    ]);
            }
        );
    }

    public function update(
        User $actor,
        RestaurantTable $table,
        array $data
    ): RestaurantTable {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $table,
                $data
            ): RestaurantTable {
                $locked =
                    RestaurantTable::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $table->id
                    );

                $openSession =
                    $locked
                    ->sessions()
                    ->where(
                        'status',
                        'OPEN'
                    )
                    ->exists();

                if (
                    $openSession
                    && ! $data['is_active']
                ) {
                    throw new TableOperationException(
                        message: 'A table with an open session cannot be deactivated.',
                        errorCode: 'TABLE_HAS_OPEN_SESSION'
                    );
                }

                $oldValues =
                    $locked->toArray();

                $number =
                    (int)
                    $data['table_number'];

                $locked->fill([
                    'table_number' =>
                    $number,

                    'code' =>
                    $this
                        ->codeForNumber(
                            $number
                        ),

                    'name' =>
                    $this
                        ->nameForTable(
                            $number,
                            $data['name']
                                ?? null
                        ),

                    'area' =>
                    $data['area']
                        ?? null,

                    'capacity' =>
                    $data['capacity'],

                    'sort_order' =>
                    $number,

                    'is_active' =>
                    $data['is_active'],

                    'notes' =>
                    $data['notes']
                        ?? null,
                ]);

                if (
                    ! $locked
                        ->is_active
                ) {
                    $locked->status =
                        RestaurantTable::STATUS_OUT_OF_SERVICE;

                    $locked
                        ->qr_ordering_enabled =
                        false;
                }

                $locked->save();

                $this->auditLogger
                    ->record(
                        action: 'TABLE_UPDATED',

                        entityType: 'table',

                        entityId: $locked->id,

                        oldValues: $oldValues,

                        newValues: $locked
                            ->fresh()
                            ->toArray(),

                        userId: $actor->id
                    );

                return $locked
                    ->refresh()
                    ->load([
                        'activeQrToken',
                        'openSession',
                    ]);
            }
        );
    }

    public function updateStatus(
        User $actor,
        RestaurantTable $table,
        string $status
    ): RestaurantTable {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $table,
                $status
            ): RestaurantTable {
                $locked =
                    RestaurantTable::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $table->id
                    );

                if (
                    $locked
                    ->sessions()
                    ->where(
                        'status',
                        'OPEN'
                    )
                    ->exists()
                ) {
                    throw new TableOperationException(
                        message: 'Table status cannot be changed manually while a table session is open.',
                        errorCode: 'TABLE_HAS_OPEN_SESSION'
                    );
                }

                if (
                    ! $locked->is_active
                    && $status
                    !== RestaurantTable::STATUS_OUT_OF_SERVICE
                ) {
                    throw new TableOperationException(
                        message: 'Activate the table before changing its status.',
                        errorCode: 'TABLE_INACTIVE'
                    );
                }

                $oldStatus =
                    $locked->status;

                $locked->status =
                    $status;

                $locked->save();

                $this->auditLogger
                    ->record(
                        action: 'TABLE_STATUS_UPDATED',

                        entityType: 'table',

                        entityId: $locked->id,

                        oldValues: [
                            'status' =>
                            $oldStatus,
                        ],

                        newValues: [
                            'status' =>
                            $status,
                        ],

                        userId: $actor->id
                    );

                return $locked
                    ->refresh()
                    ->load([
                        'activeQrToken',
                        'openSession',
                    ]);
            }
        );
    }

    public function setQrOrdering(
        User $actor,
        RestaurantTable $table,
        bool $enabled
    ): RestaurantTable {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $table,
                $enabled
            ): RestaurantTable {
                $locked =
                    RestaurantTable::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $table->id
                    );

                if (
                    $enabled
                    && ! $locked
                        ->is_active
                ) {
                    throw new TableOperationException(
                        message: 'QR ordering cannot be enabled for an inactive table.',
                        errorCode: 'TABLE_INACTIVE'
                    );
                }

                $oldValue =
                    $locked
                    ->qr_ordering_enabled;

                $locked
                    ->qr_ordering_enabled =
                    $enabled;

                $locked->save();

                if ($enabled) {
                    $this
                        ->qrCodeService
                        ->ensureActiveToken(
                            $locked,
                            $actor
                        );
                }

                $this->auditLogger
                    ->record(
                        action: $enabled
                            ? 'TABLE_QR_ORDERING_ENABLED'
                            : 'TABLE_QR_ORDERING_DISABLED',

                        entityType: 'table',

                        entityId: $locked->id,

                        oldValues: [
                            'qr_ordering_enabled' =>
                            $oldValue,
                        ],

                        newValues: [
                            'qr_ordering_enabled' =>
                            $enabled,
                        ],

                        userId: $actor->id
                    );

                return $locked
                    ->refresh()
                    ->load([
                        'activeQrToken',
                        'openSession',
                    ]);
            }
        );
    }

    private function codeForNumber(
        int $number
    ): string {
        return sprintf(
            'TBL-%03d',
            $number
        );
    }

    private function nameForTable(
        int $number,
        ?string $name
    ): string {
        $name =
            trim(
                (string) $name
            );

        if ($name !== '') {
            return $name;
        }

        return sprintf(
            'Table %02d',
            $number
        );
    }
}
