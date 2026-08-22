<?php

namespace App\Services;

use App\Exceptions\RecipeOperationException;
use App\Models\Addon;
use App\Models\AddonRecipeComponent;
use App\Models\Ingredient;
use App\Models\Unit;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Throwable;

final class AddonRecipeManagementService
{
    public function __construct(
        private readonly UnitConversionService $unitConversionService,
        private readonly AddonRecipeCostService $costService,
        private readonly AuditLogger $auditLogger
    ) {}

    public function save(
        User $actor,
        Addon $addon,
        array $components
    ): array {
        $validated =
            $this->validateComponents(
                $components
            );

        DatabaseTransaction::run(
            function () use (
                $actor,
                $addon,
                $validated
            ): void {
                $old =
                    AddonRecipeComponent::query()
                    ->where(
                        'addon_id',
                        $addon->id
                    )
                    ->get()
                    ->map(
                        fn(
                            AddonRecipeComponent $component
                        ): array => [
                            'ingredient_id' =>
                            $component
                                ->ingredient_id,

                            'quantity' =>
                            $component
                                ->quantity,

                            'unit_id' =>
                            $component
                                ->unit_id,
                        ]
                    )
                    ->values()
                    ->all();

                AddonRecipeComponent::query()
                    ->where(
                        'addon_id',
                        $addon->id
                    )
                    ->delete();

                foreach (
                    $validated as $component
                ) {
                    AddonRecipeComponent::query()
                        ->create([
                            'addon_id' =>
                            $addon->id,

                            'ingredient_id' =>
                            $component['ingredient_id'],

                            'quantity' =>
                            $component['quantity'],

                            'unit_id' =>
                            $component['unit_id'],
                        ]);
                }

                /*
                 * A configured recipe means this
                 * add-on participates in inventory.
                 */
                $addon->consumes_inventory =
                    true;

                $addon->save();

                $this->auditLogger->record(
                    action: 'ADDON_RECIPE_UPDATED',

                    entityType: 'addon_recipe',

                    entityId: $addon->id,

                    oldValues: $old,

                    newValues: $validated,

                    userId: $actor->id
                );
            }
        );

        return $this
            ->costService
            ->build(
                $addon->refresh()
            );
    }

    public function clear(
        User $actor,
        Addon $addon
    ): array {
        DatabaseTransaction::run(
            function () use (
                $actor,
                $addon
            ): void {
                $old =
                    AddonRecipeComponent::query()
                    ->where(
                        'addon_id',
                        $addon->id
                    )
                    ->get()
                    ->map(
                        fn(
                            AddonRecipeComponent $component
                        ): array => [
                            'ingredient_id' =>
                            $component
                                ->ingredient_id,

                            'quantity' =>
                            $component
                                ->quantity,

                            'unit_id' =>
                            $component
                                ->unit_id,
                        ]
                    )
                    ->values()
                    ->all();

                AddonRecipeComponent::query()
                    ->where(
                        'addon_id',
                        $addon->id
                    )
                    ->delete();

                $addon->consumes_inventory =
                    false;

                $addon->save();

                $this->auditLogger->record(
                    action: 'ADDON_RECIPE_CLEARED',

                    entityType: 'addon_recipe',

                    entityId: $addon->id,

                    oldValues: $old,

                    newValues: [],

                    userId: $actor->id
                );
            }
        );

        return $this
            ->costService
            ->build(
                $addon->refresh()
            );
    }

    private function validateComponents(
        array $components
    ): array {
        $validated =
            [];

        foreach (
            $components as $index => $component
        ) {
            /** @var Ingredient|null $ingredient */
            $ingredient =
                Ingredient::query()
                ->with('baseUnit')
                ->where(
                    'is_active',
                    true
                )
                ->find(
                    $component['ingredient_id']
                );

            if (! $ingredient) {
                throw new RecipeOperationException(
                    message: "Ingredient at row {$index} is inactive or does not exist.",

                    errorCode: 'ADDON_RECIPE_INGREDIENT_INVALID',

                    status: 422
                );
            }

            if (! $ingredient->baseUnit) {
                throw new RecipeOperationException(
                    message: "Ingredient {$ingredient->name} has no base unit.",

                    errorCode: 'INGREDIENT_BASE_UNIT_MISSING',

                    status: 422
                );
            }

            /** @var Unit|null $unit */
            $unit =
                Unit::query()
                ->where(
                    'is_active',
                    true
                )
                ->find(
                    $component['unit_id']
                );

            if (! $unit) {
                throw new RecipeOperationException(
                    message: "Unit at row {$index} is inactive or does not exist.",

                    errorCode: 'ADDON_RECIPE_UNIT_INVALID',

                    status: 422
                );
            }

            try {
                $this
                    ->unitConversionService
                    ->convert(
                        quantity: 1,

                        fromUnit: $unit,

                        toUnit: $ingredient
                            ->baseUnit
                    );
            } catch (Throwable) {
                throw new RecipeOperationException(
                    message: sprintf(
                        'Unit %s cannot be used for ingredient %s, whose base unit is %s.',
                        $unit->symbol,
                        $ingredient->name,
                        $ingredient
                            ->baseUnit
                            ->symbol
                    ),

                    errorCode: 'ADDON_RECIPE_UNIT_INCOMPATIBLE',

                    status: 422
                );
            }

            $validated[] = [
                'ingredient_id' =>
                $ingredient->id,

                'quantity' =>
                round(
                    (float)
                    $component['quantity'],
                    4
                ),

                'unit_id' =>
                $unit->id,
            ];
        }

        return $validated;
    }
}
