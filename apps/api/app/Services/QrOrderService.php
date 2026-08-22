<?php

namespace App\Services;

use App\Exceptions\QrOrderException;
use App\Exceptions\RecipeOperationException;
use App\Models\Addon;
use App\Models\Ingredient;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\Order;
use App\Models\OrderAdditionSubmission;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\RecipeComponent;
use App\Models\RestaurantTable;
use App\Models\TableSession;
use App\Services\OrderLifecycleService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class QrOrderService
{
    public function __construct(
        private readonly TableQrCodeService $qrCodeService,
        private readonly TableSessionService $sessionService,
        private readonly RecipeRequirementService $recipeRequirementService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Submit First Customer QR Order
    |--------------------------------------------------------------------------
    */

    public function submit(
        string $token,
        array $data
    ): array {
        $submissionHash =
            $this->submissionHash(
                token: $token,
                data: $data
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Duplicate Check
        |--------------------------------------------------------------------------
        */

        $existing =
            Order::query()
            ->where(
                'client_order_id',
                $data['client_order_id']
            )
            ->first();

        if ($existing) {
            return [
                'order' =>
                $this->validateExisting(
                    $existing,
                    $submissionHash
                ),

                'created' =>
                false,
            ];
        }

        /*
        |--------------------------------------------------------------------------
        | Resolve Secure Table QR
        |--------------------------------------------------------------------------
        */

        $qrToken =
            $this
            ->qrCodeService
            ->resolve(
                $token
            );

        $qrToken->loadMissing(
            'restaurantTable'
        );

        /** @var RestaurantTable|null $table */
        $table =
            $qrToken->restaurantTable;

        if (! $table) {
            throw new QrOrderException(
                message: 'The table linked to this QR code could not be found.',

                errorCode: 'TABLE_NOT_FOUND',

                status: 404
            );
        }

        $this->validateTable(
            $table
        );

        /*
        |--------------------------------------------------------------------------
        | Open / Reuse Table Session
        |--------------------------------------------------------------------------
        */

        $sessionResult =
            $this
            ->sessionService
            ->openFromQr(
                table: $table,
                guestCount: 1
            );

        /** @var TableSession $session */
        $session =
            $sessionResult['session'];

        try {
            $order =
                DB::transaction(
                    function () use (
                        $data,
                        $submissionHash,
                        $table,
                        $session
                    ): Order {
                        /*
                        |--------------------------------------------------------------------------
                        | Lock Table Session
                        |--------------------------------------------------------------------------
                        */

                        /** @var TableSession $lockedSession */
                        $lockedSession =
                            TableSession::query()
                            ->lockForUpdate()
                            ->findOrFail(
                                $session->id
                            );

                        if (
                            $lockedSession->status
                            !== TableSession::STATUS_OPEN
                        ) {
                            throw new QrOrderException(
                                message: 'This table session is no longer open.',

                                errorCode: 'TABLE_SESSION_NOT_OPEN',

                                status: 409
                            );
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Lock Table
                        |--------------------------------------------------------------------------
                        */

                        /** @var RestaurantTable $lockedTable */
                        $lockedTable =
                            RestaurantTable::query()
                            ->lockForUpdate()
                            ->findOrFail(
                                $table->id
                            );

                        $this->validateTable(
                            $lockedTable
                        );

                        if (
                            (int) $lockedSession->table_id
                            !== (int) $lockedTable->id
                        ) {
                            throw new QrOrderException(
                                message: 'The table session does not match this QR code.',

                                errorCode: 'TABLE_SESSION_MISMATCH',

                                status: 409
                            );
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Duplicate Check Inside Transaction
                        |--------------------------------------------------------------------------
                        */

                        $existingOrder =
                            Order::query()
                            ->where(
                                'client_order_id',
                                $data['client_order_id']
                            )
                            ->first();

                        if ($existingOrder) {
                            return $this
                                ->validateExisting(
                                    $existingOrder,
                                    $submissionHash
                                );
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Validate Cart + Server Prices
                        |--------------------------------------------------------------------------
                        */

                        $prepared =
                            $this->prepareCart(
                                $data['items']
                            );

                        /*
                         * Check the combined stock requirement
                         * for the entire cart.
                         *
                         * No stock is deducted here.
                         */
                        $this->validateCombinedStock(
                            $prepared['requirements']
                        );

                        /*
                        |--------------------------------------------------------------------------
                        | Sequence Inside Table Session
                        |--------------------------------------------------------------------------
                        */

                        $sequence =
                            (
                                (int)
                                Order::query()
                                    ->where(
                                        'table_session_id',
                                        $lockedSession->id
                                    )
                                    ->max(
                                        'session_sequence'
                                    )
                            )
                            + 1;

                        /*
                        |--------------------------------------------------------------------------
                        | Create PENDING Order
                        |--------------------------------------------------------------------------
                        */

                        $order =
                            Order::query()
                            ->create([
                                /*
                                     * Temporary unique value until
                                     * the database order ID exists.
                                     */
                                'order_number' =>
                                'TMP-' .
                                    Str::upper(
                                        (string)
                                        Str::ulid()
                                    ),

                                'client_order_id' =>
                                $data['client_order_id'],

                                'submission_hash' =>
                                $submissionHash,

                                'public_status_token' =>
                                Str::random(
                                    64
                                ),

                                'business_day_id' =>
                                $lockedSession
                                    ->business_day_id,

                                'table_session_id' =>
                                $lockedSession
                                    ->id,

                                'table_id' =>
                                $lockedTable
                                    ->id,

                                'order_type' =>
                                Order::TYPE_DINE_IN,

                                'order_source' =>
                                Order::SOURCE_QR_CUSTOMER,

                                'session_sequence' =>
                                $sequence,

                                'table_name_snapshot' =>
                                $lockedTable
                                    ->name,

                                'customer_name' =>
                                $data['customer_name']
                                    ?? null,

                                'customer_phone' =>
                                $data['customer_phone']
                                    ?? null,

                                /*
                                     * Customer QR orders always
                                     * begin as PENDING.
                                     */
                                'status' =>
                                Order::STATUS_PENDING,

                                'subtotal' =>
                                $prepared['subtotal'],

                                'discount_total' =>
                                0,

                                'tax_total' =>
                                0,

                                'service_charge_total' =>
                                0,

                                'grand_total' =>
                                $prepared['subtotal'],

                                'estimated_cost_total' =>
                                $prepared['estimated_cost_total'],

                                'customer_notes' =>
                                $data['notes']
                                    ?? null,

                                'internal_notes' =>
                                null,

                                /*
                                     * Public QR customer has
                                     * no authenticated user.
                                     */
                                'created_by' =>
                                null,
                            ]);

                        /*
                        |--------------------------------------------------------------------------
                        | Final Human-readable Order Number
                        |--------------------------------------------------------------------------
                        */

                        $order->order_number =
                            sprintf(
                                'ORD-%s-%06d',
                                now()->format(
                                    'ymd'
                                ),
                                $order->id
                            );

                        $order->save();

                        /*
                        |--------------------------------------------------------------------------
                        | Save First Order Items
                        |--------------------------------------------------------------------------
                        */

                        $this->createOrderItems(
                            order: $order,
                            lines: $prepared['lines']
                        );

                        /*
                        |--------------------------------------------------------------------------
                        | Initial Status History
                        |--------------------------------------------------------------------------
                        */

                        OrderStatusHistory::query()
                            ->create([
                                'order_id' =>
                                $order->id,

                                'from_status' =>
                                null,

                                'to_status' =>
                                Order::STATUS_PENDING,

                                'changed_by' =>
                                null,

                                'notes' =>
                                'Customer QR order submitted and is awaiting cashier approval.',

                                'changed_at' =>
                                now(),
                            ]);

                        /*
                        |--------------------------------------------------------------------------
                        | Table Activity
                        |--------------------------------------------------------------------------
                        */

                        $lockedSession
                            ->last_activity_at =
                            now();

                        $lockedSession->save();

                        return $this->loadOrder(
                            $order
                        );
                    },
                    3
                );
        } catch (
            QueryException $exception
        ) {
            /*
             * Handles simultaneous duplicate requests.
             *
             * The unique client_order_id database
             * constraint remains the final protection.
             */

            $existing =
                Order::query()
                ->where(
                    'client_order_id',
                    $data['client_order_id']
                )
                ->first();

            if ($existing) {
                return [
                    'order' =>
                    $this->validateExisting(
                        $existing,
                        $submissionHash
                    ),

                    'created' =>
                    false,
                ];
            }

            throw $exception;
        }

        return [
            'order' =>
            $order,

            'created' =>
            true,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Append Additional Items To Existing Order
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | This does NOT create another orders row.
    |
    | Example:
    |
    | ORD-260822-000025
    |
    | First:
    |   Chicken Fried Rice
    |
    | Order More:
    |   Coke
    |
    | Order More again:
    |   Ice Cream
    |
    | All items remain attached to:
    |
    |   orders.id = 25
    |
    |--------------------------------------------------------------------------
    */

    public function append(
        string $statusToken,
        array $data
    ): array {
        /** @var Order|null $order */
        $order =
            Order::query()
            ->where(
                'public_status_token',
                $statusToken
            )
            ->where(
                'order_source',
                Order::SOURCE_QR_CUSTOMER
            )
            ->with([
                'tableSession',
                'restaurantTable',
            ])
            ->first();

        if (! $order) {
            throw new QrOrderException(
                message: 'The order could not be found.',

                errorCode: 'QR_ORDER_NOT_FOUND',

                status: 404
            );
        }

        $submissionHash =
            $this
            ->additionalSubmissionHash(
                statusToken: $statusToken,

                data: $data
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Additional Submission Duplicate Check
        |--------------------------------------------------------------------------
        */

        $existingSubmission =
            OrderAdditionSubmission::query()
            ->where(
                'client_submission_id',
                $data['client_submission_id']
            )
            ->first();

        if ($existingSubmission) {
            return [
                'order' =>
                $this
                    ->validateExistingAddition(
                        submission: $existingSubmission,

                        order: $order,

                        submissionHash: $submissionHash
                    ),

                'created' =>
                false,
            ];
        }

        try {
            return DB::transaction(
                function () use (
                    $order,
                    $data,
                    $submissionHash
                ): array {
                    /*
                    |--------------------------------------------------------------------------
                    | Lock Existing Order
                    |--------------------------------------------------------------------------
                    */

                    /** @var Order $lockedOrder */
                    $lockedOrder =
                        Order::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $order->id
                        );

                    $lockedOrder->load([
                        'tableSession',
                        'restaurantTable',
                    ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Validate Order Can Still Accept Additional Items
                    |--------------------------------------------------------------------------
                    */

                    $this
                        ->validateOrderForAdditionalItems(
                            $lockedOrder
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Duplicate Check Inside Transaction
                    |--------------------------------------------------------------------------
                    */

                    $existingSubmission =
                        OrderAdditionSubmission::query()
                        ->where(
                            'client_submission_id',
                            $data['client_submission_id']
                        )
                        ->first();

                    if ($existingSubmission) {
                        return [
                            'order' =>
                            $this
                                ->validateExistingAddition(
                                    submission: $existingSubmission,

                                    order: $lockedOrder,

                                    submissionHash: $submissionHash
                                ),

                            'created' =>
                            false,
                        ];
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Validate Only The New Cart
                    |--------------------------------------------------------------------------
                    */

                    $prepared =
                        $this->prepareCart(
                            $data['items']
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Check Stock For New Items
                    |--------------------------------------------------------------------------
                    |
                    | This checks availability only.
                    |
                    | It does NOT create SALE_CONSUMPTION.
                    |
                    */

                    $this
                        ->validateCombinedStock(
                            $prepared['requirements']
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Record Idempotency Submission
                    |--------------------------------------------------------------------------
                    */

                    OrderAdditionSubmission::query()
                        ->create([
                            'order_id' =>
                            $lockedOrder
                                ->id,

                            'client_submission_id' =>
                            $data['client_submission_id'],

                            'submission_hash' =>
                            $submissionHash,
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Append New Items To SAME Order
                    |--------------------------------------------------------------------------
                    */

                    $this->createOrderItems(
                        order: $lockedOrder,

                        lines: $prepared['lines']
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Recalculate Cumulative Order Total
                    |--------------------------------------------------------------------------
                    |
                    | Existing active items
                    | +
                    | new active items
                    | =
                    | new subtotal / total
                    |
                    */

                    $this
                        ->recalculateOrderTotals(
                            $lockedOrder
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Phase 17 Lifecycle Re-entry
                    |--------------------------------------------------------------------------
                    |
                    | Customer additional items must be approved again.
                    |
                    */

                    $lockedOrder =
                        app(
                            OrderLifecycleService::class
                        )
                        ->reopenForAdditionalItems(
                            order: $lockedOrder,

                            actor: null,

                            source: Order::SOURCE_QR_CUSTOMER
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Update Table Activity
                    |--------------------------------------------------------------------------
                    */

                    if (
                        $lockedOrder
                        ->tableSession
                    ) {
                        $lockedOrder
                            ->tableSession
                            ->last_activity_at =
                            now();

                        $lockedOrder
                            ->tableSession
                            ->save();
                    }

                    return [
                        'order' =>
                        $this->loadOrder(
                            $lockedOrder
                        ),

                        'created' =>
                        true,
                    ];
                },
                3
            );
        } catch (
            QueryException $exception
        ) {
            /*
             * Handles a double tap / network retry
             * where two identical requests race.
             */

            $existingSubmission =
                OrderAdditionSubmission::query()
                ->where(
                    'client_submission_id',
                    $data['client_submission_id']
                )
                ->first();

            if ($existingSubmission) {
                return [
                    'order' =>
                    $this
                        ->validateExistingAddition(
                            submission: $existingSubmission,

                            order: $order,

                            submissionHash: $submissionHash
                        ),

                    'created' =>
                    false,
                ];
            }

            throw $exception;
        }
    }

    /*
|--------------------------------------------------------------------------
| Shared Dine-in Cart Preparation
|--------------------------------------------------------------------------
|
| Phase 16 waiter ordering uses the same validated
| menu selections, server prices, recipe requirements
| and stock availability rules as customer QR ordering.
|
| This avoids maintaining two different pricing engines.
|
*/

    public function prepareCartForStaff(
        array $items
    ): array {
        return $this->prepareCart(
            items: $items,
            requireQrVisibility: false
        );
    }

    public function prepareDineInCartForStaff(
        array $items
    ): array {
        return $this->prepareCartForStaff(
            $items
        );
    }

    public function validatePreparedCartStock(
        array $requirements
    ): void {
        $this->validateCombinedStock(
            $requirements
        );
    }

    public function savePreparedOrderItems(
        Order $order,
        array $lines
    ): void {
        $this->createOrderItems(
            order: $order,
            lines: $lines
        );
    }

    public function recalculatePreparedOrder(
        Order $order
    ): void {
        $this->recalculateOrderTotals(
            $order
        );
    }

    public function reloadOrderWithItems(
        Order $order
    ): Order {
        return $this->loadOrder(
            $order
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Prepare Cart
    |--------------------------------------------------------------------------
    |
    | This method validates:
    |
    | - Menu item
    | - QR visibility
    | - Menu availability
    | - Category availability
    | - Variant
    | - Add-ons
    | - Add-on ownership
    | - Database prices
    | - Recipe configuration
    | - Ingredient requirements
    |
    |--------------------------------------------------------------------------
    */

    private function prepareCart(
        array $items,
        bool $requireQrVisibility = true
    ): array {
        $lines =
            [];

        $requirements =
            [];

        $subtotal =
            0.0;

        $estimatedCostTotal =
            0.0;

        foreach (
            $items as $itemIndex => $itemData
        ) {
            /*
            |--------------------------------------------------------------------------
            | Menu Item
            |--------------------------------------------------------------------------
            */

            /** @var MenuItem|null $menuItem */
            $menuItem =
                MenuItem::query()
                ->with([
                    'category',
                    'variants',
                    'addons',
                ])
                ->find(
                    $itemData['menu_item_id']
                );

            if (! $menuItem) {
                throw new QrOrderException(
                    message: "Menu item at row {$itemIndex} no longer exists.",

                    errorCode: 'MENU_ITEM_NOT_FOUND',

                    status: 422
                );
            }

            $this->validateMenuItem(
                menuItem: $menuItem,
                requireQrVisibility: $requireQrVisibility
            );

            $quantity =
                (int)
                $itemData['quantity'];

            /*
            |--------------------------------------------------------------------------
            | Variant
            |--------------------------------------------------------------------------
            */

            $variant =
                null;

            if (
                isset(
                    $itemData['variant_id']
                )
                && $itemData['variant_id'] !== null
            ) {
                /** @var MenuItemVariant|null $variant */
                $variant =
                    $menuItem
                    ->variants
                    ->firstWhere(
                        'id',
                        (int)
                        $itemData['variant_id']
                    );

                if (! $variant) {
                    throw new QrOrderException(
                        message: "The selected variant does not belong to {$menuItem->name}.",

                        errorCode: 'VARIANT_MENU_ITEM_MISMATCH',

                        status: 422
                    );
                }

                if (
                    ! $variant->is_active
                    || ! $variant->is_available
                ) {
                    throw new QrOrderException(
                        message: "The selected {$variant->name} variant is not currently available.",

                        errorCode: 'VARIANT_NOT_AVAILABLE',

                        status: 422
                    );
                }
            }

            if (
                $menuItem->has_variants
                && ! $variant
            ) {
                throw new QrOrderException(
                    message: "Please select a variant for {$menuItem->name}.",

                    errorCode: 'VARIANT_REQUIRED',

                    status: 422
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Add-ons
            |--------------------------------------------------------------------------
            */

            $selectedAddons =
                $itemData['addons']
                ?? [];

            $preparedAddons =
                [];

            $addonSellingTotal =
                0.0;

            foreach (
                $selectedAddons
                as $addonSelection
            ) {
                $addonId =
                    (int)
                    $addonSelection['addon_id'];

                $addonQuantity =
                    (int)
                    $addonSelection['quantity'];

                /** @var Addon|null $addon */
                $addon =
                    $menuItem
                    ->addons
                    ->firstWhere(
                        'id',
                        $addonId
                    );

                if (! $addon) {
                    throw new QrOrderException(
                        message: "One of the selected add-ons is not available for {$menuItem->name}.",

                        errorCode: 'ADDON_NOT_ALLOWED',

                        status: 422
                    );
                }

                if (
                    ! $addon->is_active
                    || ! $addon->is_available
                ) {
                    throw new QrOrderException(
                        message: "Add-on {$addon->name} is not currently available.",

                        errorCode: 'ADDON_NOT_AVAILABLE',

                        status: 422
                    );
                }

                /*
                 * Menu-specific price override wins.
                 */
                $effectivePrice =
                    $addon->pivot
                    ->price_override
                    !== null
                    ? (float)
                    $addon->pivot
                        ->price_override
                    : (float)
                    $addon->price;

                $addonLineTotal =
                    round(
                        $effectivePrice
                            *
                            $addonQuantity
                            *
                            $quantity,
                        2
                    );

                $addonSellingTotal +=
                    $addonLineTotal;

                $preparedAddons[$addonId] = [
                    'addon_id' =>
                    $addon->id,

                    'name' =>
                    $addon->name,

                    /*
                     * Add-on quantity PER menu item.
                     */
                    'quantity' =>
                    $addonQuantity,

                    'unit_price' =>
                    round(
                        $effectivePrice,
                        2
                    ),

                    /*
                     * Includes:
                     *
                     * addon quantity
                     * × menu-item quantity
                     * × addon price
                     */
                    'line_total' =>
                    $addonLineTotal,

                    'estimated_cost_total' =>
                    0.0,

                    'consumes_inventory' =>
                    (bool)
                    $addon
                        ->consumes_inventory,
                ];
            }

            /*
            |--------------------------------------------------------------------------
            | Base Selling Price
            |--------------------------------------------------------------------------
            */

            $unitPrice =
                round(
                    (float)
                    (
                        $variant
                        ? $variant->price
                        : $menuItem->price
                    ),
                    2
                );

            $grossTotal =
                round(
                    $unitPrice
                        * $quantity,
                    2
                );

            /*
            |--------------------------------------------------------------------------
            | Recipe / Inventory Requirement
            |--------------------------------------------------------------------------
            */

            $recipeQuery =
                RecipeComponent::query()
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

            $hasRecipe =
                $recipeQuery->exists();

            $hasInventoryAddon =
                collect(
                    $preparedAddons
                )
                ->contains(
                    fn(
                        array $addon
                    ): bool =>
                    $addon['consumes_inventory']
                );

            $estimatedLineCost =
                0.0;

            /*
             * Beverage/non-stock items without recipes
             * are allowed.
             *
             * But if an inventory-consuming add-on is
             * selected, the menu recipe must also exist.
             */
            if (
                $hasRecipe
                || $hasInventoryAddon
            ) {
                if (! $hasRecipe) {
                    throw new QrOrderException(
                        message: "Inventory recipe is not configured for {$menuItem->name}.",

                        errorCode: 'MENU_RECIPE_NOT_CONFIGURED',

                        status: 422
                    );
                }

                try {
                    $recipeResult =
                        $this
                        ->recipeRequirementService
                        ->build(
                            menuItem: $menuItem,

                            variant: $variant,

                            selectedAddons: $selectedAddons,

                            itemQuantity: $quantity
                        );
                } catch (
                    RecipeOperationException $exception
                ) {
                    throw new QrOrderException(
                        message: $exception
                            ->getMessage(),

                        errorCode: $exception
                            ->errorCode,

                        status: $exception
                            ->status
                    );
                }

                $estimatedLineCost =
                    round(
                        (float)
                        $recipeResult['costing']['total_recipe_cost'],
                        2
                    );

                /*
                |--------------------------------------------------------------------------
                | Aggregate Ingredient Requirements
                |--------------------------------------------------------------------------
                */

                foreach (
                    $recipeResult['requirements']
                    as $requirement
                ) {
                    $ingredientId =
                        (int)
                        $requirement['ingredient_id'];

                    if (
                        ! isset(
                            $requirements[$ingredientId]
                        )
                    ) {
                        $requirements[$ingredientId] = 0.0;
                    }

                    $requirements[$ingredientId] +=
                        (float)
                        $requirement['required_quantity'];
                }

                /*
                |--------------------------------------------------------------------------
                | Add-on Estimated Cost Snapshots
                |--------------------------------------------------------------------------
                */

                foreach (
                    $recipeResult['addons']
                    as $addonCost
                ) {
                    $addonId =
                        (int)
                        $addonCost['addon_id'];

                    if (
                        isset(
                            $preparedAddons[$addonId]
                        )
                    ) {
                        $preparedAddons[$addonId]['estimated_cost_total'] =
                            round(
                                (float)
                                $addonCost['estimated_ingredient_cost'],
                                2
                            );
                    }
                }
            }

            /*
            |--------------------------------------------------------------------------
            | Final Line Total
            |--------------------------------------------------------------------------
            */

            $lineTotal =
                round(
                    $grossTotal
                        + $addonSellingTotal,
                    2
                );

            $estimatedUnitCost =
                $quantity > 0
                ? round(
                    $estimatedLineCost
                        / $quantity,
                    4
                )
                : 0;

            $subtotal +=
                $lineTotal;

            $estimatedCostTotal +=
                $estimatedLineCost;

            $lines[] = [
                'menu_item_id' =>
                $menuItem->id,

                'variant_id' =>
                $variant?->id,

                'item_name' =>
                $menuItem->name,

                'variant_name' =>
                $variant?->name,

                'quantity' =>
                $quantity,

                'unit_price' =>
                $unitPrice,

                'gross_total' =>
                $grossTotal,

                'line_total' =>
                $lineTotal,

                'estimated_unit_cost' =>
                $estimatedUnitCost,

                'estimated_cost_total' =>
                $estimatedLineCost,

                'special_notes' =>
                $itemData['special_notes']
                    ?? $itemData['notes']
                    ?? null,

                'addons' =>
                array_values(
                    $preparedAddons
                ),
            ];
        }

        return [
            'lines' =>
            $lines,

            'requirements' =>
            $requirements,

            'subtotal' =>
            round(
                $subtotal,
                2
            ),

            'estimated_cost_total' =>
            round(
                $estimatedCostTotal,
                2
            ),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Create Order Items
    |--------------------------------------------------------------------------
    |
    | Used by BOTH:
    |
    | - First customer order
    | - Additional customer order
    |
    |--------------------------------------------------------------------------
    */

    private function createOrderItems(
        Order $order,
        array $lines
    ): void {
        foreach (
            $lines as $line
        ) {
            /** @var OrderItem $orderItem */
            $orderItem =
                $order
                ->items()
                ->create([
                    'menu_item_id' =>
                    $line['menu_item_id'],

                    'menu_item_variant_id' =>
                    $line['variant_id'],

                    'item_name_snapshot' =>
                    $line['item_name'],

                    'variant_name_snapshot' =>
                    $line['variant_name'],

                    'quantity' =>
                    $line['quantity'],

                    'unit_price' =>
                    $line['unit_price'],

                    'gross_total' =>
                    $line['gross_total'],

                    'discount_total' =>
                    0,

                    'tax_total' =>
                    0,

                    'line_total' =>
                    $line['line_total'],

                    'estimated_unit_cost' =>
                    $line['estimated_unit_cost'],

                    'estimated_cost_total' =>
                    $line['estimated_cost_total'],

                    'status' =>
                    OrderItem::STATUS_ACTIVE,

                    'special_notes' =>
                    $line['special_notes'],

                    /*
                         * New item is not automatically
                         * sent to kitchen.
                         *
                         * This is important for later
                         * ADDITIONAL ORDER KOT printing.
                         */
                    'sent_to_kitchen_at' =>
                    null,
                ]);

            foreach (
                $line['addons']
                as $addon
            ) {
                $orderItem
                    ->addons()
                    ->create([
                        'addon_id' =>
                        $addon['addon_id'],

                        'addon_name_snapshot' =>
                        $addon['name'],

                        /*
                         * Quantity per menu item.
                         */
                        'quantity' =>
                        $addon['quantity'],

                        'unit_price' =>
                        $addon['unit_price'],

                        'line_total' =>
                        $addon['line_total'],

                        'estimated_cost_total' =>
                        $addon['estimated_cost_total'],
                    ]);
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Menu Item
    |--------------------------------------------------------------------------
    */

    private function validateMenuItem(
        MenuItem $menuItem,
        bool $requireQrVisibility = true
    ): void {
        $menuItemUnavailable =
            ! $menuItem->is_active
            ||
            ! $menuItem->is_available
            ||
            (
                $requireQrVisibility
                &&
                ! $menuItem
                    ->is_visible_on_qr
            );

        if ($menuItemUnavailable) {
            throw new QrOrderException(
                message: $requireQrVisibility
                    ? "{$menuItem->name} is not currently available for QR ordering."
                    : "{$menuItem->name} is not currently available for staff ordering.",

                errorCode: 'MENU_ITEM_NOT_AVAILABLE',

                status: 422
            );
        }

        $categoryUnavailable =
            ! $menuItem->category
            ||
            ! $menuItem
                ->category
                ->is_active
            ||
            (
                $requireQrVisibility
                &&
                ! $menuItem
                    ->category
                    ->is_visible_on_qr
            );

        if ($categoryUnavailable) {
            throw new QrOrderException(
                message: $requireQrVisibility
                    ? "{$menuItem->name} is not currently available for QR ordering."
                    : "{$menuItem->name} is not currently available for staff ordering.",

                errorCode: 'MENU_CATEGORY_NOT_AVAILABLE',

                status: 422
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Complete Cart Stock
    |--------------------------------------------------------------------------
    |
    | Example:
    |
    | Item A requires Chicken 150 G
    | Item B requires Chicken 180 G
    |
    | Available Chicken = 300 G
    |
    | Individual checks:
    |
    | 150 <= 300
    | 180 <= 300
    |
    | would incorrectly pass.
    |
    | Combined:
    |
    | 330 > 300
    |
    | must fail.
    |
    |--------------------------------------------------------------------------
    */

    private function validateCombinedStock(
        array $requirements
    ): void {
        if ($requirements === []) {
            return;
        }

        $ingredientIds =
            array_keys(
                $requirements
            );

        $ingredients =
            Ingredient::query()
            ->whereIn(
                'id',
                $ingredientIds
            )
            ->get()
            ->keyBy(
                'id'
            );

        foreach (
            $requirements
            as $ingredientId => $requiredQuantity
        ) {
            /** @var Ingredient|null $ingredient */
            $ingredient =
                $ingredients->get(
                    $ingredientId
                );

            if (! $ingredient) {
                throw new QrOrderException(
                    message: 'An ingredient required by this order no longer exists.',

                    errorCode: 'ORDER_INGREDIENT_NOT_FOUND',

                    status: 422
                );
            }

            if (
                ! $ingredient->is_active
                || ! $ingredient
                    ->track_stock
            ) {
                throw new QrOrderException(
                    message: "{$ingredient->name} is not currently available for stock consumption.",

                    errorCode: 'ORDER_INGREDIENT_NOT_AVAILABLE',

                    status: 422
                );
            }

            $available =
                (float)
                $ingredient
                    ->current_stock;

            $required =
                round(
                    (float)
                    $requiredQuantity,
                    4
                );

            if (
                $required
                > $available
                + 0.000001
            ) {
                throw new QrOrderException(
                    message: sprintf(
                        'One or more items cannot currently be prepared because %s stock is insufficient.',
                        $ingredient->name
                    ),

                    errorCode: 'INSUFFICIENT_RECIPE_STOCK',

                    status: 409
                );
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Restaurant Table
    |--------------------------------------------------------------------------
    */

    private function validateTable(
        RestaurantTable $table
    ): void {
        if (! $table->is_active) {
            throw new QrOrderException(
                message: 'This restaurant table is not currently active.',

                errorCode: 'TABLE_INACTIVE',

                status: 422
            );
        }

        if (! $table->qr_ordering_enabled) {
            throw new QrOrderException(
                message: 'QR ordering is currently disabled for this table.',

                errorCode: 'QR_ORDERING_DISABLED',

                status: 403
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Original Order Duplicate
    |--------------------------------------------------------------------------
    */

    private function validateExisting(
        Order $order,
        string $submissionHash
    ): Order {
        if (
            $order->order_source
            !== Order::SOURCE_QR_CUSTOMER
        ) {
            throw new QrOrderException(
                message: 'This client order identifier has already been used.',

                errorCode: 'CLIENT_ORDER_ID_REUSED',

                status: 409
            );
        }

        if (
            ! hash_equals(
                (string)
                $order->submission_hash,
                $submissionHash
            )
        ) {
            throw new QrOrderException(
                message: 'This client order identifier has already been used for a different order.',

                errorCode: 'CLIENT_ORDER_ID_REUSED',

                status: 409
            );
        }

        return $this->loadOrder(
            $order
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Additional Submission Duplicate
    |--------------------------------------------------------------------------
    */

    private function validateExistingAddition(
        OrderAdditionSubmission $submission,
        Order $order,
        string $submissionHash
    ): Order {
        if (
            (int)
            $submission->order_id
            !==
            (int)
            $order->id
        ) {
            throw new QrOrderException(
                message: 'This additional-order identifier has already been used.',

                errorCode: 'ADDITIONAL_SUBMISSION_ID_REUSED',

                status: 409
            );
        }

        if (
            ! hash_equals(
                (string)
                $submission
                    ->submission_hash,

                $submissionHash
            )
        ) {
            throw new QrOrderException(
                message: 'This additional-order identifier has already been used for different items.',

                errorCode: 'ADDITIONAL_SUBMISSION_ID_REUSED',

                status: 409
            );
        }

        return $this->loadOrder(
            $order
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Existing Order Can Accept More Items
    |--------------------------------------------------------------------------
    */

    private function validateOrderForAdditionalItems(
        Order $order
    ): void {
        /*
         * Once fully closed, the customer cannot
         * continue adding food.
         */
        if (
            in_array(
                $order->status,
                [
                    Order::STATUS_COMPLETED,
                    Order::STATUS_CANCELLED,
                    Order::STATUS_REJECTED,
                ],
                true
            )
        ) {
            throw new QrOrderException(
                message: 'This order is already closed and cannot accept additional items.',

                errorCode: 'ORDER_NOT_OPEN_FOR_ADDITIONS',

                status: 409
            );
        }

        /** @var TableSession|null $session */
        $session =
            $order->tableSession;

        if (! $session) {
            throw new QrOrderException(
                message: 'The table session for this order could not be found.',

                errorCode: 'TABLE_SESSION_NOT_FOUND',

                status: 409
            );
        }

        if (
            $session->status
            !== TableSession::STATUS_OPEN
        ) {
            throw new QrOrderException(
                message: 'This table session is no longer open.',

                errorCode: 'TABLE_SESSION_NOT_OPEN',

                status: 409
            );
        }

        /** @var RestaurantTable|null $table */
        $table =
            $order->restaurantTable;

        if (! $table) {
            throw new QrOrderException(
                message: 'The restaurant table could not be found.',

                errorCode: 'TABLE_NOT_FOUND',

                status: 404
            );
        }

        if (
            (int)
            $session->table_id
            !==
            (int)
            $table->id
        ) {
            throw new QrOrderException(
                message: 'The order table and table session do not match.',

                errorCode: 'TABLE_SESSION_MISMATCH',

                status: 409
            );
        }

        $this->validateTable(
            $table
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Recalculate Cumulative Order Totals
    |--------------------------------------------------------------------------
    */

    private function recalculateOrderTotals(
        Order $order
    ): void {
        $subtotal =
            (float)
            $order
                ->items()
                ->where(
                    'status',
                    OrderItem::STATUS_ACTIVE
                )
                ->sum(
                    'line_total'
                );

        $estimatedCostTotal =
            (float)
            $order
                ->items()
                ->where(
                    'status',
                    OrderItem::STATUS_ACTIVE
                )
                ->sum(
                    'estimated_cost_total'
                );

        $subtotal =
            round(
                $subtotal,
                2
            );

        $discount =
            (float)
            $order
                ->discount_total;

        $tax =
            (float)
            $order
                ->tax_total;

        $serviceCharge =
            (float)
            $order
                ->service_charge_total;

        $grandTotal =
            round(
                $subtotal
                    - $discount
                    + $tax
                    + $serviceCharge,
                2
            );

        /*
         * Never allow a negative payable total.
         */
        $grandTotal =
            max(
                0,
                $grandTotal
            );

        $order->subtotal =
            $subtotal;

        $order->estimated_cost_total =
            round(
                $estimatedCostTotal,
                2
            );

        $order->grand_total =
            $grandTotal;

        $order->save();
    }

    /*
    |--------------------------------------------------------------------------
    | Original Order Submission Hash
    |--------------------------------------------------------------------------
    */

    private function submissionHash(
        string $token,
        array $data
    ): string {
        $items =
            $this->normalizeItemsForHash(
                $data['items']
            );

        return hash(
            'sha256',
            json_encode(
                [
                    'qr_token' =>
                    $token,

                    'customer_name' =>
                    $data['customer_name']
                        ?? null,

                    'customer_phone' =>
                    $data['customer_phone']
                        ?? null,

                    'notes' =>
                    $data['notes']
                        ?? null,

                    'items' =>
                    $items,
                ],
                JSON_THROW_ON_ERROR
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Additional Items Submission Hash
    |--------------------------------------------------------------------------
    */

    private function additionalSubmissionHash(
        string $statusToken,
        array $data
    ): string {
        return hash(
            'sha256',
            json_encode(
                [
                    'status_token' =>
                    $statusToken,

                    'items' =>
                    $this
                        ->normalizeItemsForHash(
                            $data['items']
                        ),
                ],
                JSON_THROW_ON_ERROR
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Normalize Cart For Idempotency Hash
    |--------------------------------------------------------------------------
    */

    private function normalizeItemsForHash(
        array $items
    ): array {
        return collect(
            $items
        )
            ->map(
                function (
                    array $item
                ): array {
                    $addons =
                        collect(
                            $item['addons']
                                ?? []
                        )
                        ->map(
                            fn(
                                array $addon
                            ): array => [
                                'addon_id' =>
                                (int)
                                $addon['addon_id'],

                                'quantity' =>
                                (int)
                                $addon['quantity'],
                            ]
                        )
                        ->sortBy(
                            'addon_id'
                        )
                        ->values()
                        ->all();

                    return [
                        'menu_item_id' =>
                        (int)
                        $item['menu_item_id'],

                        'variant_id' =>
                        isset(
                            $item['variant_id']
                        )
                            && $item['variant_id'] !== null
                            ? (int)
                            $item['variant_id']
                            : null,

                        'quantity' =>
                        (int)
                        $item['quantity'],

                        'special_notes' =>
                        $item['special_notes']
                            ?? $item['notes']
                            ?? null,

                        'addons' =>
                        $addons,
                    ];
                }
            )
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Reload Complete Cumulative Order
    |--------------------------------------------------------------------------
    */

    private function loadOrder(
        Order $order
    ): Order {
        return $order
            ->refresh()
            ->load([
                'items' =>
                fn($query) =>
                $query
                    ->orderBy(
                        'id'
                    ),

                'items.addons' =>
                fn($query) =>
                $query
                    ->orderBy(
                        'id'
                    ),

                'restaurantTable',

                'tableSession',
            ]);
    }
}
