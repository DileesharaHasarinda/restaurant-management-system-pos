<?php

namespace Tests\Feature;

use App\Models\BusinessDay;
use App\Models\DocumentSequence;
use App\Models\Order;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TakeawayOrderTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;

    private User $waiter;

    private BusinessDay $businessDay;

    private int $unitId;

    private int $ingredientId;

    protected function setUp(): void
    {
        parent::setUp();

        /*
        |--------------------------------------------------------------------------
        | Cashier
        |--------------------------------------------------------------------------
        */

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
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | Waiter
        |--------------------------------------------------------------------------
        |
        | Waiter can create normal dine-in orders,
        | but must NOT be allowed to create a
        | pre-confirmed cashier takeaway.
        |
        */

        $this->waiter =
            $this->createUserWithPermissions(
                roleCode: 'WAITER',
                permissions: [
                    'orders.view',
                    'orders.create',
                    'orders.serve',
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | Open Business Day
        |--------------------------------------------------------------------------
        */

        $this->businessDay =
            BusinessDay::query()
            ->create([
                'business_date' =>
                now()->toDateString(),

                'status' =>
                BusinessDay::STATUS_OPEN,

                'opened_by' =>
                $this->cashier->id,

                'closed_by' =>
                null,

                'opened_at' =>
                now(),

                'closed_at' =>
                null,

                'notes' =>
                'Phase 18 automated test business day.',
            ]);

        /*
        |--------------------------------------------------------------------------
        | TOKEN Sequence
        |--------------------------------------------------------------------------
        */

        DocumentSequence::query()
            ->create([
                'sequence_type' =>
                DocumentSequence::TYPE_TOKEN,

                'prefix' =>
                'TOK',

                'current_number' =>
                0,

                'padding' =>
                4,

                'reset_period' =>
                DocumentSequence::RESET_DAILY,

                'last_reset_key' =>
                null,

                'is_active' =>
                true,
            ]);

        /*
        |--------------------------------------------------------------------------
        | Base Unit
        |--------------------------------------------------------------------------
        */

        $this->unitId =
            DB::table('units')
            ->insertGetId([
                'name' =>
                'Gram',

                'symbol' =>
                'G',

                'measurement_type' =>
                'WEIGHT',

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

        /*
        |--------------------------------------------------------------------------
        | Ingredient With Plenty Of Stock
        |--------------------------------------------------------------------------
        */

        $this->ingredientId =
            DB::table('ingredients')
            ->insertGetId([
                'sku' =>
                'ING-P18-001',

                'name' =>
                'Phase 18 Test Ingredient',

                'base_unit_id' =>
                $this->unitId,

                'current_stock' =>
                10000,

                'reorder_level' =>
                100,

                'average_cost_per_base_unit' =>
                0.50,

                'track_stock' =>
                true,

                'is_active' =>
                true,

                'storage_location' =>
                'TEST',

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Basic Takeaway Creation
    |--------------------------------------------------------------------------
    */

    public function test_cashier_can_create_takeaway_without_table_or_table_session(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Chicken Fried Rice',

                price: 1250.00
            );

        $clientOrderId =
            (string)
            Str::uuid();

        Sanctum::actingAs(
            $this->cashier
        );

        $response =
            $this->postJson(
                '/api/v1/takeaway/orders',
                [
                    'client_order_id' =>
                    $clientOrderId,

                    'customer_name' =>
                    'Nimal Perera',

                    'customer_phone' =>
                    '0771234567',

                    'pickup_notes' =>
                    'Customer will collect in 20 minutes.',

                    'items' => [
                        [
                            'menu_item_id' =>
                            $menuItemId,

                            'variant_id' =>
                            null,

                            'quantity' =>
                            2,

                            'notes' =>
                            'Less spicy',

                            'addons' =>
                            [],
                        ],
                    ],
                ]
            );

        $response
            ->assertStatus(201);

        /** @var Order $order */
        $order =
            Order::query()
            ->where(
                'client_order_id',
                $clientOrderId
            )
            ->firstOrFail();

        /*
         * Core takeaway identity.
         */
        $this->assertSame(
            Order::TYPE_TAKEAWAY,
            $order->order_type
        );

        $this->assertSame(
            Order::SOURCE_CASHIER,
            $order->order_source
        );

        $this->assertSame(
            Order::STATUS_CONFIRMED,
            $order->status
        );

        /*
         * Takeaway does NOT occupy a table.
         */
        $this->assertNull(
            $order->table_id
        );

        $this->assertNull(
            $order->table_session_id
        );

        $this->assertNull(
            $order->session_sequence
        );

        $this->assertNull(
            $order->table_name_snapshot
        );

        /*
         * Public QR status token is not needed
         * for cashier takeaway ordering.
         */
        $this->assertNull(
            $order->public_status_token
        );

        /*
         * Pickup token.
         */
        $this->assertNotNull(
            $order->takeaway_token
        );

        $this->assertMatchesRegularExpression(
            '/^TOK-\d{8}-\d{4}$/',
            $order->takeaway_token
        );

        /*
         * Optional customer details.
         */
        $this->assertSame(
            'Nimal Perera',
            $order->customer_name
        );

        $this->assertSame(
            '0771234567',
            $order->customer_phone
        );

        $this->assertSame(
            'Customer will collect in 20 minutes.',
            $order->customer_notes
        );

        /*
         * Cashier-created takeaway is
         * confirmed immediately.
         */
        $this->assertSame(
            $this->cashier->id,
            (int)
            $order->created_by
        );

        $this->assertSame(
            $this->cashier->id,
            (int)
            $order->confirmed_by
        );

        $this->assertNotNull(
            $order->confirmed_at
        );

        $this->assertNull(
            $order->sent_to_kitchen_at
        );

        /*
         * Server-side price:
         *
         * Rs. 1,250 × 2
         * = Rs. 2,500
         */
        $this->assertSame(
            '2500.00',
            $order->subtotal
        );

        $this->assertSame(
            '2500.00',
            $order->grand_total
        );

        /*
         * Item snapshot.
         */
        $this->assertDatabaseHas(
            'order_items',
            [
                'order_id' =>
                $order->id,

                'menu_item_id' =>
                $menuItemId,

                'item_name_snapshot' =>
                'Chicken Fried Rice',

                'quantity' =>
                2,

                'unit_price' =>
                1250,

                'special_notes' =>
                'Less spicy',
            ]
        );

        /*
         * Initial history starts at CONFIRMED.
         */
        $this->assertDatabaseHas(
            'order_status_histories',
            [
                'order_id' =>
                $order->id,

                'from_status' =>
                null,

                'to_status' =>
                Order::STATUS_CONFIRMED,

                'changed_by' =>
                $this->cashier->id,
            ]
        );

        /*
         * Audit log.
         */
        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'TAKEAWAY_ORDER_CREATED',

                'entity_type' =>
                'order',

                'entity_id' =>
                $order->id,

                'user_id' =>
                $this->cashier->id,
            ]
        );

        /*
         * Phase 18 performs stock availability
         * checking only.
         *
         * Stock is NOT deducted yet.
         */
        $this->assertSame(
            10000.0,
            (float)
            DB::table(
                'ingredients'
            )
                ->where(
                    'id',
                    $this->ingredientId
                )
                ->value(
                    'current_stock'
                )
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Optional Customer Information
    |--------------------------------------------------------------------------
    */

    public function test_customer_details_are_optional_for_takeaway(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Vegetable Rice',

                price: 850
            );

        $clientOrderId =
            (string)
            Str::uuid();

        Sanctum::actingAs(
            $this->cashier
        );

        $this->postJson(
            '/api/v1/takeaway/orders',
            [
                'client_order_id' =>
                $clientOrderId,

                'items' => [
                    [
                        'menu_item_id' =>
                        $menuItemId,

                        'quantity' =>
                        1,

                        'addons' =>
                        [],
                    ],
                ],
            ]
        )
            ->assertStatus(201);

        $order =
            Order::query()
            ->where(
                'client_order_id',
                $clientOrderId
            )
            ->firstOrFail();

        $this->assertNull(
            $order->customer_name
        );

        $this->assertNull(
            $order->customer_phone
        );

        $this->assertNull(
            $order->customer_notes
        );

        $this->assertNotNull(
            $order->takeaway_token
        );
    }

    /*
    |--------------------------------------------------------------------------
    | QR-hidden Items
    |--------------------------------------------------------------------------
    */

    public function test_cashier_can_order_active_item_hidden_from_qr_menu(): void
    {
        /*
         * This menu item and its category are
         * intentionally hidden from customer QR.
         *
         * Staff must still be able to sell it.
         */
        $menuItemId =
            $this->createMenuItem(
                name: 'Staff Only Special',

                price: 990,

                qrVisible: false
            );

        Sanctum::actingAs(
            $this->cashier
        );

        $clientOrderId =
            (string)
            Str::uuid();

        $this->postJson(
            '/api/v1/takeaway/orders',
            [
                'client_order_id' =>
                $clientOrderId,

                'items' => [
                    [
                        'menu_item_id' =>
                        $menuItemId,

                        'quantity' =>
                        1,

                        'addons' =>
                        [],
                    ],
                ],
            ]
        )
            ->assertStatus(201);

        $this->assertDatabaseHas(
            'orders',
            [
                'client_order_id' =>
                $clientOrderId,

                'order_type' =>
                Order::TYPE_TAKEAWAY,

                'order_source' =>
                Order::SOURCE_CASHIER,

                'status' =>
                Order::STATUS_CONFIRMED,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Variant + Add-on Pricing
    |--------------------------------------------------------------------------
    */

    public function test_takeaway_uses_server_variant_and_addon_prices(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Chicken Kottu',

                price: 500,

                qrVisible: true,

                hasVariants: true
            );

        /*
         * Variant price:
         * Rs. 650
         */
        $variantId =
            DB::table(
                'menu_item_variants'
            )
            ->insertGetId([
                'menu_item_id' =>
                $menuItemId,

                'sku' =>
                'VAR-P18-001',

                'name' =>
                'Large',

                'price' =>
                650,

                'is_default' =>
                true,

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

        /*
         * Variant-specific recipe.
         */
        DB::table(
            'recipe_components'
        )
            ->insert([
                'menu_item_id' =>
                $menuItemId,

                'variant_id' =>
                $variantId,

                'ingredient_id' =>
                $this->ingredientId,

                'quantity' =>
                10,

                'unit_id' =>
                $this->unitId,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        /*
         * Add-on group.
         */
        $addonGroupId =
            DB::table(
                'addon_groups'
            )
            ->insertGetId([
                'name' =>
                'Extras',

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

        /*
         * Add-on normal price is Rs. 100.
         *
         * But menu-item override below
         * changes it to Rs. 75.
         */
        $addonId =
            DB::table('addons')
            ->insertGetId([
                'addon_group_id' =>
                $addonGroupId,

                'name' =>
                'Extra Cheese',

                'sku' =>
                'ADD-P18-001',

                'price' =>
                100,

                'is_available' =>
                true,

                'consumes_inventory' =>
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

        DB::table(
            'menu_item_addons'
        )
            ->insert([
                'menu_item_id' =>
                $menuItemId,

                'addon_id' =>
                $addonId,

                'price_override' =>
                75,

                'is_default' =>
                false,

                'sort_order' =>
                1,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        /*
         * Customer/client supplied no price.
         *
         * Server calculates:
         *
         * Large Kottu:
         * 650 × 2 = 1300
         *
         * Extra Cheese:
         * 75 × 1 × 2 = 150
         *
         * Total:
         * 1450
         */
        Sanctum::actingAs(
            $this->cashier
        );

        $clientOrderId =
            (string)
            Str::uuid();

        $this->postJson(
            '/api/v1/takeaway/orders',
            [
                'client_order_id' =>
                $clientOrderId,

                'items' => [
                    [
                        'menu_item_id' =>
                        $menuItemId,

                        'variant_id' =>
                        $variantId,

                        'quantity' =>
                        2,

                        'notes' =>
                        'No onions',

                        'addons' => [
                            [
                                'addon_id' =>
                                $addonId,

                                'quantity' =>
                                1,
                            ],
                        ],
                    ],
                ],
            ]
        )
            ->assertStatus(201);

        $order =
            Order::query()
            ->where(
                'client_order_id',
                $clientOrderId
            )
            ->firstOrFail();

        $this->assertSame(
            '1450.00',
            $order->subtotal
        );

        $this->assertSame(
            '1450.00',
            $order->grand_total
        );

        $orderItem =
            DB::table(
                'order_items'
            )
            ->where(
                'order_id',
                $order->id
            )
            ->first();

        $this->assertNotNull(
            $orderItem
        );

        $this->assertSame(
            $variantId,
            (int)
            $orderItem
                ->menu_item_variant_id
        );

        $this->assertSame(
            'Large',
            $orderItem
                ->variant_name_snapshot
        );

        $this->assertSame(
            650.0,
            (float)
            $orderItem
                ->unit_price
        );

        $this->assertSame(
            'No onions',
            $orderItem
                ->special_notes
        );

        $this->assertDatabaseHas(
            'order_item_addons',
            [
                'order_item_id' =>
                $orderItem->id,

                'addon_id' =>
                $addonId,

                'addon_name_snapshot' =>
                'Extra Cheese',

                'quantity' =>
                1,

                'unit_price' =>
                75,

                'line_total' =>
                150,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency
    |--------------------------------------------------------------------------
    */

    public function test_duplicate_takeaway_submission_returns_same_order_without_duplicate(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Chicken Noodles',

                price: 1100
            );

        $clientOrderId =
            (string)
            Str::uuid();

        $payload = [
            'client_order_id' =>
            $clientOrderId,

            'customer_name' =>
            'Kasun',

            'items' => [
                [
                    'menu_item_id' =>
                    $menuItemId,

                    'quantity' =>
                    1,

                    'addons' =>
                    [],
                ],
            ],
        ];

        Sanctum::actingAs(
            $this->cashier
        );

        $this->postJson(
            '/api/v1/takeaway/orders',
            $payload
        )
            ->assertStatus(201);

        $firstOrder =
            Order::query()
            ->where(
                'client_order_id',
                $clientOrderId
            )
            ->firstOrFail();

        $firstToken =
            $firstOrder
            ->takeaway_token;

        /*
         * Exact retry.
         */
        $this->postJson(
            '/api/v1/takeaway/orders',
            $payload
        )
            ->assertStatus(200);

        $this->assertSame(
            1,
            Order::query()
                ->where(
                    'client_order_id',
                    $clientOrderId
                )
                ->count()
        );

        $retryOrder =
            Order::query()
            ->where(
                'client_order_id',
                $clientOrderId
            )
            ->firstOrFail();

        $this->assertSame(
            $firstOrder->id,
            $retryOrder->id
        );

        $this->assertSame(
            $firstToken,
            $retryOrder
                ->takeaway_token
        );

        /*
         * Token sequence must only have
         * advanced once.
         */
        $sequence =
            DocumentSequence::query()
            ->where(
                'sequence_type',
                DocumentSequence::TYPE_TOKEN
            )
            ->firstOrFail();

        $this->assertSame(
            1,
            $sequence->current_number
        );
    }

    public function test_same_client_order_id_with_different_payload_is_rejected(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Seafood Rice',

                price: 1500
            );

        $clientOrderId =
            (string)
            Str::uuid();

        Sanctum::actingAs(
            $this->cashier
        );

        $this->postJson(
            '/api/v1/takeaway/orders',
            [
                'client_order_id' =>
                $clientOrderId,

                'pickup_notes' =>
                'First submission',

                'items' => [
                    [
                        'menu_item_id' =>
                        $menuItemId,

                        'quantity' =>
                        1,

                        'addons' =>
                        [],
                    ],
                ],
            ]
        )
            ->assertStatus(201);

        /*
         * Same identifier but different payload.
         */
        $this->postJson(
            '/api/v1/takeaway/orders',
            [
                'client_order_id' =>
                $clientOrderId,

                'pickup_notes' =>
                'Changed submission',

                'items' => [
                    [
                        'menu_item_id' =>
                        $menuItemId,

                        'quantity' =>
                        2,

                        'addons' =>
                        [],
                    ],
                ],
            ]
        )
            ->assertStatus(409);

        $this->assertSame(
            1,
            Order::query()
                ->where(
                    'client_order_id',
                    $clientOrderId
                )
                ->count()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | RBAC
    |--------------------------------------------------------------------------
    */

    public function test_waiter_cannot_create_cashier_takeaway_order(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Waiter Permission Test',

                price: 500
            );

        Sanctum::actingAs(
            $this->waiter
        );

        $this->postJson(
            '/api/v1/takeaway/orders',
            [
                'client_order_id' =>
                (string)
                Str::uuid(),

                'items' => [
                    [
                        'menu_item_id' =>
                        $menuItemId,

                        'quantity' =>
                        1,

                        'addons' =>
                        [],
                    ],
                ],
            ]
        )
            ->assertStatus(403);

        $this->assertDatabaseCount(
            'orders',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Phase 17 Kitchen Integration
    |--------------------------------------------------------------------------
    */

    public function test_takeaway_order_can_be_sent_to_kitchen_using_core_lifecycle(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Takeaway Kitchen Test',

                price: 1000
            );

        $clientOrderId =
            (string)
            Str::uuid();

        Sanctum::actingAs(
            $this->cashier
        );

        $this->postJson(
            '/api/v1/takeaway/orders',
            [
                'client_order_id' =>
                $clientOrderId,

                'items' => [
                    [
                        'menu_item_id' =>
                        $menuItemId,

                        'quantity' =>
                        1,

                        'addons' =>
                        [],
                    ],
                ],
            ]
        )
            ->assertStatus(201);

        $order =
            Order::query()
            ->where(
                'client_order_id',
                $clientOrderId
            )
            ->firstOrFail();

        $this->assertSame(
            Order::STATUS_CONFIRMED,
            $order->status
        );

        $item =
            DB::table(
                'order_items'
            )
            ->where(
                'order_id',
                $order->id
            )
            ->first();

        $this->assertNotNull(
            $item
        );

        $this->assertNull(
            $item
                ->sent_to_kitchen_at
        );

        /*
         * Existing Phase 17 endpoint.
         */
        $this->postJson(
            "/api/v1/orders/{$order->id}/send-to-kitchen",
            [
                'notes' =>
                'Send takeaway to kitchen.',
            ]
        )
            ->assertStatus(200);

        $order->refresh();

        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $order->status
        );

        $this->assertNotNull(
            $order
                ->sent_to_kitchen_at
        );

        $sentItem =
            DB::table(
                'order_items'
            )
            ->where(
                'id',
                $item->id
            )
            ->first();

        $this->assertNotNull(
            $sentItem
                ->sent_to_kitchen_at
        );

        /*
         * Kitchen send still does NOT deduct
         * inventory during Phase 18.
         */
        $this->assertDatabaseCount(
            'stock_movements',
            0
        );

        /*
         * Pickup token remains unchanged.
         */
        $this->assertNotNull(
            $order
                ->takeaway_token
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'ORDER_SENT_TO_KITCHEN',

                'entity_type' =>
                'order',

                'entity_id' =>
                $order->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Unique Tokens
    |--------------------------------------------------------------------------
    */

    public function test_each_takeaway_receives_a_different_token(): void
    {
        $menuItemId =
            $this->createMenuItem(
                name: 'Token Test Item',

                price: 600
            );

        Sanctum::actingAs(
            $this->cashier
        );

        foreach (
            range(
                1,
                2
            ) as $index
        ) {
            $this->postJson(
                '/api/v1/takeaway/orders',
                [
                    'client_order_id' =>
                    (string)
                    Str::uuid(),

                    'items' => [
                        [
                            'menu_item_id' =>
                            $menuItemId,

                            'quantity' =>
                            1,

                            'addons' =>
                            [],
                        ],
                    ],
                ]
            )
                ->assertStatus(201);
        }

        $orders =
            Order::query()
            ->where(
                'order_type',
                Order::TYPE_TAKEAWAY
            )
            ->orderBy('id')
            ->get();

        $this->assertCount(
            2,
            $orders
        );

        $this->assertNotSame(
            $orders[0]
                ->takeaway_token,

            $orders[1]
                ->takeaway_token
        );

        $this->assertSame(
            2,

            DocumentSequence::query()
                ->where(
                    'sequence_type',
                    DocumentSequence::TYPE_TOKEN
                )
                ->value(
                    'current_number'
                )
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
                ucfirst(
                    strtolower(
                        $roleCode
                    )
                ),

                'code' =>
                $roleCode,

                'description' =>
                "Phase 18 {$roleCode} role.",

                'is_active' =>
                true,
            ]);

        $permissionIds = [];

        foreach (
            $permissions as $permissionCode
        ) {
            $permission =
                Permission::query()
                ->firstOrCreate(
                    [
                        'code' =>
                        $permissionCode,
                    ],
                    [
                        'name' =>
                        $permissionCode,

                        'group' =>
                        'orders',

                        'description' =>
                        "Permission {$permissionCode}",
                    ]
                );

            $permissionIds[] =
                $permission->id;
        }

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
                "{$roleCode} Phase 18 User",

                'username' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_p18_'
                    .
                    Str::lower(
                        Str::random(6)
                    ),

                'email' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_'
                    .
                    Str::lower(
                        Str::random(6)
                    )
                    .
                    '@example.test',

                'phone' =>
                null,

                'password' =>
                Hash::make(
                    'password'
                ),

                'status' =>
                'ACTIVE',
            ]);
    }

    private function createMenuItem(
        string $name,
        float $price,
        bool $qrVisible = true,
        bool $hasVariants = false
    ): int {
        $slugSuffix =
            Str::lower(
                Str::random(8)
            );

        /*
         * Category.
         */
        $categoryId =
            DB::table(
                'categories'
            )
            ->insertGetId([
                'parent_id' =>
                null,

                'name' =>
                "{$name} Category",

                'slug' =>
                "p18-category-{$slugSuffix}",

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
                $qrVisible,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        /*
         * Menu item.
         */
        $menuItemId =
            DB::table(
                'menu_items'
            )
            ->insertGetId([
                'category_id' =>
                $categoryId,

                'sku' =>
                'MENU-' .
                    Str::upper(
                        Str::random(8)
                    ),

                'name' =>
                $name,

                'slug' =>
                "p18-item-{$slugSuffix}",

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
                $qrVisible,

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

        /*
         * Base recipe.
         *
         * Variant tests create their own
         * variant-specific recipe.
         */
        DB::table(
            'recipe_components'
        )
            ->insert([
                'menu_item_id' =>
                $menuItemId,

                'variant_id' =>
                null,

                'ingredient_id' =>
                $this->ingredientId,

                'quantity' =>
                10,

                'unit_id' =>
                $this->unitId,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        return $menuItemId;
    }
}
