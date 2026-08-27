<?php

namespace App\Services;

use App\Models\Supplier;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Str;

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
                /*
                 * supplier_code is NOT NULL and UNIQUE
                 * at database level.
                 *
                 * We therefore create the supplier using
                 * a temporary unique value, allow the
                 * database to generate the primary key,
                 * and then replace the temporary value
                 * with the permanent human-readable code.
                 *
                 * Example:
                 *
                 * SUP-000001
                 * SUP-000002
                 */
                $supplier =
                    new Supplier();

                $supplier->supplier_code =
                    'SUP-TMP-' .
                    Str::upper(
                        (string)
                        Str::ulid()
                    );

                $supplier->name =
                    $data['name'];

                $supplier->phone =
                    $data['phone']
                    ?? null;

                $supplier->email =
                    $data['email']
                    ?? null;

                $supplier->address =
                    $data['address']
                    ?? null;

                $supplier->notes =
                    $data['notes']
                    ?? null;

                /*
                 * Supplier balance is authoritative
                 * financial state.
                 *
                 * It starts at zero and is later changed
                 * only by purchasing/payment workflows.
                 */
                $supplier->current_balance =
                    0;

                $supplier->is_active =
                    $data['is_active']
                    ?? true;

                $supplier->save();

                $supplier->supplier_code =
                    sprintf(
                        'SUP-%06d',
                        $supplier->id
                    );

                $supplier->save();

                $this->auditLogger->record(
                    action: 'SUPPLIER_CREATED',

                    entityType: 'supplier',

                    entityId: $supplier->id,

                    newValues: [
                        'supplier_code' =>
                        $supplier
                            ->supplier_code,

                        'name' =>
                        $supplier->name,

                        'phone' =>
                        $supplier->phone,

                        'email' =>
                        $supplier->email,

                        'address' =>
                        $supplier->address,

                        'notes' =>
                        $supplier->notes,

                        'current_balance' =>
                        (float)
                        $supplier
                            ->current_balance,

                        'is_active' =>
                        (bool)
                        $supplier
                            ->is_active,
                    ],

                    userId: $actor->id
                );

                return $supplier
                    ->refresh();
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

                $old = [
                    'name' =>
                    $locked->name,

                    'phone' =>
                    $locked->phone,

                    'email' =>
                    $locked->email,

                    'address' =>
                    $locked->address,

                    'notes' =>
                    $locked->notes,
                ];

                /*
                 * Deliberately do NOT modify:
                 *
                 * supplier_code
                 * current_balance
                 * is_active
                 *
                 * Status has its own endpoint and
                 * current balance is controlled by
                 * purchasing/payment workflows.
                 */
                $locked->name =
                    $data['name'];

                $locked->phone =
                    $data['phone']
                    ?? null;

                $locked->email =
                    $data['email']
                    ?? null;

                $locked->address =
                    $data['address']
                    ?? null;

                $locked->notes =
                    $data['notes']
                    ?? null;

                $locked->save();

                $this->auditLogger->record(
                    action: 'SUPPLIER_UPDATED',

                    entityType: 'supplier',

                    entityId: $locked->id,

                    oldValues: $old,

                    newValues: [
                        'name' =>
                        $locked->name,

                        'phone' =>
                        $locked->phone,

                        'email' =>
                        $locked->email,

                        'address' =>
                        $locked->address,

                        'notes' =>
                        $locked->notes,
                    ],

                    userId: $actor->id
                );

                return $locked
                    ->refresh();
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
                    (bool)
                    $locked
                        ->is_active;

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

                return $locked
                    ->refresh();
            }
        );
    }
}
