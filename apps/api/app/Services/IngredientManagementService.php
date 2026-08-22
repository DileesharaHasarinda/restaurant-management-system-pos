<?php

namespace App\Services;

use App\Exceptions\InventoryOperationException;
use App\Models\Ingredient;
use App\Models\Unit;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class IngredientManagementService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function create(
        User $actor,
        array $data
    ): Ingredient {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): Ingredient {
                /** @var Unit $unit */
                $unit =
                    Unit::query()
                    ->where(
                        'is_active',
                        true
                    )
                    ->findOrFail(
                        $data['base_unit_id']
                    );

                /*
                 * Ingredient stock should preferably
                 * use the root physical unit.
                 *
                 * G instead of KG
                 * ML instead of L
                 */
                if (
                    $unit->base_unit_id
                    !== null
                ) {
                    throw new InventoryOperationException(
                        message: 'Ingredient base stock must use a root unit such as G, ML, PCS, BOTTLE or PACK.',

                        errorCode: 'INGREDIENT_UNIT_NOT_BASE',

                        status: 422
                    );
                }

                $ingredient =
                    Ingredient::query()
                    ->create([
                        'sku' =>
                        null,

                        'name' =>
                        $data['name'],

                        'base_unit_id' =>
                        $unit->id,

                        /*
                             * Never manually create
                             * inventory quantities here.
                             */
                        'current_stock' =>
                        0,

                        'reorder_level' =>
                        round(
                            (float)
                            $data['minimum_stock'],
                            4
                        ),

                        /*
                             * Purchase engine calculates
                             * this later.
                             */
                        'average_cost' =>
                        0,

                        'track_stock' =>
                        true,

                        'is_active' =>
                        $data['is_active']
                            ?? true,

                        'storage_location' =>
                        $data['storage_location']
                            ?? null,
                    ]);

                $ingredient->sku =
                    sprintf(
                        'ING-%06d',
                        $ingredient->id
                    );

                $ingredient->save();

                $this->auditLogger->record(
                    action: 'INGREDIENT_CREATED',

                    entityType: 'ingredient',

                    entityId: $ingredient->id,

                    newValues: [
                        'sku' =>
                        $ingredient->sku,

                        'name' =>
                        $ingredient->name,

                        'base_unit_id' =>
                        $ingredient
                            ->base_unit_id,

                        'minimum_stock' =>
                        $ingredient
                            ->reorder_level,

                        'is_active' =>
                        $ingredient
                            ->is_active,
                    ],

                    userId: $actor->id
                );

                return $ingredient
                    ->load(
                        'baseUnit'
                    );
            }
        );
    }

    public function update(
        User $actor,
        Ingredient $ingredient,
        array $data
    ): Ingredient {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $ingredient,
                $data
            ): Ingredient {
                /** @var Ingredient $locked */
                $locked =
                    Ingredient::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $ingredient->id
                    );

                /** @var Unit $unit */
                $unit =
                    Unit::query()
                    ->where(
                        'is_active',
                        true
                    )
                    ->findOrFail(
                        $data['base_unit_id']
                    );

                if (
                    $unit->base_unit_id
                    !== null
                ) {
                    throw new InventoryOperationException(
                        message: 'Ingredient base stock must use a root unit such as G, ML, PCS, BOTTLE or PACK.',

                        errorCode: 'INGREDIENT_UNIT_NOT_BASE',

                        status: 422
                    );
                }

                $changingBaseUnit =
                    $locked->base_unit_id
                    !== $unit->id;

                if ($changingBaseUnit) {
                    $hasHistory =
                        $locked
                        ->stockMovements()
                        ->exists();

                    $hasStock =
                        abs(
                            (float)
                            $locked
                                ->current_stock
                        ) > 0.000001;

                    if (
                        $hasHistory
                        || $hasStock
                    ) {
                        throw new InventoryOperationException(
                            message: 'The base unit cannot be changed after an ingredient has stock or movement history.',

                            errorCode: 'INGREDIENT_UNIT_LOCKED'
                        );
                    }
                }

                $oldValues = [
                    'name' =>
                    $locked->name,

                    'base_unit_id' =>
                    $locked
                        ->base_unit_id,

                    'minimum_stock' =>
                    $locked
                        ->reorder_level,

                    'storage_location' =>
                    $locked
                        ->storage_location,
                ];

                $locked->fill([
                    'name' =>
                    $data['name'],

                    'base_unit_id' =>
                    $unit->id,

                    'reorder_level' =>
                    round(
                        (float)
                        $data['minimum_stock'],
                        4
                    ),

                    'storage_location' =>
                    $data['storage_location']
                        ?? null,
                ]);

                /*
                 * current_stock and average_cost
                 * are deliberately untouched.
                 */

                $locked->save();

                $this->auditLogger->record(
                    action: 'INGREDIENT_UPDATED',

                    entityType: 'ingredient',

                    entityId: $locked->id,

                    oldValues: $oldValues,

                    newValues: [
                        'name' =>
                        $locked->name,

                        'base_unit_id' =>
                        $locked
                            ->base_unit_id,

                        'minimum_stock' =>
                        $locked
                            ->reorder_level,

                        'storage_location' =>
                        $locked
                            ->storage_location,
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

    public function updateStatus(
        User $actor,
        Ingredient $ingredient,
        bool $active
    ): Ingredient {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $ingredient,
                $active
            ): Ingredient {
                /** @var Ingredient $locked */
                $locked =
                    Ingredient::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $ingredient->id
                    );

                $old =
                    $locked
                    ->is_active;

                $locked->is_active =
                    $active;

                $locked->save();

                $this->auditLogger->record(
                    action: 'INGREDIENT_STATUS_UPDATED',

                    entityType: 'ingredient',

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
}
