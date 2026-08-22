<?php

namespace App\Services;

use App\Exceptions\RecipeOperationException;
use App\Models\Addon;
use App\Models\AddonRecipeComponent;
use App\Models\Ingredient;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\RecipeComponent;
use Illuminate\Support\Facades\DB;

final class RecipeRequirementService
{
    public function __construct(
        private readonly UnitConversionService $unitConversionService
    ) {}

    public function build(
        MenuItem $menuItem,
        ?MenuItemVariant $variant = null,
        array $selectedAddons = [],
        int $itemQuantity = 1
    ): array {
        if ($itemQuantity < 1) {
            throw new RecipeOperationException(
                message: 'Menu item quantity must be at least one.',

                errorCode: 'INVALID_ITEM_QUANTITY',

                status: 422
            );
        }

        $this->assertVariant(
            $menuItem,
            $variant
        );

        $requirements =
            [];

        $uncostedIngredients =
            [];

        $baseRecipeCost =
            0.0;

        $addonRecipeCost =
            0.0;

        $addonSellingTotal =
            0.0;

        /*
        |--------------------------------------------------------------------------
        | Base / Variant Recipe
        |--------------------------------------------------------------------------
        */

        $recipeQuery =
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
            $recipeQuery->where(
                'variant_id',
                $variant->id
            );
        } else {
            $recipeQuery->whereNull(
                'variant_id'
            );
        }

        $recipeComponents =
            $recipeQuery
            ->orderBy('id')
            ->get();

        if ($recipeComponents->isEmpty()) {
            throw new RecipeOperationException(
                message: $variant
                    ? "Recipe is not configured for variant {$variant->name}."
                    : "Recipe is not configured for {$menuItem->name}.",

                errorCode: 'MENU_RECIPE_NOT_CONFIGURED',

                status: 422
            );
        }

