<?php

namespace Tests\Feature;

use App\Exceptions\InventoryOperationException;
use App\Models\BusinessDay;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\OrderInventoryConsumptionService;
use App\Services\OrderLifecycleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class RecipeStockDeductionTest extends TestCase
{
    use RefreshDatabase;

    private OrderLifecycleService $lifecycle;

    private OrderInventoryConsumptionService $orderInventoryConsumptionService;

    private User $cashier;

    private BusinessDay $businessDay;

    private int $gramUnitId;

    private int $pieceUnitId;

    private int $categoryId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->lifecycle =
            app(
                OrderLifecycleService::class
            );

        $this->orderInventoryConsumptionService =
            app(
                OrderInventoryConsumptionService::class
            );

        $this->cashier =
            $this->createUserWithPermissions(
                roleCode: 'CASHIER',

                permissions: [
                    'orders.view',
                    'orders.create',
                    'orders.confirm',
                    'orders.send_kitchen',
                    'orders.serve',
                    'orders.complete',
                    'orders.cancel',
                    'kitchen.reprint',
                ]
            );

        $this->businessDay =
            BusinessDay::query()
            ->create([
                'business_date' =>
                now()
                    ->toDateString(),

                'status' =>
                BusinessDay::STATUS_OPEN,

                'opened_by' =>
                $this->cashier->id,

                'opened_at' =>
                now(),

                'notes' =>
                'Phase 23 recipe stock deduction automated tests.',
            ]);

        $this->gramUnitId =
            $this->createUnit(
                name: 'Gram',

                symbol: 'G',

                measurementType: 'WEIGHT'
            );

        $this->pieceUnitId =
            $this->createUnit(
                name: 'Piece',

                symbol: 'PC',

                measurementType: 'COUNT'
            );

        $this->categoryId =
            DB::table(
                'categories'
            )
            ->insertGetId([
                'parent_id' =>
                null,

                'name' =>
                'Phase 23 Food',

                'slug' =>
                'phase-23-food-'
                    .
                    Str::lower(
                        Str::random(8)
                    ),

                'description' =>
                null,

                'image_path' =>
                null,

                'sort_order' =>
                1,

                'is_active' =>
                true,

                'is_visible_on_website' =>
                true,

                'is_visible_on_qr' =>
                true,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Full Recipe × Ordered Quantity
    |--------------------------------------------------------------------------
    */

    public function test_recipe_quantities_are_multiplied_by_order_quantity(): void
    {
        $rice =
            $this->createIngredient(
                'Rice',
                10000,
                $this->gramUnitId
            );

        $chicken =
            $this->createIngredient(
                'Chicken',
                5000,
                $this->gramUnitId
            );

        $carrot =
            $this->createIngredient(
                'Carrot',
                5000,
                $this->gramUnitId
            );

        $egg =
            $this->createIngredient(
                'Egg',
                100,
                $this->pieceUnitId
            );

        $oil =
            $this->createIngredient(
                'Oil',
                5000,
                $this->gramUnitId
            );

        $menuItemId =
            $this->createMenuItem(
                name: 'Chicken Fried Rice',

                price: 1200
            );

        $this->addRecipeComponent(
            $menuItemId,
            $rice,
            250,
            $this->gramUnitId
        );

        $this->addRecipeComponent(
            $menuItemId,
            $chicken,
            120,
            $this->gramUnitId
        );

        $this->addRecipeComponent(
            $menuItemId,
            $carrot,
            50,
            $this->gramUnitId
        );

        $this->addRecipeComponent(
            $menuItemId,
            $egg,
            1,
            $this->pieceUnitId
        );

        $this->addRecipeComponent(
            $menuItemId,
            $oil,
            20,
            $this->gramUnitId
        );

        $order =
            $this->createOrder();

        $item =
            $this->addOrderItem(
                order: $order,

                menuItemId: $menuItemId,

                quantity: 2
            );

        $result =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,

                actor: $this->cashier
            );

        $this->assertTrue(
            $result['changed']
        );

        $this->assertSame(
            [
                $item->id,
            ],
            $result['affected_item_ids']
        );

        /*
         * 5 different ingredients =
         * 5 immutable stock movements.
         */
        $this->assertDatabaseCount(
            'stock_movements',
            5
        );

        /*
         * 2 × recipe.
         */
        $this->assertStock(
            $rice,
            9500
        );

        $this->assertStock(
            $chicken,
            4760
        );

        $this->assertStock(
            $carrot,
            4900
        );

        $this->assertStock(
            $egg,
            98
        );

        $this->assertStock(
            $oil,
            4960
        );

        $this->assertMovement(
            ingredientId: $rice,

            orderItemId: $item->id,

            quantityDelta: -500
        );

        $this->assertMovement(
            ingredientId: $chicken,

            orderItemId: $item->id,

            quantityDelta: -240
        );

        $this->assertMovement(
            ingredientId: $carrot,

            orderItemId: $item->id,

            quantityDelta: -100
        );

        $this->assertMovement(
            ingredientId: $egg,

            orderItemId: $item->id,

            quantityDelta: -2
        );

        $this->assertMovement(
            ingredientId: $oil,

            orderItemId: $item->id,

            quantityDelta: -40
        );

        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $order
                ->fresh()
                ->status
        );

        $this->assertNotNull(
            $item
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Strong Inventory-Service Idempotency
    |--------------------------------------------------------------------------
    */

    public function test_same_order_item_consumption_is_idempotent_even_when_service_is_called_twice(): void
    {
        $ingredientId =
            $this->createIngredient(
                'Idempotent Ingredient',
                100,
                $this->gramUnitId
            );

        $menuItemId =
            $this->createMenuItem(
                name: 'Idempotent Meal',

                price: 500
            );

        /*
         * Consumes 60 from 100.
         *
         * After first consumption only 40 remains.
         *
         * A duplicate request must still return the
         * existing movement instead of failing because
         * 40 < 60.
         */
        $this->addRecipeComponent(
            $menuItemId,
            $ingredientId,
            60,
            $this->gramUnitId
        );

        $order =
            $this->createOrder();

        $item =
            $this->addOrderItem(
                order: $order,

                menuItemId: $menuItemId,

                quantity: 1
            );

        $first =
            $this
            ->orderInventoryConsumptionService
            ->consumeForKitchenSend(
                order: $order,

                itemIds: [
                    $item->id,
                ],

                actor: $this->cashier
            );

        $this->assertStock(
            $ingredientId,
            40
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );

        $second =
            $this
            ->orderInventoryConsumptionService
            ->consumeForKitchenSend(
                order: $order,

                itemIds: [
                    $item->id,
                ],

                actor: $this->cashier
            );

        /*
         * Stock must remain 40.
         *
         * It must NOT become negative
         * and must NOT create another movement.
         */
        $this->assertStock(
            $ingredientId,
            40
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );

        $this->assertSame(
            $first['stock_movement_ids'],

            $second['stock_movement_ids']
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Duplicate Send-To-Kitchen
    |--------------------------------------------------------------------------
    */

    public function test_repeated_send_to_kitchen_never_deducts_stock_twice(): void
    {
        $ingredientId =
            $this->createIngredient(
                'Duplicate Protection Ingredient',
                100,
                $this->gramUnitId
            );

        $menuItemId =
            $this->createMenuItem(
                name: 'Duplicate Protection Meal',

                price: 700
            );

        $this->addRecipeComponent(
            $menuItemId,
            $ingredientId,
            10,
            $this->gramUnitId
        );

        $order =
            $this->createOrder();

        $item =
            $this->addOrderItem(
                order: $order,

                menuItemId: $menuItemId,

                quantity: 1
            );

        $first =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,

                actor: $this->cashier
            );

        $this->assertTrue(
            $first['changed']
        );

        $this->assertStock(
            $ingredientId,
            90
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );

        $movementKey =
            (string)
            DB::table(
                'stock_movements'
            )
                ->where(
                    'source_type',
                    'order_item'
                )
                ->where(
                    'source_id',
                    $item->id
                )
                ->value(
                    'movement_key'
                );

        $second =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,

                actor: $this->cashier
            );

        $this->assertFalse(
            $second['changed']
        );

        $this->assertSame(
            [],
            $second['affected_item_ids']
        );

        $this->assertStock(
            $ingredientId,
            90
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );

        $this->assertSame(
            $movementKey,

            (string)
            DB::table(
                'stock_movements'
            )
                ->where(
                    'source_id',
                    $item->id
                )
                ->value(
                    'movement_key'
                )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Additional Order
    |--------------------------------------------------------------------------
    */

    public function test_additional_order_deducts_only_new_order_item_recipe(): void
    {
        $ingredientId =
            $this->createIngredient(
                'Additional Order Ingredient',
                100,
                $this->gramUnitId
            );

        $firstMenuItemId =
            $this->createMenuItem(
                name: 'First Kitchen Item',

                price: 500
            );

        $this->addRecipeComponent(
            $firstMenuItemId,
            $ingredientId,
            10,
            $this->gramUnitId
        );

        $secondMenuItemId =
            $this->createMenuItem(
                name: 'Additional Kitchen Item',

                price: 600
            );

        $this->addRecipeComponent(
            $secondMenuItemId,
            $ingredientId,
            20,
            $this->gramUnitId
        );

        $order =
            $this->createOrder(
                source: Order::SOURCE_WAITER
            );

        $firstItem =
            $this->addOrderItem(
                order: $order,

                menuItemId: $firstMenuItemId,

                quantity: 1
            );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,

                actor: $this->cashier
            );

        $this->assertStock(
            $ingredientId,
            90
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );

        $firstSentAt =
            $firstItem
            ->fresh()
            ->sent_to_kitchen_at;

        $this->assertNotNull(
            $firstSentAt
        );

        /*
         * Add only the new item.
         */
        $secondItem =
            $this->addOrderItem(
                order: $order,

                menuItemId: $secondMenuItemId,

                quantity: 1
            );

        $this->lifecycle
            ->reopenForAdditionalItems(
                order: $order,

                actor: $this->cashier,

                source: Order::SOURCE_WAITER
            );

        $this->assertSame(
            Order::STATUS_CONFIRMED,
            $order
                ->fresh()
                ->status
        );

        $secondSend =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,

                actor: $this->cashier
            );

        $this->assertSame(
            [
                $secondItem->id,
            ],
            $secondSend['affected_item_ids']
        );

        /*
         * 100
         * -10 first item
         * -20 additional item
         * = 70
         */
        $this->assertStock(
            $ingredientId,
            70
        );

        /*
         * One movement for each order item.
         */
        $this->assertDatabaseCount(
            'stock_movements',
            2
        );

        /*
         * Initial + Additional KOT.
         */
        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            2
        );

        $this->assertDatabaseHas(
            'kitchen_print_jobs',
            [
                'order_id' =>
                $order->id,

                'job_type' =>
                'INITIAL_ORDER',
            ]
        );

        $this->assertDatabaseHas(
            'kitchen_print_jobs',
            [
                'order_id' =>
                $order->id,

                'job_type' =>
                'ADDITIONAL_ORDER',
            ]
        );

        /*
         * Original item timestamp remains unchanged.
         */
        $this->assertSame(
            $firstSentAt
                ?->toISOString(),

            $firstItem
                ->fresh()
                ->sent_to_kitchen_at
                ?->toISOString()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Variant Recipe
    |--------------------------------------------------------------------------
    */

    public function test_variant_uses_variant_recipe_not_base_recipe(): void
    {
        $ingredientId =
            $this->createIngredient(
                'Variant Ingredient',
                200,
                $this->gramUnitId
            );

        $menuItemId =
            $this->createMenuItem(
                name: 'Variant Meal',

                price: 500,

                hasVariants: true
            );

        /*
         * Base recipe = 10 G.
         */
        $this->addRecipeComponent(
            $menuItemId,
            $ingredientId,
            10,
            $this->gramUnitId
        );

        $variantId =
            $this->createVariant(
                menuItemId: $menuItemId,

                name: 'Large',

                price: 800
            );

        /*
         * Large recipe = 25 G.
         */
        $this->addRecipeComponent(
            menuItemId: $menuItemId,

            ingredientId: $ingredientId,

            quantity: 25,

            unitId: $this->gramUnitId,

            variantId: $variantId
        );

        $order =
            $this->createOrder();

        $item =
            $this->addOrderItem(
                order: $order,

                menuItemId: $menuItemId,

                quantity: 2,

                variantId: $variantId
            );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,

                actor: $this->cashier
            );

        /*
         * Large 25 G × 2 = 50 G.
         *
         * Stock:
         * 200 - 50 = 150
         */
        $this->assertStock(
            $ingredientId,
            150
        );

        $this->assertMovement(
            ingredientId: $ingredientId,

            orderItemId: $item->id,

            quantityDelta: -50
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Add-on Recipe
    |--------------------------------------------------------------------------
    */

    public function test_inventory_consuming_addon_is_included_in_recipe_deduction(): void
    {
        $rice =
            $this->createIngredient(
                'Addon Test Rice',
                1000,
                $this->gramUnitId
            );

        $egg =
            $this->createIngredient(
                'Addon Test Egg',
                10,
                $this->pieceUnitId
            );

        $menuItemId =
            $this->createMenuItem(
                name: 'Fried Rice With Addons',

                price: 1000
            );

        /*
         * Base recipe:
         * Rice 100 G per meal.
         */
        $this->addRecipeComponent(
            $menuItemId,
            $rice,
            100,
            $this->gramUnitId
        );

        $addonId =
            $this->createInventoryAddon(
                menuItemId: $menuItemId,

                name: 'Extra Egg',

                price: 100,

                ingredientId: $egg,

                recipeQuantity: 1,

                unitId: $this->pieceUnitId
            );

        $order =
            $this->createOrder();

        /*
         * 2 Fried Rice
         */
        $item =
            $this->addOrderItem(
                order: $order,

                menuItemId: $menuItemId,

                quantity: 2
            );

        /*
         * Extra Egg ×2 PER ordered Fried Rice.
         *
         * 1 recipe egg
         * × addon quantity 2
         * × menu quantity 2
         * = 4 eggs.
         */
        $this->addOrderItemAddon(
            orderItem: $item,

            addonId: $addonId,

            quantity: 2
        );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,

                actor: $this->cashier
            );

        /*
         * Rice:
         * 100 × 2 = 200
         */
        $this->assertStock(
            $rice,
            800
        );

        /*
         * Egg:
         * 1 × 2 addon qty × 2 meals
         * = 4
         */
        $this->assertStock(
            $egg,
            6
        );

        $this->assertMovement(
            ingredientId: $rice,

            orderItemId: $item->id,

            quantityDelta: -200
        );

        $this->assertMovement(
            ingredientId: $egg,

            orderItemId: $item->id,

            quantityDelta: -4
        );

        $this->assertDatabaseCount(
            'stock_movements',
            2
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Insufficient Stock Rollback
    |--------------------------------------------------------------------------
    */

    public function test_insufficient_stock_rolls_back_entire_kitchen_send(): void
    {
        $rice =
            $this->createIngredient(
                'Rollback Rice',
                1000,
                $this->gramUnitId
            );

        $chicken =
            $this->createIngredient(
                'Rollback Chicken',
                50,
                $this->gramUnitId
            );

        $menuItemId =
            $this->createMenuItem(
                name: 'Insufficient Stock Meal',

                price: 1000
            );

        $this->addRecipeComponent(
            $menuItemId,
            $rice,
            250,
            $this->gramUnitId
        );

        /*
         * Requires 120 G but only 50 exists.
         */
        $this->addRecipeComponent(
            $menuItemId,
            $chicken,
            120,
            $this->gramUnitId
        );

        $order =
            $this->createOrder();

        $item =
            $this->addOrderItem(
                order: $order,

                menuItemId: $menuItemId,

                quantity: 1
            );

        try {
            $this->lifecycle
                ->sendToKitchen(
                    order: $order,

                    actor: $this->cashier
                );

            $this->fail(
                'Expected INSUFFICIENT_STOCK was not thrown.'
            );
        } catch (
            InventoryOperationException $exception
        ) {
            $this->assertSame(
                'INSUFFICIENT_STOCK',
                $exception->errorCode
            );

            $this->assertSame(
                409,
                $exception->status
            );
        }

        /*
         * Nothing changed.
         */
        $this->assertStock(
            $rice,
            1000
        );

        $this->assertStock(
            $chicken,
            50
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            0
        );

        $this->assertSame(
            Order::STATUS_CONFIRMED,
            $order
                ->fresh()
                ->status
        );

        $this->assertNull(
            $order
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertNull(
            $item
                ->fresh()
                ->sent_to_kitchen_at
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Multi-item Transaction Rollback
    |--------------------------------------------------------------------------
    */

    public function test_failure_on_second_item_rolls_back_first_item_consumption(): void
    {
        $availableIngredient =
            $this->createIngredient(
                'Available Ingredient',
                100,
                $this->gramUnitId
            );

        $shortIngredient =
            $this->createIngredient(
                'Short Ingredient',
                5,
                $this->gramUnitId
            );

        $firstMenuItem =
            $this->createMenuItem(
                name: 'First Valid Meal',

                price: 500
            );

        $this->addRecipeComponent(
            $firstMenuItem,
            $availableIngredient,
            20,
            $this->gramUnitId
        );

        $secondMenuItem =
            $this->createMenuItem(
                name: 'Second Invalid Meal',

                price: 500
            );

        $this->addRecipeComponent(
            $secondMenuItem,
            $shortIngredient,
            10,
            $this->gramUnitId
        );

        $order =
            $this->createOrder();

        $firstItem =
            $this->addOrderItem(
                order: $order,

                menuItemId: $firstMenuItem,

                quantity: 1
            );

        $secondItem =
            $this->addOrderItem(
                order: $order,

                menuItemId: $secondMenuItem,

                quantity: 1
            );

        try {
            $this->lifecycle
                ->sendToKitchen(
                    order: $order,

                    actor: $this->cashier
                );

            $this->fail(
                'Expected second item stock failure was not thrown.'
            );
        } catch (
            InventoryOperationException $exception
        ) {
            $this->assertSame(
                'INSUFFICIENT_STOCK',
                $exception->errorCode
            );
        }

        /*
         * First item consumption must also be rolled back.
         */
        $this->assertStock(
            $availableIngredient,
            100
        );

        $this->assertStock(
            $shortIngredient,
            5
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            0
        );

        $this->assertNull(
            $firstItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertNull(
            $secondItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertSame(
            Order::STATUS_CONFIRMED,
            $order
                ->fresh()
                ->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Non-stock / Beverage Item
    |--------------------------------------------------------------------------
    */

    public function test_non_stock_menu_item_without_recipe_can_still_be_sent_to_kitchen(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Non Stock Beverage',

                price: 300
            );

        /*
         * Intentionally NO recipe.
         */

        $order =
            $this->createOrder();

        $item =
            $this->addOrderItem(
                order: $order,

                menuItemId: $menuItemId,

                quantity: 1
            );

        $result =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,

                actor: $this->cashier
            );

        $this->assertTrue(
            $result['changed']
        );

        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $order
                ->fresh()
                ->status
        );

        $this->assertNotNull(
            $item
                ->fresh()
                ->sent_to_kitchen_at
        );

        /*
         * No inventory recipe means no stock movement.
         */
        $this->assertDatabaseCount(
            'stock_movements',
            0
        );

        /*
         * Kitchen still receives the KOT.
         */
        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createUserWithPermissions(
        string $roleCode,
        array $permissions
    ): User {
        $role =
            Role::query()
            ->create([
                'name' =>
                Str::headline(
                    strtolower(
                        $roleCode
                    )
                ),

                'code' =>
                $roleCode,

                'description' =>
                "{$roleCode} Phase 23 test role.",

                'is_active' =>
                true,
            ]);

        $permissionIds =
            collect(
                $permissions
            )
            ->map(
                function (
                    string $code
                ): int {
                    $permission =
                        Permission::query()
                        ->firstOrCreate(
                            [
                                'code' =>
                                $code,
                            ],
                            [
                                'name' =>
                                Str::headline(
                                    str_replace(
                                        '.',
                                        ' ',
                                        $code
                                    )
                                ),

                                'group' =>
                                str_starts_with(
                                    $code,
                                    'kitchen.'
                                )
                                    ? 'Kitchen'
                                    : 'Orders',

                                'description' =>
                                null,
                            ]
                        );

                    return (int)
                    $permission->id;
                }
            )
            ->all();

        $role
            ->permissions()
            ->sync(
                $permissionIds
            );

        return User::query()
            ->create([
                'role_id' =>
                $role->id,

                'name' =>
                "{$roleCode} Phase 23 User",

                'username' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_p23_'
                    .
                    Str::lower(
                        Str::random(8)
                    ),

                'email' =>
                Str::lower(
                    Str::random(12)
                )
                    .
                    '@example.test',

                'phone' =>
                null,

                'password' =>
                Hash::make(
                    'TestPassword123!'
                ),

                'status' =>
                'ACTIVE',
            ]);
    }

    private function createUnit(
        string $name,
        string $symbol,
        string $measurementType
    ): int {
        return (int)
        DB::table(
            'units'
        )
            ->insertGetId([
                'name' =>
                $name,

                'symbol' =>
                $symbol,

                'measurement_type' =>
                $measurementType,

                'base_unit_id' =>
                null,

                'conversion_factor' =>
                1,

                'is_active' =>
                true,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    private function createIngredient(
        string $name,
        float $stock,
        int $unitId
    ): int {
        return (int)
        DB::table(
            'ingredients'
        )
            ->insertGetId([
                'sku' =>
                'ING-P23-'
                    .
                    Str::upper(
                        Str::random(10)
                    ),

                'name' =>
                $name,

                'base_unit_id' =>
                $unitId,

                'current_stock' =>
                $stock,

                'reorder_level' =>
                0,

                'average_cost_per_base_unit' =>
                1,

                'track_stock' =>
                true,

                'is_active' =>
                true,

                'storage_location' =>
                'PHASE-23-TEST',

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    private function createMenuItem(
        string $name,
        float $price,
        bool $hasVariants = false
    ): int {
        $suffix =
            Str::lower(
                Str::random(10)
            );

        return (int)
        DB::table(
            'menu_items'
        )
            ->insertGetId([
                'category_id' =>
                $this->categoryId,

                'sku' =>
                'MENU-P23-'
                    .
                    Str::upper(
                        Str::random(8)
                    ),

                'name' =>
                $name,

                'slug' =>
                "phase-23-{$suffix}",

                'description' =>
                null,

                'image_path' =>
                null,

                'price' =>
                $price,

                'tax_rate' =>
                0,

                'is_available' =>
                true,

                'is_active' =>
                true,

                'is_visible_on_website' =>
                true,

                'is_visible_on_qr' =>
                true,

                'has_variants' =>
                $hasVariants,

                'sort_order' =>
                1,

                'metadata' =>
                null,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    private function createVariant(
        int $menuItemId,
        string $name,
        float $price
    ): int {
        return (int)
        DB::table(
            'menu_item_variants'
        )
            ->insertGetId([
                'menu_item_id' =>
                $menuItemId,

                'sku' =>
                'VAR-P23-'
                    .
                    Str::upper(
                        Str::random(8)
                    ),

                'name' =>
                $name,

                'price' =>
                $price,

                'is_default' =>
                false,

                'is_available' =>
                true,

                'is_active' =>
                true,

                'sort_order' =>
                1,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    private function addRecipeComponent(
        int $menuItemId,
        int $ingredientId,
        float $quantity,
        int $unitId,
        ?int $variantId = null
    ): void {
        DB::table(
            'recipe_components'
        )
            ->insert([
                'menu_item_id' =>
                $menuItemId,

                'variant_id' =>
                $variantId,

                'ingredient_id' =>
                $ingredientId,

                'quantity' =>
                $quantity,

                'unit_id' =>
                $unitId,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    private function createInventoryAddon(
        int $menuItemId,
        string $name,
        float $price,
        int $ingredientId,
        float $recipeQuantity,
        int $unitId
    ): int {
        $addonGroupId =
            DB::table(
                'addon_groups'
            )
            ->insertGetId([
                'name' =>
                "{$name} Group",

                'description' =>
                null,

                'minimum_select' =>
                0,

                'maximum_select' =>
                5,

                'is_required' =>
                false,

                'is_active' =>
                true,

                'sort_order' =>
                1,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        $addonId =
            DB::table(
                'addons'
            )
            ->insertGetId([
                'addon_group_id' =>
                $addonGroupId,

                'name' =>
                $name,

                'sku' =>
                'ADD-P23-'
                    .
                    Str::upper(
                        Str::random(8)
                    ),

                'price' =>
                $price,

                'is_available' =>
                true,

                'consumes_inventory' =>
                true,

                'is_active' =>
                true,

                'sort_order' =>
                1,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        DB::table(
            'menu_item_addons'
        )
            ->insert([
                'menu_item_id' =>
                $menuItemId,

                'addon_id' =>
                $addonId,

                'price_override' =>
                null,

                'is_default' =>
                false,

                'sort_order' =>
                1,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        DB::table(
            'addon_recipe_components'
        )
            ->insert([
                'addon_id' =>
                $addonId,

                'ingredient_id' =>
                $ingredientId,

                'quantity' =>
                $recipeQuantity,

                'unit_id' =>
                $unitId,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        return (int)
        $addonId;
    }

    private function createOrder(
        string $source =
        Order::SOURCE_CASHIER
    ): Order {
        return Order::query()
            ->create([
                'order_number' =>
                'ORD-P23-'
                    .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'business_day_id' =>
                $this
                    ->businessDay
                    ->id,

                'table_session_id' =>
                null,

                'table_id' =>
                null,

                'order_type' =>
                Order::TYPE_TAKEAWAY,

                'order_source' =>
                $source,

                'session_sequence' =>
                null,

                'table_name_snapshot' =>
                null,

                'takeaway_token' =>
                'TOK-P23-'
                    .
                    Str::upper(
                        Str::random(8)
                    ),

                'customer_name' =>
                null,

                'customer_phone' =>
                null,

                'status' =>
                Order::STATUS_CONFIRMED,

                'subtotal' =>
                0,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'service_charge_total' =>
                0,

                'grand_total' =>
                0,

                'estimated_cost_total' =>
                0,

                'customer_notes' =>
                null,

                'internal_notes' =>
                null,

                'created_by' =>
                $this->cashier->id,

                'confirmed_by' =>
                $this->cashier->id,

                'confirmed_at' =>
                now(),
            ]);
    }

    private function addOrderItem(
        Order $order,
        int $menuItemId,
        int $quantity,
        ?int $variantId = null
    ): OrderItem {
        $menuItem =
            DB::table(
                'menu_items'
            )
            ->where(
                'id',
                $menuItemId
            )
            ->first();

        if (! $menuItem) {
            throw new \RuntimeException(
                'Phase 23 test menu item was not found.'
            );
        }

        $variant =
            $variantId !== null
            ? DB::table(
                'menu_item_variants'
            )
            ->where(
                'id',
                $variantId
            )
            ->first()
            : null;

        $unitPrice =
            $variant
            ? (float)
            $variant->price
            : (float)
            $menuItem->price;

        $lineTotal =
            round(
                $unitPrice
                    *
                    $quantity,
                2
            );

        $item =
            OrderItem::query()
            ->create([
                'order_id' =>
                $order->id,

                'menu_item_id' =>
                $menuItemId,

                'menu_item_variant_id' =>
                $variantId,

                'item_name_snapshot' =>
                $menuItem->name,

                'variant_name_snapshot' =>
                $variant
                    ? $variant->name
                    : null,

                'quantity' =>
                $quantity,

                'unit_price' =>
                $unitPrice,

                'gross_total' =>
                $lineTotal,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'line_total' =>
                $lineTotal,

                'estimated_unit_cost' =>
                0,

                'estimated_cost_total' =>
                0,

                'status' =>
                OrderItem::STATUS_ACTIVE,

                'special_notes' =>
                null,

                'sent_to_kitchen_at' =>
                null,

                'cancelled_at' =>
                null,
            ]);

        $freshOrder =
            $order->fresh();

        $subtotal =
            round(
                (float)
                $freshOrder->subtotal
                    +
                    $lineTotal,
                2
            );

        $freshOrder
            ->update([
                'subtotal' =>
                $subtotal,

                'grand_total' =>
                $subtotal,
            ]);

        return $item;
    }

    private function addOrderItemAddon(
        OrderItem $orderItem,
        int $addonId,
        int $quantity
    ): void {
        $addon =
            DB::table(
                'addons'
            )
            ->where(
                'id',
                $addonId
            )
            ->first();

        if (! $addon) {
            throw new \RuntimeException(
                'Phase 23 test add-on was not found.'
            );
        }

        DB::table(
            'order_item_addons'
        )
            ->insert([
                'order_item_id' =>
                $orderItem->id,

                'addon_id' =>
                $addonId,

                'addon_name_snapshot' =>
                $addon->name,

                'quantity' =>
                $quantity,

                'unit_price' =>
                $addon->price,

                'line_total' =>
                (float)
                $addon->price
                    *
                    $quantity
                    *
                    (float)
                    $orderItem->quantity,

                'estimated_cost_total' =>
                0,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    private function assertStock(
        int $ingredientId,
        float $expected
    ): void {
        $actual =
            (float)
            DB::table(
                'ingredients'
            )
                ->where(
                    'id',
                    $ingredientId
                )
                ->value(
                    'current_stock'
                );

        $this->assertEqualsWithDelta(
            $expected,
            $actual,
            0.0001
        );
    }

    private function assertMovement(
        int $ingredientId,
        int $orderItemId,
        float $quantityDelta
    ): void {
        $movement =
            DB::table(
                'stock_movements'
            )
            ->where(
                'ingredient_id',
                $ingredientId
            )
            ->where(
                'source_type',
                'order_item'
            )
            ->where(
                'source_id',
                $orderItemId
            )
            ->first();

        $this->assertNotNull(
            $movement
        );

        $this->assertSame(
            'SALE_CONSUMPTION',
            $movement
                ->movement_type
        );

        $this->assertEqualsWithDelta(
            $quantityDelta,

            (float)
            $movement
                ->quantity_delta,

            0.0001
        );

        $this->assertNotNull(
            $movement
                ->movement_key
        );

        $this->assertNotSame(
            '',
            trim(
                (string)
                $movement
                    ->movement_key
            )
        );
    }
}
