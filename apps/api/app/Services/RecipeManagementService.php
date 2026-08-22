<?php

namespace App\Services;

use App\Exceptions\RecipeOperationException;
use App\Models\Ingredient;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\RecipeComponent;
use App\Models\Unit;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class RecipeManagementService
{
    public function __construct(
        private readonly UnitConversionService $unitConversionService,
        private readonly RecipeCostService $recipeCostService,
        private readonly AuditLogger $auditLogger
    ) {}

    public function save(
        User $actor,
        MenuItem $menuItem,
        ?MenuItemVariant $variant,
        array $components
    ): array {
        $this->assertVariant(
            $menuItem,
            $variant
        );

        /*
         * Validate every component before deleting
         * the existing recipe.
         */
        $validatedComponents =
            $this->validateComponents(
                $components
            );

        DatabaseTransaction::run(
            function () use (
                $actor,
                $menuItem,
                $variant,
                $validatedComponents
            ): void {
                $query =
                    RecipeComponent::query()
                    ->where(
                        'menu_item_id',
                        $menuItem->id
                    );

                if ($variant) {
                    $query->where(
                        'variant_id',
                        $variant->id
                    );
                } else {
                    $query->whereNull(
                        'variant_id'
                    );
                }

                $oldRecipe =
                    $query
                    ->get()
                    ->map(
                        fn(
                            RecipeComponent $component
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

                /*
                 * Recipes are definitions, not inventory
                 * ledger entries. Replacing current recipe
                 * rows is safe because previous stock
                 * movements remain immutable.
                 */
                $query->delete();

                foreach (
                    $validatedComponents
                    as $component
                ) {
                    RecipeComponent::query()
                        ->create([
                            'menu_item_id' =>
                            $menuItem->id,

                            'variant_id' =>
                            $variant?->id,

                            'ingredient_id' =>
                            $component['ingredient_id'],

                            'quantity' =>
                            $component['quantity'],

                            'unit_id' =>
                            $component['unit_id'],
                        ]);
                }

                $this->auditLogger->record(
                    action: 'RECIPE_UPDATED',

                    entityType: $variant
                        ? 'menu_item_variant_recipe'
                        : 'menu_item_recipe',

                    entityId: $variant?->id
                        ?? $menuItem->id,

                    oldValues: $oldRecipe,

                    newValues: $validatedComponents,

                    userId: $actor->id
                );
            }
        );

        return $this
            ->recipeCostService
            ->build(
                $menuItem,
                $variant
            );
    }

    public function clear(
        User $actor,
        MenuItem $menuItem,
        ?MenuItemVariant $variant
    ): array {
        $this->assertVariant(
            $menuItem,
            $variant
        );

        DatabaseTransaction::run(
            function () use (
                $actor,
                $menuItem,
                $variant
            ): void {
                $query =
                    RecipeComponent::query()
                    ->where(
                        'menu_item_id',
                        $menuItem->id
                    );

                if ($variant) {
                    $query->where(
                        'variant_id',
                        $variant->id
                    );
                } else {
                    $query->whereNull(
                        'variant_id'
                    );
                }

                $oldRecipe =
                    $query
                    ->get()
                    ->map(
                        fn(
                            RecipeComponent $component
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

                $query->delete();

                $this->auditLogger->record(
                    action: 'RECIPE_CLEARED',

                    entityType: $variant
                        ? 'menu_item_variant_recipe'
                        : 'menu_item_recipe',

                    entityId: $variant?->id
                        ?? $menuItem->id,

                    oldValues: $oldRecipe,

                    newValues: [],

                    userId: $actor->id
                );
            }
        );

        return $this
            ->recipeCostService
            ->build(
                $menuItem,
                $variant
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
                ->with(
                    'baseUnit'
                )
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

                    errorCode: 'RECIPE_INGREDIENT_INVALID',

                    status: 422
                );
            }

            if (! $ingredient->baseUnit) {
                throw new RecipeOperationException(
                    message: "Ingredient {$ingredient->name} does not have a base unit.",

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
                    message: "Recipe unit at row {$index} is inactive or does not exist.",

                    errorCode: 'RECIPE_UNIT_INVALID',

                    status: 422
                );
            }

            /*
             * Validate physical compatibility.
             *
             * Rice:
             * G  ✅
             * KG ✅
             * ML ❌
             */
            try {
                $this
                    ->unitConversionService
                    ->convert(
                        quantity: 1,

                        fromUnit: $unit,

                        toUnit: $ingredient
                            ->baseUnit
                    );
            } catch (\Throwable) {
                throw new RecipeOperationException(
                    message: sprintf(
                        'Unit %s cannot be used for ingredient %s, whose base unit is %s.',
                        $unit->symbol,
                        $ingredient->name,
                        $ingredient
                            ->baseUnit
                            ->symbol
                    ),

                    errorCode: 'RECIPE_UNIT_INCOMPATIBLE',

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

    private function assertVariant(
        MenuItem $menuItem,
        ?MenuItemVariant $variant
    ): void {
        if (
            $variant
            && $variant->menu_item_id
            !== $menuItem->id
        ) {
            throw new RecipeOperationException(
                message: 'The selected variant does not belong to this menu item.',

                errorCode: 'VARIANT_MENU_ITEM_MISMATCH',

                status: 422
            );
        }
    }
}
