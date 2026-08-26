<?php

namespace App\Services;

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
        |--------------------------------------------------------------------------
        | Build Recipe Requirements
        |--------------------------------------------------------------------------
        |
        | RecipeRequirementService calculates the required base-unit quantities.
        |
        | IMPORTANT:
        |
        | We intentionally DO NOT reject based only on
        | "has_sufficient_stock" here.
        |
        | That value is useful for previews/UI, but it is not safe enough for
        | the actual mutation because stock could change immediately afterward.
        |
        | InventoryStockService::consumeSaleBatch() performs the authoritative
        | check while ingredient rows are locked.
        |
        | It also checks existing movement keys BEFORE checking current stock,
        | which means an already-completed duplicate request remains safely
        | idempotent even if current stock is now lower.
        |
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

        $lines =
            collect(
                $requirements['requirements']
            )
            ->map(
                fn(
                    array $requirement
                ): array => [
                    'ingredient_id' =>
                    (int)
                    $requirement['ingredient_id'],

                    'quantity' =>
                    (float)
                    $requirement['required_quantity'],
                ]
            )
            ->values()
            ->all();

        /*
        |--------------------------------------------------------------------------
        | Authoritative Inventory Mutation
        |--------------------------------------------------------------------------
        |
        | consumeSaleBatch():
        |
        | - locks ingredients
        | - re-checks deterministic movement keys
        | - prevents partial duplicate states
        | - checks ALL ingredient stock
        | - deducts atomically
        | - creates immutable SALE_CONSUMPTION movements
        |
        */

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