        foreach (
            $recipeComponents as $component
        ) {
            $ingredient =
                $component->ingredient;

            $unit =
                $component->unit;

            if (
                ! $ingredient
                || ! $ingredient->baseUnit
                || ! $unit
            ) {
                throw new RecipeOperationException(
                    message: 'A menu recipe component is invalid.',

                    errorCode: 'MENU_RECIPE_COMPONENT_INVALID',

                    status: 500
                );
            }

            /*
             * Recipe quantity multiplied by
             * ordered item quantity.
             */
            $recipeQuantity =
                (float)
                $component->quantity
                * $itemQuantity;

            $baseQuantity =
                $this
                ->unitConversionService
                ->convert(
                    quantity: $recipeQuantity,

                    fromUnit: $unit,

                    toUnit: $ingredient
                        ->baseUnit
                );

            $averageCost =
                (float)
                $ingredient
                    ->average_cost;

            $componentCost =
                $baseQuantity
                * $averageCost;

            $baseRecipeCost +=
                $componentCost;

            if ($averageCost <= 0) {
                $uncostedIngredients[] =
                    $ingredient->name;
            }

            $this->addRequirement(
                requirements: $requirements,

                ingredient: $ingredient,

                baseQuantity: $baseQuantity,

                source: [
                    'type' =>
                    $variant
                        ? 'VARIANT_RECIPE'
                        : 'BASE_RECIPE',

                    'name' =>
                    $variant
                        ? $variant->name
                        : $menuItem->name,

                    'quantity' =>
                    $baseQuantity,
                ]
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Add-ons
        |--------------------------------------------------------------------------
        */

        $addonBreakdown =
            [];

        foreach (
            $selectedAddons as $selection
        ) {
            $addonId =
                (int)
                $selection['addon_id'];

            $addonQuantity =
                (int)
                $selection['quantity'];

            /** @var Addon|null $addon */
            $addon =
                Addon::query()
                ->with([
                    'recipeComponents.ingredient.baseUnit',
                    'recipeComponents.unit',
                ])
                ->find(
                    $addonId
                );

            if (! $addon) {
                throw new RecipeOperationException(
                    message: 'Selected add-on does not exist.',

                    errorCode: 'ADDON_NOT_FOUND',

                    status: 422
                );
            }

            if (
                ! $addon->is_active
                || ! $addon->is_available
            ) {
                throw new RecipeOperationException(
                    message: "Add-on {$addon->name} is not currently available.",

                    errorCode: 'ADDON_NOT_AVAILABLE',

                    status: 422
                );
            }

            /*
             * Make sure the selected add-on is actually
             * configured for this menu item.
             */
            $pivot =
                DB::table(
                    'menu_item_addons'
                )
                ->where(
                    'menu_item_id',
                    $menuItem->id
                )
                ->where(
                    'addon_id',
                    $addon->id
                )
                ->first();

            if (! $pivot) {
                throw new RecipeOperationException(
                    message: "Add-on {$addon->name} is not configured for {$menuItem->name}.",

                    errorCode: 'ADDON_NOT_ALLOWED_FOR_MENU_ITEM',

                    status: 422
                );
            }

            if (
                $addon->consumes_inventory
                && $addon
                ->recipeComponents
                ->isEmpty()
            ) {
                throw new RecipeOperationException(
                    message: "Inventory recipe is missing for add-on {$addon->name}.",

                    errorCode: 'ADDON_RECIPE_NOT_CONFIGURED',

                    status: 422
                );
            }

            $addonCost =
                0.0;

            if (
                $addon->consumes_inventory
            ) {
                foreach (
                    $addon->recipeComponents
                    as $component
                ) {
                    $ingredient =
                        $component
                        ->ingredient;

                    $unit =
                        $component->unit;

                    if (
                        ! $ingredient
                        || ! $ingredient->baseUnit
                        || ! $unit
                    ) {
                        throw new RecipeOperationException(
                            message: "Recipe for add-on {$addon->name} is invalid.",

                            errorCode: 'ADDON_RECIPE_COMPONENT_INVALID',

                            status: 500
                        );
                    }

                    /*
                     * Example:
                     *
                     * Order quantity = 2
                     * Extra Chicken quantity = 1 per item
                     *
                     * 100 G × 1 × 2
                     * = 200 G
                     */
                    $recipeQuantity =
                        (float)
                        $component->quantity
                        *
                        $addonQuantity
                        *
                        $itemQuantity;

                    $baseQuantity =
                        $this
                        ->unitConversionService
                        ->convert(
                            quantity: $recipeQuantity,

                            fromUnit: $unit,

                            toUnit: $ingredient
                                ->baseUnit
                        );

                    $averageCost =
                        (float)
                        $ingredient
                            ->average_cost;

                    $componentCost =
                        $baseQuantity
                        * $averageCost;

                    $addonCost +=
                        $componentCost;

                    $addonRecipeCost +=
                        $componentCost;

                    if ($averageCost <= 0) {
                        $uncostedIngredients[] =
                            $ingredient->name;
                    }

                    $this->addRequirement(
                        requirements: $requirements,

                        ingredient: $ingredient,

                        baseQuantity: $baseQuantity,

                        source: [
                            'type' =>
                            'ADDON',

                            'addon_id' =>
                            $addon->id,

                            'name' =>
                            $addon->name,

                            'quantity' =>
                            $baseQuantity,
                        ]
                    );
                }
            }

            $effectivePrice =
                $pivot->price_override
                !== null
                ? (float)
                $pivot->price_override
                : (float)
                $addon->price;

            $sellingSubtotal =
                $effectivePrice
                *
                $addonQuantity
                *
                $itemQuantity;

            $addonSellingTotal +=
                $sellingSubtotal;

            $addonBreakdown[] = [
                'addon_id' =>
                $addon->id,

                'name' =>
                $addon->name,

                'consumes_inventory' =>
                (bool)
                $addon
                    ->consumes_inventory,

                'quantity_per_item' =>
                $addonQuantity,

                'item_quantity' =>
                $itemQuantity,

                'effective_unit_price' =>
                round(
                    $effectivePrice,
                    2
                ),

                'selling_subtotal' =>
                round(
                    $sellingSubtotal,
                    2
                ),

                'estimated_ingredient_cost' =>
                round(
                    $addonCost,
                    2
                ),
            ];
        }

        /*
        |--------------------------------------------------------------------------
        | Final Aggregated Requirements
        |--------------------------------------------------------------------------
        */

        $requirementRows =
            collect(
                $requirements
            )
            ->map(
                function (
                    array $row
                ): array {
                    $required =
                        round(
                            $row['required_quantity'],
                            4
                        );

                    $current =
                        (float)
                        $row['ingredient']
                            ->current_stock;

                    $enough =
                        $current
                        + 0.000001
                        >= $required;

                    return [
                        'ingredient_id' =>
                        $row['ingredient']->id,

                        'sku' =>
                        $row['ingredient']->sku,

                        'name' =>
                        $row['ingredient']->name,

                        'base_unit' => [
                            'id' =>
                            $row['ingredient']
                                ->baseUnit
                                ->id,

                            'symbol' =>
                            $row['ingredient']
                                ->baseUnit
                                ->symbol,
                        ],

                        'required_quantity' =>
                        $required,

                        'current_stock' =>
                        $current,

                        'average_cost' =>
                        (float)
                        $row['ingredient']
                            ->average_cost,

                        'estimated_cost' =>
                        round(
                            $required
                                *
                                (float)
                                $row['ingredient']
                                    ->average_cost,
                            2
                        ),

                        'enough_stock' =>
                        $enough,

                        'shortage_quantity' =>
                        $enough
                            ? 0
                            : round(
                                $required
                                    - $current,
                                4
                            ),

                        'sources' =>
                        $row['sources'],
                    ];
                }
            )
            ->sortBy('name')
            ->values()
            ->all();

        $baseSellingPrice =
            (
                $variant
                ? (float)
                $variant->price
                : (float)
                $menuItem->price
            )
            * $itemQuantity;

        $totalSellingPrice =
            round(
                $baseSellingPrice
                    + $addonSellingTotal,
                2
            );

        $totalRecipeCost =
            round(
                $baseRecipeCost
                    + $addonRecipeCost,
                2
            );

        $grossMargin =
            round(
                $totalSellingPrice
                    - $totalRecipeCost,
                2
            );

        $grossMarginPercentage =
            $totalSellingPrice > 0
            ? round(
                (
                    $grossMargin
                    / $totalSellingPrice
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

            'item_quantity' =>
            $itemQuantity,

            'addons' =>
            $addonBreakdown,

            'requirements' =>
            $requirementRows,

            'has_sufficient_stock' =>
            collect(
                $requirementRows
            )->every(
                fn(
                    array $row
                ): bool =>
                $row['enough_stock']
            ),

            'costing' => [
                'base_recipe_cost' =>
                round(
                    $baseRecipeCost,
                    2
                ),

                'addon_recipe_cost' =>
                round(
                    $addonRecipeCost,
                    2
                ),

                'total_recipe_cost' =>
                $totalRecipeCost,

                'base_selling_price' =>
                round(
                    $baseSellingPrice,
                    2
                ),

                'addon_selling_price' =>
                round(
                    $addonSellingTotal,
                    2
                ),

                'total_selling_price' =>
                $totalSellingPrice,

                'gross_margin' =>
                $grossMargin,

                'gross_margin_percentage' =>
                $grossMarginPercentage,

                'cost_complete' =>
                $uncostedIngredients
                    === [],

                'uncosted_ingredients' =>
                $uncostedIngredients,
            ],
        ];
    }

    private function addRequirement(
        array &$requirements,
        Ingredient $ingredient,
        float $baseQuantity,
        array $source
    ): void {
        $id =
            $ingredient->id;

        if (
            ! isset(
                $requirements[$id]
            )
        ) {
            $requirements[$id] = [
                'ingredient' =>
                $ingredient,

                'required_quantity' =>
                0.0,

                'sources' =>
                [],
            ];
        }

        $requirements[$id]['required_quantity'] +=
            $baseQuantity;

        $requirements[$id]['sources'][] =
            $source;
    }

    private function assertVariant(
        MenuItem $menuItem,
        ?MenuItemVariant $variant
    ): void {
        if (
            $variant
            && $variant
            ->menu_item_id
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
