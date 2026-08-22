<?php

namespace App\Services;

use App\Exceptions\InventoryOperationException;
use App\Models\Unit;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class UnitManagementService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function create(
        User $actor,
        array $data
    ): Unit {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): Unit {
                $this->validateConfiguration(
                    $data
                );

                $unit =
                    Unit::query()
                    ->create([
                        'name' =>
                        $data['name'],

                        'symbol' =>
                        $data['symbol'],

                        'measurement_type' =>
                        $data['measurement_type'],

                        'base_unit_id' =>
                        $data['base_unit_id']
                            ?? null,

                        'conversion_factor' =>
                        $data['base_unit_id']
                            ?? null
                            ? $data['conversion_factor']
                            : 1,

                        'is_active' =>
                        $data['is_active']
                            ?? true,
                    ]);

                $this->auditLogger->record(
                    action: 'UNIT_CREATED',

                    entityType: 'unit',

                    entityId: $unit->id,

                    newValues: $unit->toArray(),

                    userId: $actor->id
                );

                return $unit
                    ->load(
                        'baseUnit'
                    );
            }
        );
    }

    public function update(
        User $actor,
        Unit $unit,
        array $data
    ): Unit {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $unit,
                $data
            ): Unit {
                /** @var Unit $locked */
                $locked =
                    Unit::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $unit->id
                    );

                if (
                    isset(
                        $data['base_unit_id']
                    )
                    && (int)
                    $data['base_unit_id'] === $locked->id
                ) {
                    throw new InventoryOperationException(
                        message: 'A unit cannot use itself as its base unit.',

                        errorCode: 'INVALID_BASE_UNIT',

                        status: 422
                    );
                }

                $conversionChanged =
                    (int)
                    (
                        $data['base_unit_id']
                        ?? 0
                    )
                    !== (int)
                    (
                        $locked
                        ->base_unit_id
                        ?? 0
                    )
                    ||
                    (float)
                    $data['conversion_factor']
                    !== (float)
                    $locked
                        ->conversion_factor;

                if (
                    $conversionChanged
                    && (
                        $locked
                        ->ingredients()
                        ->exists()
                        ||
                        $locked
                        ->derivedUnits()
                        ->exists()
                    )
                ) {
                    throw new InventoryOperationException(
                        message: 'The conversion of a unit already used by inventory cannot be changed.',

                        errorCode: 'UNIT_ALREADY_IN_USE'
                    );
                }

                $this->validateConfiguration(
                    $data
                );

                $old =
                    $locked
                    ->toArray();

                $locked->fill([
                    'name' =>
                    $data['name'],

                    'symbol' =>
                    $data['symbol'],

                    'measurement_type' =>
                    $data['measurement_type'],

                    'base_unit_id' =>
                    $data['base_unit_id']
                        ?? null,

                    'conversion_factor' =>
                    $data['base_unit_id']
                        ?? null
                        ? $data['conversion_factor']
                        : 1,
                ]);

                $locked->save();

                $this->auditLogger->record(
                    action: 'UNIT_UPDATED',

                    entityType: 'unit',

                    entityId: $locked->id,

                    oldValues: $old,

                    newValues: $locked
                        ->fresh()
                        ->toArray(),

                    userId: $actor->id
                );

                return $locked
                    ->refresh()
                    ->load(
                        'baseUnit'
                    );
            }
        );
    }

    public function updateStatus(
        User $actor,
        Unit $unit,
        bool $active
    ): Unit {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $unit,
                $active
            ): Unit {
                /** @var Unit $locked */
                $locked =
                    Unit::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $unit->id
                    );

                if (
                    ! $active
                    && (
                        $locked
                        ->ingredients()
                        ->where(
                            'is_active',
                            true
                        )
                        ->exists()
                        ||
                        $locked
                        ->derivedUnits()
                        ->where(
                            'is_active',
                            true
                        )
                        ->exists()
                    )
                ) {
                    throw new InventoryOperationException(
                        message: 'This unit is currently used by active inventory records and cannot be deactivated.',

                        errorCode: 'UNIT_IN_USE'
                    );
                }

                $old =
                    $locked->is_active;

                $locked->is_active =
                    $active;

                $locked->save();

                $this->auditLogger->record(
                    action: 'UNIT_STATUS_UPDATED',

                    entityType: 'unit',

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
                    ->refresh()
                    ->load(
                        'baseUnit'
                    );
            }
        );
    }

    private function validateConfiguration(
        array $data
    ): void {
        $baseUnitId =
            $data['base_unit_id']
            ?? null;

        if ($baseUnitId === null) {
            return;
        }

        /** @var Unit $baseUnit */
        $baseUnit =
            Unit::query()
            ->findOrFail(
                $baseUnitId
            );

        if (! $baseUnit->is_active) {
            throw new InventoryOperationException(
                message: 'The selected base unit is inactive.',

                errorCode: 'BASE_UNIT_INACTIVE',

                status: 422
            );
        }

        if (
            $baseUnit
            ->measurement_type
            !== $data['measurement_type']
        ) {
            throw new InventoryOperationException(
                message: 'The unit and base unit must use the same measurement type.',

                errorCode: 'UNIT_MEASUREMENT_MISMATCH',

                status: 422
            );
        }
    }
}
