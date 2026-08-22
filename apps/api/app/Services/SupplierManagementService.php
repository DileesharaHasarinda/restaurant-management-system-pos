<?php

namespace App\Services;

use App\Models\Supplier;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class SupplierManagementService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function create(
        User $actor,
        array $data
    ): Supplier {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): Supplier {
                $supplier =
                    Supplier::query()
                    ->create([
                        'name' =>
                        $data['name'],

                        'phone' =>
                        $data['phone']
                            ?? null,

                        'email' =>
                        $data['email']
                            ?? null,

                        'address' =>
                        $data['address']
                            ?? null,

                        'notes' =>
                        $data['notes']
                            ?? null,

                        'current_balance' =>
                        0,

                        'is_active' =>
                        $data['is_active']
                            ?? true,
                    ]);

                $this->auditLogger->record(
                    action: 'SUPPLIER_CREATED',

                    entityType: 'supplier',

                    entityId: $supplier->id,

                    newValues: $supplier->toArray(),

                    userId: $actor->id
                );

                return $supplier;
            }
        );
    }

    public function update(
        User $actor,
        Supplier $supplier,
        array $data
    ): Supplier {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $supplier,
                $data
            ): Supplier {
                /** @var Supplier $locked */
                $locked =
                    Supplier::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $supplier->id
                    );

                $old =
                    $locked->only([
                        'name',
                        'phone',
                        'email',
                        'address',
                        'notes',
                    ]);

                $locked->fill([
                    'name' =>
                    $data['name'],

                    'phone' =>
                    $data['phone']
                        ?? null,

                    'email' =>
                    $data['email']
                        ?? null,

                    'address' =>
                    $data['address']
                        ?? null,

                    'notes' =>
                    $data['notes']
                        ?? null,
                ]);

                $locked->save();

                $this->auditLogger->record(
                    action: 'SUPPLIER_UPDATED',

                    entityType: 'supplier',

                    entityId: $locked->id,

                    oldValues: $old,

                    newValues: $locked->only([
                        'name',
                        'phone',
                        'email',
                        'address',
                        'notes',
                    ]),

                    userId: $actor->id
                );

                return $locked->refresh();
            }
        );
    }

    public function updateStatus(
        User $actor,
        Supplier $supplier,
        bool $active
    ): Supplier {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $supplier,
                $active
            ): Supplier {
                /** @var Supplier $locked */
                $locked =
                    Supplier::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $supplier->id
                    );

                $old =
                    $locked->is_active;

                $locked->is_active =
                    $active;

                $locked->save();

                $this->auditLogger->record(
                    action: 'SUPPLIER_STATUS_UPDATED',

                    entityType: 'supplier',

                    entityId: $locked->id,

                    oldValues: [
                        'is_active' =>
                        $old,
                    ],

                    newValues: [
                        'is_active' =>
                        $active,
                    ],

                    userId: $actor->id
                );

                return $locked->refresh();
            }
        );
    }
}
