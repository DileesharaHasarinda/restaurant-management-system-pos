<?php

namespace App\Services;

use App\Exceptions\InventoryOperationException;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\User;

final class MenuInventoryConsumptionService
{
    public function __construct(
        private readonly RecipeRequirementService $requirementService,
        private readonly InventoryStockService $inventoryStockService
    ) {}

    public function consume(
        User $actor,
        MenuItem $menuItem,
        ?MenuItemVariant $variant,
        array $selectedAddons,
        int $itemQuantity,
        string $movementKeyPrefix,
        string $sourceType,
        int $sourceId,
        ?string $reference = null,
        ?string $notes = null,
        ?int $businessDayId = null
    ): array {
        /*
         * Calculate BASE/VARIANT + ADD-ONS
         * before touching inventory.
         */
        $requirements =
            $this
            ->requirementService
            ->build(
                menuItem: $menuItem,

                variant: $variant,

                selectedAddons: $selectedAddons,

                itemQuantity: $itemQuantity
            );

        if (
            ! $requirements['has_sufficient_stock']
        ) {
            throw new InventoryOperationException(
                message: 'There is insufficient ingredient stock to prepare this item.',

                errorCode: 'INSUFFICIENT_RECIPE_STOCK',

                status: 409
            );
        }

        $lines =
            collect(
                $requirements['requirements']
            )
            ->map(
                fn(
                    array $requirement
                ): array => [
                    'ingredient_id' =>
                    $requirement['ingredient_id'],

                    'quantity' =>
                    $requirement['required_quantity'],
                ]
            )
            ->values()
            ->all();

        $movements =
            $this
            ->inventoryStockService
            ->consumeSaleBatch(
                actor: $actor,

                requirements: $lines,

                movementKeyPrefix: $movementKeyPrefix,

                sourceType: $sourceType,

                sourceId: $sourceId,

                reference: $reference,

                notes: $notes,

                businessDayId: $businessDayId
            );

        return [
            'requirements' =>
            $requirements,

            'stock_movements' =>
            $movements,
        ];
    }
}
