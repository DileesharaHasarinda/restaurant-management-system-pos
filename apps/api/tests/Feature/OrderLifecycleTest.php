<?php

namespace Tests\Feature;

use App\Exceptions\OrderLifecycleException;
use App\Models\BusinessDay;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Permission;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\TableSession;
use App\Models\User;
use App\Services\OrderLifecycleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private OrderLifecycleService $lifecycle;

    private User $manager;

    private BusinessDay $businessDay;

    private RestaurantTable $table;

    private TableSession $tableSession;

    protected function setUp(): void
    {
        parent::setUp();

        $this->lifecycle =
            app(
                OrderLifecycleService::class
            );

        $this->manager =
            $this->createUserWithPermissions(
                roleCode: 'MANAGER',

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

        $this->businessDay =
            BusinessDay::query()
            ->create([
                'business_date' =>
                now()
                    ->toDateString(),

                'status' =>
                BusinessDay::STATUS_OPEN,

                'opened_by' =>
                $this->manager->id,

                'opened_at' =>
                now(),

                'notes' =>
                'Phase 17 automated test business day.',
            ]);

        $this->table =
            RestaurantTable::query()
            ->create([
                'table_number' =>
                1,

                'code' =>
                'T-P17-001',

                'name' =>
                'Phase 17 Table',

                'area' =>
                'Test Area',

                'capacity' =>
                4,

                'status' =>
                RestaurantTable::STATUS_OCCUPIED,

                'qr_ordering_enabled' =>
                true,

                'sort_order' =>
                1,

                'notes' =>
                null,

                'is_active' =>
                true,
            ]);

        $this->tableSession =
            TableSession::query()
            ->create([
                'session_number' =>
                'TS-' .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'table_id' =>
                $this->table->id,

                'guest_count' =>
                2,

                'opened_source' =>
                TableSession::SOURCE_STAFF,

                'status' =>
                TableSession::STATUS_OPEN,

                'opened_by' =>
                $this->manager->id,

                'opened_at' =>
                now(),

                'last_activity_at' =>
                now(),
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Full Lifecycle
    |--------------------------------------------------------------------------
    */

    public function test_order_can_move_through_the_complete_lifecycle(): void
    {
        $order =
            $this->createOrder(
                source: Order::SOURCE_QR_CUSTOMER
            );

        $item =
            $this->addItem(
                $order,
                'Chicken Fried Rice'
            );

        /*
         * PENDING -> CONFIRMED
         */
        $confirmed =
            $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->manager,
                notes: 'Approved by cashier.'
            );

        $this->assertTrue(
            $confirmed['changed']
        );

        $this->assertSame(
            Order::STATUS_CONFIRMED,
            $order->fresh()->status
        );

        $this->assertNotNull(
            $order
                ->fresh()
                ->confirmed_at
        );

        $this->assertSame(
            $this->manager->id,
            (int)
            $order
                ->fresh()
                ->confirmed_by
        );

        /*
         * Repeating confirm is idempotent.
         */
        $confirmedAgain =
            $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->manager
            );

        $this->assertFalse(
            $confirmedAgain['changed']
        );

        /*
         * CONFIRMED -> SENT_TO_KITCHEN
         */
        $sent =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->manager,
                notes: 'Kitchen batch sent.'
            );

        $this->assertTrue(
            $sent['changed']
        );

        $this->assertSame(
            [
                $item->id,
            ],
            $sent['affected_item_ids']
        );

        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $order->fresh()->status
        );

        $this->assertNotNull(
            $order
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertNotNull(
            $item
                ->fresh()
                ->sent_to_kitchen_at
        );

        /*
         * Sending again with no new items
         * is safely idempotent.
         */
        $sentAgain =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->manager
            );

        $this->assertFalse(
            $sentAgain['changed']
        );

        $this->assertSame(
            [],
            $sentAgain['affected_item_ids']
        );

        /*
         * SENT_TO_KITCHEN -> SERVED
         */
        $served =
            $this->lifecycle
            ->serve(
                order: $order,
                actor: $this->manager
            );

        $this->assertTrue(
            $served['changed']
        );

        $this->assertSame(
            Order::STATUS_SERVED,
            $order->fresh()->status
        );

        $this->assertNotNull(
            $order
                ->fresh()
                ->served_at
        );

        /*
         * SERVED -> COMPLETED
         */
        $completed =
            $this->lifecycle
            ->complete(
                order: $order,
                actor: $this->manager
            );

        $this->assertTrue(
            $completed['changed']
        );

        $this->assertSame(
            Order::STATUS_COMPLETED,
            $order->fresh()->status
        );

        $this->assertNotNull(
            $order
                ->fresh()
                ->completed_at
        );

        /*
         * Exact transition history.
         */
        $history =
            $order
            ->statusHistories()
            ->orderBy('id')
            ->get();

        $this->assertSame(
            [
                Order::STATUS_CONFIRMED,
                Order::STATUS_SENT_TO_KITCHEN,
                Order::STATUS_SERVED,
                Order::STATUS_COMPLETED,
            ],
            $history
                ->pluck('to_status')
                ->all()
        );

        $this->assertSame(
            [
                Order::STATUS_PENDING,
                Order::STATUS_CONFIRMED,
                Order::STATUS_SENT_TO_KITCHEN,
                Order::STATUS_SERVED,
            ],
            $history
                ->pluck('from_status')
                ->all()
        );

        /*
         * Audit trail exists.
         */
        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'ORDER_CONFIRMED',

                'entity_type' =>
                'order',

                'entity_id' =>
                $order->id,

                'user_id' =>
                $this->manager->id,
            ]
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

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'ORDER_SERVED',

                'entity_type' =>
                'order',

                'entity_id' =>
                $order->id,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'ORDER_COMPLETED',

                'entity_type' =>
                'order',

                'entity_id' =>
                $order->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Invalid Transition
    |--------------------------------------------------------------------------
    */

    public function test_pending_order_cannot_jump_directly_to_served(): void
    {
        $order =
            $this->createOrder();

        $this->addItem(
            $order
        );

        try {
            $this->lifecycle
                ->serve(
                    order: $order,
                    actor: $this->manager
                );

            $this->fail(
                'Expected INVALID_ORDER_TRANSITION was not thrown.'
            );
        } catch (
            OrderLifecycleException $exception
        ) {
            $this->assertSame(
                'INVALID_ORDER_TRANSITION',
                $exception->errorCode
            );

            $this->assertSame(
                409,
                $exception->status
            );
        }

        $this->assertSame(
            Order::STATUS_PENDING,
            $order->fresh()->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Rejection
    |--------------------------------------------------------------------------
    */

    public function test_pending_order_can_be_rejected(): void
    {
        $order =
            $this->createOrder(
                source: Order::SOURCE_QR_CUSTOMER
            );

        $this->addItem(
            $order
        );

        $reason =
            'Requested item cannot currently be prepared.';

        $result =
            $this->lifecycle
            ->reject(
                order: $order,
                actor: $this->manager,
                reason: $reason
            );

        $this->assertTrue(
            $result['changed']
        );

        $fresh =
            $order->fresh();

        $this->assertSame(
            Order::STATUS_REJECTED,
            $fresh->status
        );

        $this->assertSame(
            $this->manager->id,
            (int)
            $fresh->rejected_by
        );

        $this->assertNotNull(
            $fresh->rejected_at
        );

        $this->assertSame(
            $reason,
            $fresh->rejection_reason
        );

        $this->assertDatabaseHas(
            'order_status_histories',
            [
                'order_id' =>
                $order->id,

                'from_status' =>
                Order::STATUS_PENDING,

                'to_status' =>
                Order::STATUS_REJECTED,

                'changed_by' =>
                $this->manager->id,

                'notes' =>
                $reason,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'ORDER_REJECTED',

                'entity_type' =>
                'order',

                'entity_id' =>
                $order->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cancellation
    |--------------------------------------------------------------------------
    */

    public function test_orders_can_be_cancelled_from_all_allowed_states(): void
    {
        $statuses = [
            Order::STATUS_PENDING,
            Order::STATUS_CONFIRMED,
            Order::STATUS_SENT_TO_KITCHEN,
            Order::STATUS_SERVED,
        ];

        foreach (
            $statuses as $status
        ) {
            $order =
                $this->createOrder();

            $item =
                $this->addItem(
                    $order,
                    "Cancellation Test {$status}"
                );

            $this->moveOrderTo(
                order: $order,
                targetStatus: $status
            );

            $reason =
                "Cancelled from {$status}.";

            $result =
                $this->lifecycle
                ->cancel(
                    order: $order,
                    actor: $this->manager,
                    reason: $reason
                );

            $this->assertTrue(
                $result['changed']
            );

            $fresh =
                $order->fresh();

            $this->assertSame(
                Order::STATUS_CANCELLED,
                $fresh->status
            );

            $this->assertSame(
                $this->manager->id,
                (int)
                $fresh->cancelled_by
            );

            $this->assertNotNull(
                $fresh->cancelled_at
            );

            $this->assertSame(
                $reason,
                $fresh->cancellation_reason
            );

            $this->assertSame(
                OrderItem::STATUS_CANCELLED,
                $item->fresh()->status
            );

            $this->assertNotNull(
                $item
                    ->fresh()
                    ->cancelled_at
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Terminal States
    |--------------------------------------------------------------------------
    */

    public function test_completed_order_cannot_be_cancelled(): void
    {
        $order =
            $this->createOrder();

        $this->addItem(
            $order
        );

        $this->moveOrderTo(
            order: $order,
            targetStatus: Order::STATUS_SERVED
        );

        $this->lifecycle
            ->complete(
                order: $order,
                actor: $this->manager
            );

        try {
            $this->lifecycle
                ->cancel(
                    order: $order,
                    actor: $this->manager,
                    reason: 'This must not be accepted.'
                );

            $this->fail(
                'Completed order was incorrectly allowed to cancel.'
            );
        } catch (
            OrderLifecycleException $exception
        ) {
            $this->assertSame(
                'INVALID_ORDER_TRANSITION',
                $exception->errorCode
            );
        }

        $this->assertSame(
            Order::STATUS_COMPLETED,
            $order->fresh()->status
        );
    }

    public function test_rejected_order_cannot_be_confirmed_again(): void
    {
        $order =
            $this->createOrder();

        $this->addItem(
            $order
        );

        $this->lifecycle
            ->reject(
                order: $order,
                actor: $this->manager,
                reason: 'Reject this order.'
            );

        try {
            $this->lifecycle
                ->confirm(
                    order: $order,
                    actor: $this->manager
                );

            $this->fail(
                'Rejected order was incorrectly allowed to confirm.'
            );
        } catch (
            OrderLifecycleException $exception
        ) {
            $this->assertSame(
                'INVALID_ORDER_TRANSITION',
                $exception->errorCode
            );
        }

        $this->assertSame(
            Order::STATUS_REJECTED,
            $order->fresh()->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Customer QR Additional Items
    |--------------------------------------------------------------------------
    */

    public function test_customer_qr_addition_requires_approval_again_and_only_new_items_are_sent(): void
    {
        $order =
            $this->createOrder(
                source: Order::SOURCE_QR_CUSTOMER
            );

        $originalItem =
            $this->addItem(
                $order,
                'Chicken Fried Rice'
            );

        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->manager
            );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->manager
            );

        $originalSentAt =
            $originalItem
            ->fresh()
            ->sent_to_kitchen_at;

        $this->assertNotNull(
            $originalSentAt
        );

        /*
         * Simulate Phase 15 Order More:
         * the new item itself has not entered
         * the kitchen yet.
         */
        $newItem =
            $this->addItem(
                $order,
                'Ice Cream Sundae'
            );

        $this->assertNull(
            $newItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        $reopened =
            $this->lifecycle
            ->reopenForAdditionalItems(
                order: $order,
                actor: null,
                source: Order::SOURCE_QR_CUSTOMER
            );

        $this->assertSame(
            Order::STATUS_PENDING,
            $reopened->status
        );

        /*
         * Original kitchen item remains sent.
         */
        $this->assertNotNull(
            $originalItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        /*
         * New customer item remains unsent.
         */
        $this->assertNull(
            $newItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        /*
         * Cashier approves the additional
         * customer order.
         */
        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->manager
            );

        $sendResult =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->manager
            );

        /*
         * Only the new item belongs in the
         * additional kitchen batch.
         */
        $this->assertSame(
            [
                $newItem->id,
            ],
            $sendResult['affected_item_ids']
        );

        $this->assertSame(
            $originalSentAt
                ->toISOString(),

            $originalItem
                ->fresh()
                ->sent_to_kitchen_at
                ?->toISOString()
        );

        $this->assertNotNull(
            $newItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $order->fresh()->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Waiter Additional Items
    |--------------------------------------------------------------------------
    */

    public function test_waiter_addition_returns_order_to_confirmed_and_only_new_items_are_sent(): void
    {
        $order =
            $this->createOrder(
                source: Order::SOURCE_WAITER
            );

        $originalItem =
            $this->addItem(
                $order,
                'Chicken Kottu'
            );

        /*
         * Waiter orders enter Phase 17 as
         * CONFIRMED.
         *
         * We use the lifecycle here to create
         * that state safely for the test.
         */
        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->manager
            );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->manager
            );

        $this->assertNotNull(
            $originalItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        $newItem =
            $this->addItem(
                $order,
                'Coca Cola'
            );

        $reopened =
            $this->lifecycle
            ->reopenForAdditionalItems(
                order: $order,
                actor: $this->manager,
                source: Order::SOURCE_WAITER
            );

        /*
         * Staff additions do not require the
         * customer QR approval step.
         */
        $this->assertSame(
            Order::STATUS_CONFIRMED,
            $reopened->status
        );

        $this->assertNotNull(
            $originalItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertNull(
            $newItem
                ->fresh()
                ->sent_to_kitchen_at
        );

        $sendResult =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->manager
            );

        $this->assertSame(
            [
                $newItem->id,
            ],
            $sendResult['affected_item_ids']
        );

        $this->assertNotNull(
            $newItem
                ->fresh()
                ->sent_to_kitchen_at
        );
    }

    /*
    |--------------------------------------------------------------------------
    | WAITER RBAC
    |--------------------------------------------------------------------------
    */

    public function test_waiter_cannot_confirm_or_send_orders_to_kitchen(): void
    {
        $waiter =
            $this->createUserWithPermissions(
                roleCode: 'WAITER',

                permissions: [
                    'orders.view',
                    'orders.create',
                    'orders.serve',
                ]
            );

        $order =
            $this->createOrder();

        $this->addItem(
            $order
        );

        Sanctum::actingAs(
            $waiter,
            ['*']
        );

        $this
            ->postJson(
                "/api/v1/orders/{$order->id}/confirm"
            )
            ->assertForbidden();

        $this
            ->postJson(
                "/api/v1/orders/{$order->id}/send-to-kitchen"
            )
            ->assertForbidden();

        /*
         * Middleware rejection must leave the
         * order untouched.
         */
        $this->assertSame(
            Order::STATUS_PENDING,
            $order->fresh()->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Authorized Staff API
    |--------------------------------------------------------------------------
    */

    public function test_authorized_staff_can_use_core_order_lifecycle_endpoints(): void
    {
        $cashier =
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

        $order =
            $this->createOrder();

        $this->addItem(
            $order,
            'API Lifecycle Item'
        );

        Sanctum::actingAs(
            $cashier,
            ['*']
        );

        /*
         * PENDING -> CONFIRMED
         */
        $this
            ->postJson(
                "/api/v1/orders/{$order->id}/confirm",
                [
                    'notes' =>
                    'Cashier approved.',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'success',
                true
            )
            ->assertJsonPath(
                'data.status',
                Order::STATUS_CONFIRMED
            )
            ->assertJsonPath(
                'meta.changed',
                true
            );

        /*
         * CONFIRMED -> SENT_TO_KITCHEN
         */
        $this
            ->postJson(
                "/api/v1/orders/{$order->id}/send-to-kitchen"
            )
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                Order::STATUS_SENT_TO_KITCHEN
            );

        /*
         * SENT_TO_KITCHEN -> SERVED
         */
        $this
            ->postJson(
                "/api/v1/orders/{$order->id}/serve"
            )
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                Order::STATUS_SERVED
            );

        /*
         * SERVED -> COMPLETED
         */
        $this
            ->postJson(
                "/api/v1/orders/{$order->id}/complete"
            )
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                Order::STATUS_COMPLETED
            );

        /*
         * Terminal state cannot be cancelled.
         */
        $this
            ->postJson(
                "/api/v1/orders/{$order->id}/cancel",
                [
                    'reason' =>
                    'This must fail.',
                ]
            )
            ->assertStatus(
                409
            )
            ->assertJsonPath(
                'code',
                'INVALID_ORDER_TRANSITION'
            );

        $this->assertSame(
            Order::STATUS_COMPLETED,
            $order->fresh()->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | API Invalid Transition
    |--------------------------------------------------------------------------
    */

    public function test_api_rejects_invalid_order_transition(): void
    {
        $cashier =
            $this->createUserWithPermissions(
                roleCode: 'CASHIER',

                permissions: [
                    'orders.view',
                    'orders.serve',
                ]
            );

        $order =
            $this->createOrder();

        $this->addItem(
            $order
        );

        Sanctum::actingAs(
            $cashier,
            ['*']
        );

        $this
            ->postJson(
                "/api/v1/orders/{$order->id}/serve"
            )
            ->assertStatus(
                409
            )
            ->assertJsonPath(
                'success',
                false
            )
            ->assertJsonPath(
                'code',
                'INVALID_ORDER_TRANSITION'
            );

        $this->assertSame(
            Order::STATUS_PENDING,
            $order->fresh()->status
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
                "{$roleCode} test role.",

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
                                'Orders',

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
                "{$roleCode} Test User",

                'username' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_'
                    .
                    Str::lower(
                        Str::random(
                            8
                        )
                    ),

                'email' =>
                Str::lower(
                    Str::random(
                        12
                    )
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

    private function createOrder(
        string $source =
        Order::SOURCE_QR_CUSTOMER
    ): Order {
        $sequence =
            Order::query()
            ->where(
                'table_session_id',
                $this
                    ->tableSession
                    ->id
            )
            ->count()
            + 1;

        return Order::query()
            ->create([
                'order_number' =>
                'ORD-TEST-' .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'table_session_id' =>
                $this->tableSession->id,

                'table_id' =>
                $this->table->id,

                'order_type' =>
                Order::TYPE_DINE_IN,

                'order_source' =>
                $source,

                'session_sequence' =>
                $sequence,

                'table_name_snapshot' =>
                $this->table->name,

                'customer_name' =>
                null,

                'customer_phone' =>
                null,

                'status' =>
                Order::STATUS_PENDING,

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
                $source
                    === Order::SOURCE_QR_CUSTOMER
                    ? null
                    : $this->manager->id,
            ]);
    }

    private function addItem(
        Order $order,
        string $name =
        'Test Menu Item',
        float $price = 100.00
    ): OrderItem {
        $item =
            OrderItem::query()
            ->create([
                'order_id' =>
                $order->id,

                'menu_item_id' =>
                null,

                'menu_item_variant_id' =>
                null,

                'item_name_snapshot' =>
                $name,

                'variant_name_snapshot' =>
                null,

                'quantity' =>
                1,

                'unit_price' =>
                $price,

                'gross_total' =>
                $price,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'line_total' =>
                $price,

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
                    $price,
                2
            );

        $freshOrder->update([
            'subtotal' =>
            $subtotal,

            'grand_total' =>
            $subtotal,
        ]);

        return $item;
    }

    private function moveOrderTo(
        Order $order,
        string $targetStatus
    ): void {
        if (
            $targetStatus
            === Order::STATUS_PENDING
        ) {
            return;
        }

        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->manager
            );

        if (
            $targetStatus
            === Order::STATUS_CONFIRMED
        ) {
            return;
        }

        $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->manager
            );

        if (
            $targetStatus
            === Order::STATUS_SENT_TO_KITCHEN
        ) {
            return;
        }

        $this->lifecycle
            ->serve(
                order: $order,
                actor: $this->manager
            );

        if (
            $targetStatus
            === Order::STATUS_SERVED
        ) {
            return;
        }

        throw new \InvalidArgumentException(
            "Unsupported target status {$targetStatus}."
        );
    }
}
