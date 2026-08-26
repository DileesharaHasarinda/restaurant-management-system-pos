<?php

namespace App\Services;

use App\Exceptions\InventoryOperationException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RecipeComponent;
use App\Models\User;

final class OrderInventoryConsumptionService
{
    public function __construct(
        private readonly MenuInventoryConsumptionService $menuInventoryConsumptionService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Consume Order Items For Kitchen Send
    |--------------------------------------------------------------------------
    |
    | Phase 23 duplicate protection boundary:
    |
    | ONE ORDER ITEM
    |        ↓
    | ONE deterministic movement-key namespace
    |
    | Example:
    |
    | order-item:501:recipe-v1
    |
    | InventoryStockService then combines:
    |
    | - movement prefix
    | - source type
    | - source ID
    | - ingredient ID
    |
    | This means the same ingredient for the same order item can never
    | be deducted twice.
    |
    */

    public function consumeForKitchenSend(
        Order $order,
        array $itemIds,
        User $actor
    ): array {
        $normalizedItemIds =
            collect(
                $itemIds
            )
            ->map(
                fn($id): int =>
                (int) $id
            )
            ->filter(
                fn(int $id): bool =>
                $id > 0
            )
            ->unique()
            ->sort()
            ->values()
            ->all();

        if ($normalizedItemIds === []) {
            return [
                'consumed_item_ids' =>
                [],

                'skipped_item_ids' =>
                [],

                'stock_movement_ids' =>
                [],

                'items' =>
                [],
            ];
        }

        /*
        |--------------------------------------------------------------------------
        | Load Exact Order Items
        |--------------------------------------------------------------------------
        */

        $items =
            OrderItem::query()
            ->with([
                'menuItem',
                'variant',

                /*
                 * We need the real add-on row to determine
                 * whether the selected add-on consumes stock.
                 */
                'addons.addon',
            ])
            ->where(
                'order_id',
                $order->id
            )
            ->whereIn(
                'id',
                $normalizedItemIds
            )
            ->orderBy('id')
            ->get();

        if (
            $items->count()
            !== count(
                $normalizedItemIds
            )
        ) {
            throw new InventoryOperationException(
                message: 'One or more kitchen order items could not be found for inventory consumption.',

                errorCode: 'ORDER_INVENTORY_ITEM_NOT_FOUND',

                status: 422
            );
        }

        $consumedItemIds =
            [];

        $skippedItemIds =
            [];

        $stockMovementIds =
            [];

        $itemResults =
            [];

        foreach (
            $items as $item
        ) {
            if (
                $item->status
                !== OrderItem::STATUS_ACTIVE
            ) {
                throw new InventoryOperationException(
                    message: sprintf(
                        'Order item %d is not active and cannot consume recipe inventory.',
                        $item->id
                    ),

                    errorCode: 'ORDER_INVENTORY_ITEM_NOT_ACTIVE',

                    status: 409
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Legacy / Manual Item
            |--------------------------------------------------------------------------
            |
            | Existing historical tests may contain menu_item_id = null.
            |
            | Without a menu-item identity there is no safe recipe identity,
            | so inventory is intentionally skipped.
            |
            */

            if (
                $item->menu_item_id
                === null
            ) {
                $skippedItemIds[] =
                    (int) $item->id;

                $itemResults[] = [
                    'order_item_id' =>
                    (int) $item->id,

                    'consumed' =>
                    false,

                    'reason' =>
                    'NO_MENU_ITEM_REFERENCE',

                    'stock_movement_ids' =>
                    [],
                ];

                continue;
            }

            $menuItem =
                $item->menuItem;

            if (! $menuItem) {
                throw new InventoryOperationException(
                    message: sprintf(
                        'Menu item reference for order item %d could not be found.',
                        $item->id
                    ),

                    errorCode: 'ORDER_MENU_ITEM_NOT_FOUND',

                    status: 422
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Variant
            |--------------------------------------------------------------------------
            */

            $variant =
                null;

            if (
                $item->menu_item_variant_id
                !== null
            ) {
                $variant =
                    $item->variant;

                if (! $variant) {
                    throw new InventoryOperationException(
                        message: sprintf(
                            'Variant reference for order item %d could not be found.',
                            $item->id
                        ),

                        errorCode: 'ORDER_VARIANT_NOT_FOUND',

                        status: 422
                    );
                }

                if (
                    (int)
                    $variant->menu_item_id
                    !==
                    (int)
                    $menuItem->id
                ) {
                    throw new InventoryOperationException(
                        message: sprintf(
                            'Variant on order item %d does not belong to its menu item.',
                            $item->id
                        ),

                        errorCode: 'ORDER_VARIANT_MENU_ITEM_MISMATCH',

                        status: 422
                    );
                }
            }

            /*
            |--------------------------------------------------------------------------
            | Menu Item Quantity
            |--------------------------------------------------------------------------
            */

            $rawItemQuantity =
                (float)
                $item->quantity;

            $roundedItemQuantity =
                round(
                    $rawItemQuantity
                );

            if (
                $rawItemQuantity <= 0
                ||
                abs(
                    $rawItemQuantity
                        -
                        $roundedItemQuantity
                )
                > 0.000001
            ) {
                throw new InventoryOperationException(
                    message: sprintf(
                        'Order item %d has an invalid quantity for recipe consumption.',
                        $item->id
                    ),

                    errorCode: 'INVALID_RECIPE_ORDER_ITEM_QUANTITY',

                    status: 422
                );
            }

            $itemQuantity =
                (int)
                $roundedItemQuantity;

            /*
            |--------------------------------------------------------------------------
            | Selected Inventory Add-ons
            |--------------------------------------------------------------------------
            */

            $selectedInventoryAddons =
                [];

            $hasInventoryAddon =
                false;

            foreach (
                $item->addons
                as $orderItemAddon
            ) {
                if (
                    $orderItemAddon->addon_id
                    === null
                ) {
                    throw new InventoryOperationException(
                        message: sprintf(
                            'Add-on "%s" on order item %d has no inventory reference.',
                            $orderItemAddon
                                ->addon_name_snapshot,
                            $item->id
                        ),

                        errorCode: 'ORDER_ADDON_INVENTORY_REFERENCE_MISSING',

                        status: 422
                    );
                }

                $addon =
                    $orderItemAddon->addon;

                if (! $addon) {
                    throw new InventoryOperationException(
                        message: sprintf(
                            'Add-on "%s" on order item %d could not be found.',
                            $orderItemAddon
                                ->addon_name_snapshot,
                            $item->id
                        ),

                        errorCode: 'ORDER_ADDON_NOT_FOUND',

                        status: 422
                    );
                }

                /*
                 * Non-inventory add-ons do not need to
                 * participate in stock consumption.
                 */
                if (
                    ! $addon->consumes_inventory
                ) {
                    continue;
                }

                $hasInventoryAddon =
                    true;

                $rawAddonQuantity =
                    (float)
                    $orderItemAddon->quantity;

                $roundedAddonQuantity =
                    round(
                        $rawAddonQuantity
                    );

                if (
                    $rawAddonQuantity <= 0
                    ||
                    abs(
                        $rawAddonQuantity
                            -
                            $roundedAddonQuantity
                    )
                    > 0.000001
                ) {
                    throw new InventoryOperationException(
                        message: sprintf(
                            'Add-on "%s" on order item %d has an invalid recipe quantity.',
                            $orderItemAddon
                                ->addon_name_snapshot,
                            $item->id
                        ),

                        errorCode: 'INVALID_RECIPE_ADDON_QUANTITY',

                        status: 422
                    );
                }

                $selectedInventoryAddons[] = [
                    'addon_id' =>
                    (int)
                    $addon->id,

                    'quantity' =>
                    (int)
                    $roundedAddonQuantity,
                ];
            }

            /*
            |--------------------------------------------------------------------------
            | Does This Item Use Inventory?
            |--------------------------------------------------------------------------
            |
            | Existing application rule:
            |
            | Beverage/non-stock items may intentionally have no recipe.
            |
            */

            $recipeQuery =
                RecipeComponent::query()
                ->where(
                    'menu_item_id',
                    $menuItem->id
                );

            if ($variant) {
                $recipeQuery
                    ->where(
                        'variant_id',
                        $variant->id
                    );
            } else {
                $recipeQuery
                    ->whereNull(
                        'variant_id'
                    );
            }

            $hasRecipe =
                $recipeQuery
                ->exists();

            /*
             * Nothing about this menu item consumes inventory.
             */
            if (
                ! $hasRecipe
                &&
                ! $hasInventoryAddon
            ) {
                $skippedItemIds[] =
                    (int)
                    $item->id;

                $itemResults[] = [
                    'order_item_id' =>
                    (int)
                    $item->id,

                    'consumed' =>
                    false,

                    'reason' =>
                    'NO_INVENTORY_RECIPE',

                    'stock_movement_ids' =>
                    [],
                ];

                continue;
            }

            /*
             * Existing ordering rules require the main
             * menu recipe when an inventory-consuming
             * add-on is selected.
             */
            if (
                ! $hasRecipe
                &&
                $hasInventoryAddon
            ) {
                throw new InventoryOperationException(
                    message: sprintf(
                        'Inventory recipe is not configured for %s.',
                        $menuItem->name
                    ),

                    errorCode: 'MENU_RECIPE_NOT_CONFIGURED',

                    status: 422
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Deterministic Idempotency Namespace
            |--------------------------------------------------------------------------
            */

            $movementKeyPrefix =
                sprintf(
                    'order-item:%d:recipe-v1',
                    $item->id
                );

            /*
            |--------------------------------------------------------------------------
            | Consume Recipe Inventory
            |--------------------------------------------------------------------------
            */

            $consumption =
                $this
                ->menuInventoryConsumptionService
                ->consume(
                    actor: $actor,

                    menuItem: $menuItem,

                    variant: $variant,

                    selectedAddons: $selectedInventoryAddons,

                    itemQuantity: $itemQuantity,

                    movementKeyPrefix: $movementKeyPrefix,

                    sourceType: 'order_item',

                    sourceId: (int) $item->id,

                    reference: $order->order_number,

                    notes: sprintf(
                        'Recipe consumption for kitchen send of order %s, item %d.',
                        $order->order_number,
                        $item->id
                    ),

                    businessDayId: $order->business_day_id
                );

            $movementIds =
                collect(
                    $consumption['stock_movements']
                )
                ->pluck(
                    'id'
                )
                ->map(
                    fn($id): int =>
                    (int) $id
                )
                ->values()
                ->all();

            $consumedItemIds[] =
                (int)
                $item->id;

            $stockMovementIds =
                array_merge(
                    $stockMovementIds,
                    $movementIds
                );

            $itemResults[] = [
                'order_item_id' =>
                (int)
                $item->id,

                'consumed' =>
                true,

                'movement_key_prefix' =>
                $movementKeyPrefix,

                'stock_movement_ids' =>
                $movementIds,

                'requirements' =>
                $consumption['requirements'],
            ];
        }

        return [
            'consumed_item_ids' =>
            array_values(
                array_unique(
                    $consumedItemIds
                )
            ),

            'skipped_item_ids' =>
            array_values(
                array_unique(
                    $skippedItemIds
                )
            ),

            'stock_movement_ids' =>
            array_values(
                array_unique(
                    $stockMovementIds
                )
            ),

            'items' =>
            $itemResults,
        ];
    }
}
