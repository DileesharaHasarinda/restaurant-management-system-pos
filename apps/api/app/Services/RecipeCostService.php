<?php

namespace App\Services;

use App\Exceptions\RecipeOperationException;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\RecipeComponent;

final class RecipeCostService
{
    public function __construct(
        private readonly UnitConversionService $unitConversionService
    ) {}

    public function build(
        MenuItem $menuItem,
        ?MenuItemVariant $variant = null
    ): array {
        $this->assertVariantBelongsToMenuItem(
            $menuItem,
            $variant
        );

        $query =
            RecipeComponent::query()
            ->with([
                'ingredient.baseUnit',
                'unit',
            ])
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

        $components =
            $query
            ->orderBy('id')
            ->get();

        $recipeCost =
            0.0;

        $uncostedIngredients =
            [];

        $componentData =
            $components
            ->map(
                function (
                    RecipeComponent $component
                ) use (
                    &$recipeCost,
                    &$uncostedIngredients
                ): array {
                    $ingredient =
                        $component->ingredient;

                    $recipeUnit =
                        $component->unit;

                    if (! $ingredient) {
                        throw new RecipeOperationException(
                            message: 'A recipe component contains a missing ingredient.',

                            errorCode: 'RECIPE_INGREDIENT_MISSING',

                            status: 500
                        );
                    }

                    if (! $ingredient->baseUnit) {
                        throw new RecipeOperationException(
                            message: "Ingredient {$ingredient->name} has no base unit.",

                            errorCode: 'INGREDIENT_BASE_UNIT_MISSING',

                            status: 422
                        );
                    }

                    if (! $recipeUnit) {
                        throw new RecipeOperationException(
                            message: "A recipe unit is missing for {$ingredient->name}.",

                            errorCode: 'RECIPE_UNIT_MISSING',

                            status: 500
                        );
                    }

                    /*
                         * Example:
                         *
                         * Recipe = 0.25 KG Rice
                         * Ingredient base = G
                         *
                         * Base quantity = 250 G
                         */
                    $baseQuantity =
                        $this
                        ->unitConversionService
                        ->convert(
                            quantity: (float)
                            $component->quantity,

                            fromUnit: $recipeUnit,

                            toUnit: $ingredient
                                ->baseUnit
                        );

                    $averageCost =
                        (float)
                        $ingredient
                            ->average_cost;

                    $componentCost =
                        round(
                            $baseQuantity
                                * $averageCost,
                            4
                        );

                    $recipeCost +=
                        $componentCost;

                    /*
                         * Zero average cost generally means
                         * this ingredient has not yet been
                         * properly costed through opening
                         * balance/purchases.
                         */
                    if (
                        $averageCost <= 0
                    ) {
                        $uncostedIngredients[] =
                            $ingredient->name;
                    }

                    return [
                        'id' =>
                        $component->id,

                        'ingredient' => [
                            'id' =>
                            $ingredient->id,

                            'sku' =>
                            $ingredient->sku,

                            'name' =>
                            $ingredient->name,

                            'current_stock' =>
                            (float)
                            $ingredient
                                ->current_stock,

                            'average_cost' =>
                            $averageCost,

                            'base_unit' => [
                                'id' =>
                                $ingredient
                                    ->baseUnit
                                    ->id,

                                'name' =>
                                $ingredient
                                    ->baseUnit
                                    ->name,

                                'symbol' =>
                                $ingredient
                                    ->baseUnit
                                    ->symbol,
                            ],
                        ],

                        'quantity' =>
                        (float)
                        $component->quantity,

                        'unit' => [
                            'id' =>
                            $recipeUnit->id,

                            'name' =>
                            $recipeUnit->name,

                            'symbol' =>
                            $recipeUnit->symbol,
                        ],

                        'base_quantity' =>
                        $baseQuantity,

                        'component_cost' =>
                        round(
                            $componentCost,
                            2
                        ),
                    ];
                }
            )
            ->values()
            ->all();

        $recipeCost =
            round(
                $recipeCost,
                2
            );

        $sellingPrice =
            round(
                (float)
                (
                    $variant
                    ? $variant->price
                    : $menuItem->price
                ),
                2
            );

        $grossMargin =
            round(
                $sellingPrice
                    - $recipeCost,
                2
            );

        $grossMarginPercentage =
            $sellingPrice > 0
            ? round(
                (
                    $grossMargin
                    / $sellingPrice
                ) * 100,
                2
            )
            : 0;

        $uncostedIngredients =
            array_values(
                array_unique(
                    $uncostedIngredients
                )
            );

        return [
            'configured' =>
            count($componentData) > 0,

            'menu_item' => [
                'id' =>
                $menuItem->id,

                'name' =>
                $menuItem->name,

                'sku' =>
                $menuItem->sku,
            ],

            'variant' =>
            $variant
                ? [
                    'id' =>
                    $variant->id,

                    'name' =>
                    $variant->name,

                    'sku' =>
                    $variant->sku,
                ]
                : null,

            'recipe_type' =>
            $variant
                ? 'VARIANT'
                : 'BASE',

            'components' =>
            $componentData,

            'costing' => [
                'recipe_cost' =>
                $recipeCost,

                'selling_price' =>
                $sellingPrice,

                'gross_margin' =>
                $grossMargin,

                'gross_margin_percentage' =>
                $grossMarginPercentage,

                /*
                 * false warns the UI that one or
                 * more ingredient costs are still 0.
                 */
                'cost_complete' =>
                $uncostedIngredients === [],

                'uncosted_ingredients' =>
                $uncostedIngredients,
            ],
        ];
    }

    private function assertVariantBelongsToMenuItem(
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
