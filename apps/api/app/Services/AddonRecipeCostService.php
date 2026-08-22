<?php

namespace App\Services;

use App\Exceptions\RecipeOperationException;
use App\Models\Addon;
use App\Models\AddonRecipeComponent;

final class AddonRecipeCostService
{
    public function __construct(
        private readonly UnitConversionService $unitConversionService
    ) {}

    public function build(
        Addon $addon
    ): array {
        $components =
            AddonRecipeComponent::query()
            ->with([
                'ingredient.baseUnit',
                'unit',
            ])
            ->where(
                'addon_id',
                $addon->id
            )
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
                    AddonRecipeComponent $component
                ) use (
                    &$recipeCost,
                    &$uncostedIngredients
                ): array {
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
                            message: 'An add-on recipe component is not configured correctly.',

                            errorCode: 'ADDON_RECIPE_COMPONENT_INVALID',

                            status: 500
                        );
                    }

                    $baseQuantity =
                        $this
                        ->unitConversionService
                        ->convert(
                            quantity: (float)
                            $component->quantity,

                            fromUnit: $unit,

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

                            'average_cost' =>
                            $averageCost,

                            'current_stock' =>
                            (float)
                            $ingredient
                                ->current_stock,

                            'base_unit' => [
                                'id' =>
                                $ingredient
                                    ->baseUnit
                                    ->id,

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
                            $unit->id,

                            'name' =>
                            $unit->name,

                            'symbol' =>
                            $unit->symbol,
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
                $addon->price,
                2
            );

        $grossMargin =
            round(
                $sellingPrice
                    - $recipeCost,
                2
            );

        $marginPercentage =
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

            'addon' => [
                'id' =>
                $addon->id,

                'name' =>
                $addon->name,

                'sku' =>
                $addon->sku,

                'consumes_inventory' =>
                (bool)
                $addon
                    ->consumes_inventory,
            ],

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
                $marginPercentage,

                'cost_complete' =>
                $uncostedIngredients
                    === [],

                'uncosted_ingredients' =>
                $uncostedIngredients,
            ],
        ];
    }
}
