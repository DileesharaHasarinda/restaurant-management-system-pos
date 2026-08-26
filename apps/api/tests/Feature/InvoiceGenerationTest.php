<?php

namespace Tests\Feature;

use App\Models\BusinessDay;
use App\Models\DocumentSequence;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Permission;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\TableSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceGenerationTest extends TestCase
{
    use RefreshDatabase;

    private User $billingUser;

    private User $unauthorizedUser;

    private BusinessDay $businessDay;

    protected function setUp(): void
    {
        parent::setUp();

        /*
        |--------------------------------------------------------------------------
        | Authorized Billing User
        |--------------------------------------------------------------------------
        */

        $this->billingUser =
            $this->createUserWithPermissions(
                roleCode: 'P27_BILLING',
                permissions: [
                    'invoices.view',
                    'invoices.create',

                    /*
                     * Required by merged-table billing test.
                     */
                    'tables.view',
                    'tables.merge',
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | Unauthorized User
        |--------------------------------------------------------------------------
        */

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'P27_NO_BILLING',
                permissions: []
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
                $this->billingUser->id,

                'opened_at' =>
                now(),

                'notes' =>
                'Phase 27 billing automated test business day.',
            ]);

        /*
        |--------------------------------------------------------------------------
        | Invoice Number Sequence
        |--------------------------------------------------------------------------
        */

        DocumentSequence::query()
            ->create([
                'sequence_type' =>
                DocumentSequence::TYPE_INVOICE,

                'prefix' =>
                'INV',

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
    }

    /*
    |--------------------------------------------------------------------------
    | Takeaway Invoice + Idempotency
    |--------------------------------------------------------------------------
    */

    public function test_takeaway_invoice_is_generated_once_and_repeated_request_is_idempotent(): void
    {
        $order =
            $this->createOrder(
                type: Order::TYPE_TAKEAWAY,
                status: Order::STATUS_SERVED,
                subtotal: 2500,
                customerName: 'Nimal Perera',
                customerPhone: '0771234567'
            );

        $this->addOrderItem(
            order: $order,
            name: 'Chicken Fried Rice',
            quantity: 2,
            unitPrice: 1250,
            lineTotal: 2500
        );

        Sanctum::actingAs(
            $this->billingUser
        );

        /*
        |--------------------------------------------------------------------------
        | First Request
        |--------------------------------------------------------------------------
        */

        $firstResponse =
            $this->postJson(
                "/api/v1/orders/{$order->id}/invoice"
            );

        $firstResponse
            ->assertStatus(201)
            ->assertJsonPath(
                'data.created',
                true
            );

        $invoiceId =
            (int)
            $firstResponse
                ->json(
                    'data.invoice.id'
                );

        $this->assertGreaterThan(
            0,
            $invoiceId
        );

        $invoiceNumber =
            $firstResponse
            ->json(
                'data.invoice.invoice_number'
            );

        $this->assertMatchesRegularExpression(
            '/^INV-\d{8}-\d{4}$/',
            $invoiceNumber
        );

        $firstResponse
            ->assertJsonPath(
                'data.invoice.status',
                Invoice::STATUS_ISSUED
            )
            ->assertJsonPath(
                'data.invoice.payment.status',
                Invoice::PAYMENT_STATUS_UNPAID
            );

        $this->assertEquals(
            2500,
            $firstResponse->json(
                'data.invoice.totals.subtotal'
            )
        );

        $this->assertEquals(
            2500,
            $firstResponse->json(
                'data.invoice.totals.grand_total'
            )
        );

        $this->assertEquals(
            2500,
            $firstResponse->json(
                'data.invoice.payment.balance_due'
            )
        );

        $this->assertEquals(
            0,
            $firstResponse->json(
                'data.invoice.payment.paid_amount'
            )
        );

        $this->assertDatabaseCount(
            'invoices',
            1
        );

        $this->assertDatabaseCount(
            'invoice_items',
            1
        );

        /*
        |--------------------------------------------------------------------------
        | Second Request
        |--------------------------------------------------------------------------
        |
        | Must return the SAME invoice.
        |
        */

        $secondResponse =
            $this->postJson(
                "/api/v1/orders/{$order->id}/invoice"
            );

        $secondResponse
            ->assertStatus(200)
            ->assertJsonPath(
                'data.created',
                false
            )
            ->assertJsonPath(
                'data.invoice.id',
                $invoiceId
            );

        $this->assertDatabaseCount(
            'invoices',
            1
        );

        $this->assertDatabaseCount(
            'invoice_items',
            1
        );

        /*
        |--------------------------------------------------------------------------
        | Audit Must Also Be Idempotent
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            1,
            DB::table('audit_logs')
                ->where(
                    'action',
                    'INVOICE_ISSUED'
                )
                ->where(
                    'entity_id',
                    $invoiceId
                )
                ->count()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Historical Snapshots
    |--------------------------------------------------------------------------
    */

    public function test_invoice_remains_unchanged_after_menu_variant_addon_and_order_values_change(): void
    {
        $menu =
            $this
            ->createLiveMenuWithVariantAndAddon();

        /*
         * Sale-time values:
         *
         * Large Fried Rice:
         *
         * Rs. 1,500 × 2
         * = Rs. 3,000
         *
         * Extra Cheese:
         *
         * Rs. 200 × 1 × 2
         * = Rs. 400
         *
         * Subtotal = Rs. 3,400
         *
         * Discount       = Rs. 100
         * Service Charge = Rs. 170
         * Tax            = Rs. 340
         *
         * Grand Total:
         *
         * 3400 - 100 + 170 + 340
         * = 3810
         */

        $order =
            $this->createOrder(
                type: Order::TYPE_TAKEAWAY,
                status: Order::STATUS_SERVED,
                subtotal: 3400,
                discount: 100,
                tax: 340,
                serviceCharge: 170,
                customerName: 'Kamal Silva',
                customerPhone: '0711111111'
            );

        $orderItem =
            $this->addOrderItem(
                order: $order,

                name: 'Chicken Fried Rice',

                variantName: 'Large',

                quantity: 2,

                unitPrice: 1500,

                lineTotal: 3400,

                menuItemId: $menu['menu_item_id'],

                variantId: $menu['variant_id']
            );

        $orderAddon =
            $this->addOrderItemAddon(
                orderItem: $orderItem,

                addonId: $menu['addon_id'],

                name: 'Extra Cheese',

                quantityPerItem: 1,

                unitPrice: 200,

                lineTotal: 400
            );

        Sanctum::actingAs(
            $this->billingUser
        );

        /*
        |--------------------------------------------------------------------------
        | Generate Invoice Today
        |--------------------------------------------------------------------------
        */

        $response =
            $this->postJson(
                "/api/v1/orders/{$order->id}/invoice"
            );

        $response
            ->assertStatus(201);

        $invoiceId =
            (int)
            $response
                ->json(
                    'data.invoice.id'
                );

        /*
        |--------------------------------------------------------------------------
        | Verify Initial Invoice Snapshot
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            'Chicken Fried Rice',
            $response->json(
                'data.invoice.items.0.name'
            )
        );

        $this->assertSame(
            'Large',
            $response->json(
                'data.invoice.items.0.variant'
            )
        );

        $this->assertEquals(
            2,
            $response->json(
                'data.invoice.items.0.quantity'
            )
        );

        $this->assertEquals(
            1500,
            $response->json(
                'data.invoice.items.0.unit_price'
            )
        );

        $this->assertSame(
            'Extra Cheese',
            $response->json(
                'data.invoice.items.0.addons.0.name'
            )
        );

        $this->assertEquals(
            200,
            $response->json(
                'data.invoice.items.0.addons.0.unit_price'
            )
        );

        $this->assertEquals(
            1,
            $response->json(
                'data.invoice.items.0.addons.0.quantity_per_item'
            )
        );

        $this->assertEquals(
            2,
            $response->json(
                'data.invoice.items.0.addons.0.total_quantity'
            )
        );

        $this->assertEquals(
            400,
            $response->json(
                'data.invoice.items.0.addons.0.line_total'
            )
        );

        $this->assertEquals(
            3400,
            $response->json(
                'data.invoice.totals.subtotal'
            )
        );

        $this->assertEquals(
            100,
            $response->json(
                'data.invoice.totals.discount'
            )
        );

        $this->assertEquals(
            170,
            $response->json(
                'data.invoice.totals.service_charge'
            )
        );

        $this->assertEquals(
            340,
            $response->json(
                'data.invoice.totals.tax'
            )
        );

        $this->assertEquals(
            3810,
            $response->json(
                'data.invoice.totals.grand_total'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Tomorrow - Change Live Menu Prices / Names
        |--------------------------------------------------------------------------
        */

        DB::table('menu_items')
            ->where(
                'id',
                $menu['menu_item_id']
            )
            ->update([
                'name' =>
                'NEW Fried Rice Name',

                'price' =>
                9999,

                'updated_at' =>
                now(),
            ]);

        DB::table('menu_item_variants')
            ->where(
                'id',
                $menu['variant_id']
            )
            ->update([
                'name' =>
                'NEW XXL Variant',

                'price' =>
                8888,

                'updated_at' =>
                now(),
            ]);

        DB::table('addons')
            ->where(
                'id',
                $menu['addon_id']
            )
            ->update([
                'name' =>
                'NEW Cheese Name',

                'price' =>
                777,

                'updated_at' =>
                now(),
            ]);

        DB::table('menu_item_addons')
            ->where(
                'menu_item_id',
                $menu['menu_item_id']
            )
            ->where(
                'addon_id',
                $menu['addon_id']
            )
            ->update([
                'price_override' =>
                999,

                'updated_at' =>
                now(),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Also Change Source Order After Invoice
        |--------------------------------------------------------------------------
        |
        | Even the original order must no longer be authoritative
        | after invoice issuance.
        |
        */

        $order->update([
            'subtotal' =>
            1,

            'discount_total' =>
            0,

            'tax_total' =>
            0,

            'service_charge_total' =>
            0,

            'grand_total' =>
            1,
        ]);

        $orderItem->update([
            'item_name_snapshot' =>
            'CHANGED SOURCE ORDER ITEM',

            'variant_name_snapshot' =>
            'CHANGED SOURCE VARIANT',

            'unit_price' =>
            1,

            'gross_total' =>
            2,

            'line_total' =>
            2,
        ]);

        $orderAddon->update([
            'addon_name_snapshot' =>
            'CHANGED SOURCE ADDON',

            'unit_price' =>
            1,

            'line_total' =>
            2,
        ]);

        /*
        |--------------------------------------------------------------------------
        | Reload Old Invoice
        |--------------------------------------------------------------------------
        */

        $oldInvoice =
            $this->getJson(
                "/api/v1/invoices/{$invoiceId}"
            );

        $oldInvoice
            ->assertStatus(200);

        /*
        |--------------------------------------------------------------------------
        | Historical Values MUST Remain Unchanged
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            'Chicken Fried Rice',
            $oldInvoice->json(
                'data.items.0.name'
            )
        );

        $this->assertSame(
            'Large',
            $oldInvoice->json(
                'data.items.0.variant'
            )
        );

        $this->assertEquals(
            1500,
            $oldInvoice->json(
                'data.items.0.unit_price'
            )
        );

        $this->assertSame(
            'Extra Cheese',
            $oldInvoice->json(
                'data.items.0.addons.0.name'
            )
        );

        $this->assertEquals(
            200,
            $oldInvoice->json(
                'data.items.0.addons.0.unit_price'
            )
        );

        $this->assertEquals(
            400,
            $oldInvoice->json(
                'data.items.0.addons.0.line_total'
            )
        );

        $this->assertEquals(
            3400,
            $oldInvoice->json(
                'data.totals.subtotal'
            )
        );

        $this->assertEquals(
            100,
            $oldInvoice->json(
                'data.totals.discount'
            )
        );

        $this->assertEquals(
            170,
            $oldInvoice->json(
                'data.totals.service_charge'
            )
        );

        $this->assertEquals(
            340,
            $oldInvoice->json(
                'data.totals.tax'
            )
        );

        $this->assertEquals(
            3810,
            $oldInvoice->json(
                'data.totals.grand_total'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Database Snapshot Verification
        |--------------------------------------------------------------------------
        */

        /** @var InvoiceItem $invoiceItem */
        $invoiceItem =
            InvoiceItem::query()
            ->where(
                'invoice_id',
                $invoiceId
            )
            ->firstOrFail();

        $this->assertSame(
            'Chicken Fried Rice',
            $invoiceItem
                ->item_name_snapshot
        );

        $this->assertSame(
            'Large',
            $invoiceItem
                ->variant_name_snapshot
        );

        $this->assertSame(
            '1500.00',
            $invoiceItem
                ->unit_price
        );

        $addonSnapshot =
            $invoiceItem
                ->addons_snapshot[0];

        $this->assertSame(
            'Extra Cheese',
            $addonSnapshot['name']
        );

        $this->assertEquals(
            200,
            $addonSnapshot['unit_price']
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Dine-in Multiple Orders
    |--------------------------------------------------------------------------
    */

    public function test_multiple_dine_in_orders_generate_one_final_table_session_invoice(): void
    {
        $table =
            $this->createTable(
                number: 27,
                capacity: 10
            );

        $session =
            $this->createOpenSession(
                table: $table
            );

        $firstOrder =
            $this->createOrder(
                type: Order::TYPE_DINE_IN,
                status: Order::STATUS_SERVED,
                subtotal: 1200,
                tableSession: $session,
                table: $table,
                sequence: 1,
                customerName: 'Table Customer'
            );

        $this->addOrderItem(
            order: $firstOrder,
            name: 'Chicken Burger',
            quantity: 1,
            unitPrice: 1200,
            lineTotal: 1200
        );

        $secondOrder =
            $this->createOrder(
                type: Order::TYPE_DINE_IN,
                status: Order::STATUS_SERVED,
                subtotal: 800,
                tableSession: $session,
                table: $table,
                sequence: 2
            );

        $this->addOrderItem(
            order: $secondOrder,
            name: 'Chocolate Milkshake',
            quantity: 1,
            unitPrice: 800,
            lineTotal: 800
        );

        Sanctum::actingAs(
            $this->billingUser
        );

        $response =
            $this->postJson(
                "/api/v1/table-sessions/{$session->id}/invoice"
            );

        $response
            ->assertStatus(201)
            ->assertJsonPath(
                'data.created',
                true
            );

        $invoiceId =
            (int)
            $response->json(
                'data.invoice.id'
            );

        $this->assertNull(
            $response->json(
                'data.invoice.order_id'
            )
        );

        $response
            ->assertJsonPath(
                'data.invoice.table_session_id',
                $session->id
            );

        $this->assertSame(
            $table->name,
            $response->json(
                'data.invoice.table_name'
            )
        );

        $response
            ->assertJsonCount(
                2,
                'data.invoice.items'
            );

        $this->assertEquals(
            2000,
            $response->json(
                'data.invoice.totals.subtotal'
            )
        );

        $this->assertEquals(
            2000,
            $response->json(
                'data.invoice.totals.grand_total'
            )
        );

        /*
         * Generate from one individual dine-in order.
         *
         * It must still return the SAME session invoice.
         */

        $again =
            $this->postJson(
                "/api/v1/orders/{$firstOrder->id}/invoice"
            );

        $again
            ->assertStatus(200)
            ->assertJsonPath(
                'data.created',
                false
            )
            ->assertJsonPath(
                'data.invoice.id',
                $invoiceId
            );

        $this->assertDatabaseCount(
            'invoices',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Merged Table Billing
    |--------------------------------------------------------------------------
    */

    public function test_merged_table_orders_generate_one_invoice_using_surviving_session(): void
    {
        $primaryTable =
            $this->createTable(
                number: 31,
                capacity: 10
            );

        $secondaryTable =
            $this->createTable(
                number: 32,
                capacity: 6
            );

        $primarySession =
            $this->createOpenSession(
                table: $primaryTable,
                guestCount: 2
            );

        $secondarySession =
            $this->createOpenSession(
                table: $secondaryTable,
                guestCount: 2
            );

        $primaryOrder =
            $this->createOrder(
                type: Order::TYPE_DINE_IN,
                status: Order::STATUS_SERVED,
                subtotal: 1000,
                tableSession: $primarySession,
                table: $primaryTable,
                sequence: 1
            );

        $this->addOrderItem(
            order: $primaryOrder,
            name: 'Primary Table Meal',
            quantity: 1,
            unitPrice: 1000,
            lineTotal: 1000
        );

        $secondaryOrder =
            $this->createOrder(
                type: Order::TYPE_DINE_IN,
                status: Order::STATUS_SERVED,
                subtotal: 1500,
                tableSession: $secondarySession,
                table: $secondaryTable,
                sequence: 1
            );

        $this->addOrderItem(
            order: $secondaryOrder,
            name: 'Secondary Table Meal',
            quantity: 1,
            unitPrice: 1500,
            lineTotal: 1500
        );

        Sanctum::actingAs(
            $this->billingUser
        );

        /*
        |--------------------------------------------------------------------------
        | Merge Secondary Into Primary
        |--------------------------------------------------------------------------
        */

        $mergeResponse =
            $this->postJson(
                "/api/v1/tables/{$primaryTable->id}/merge",
                [
                    'secondary_table_id' =>
                    $secondaryTable->id,

                    'reason' =>
                    'Phase 27 final billing merge.',
                ]
            );

        $mergeResponse
            ->assertStatus(200);

        $secondarySession->refresh();

        $this->assertSame(
            TableSession::STATUS_MERGED,
            $secondarySession->status
        );

        $this->assertSame(
            $primarySession->id,
            (int)
            $secondarySession
                ->merged_into_session_id
        );

        /*
        |--------------------------------------------------------------------------
        | Generate Using OLD Secondary Session ID
        |--------------------------------------------------------------------------
        |
        | Invoice service must resolve:
        |
        | secondary -> primary surviving session.
        |
        */

        $invoiceResponse =
            $this->postJson(
                "/api/v1/table-sessions/{$secondarySession->id}/invoice"
            );

        $invoiceResponse
            ->assertStatus(201);

        $invoiceResponse
            ->assertJsonPath(
                'data.invoice.table_session_id',
                $primarySession->id
            );

        $invoiceResponse
            ->assertJsonCount(
                2,
                'data.invoice.items'
            );

        $this->assertEquals(
            2500,
            $invoiceResponse->json(
                'data.invoice.totals.subtotal'
            )
        );

        $this->assertEquals(
            2500,
            $invoiceResponse->json(
                'data.invoice.totals.grand_total'
            )
        );

        $primaryOrder->refresh();
        $secondaryOrder->refresh();

        $this->assertSame(
            $primarySession->id,
            (int)
            $primaryOrder
                ->table_session_id
        );

        $this->assertSame(
            $primarySession->id,
            (int)
            $secondaryOrder
                ->table_session_id
        );

        $this->assertDatabaseCount(
            'invoices',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cancelled Item Exclusion
    |--------------------------------------------------------------------------
    */

    public function test_cancelled_items_are_excluded_from_invoice(): void
    {
        $order =
            $this->createOrder(
                type: Order::TYPE_TAKEAWAY,
                status: Order::STATUS_SERVED,

                /*
                 * Order total already reflects the active item only.
                 */
                subtotal: 1000
            );

        $activeItem =
            $this->addOrderItem(
                order: $order,
                name: 'Active Meal',
                quantity: 1,
                unitPrice: 1000,
                lineTotal: 1000
            );

        $cancelledItem =
            $this->addOrderItem(
                order: $order,
                name: 'Cancelled Meal',
                quantity: 1,
                unitPrice: 500,
                lineTotal: 500,
                status: OrderItem::STATUS_CANCELLED
            );

        Sanctum::actingAs(
            $this->billingUser
        );

        $response =
            $this->postJson(
                "/api/v1/orders/{$order->id}/invoice"
            );

        $response
            ->assertStatus(201)
            ->assertJsonCount(
                1,
                'data.invoice.items'
            );

        $this->assertSame(
            'Active Meal',
            $response->json(
                'data.invoice.items.0.name'
            )
        );

        $invoiceId =
            (int)
            $response->json(
                'data.invoice.id'
            );

        $this->assertDatabaseHas(
            'invoice_items',
            [
                'invoice_id' =>
                $invoiceId,

                'order_item_id' =>
                $activeItem->id,
            ]
        );

        $this->assertDatabaseMissing(
            'invoice_items',
            [
                'invoice_id' =>
                $invoiceId,

                'order_item_id' =>
                $cancelledItem->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Unready Takeaway Orders
    |--------------------------------------------------------------------------
    */

    public function test_unserved_orders_cannot_be_invoiced(): void
    {
        $statuses = [
            Order::STATUS_PENDING,
            Order::STATUS_CONFIRMED,
            Order::STATUS_SENT_TO_KITCHEN,
        ];

        Sanctum::actingAs(
            $this->billingUser
        );

        foreach (
            $statuses
            as $status
        ) {
            $order =
                $this->createOrder(
                    type: Order::TYPE_TAKEAWAY,
                    status: $status,
                    subtotal: 1000
                );

            $this->addOrderItem(
                order: $order,
                name: "Meal {$status}",
                quantity: 1,
                unitPrice: 1000,
                lineTotal: 1000
            );

            $response =
                $this->postJson(
                    "/api/v1/orders/{$order->id}/invoice"
                );

            $response
                ->assertStatus(409);
        }

        $this->assertDatabaseCount(
            'invoices',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cancelled / Rejected Orders
    |--------------------------------------------------------------------------
    */

    public function test_cancelled_and_rejected_takeaway_orders_cannot_be_invoiced(): void
    {
        $statuses = [
            Order::STATUS_CANCELLED,
            Order::STATUS_REJECTED,
        ];

        Sanctum::actingAs(
            $this->billingUser
        );

        foreach (
            $statuses
            as $status
        ) {
            $order =
                $this->createOrder(
                    type: Order::TYPE_TAKEAWAY,
                    status: $status,
                    subtotal: 1000
                );

            $this->addOrderItem(
                order: $order,
                name: "Invalid {$status} Meal",
                quantity: 1,
                unitPrice: 1000,
                lineTotal: 1000
            );

            $this->postJson(
                "/api/v1/orders/{$order->id}/invoice"
            )
                ->assertStatus(409);
        }

        $this->assertDatabaseCount(
            'invoices',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Dine-in Must Wait For Every Order
    |--------------------------------------------------------------------------
    */

    public function test_table_session_invoice_is_blocked_when_any_billable_order_is_not_served(): void
    {
        $table =
            $this->createTable(
                number: 41,
                capacity: 8
            );

        $session =
            $this->createOpenSession(
                table: $table
            );

        $servedOrder =
            $this->createOrder(
                type: Order::TYPE_DINE_IN,
                status: Order::STATUS_SERVED,
                subtotal: 1000,
                tableSession: $session,
                table: $table,
                sequence: 1
            );

        $this->addOrderItem(
            order: $servedOrder,
            name: 'Served Meal',
            quantity: 1,
            unitPrice: 1000,
            lineTotal: 1000
        );

        $unservedOrder =
            $this->createOrder(
                type: Order::TYPE_DINE_IN,
                status: Order::STATUS_CONFIRMED,
                subtotal: 500,
                tableSession: $session,
                table: $table,
                sequence: 2
            );

        $this->addOrderItem(
            order: $unservedOrder,
            name: 'Still Preparing',
            quantity: 1,
            unitPrice: 500,
            lineTotal: 500
        );

        Sanctum::actingAs(
            $this->billingUser
        );

        $this->postJson(
            "/api/v1/table-sessions/{$session->id}/invoice"
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'invoices',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Permission Protection
    |--------------------------------------------------------------------------
    */

    public function test_invoice_routes_require_correct_permissions(): void
    {
        $order =
            $this->createOrder(
                type: Order::TYPE_TAKEAWAY,
                status: Order::STATUS_SERVED,
                subtotal: 1000
            );

        $this->addOrderItem(
            order: $order,
            name: 'Permission Test Meal',
            quantity: 1,
            unitPrice: 1000,
            lineTotal: 1000
        );

        /*
        |--------------------------------------------------------------------------
        | Cannot Create
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs(
            $this->unauthorizedUser
        );

        $this->postJson(
            "/api/v1/orders/{$order->id}/invoice"
        )
            ->assertStatus(403);

        $this->assertDatabaseCount(
            'invoices',
            0
        );

        /*
        |--------------------------------------------------------------------------
        | Authorized User Creates
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs(
            $this->billingUser
        );

        $createResponse =
            $this->postJson(
                "/api/v1/orders/{$order->id}/invoice"
            );

        $createResponse
            ->assertStatus(201);

        $invoiceId =
            (int)
            $createResponse
                ->json(
                    'data.invoice.id'
                );

        /*
        |--------------------------------------------------------------------------
        | Unauthorized User Cannot View
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs(
            $this->unauthorizedUser
        );

        $this->getJson(
            "/api/v1/invoices/{$invoiceId}"
        )
            ->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Financial Consistency Protection
    |--------------------------------------------------------------------------
    */

    public function test_invoice_generation_stops_when_order_totals_do_not_match_active_items(): void
    {
        /*
         * Header says Rs. 2,000.
         */
        $order =
            $this->createOrder(
                type: Order::TYPE_TAKEAWAY,
                status: Order::STATUS_SERVED,
                subtotal: 2000
            );

        /*
         * Active items actually total Rs. 1,000.
         */
        $this->addOrderItem(
            order: $order,
            name: 'Mismatch Meal',
            quantity: 1,
            unitPrice: 1000,
            lineTotal: 1000
        );

        Sanctum::actingAs(
            $this->billingUser
        );

        $this->postJson(
            "/api/v1/orders/{$order->id}/invoice"
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'invoices',
            0
        );

        $this->assertDatabaseCount(
            'invoice_items',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createOrder(
        string $type,
        string $status,
        float $subtotal,
        float $discount = 0,
        float $tax = 0,
        float $serviceCharge = 0,
        ?TableSession $tableSession = null,
        ?RestaurantTable $table = null,
        ?int $sequence = null,
        ?string $customerName = null,
        ?string $customerPhone = null
    ): Order {
        $grandTotal =
            round(
                max(
                    0,
                    $subtotal
                        -
                        $discount
                        +
                        $tax
                        +
                        $serviceCharge
                ),
                2
            );

        $isConfirmed =
            ! in_array(
                $status,
                [
                    Order::STATUS_PENDING,
                ],
                true
            );

        $isKitchenSent =
            in_array(
                $status,
                [
                    Order::STATUS_SENT_TO_KITCHEN,
                    Order::STATUS_SERVED,
                    Order::STATUS_COMPLETED,
                ],
                true
            );

        $isServed =
            in_array(
                $status,
                [
                    Order::STATUS_SERVED,
                    Order::STATUS_COMPLETED,
                ],
                true
            );

        $isCompleted =
            $status
            === Order::STATUS_COMPLETED;

        return Order::query()
            ->create([
                'order_number' =>
                'ORD-P27-' .
                    Str::upper(
                        Str::random(12)
                    ),

                'client_order_id' =>
                $type
                    === Order::TYPE_TAKEAWAY
                    ? (string)
                    Str::uuid()
                    : null,

                'submission_hash' =>
                null,

                'public_status_token' =>
                null,

                'business_day_id' =>
                $this
                    ->businessDay
                    ->id,

                'table_session_id' =>
                $tableSession?->id,

                'table_id' =>
                $table?->id,

                'order_type' =>
                $type,

                'order_source' =>
                $type
                    === Order::TYPE_TAKEAWAY
                    ? Order::SOURCE_CASHIER
                    : Order::SOURCE_WAITER,

                'session_sequence' =>
                $type
                    === Order::TYPE_DINE_IN
                    ? $sequence
                    : null,

                'table_name_snapshot' =>
                $table?->name,

                'takeaway_token' =>
                $type
                    === Order::TYPE_TAKEAWAY
                    ? 'TOK-P27-' .
                    Str::upper(
                        Str::random(10)
                    )
                    : null,

                'customer_name' =>
                $customerName,

                'customer_phone' =>
                $customerPhone,

                'status' =>
                $status,

                'subtotal' =>
                $subtotal,

                'discount_total' =>
                $discount,

                'tax_total' =>
                $tax,

                'service_charge_total' =>
                $serviceCharge,

                'grand_total' =>
                $grandTotal,

                'estimated_cost_total' =>
                0,

                'customer_notes' =>
                null,

                'internal_notes' =>
                'Phase 27 billing test order.',

                'created_by' =>
                $this
                    ->billingUser
                    ->id,

                'confirmed_by' =>
                $isConfirmed
                    ? $this
                    ->billingUser
                    ->id
                    : null,

                'confirmed_at' =>
                $isConfirmed
                    ? now()
                    ->subMinutes(20)
                    : null,

                'sent_to_kitchen_at' =>
                $isKitchenSent
                    ? now()
                    ->subMinutes(15)
                    : null,

                'served_at' =>
                $isServed
                    ? now()
                    ->subMinutes(5)
                    : null,

                'completed_at' =>
                $isCompleted
                    ? now()
                    : null,

                'cancelled_at' =>
                $status
                    === Order::STATUS_CANCELLED
                    ? now()
                    : null,

                'cancellation_reason' =>
                $status
                    === Order::STATUS_CANCELLED
                    ? 'Phase 27 cancellation test.'
                    : null,
            ]);
    }

    private function addOrderItem(
        Order $order,
        string $name,
        float $quantity,
        float $unitPrice,
        float $lineTotal,
        ?string $variantName = null,
        ?int $menuItemId = null,
        ?int $variantId = null,
        string $status = OrderItem::STATUS_ACTIVE
    ): OrderItem {
        $grossTotal =
            round(
                $quantity
                    *
                    $unitPrice,
                2
            );

        return OrderItem::query()
            ->create([
                'order_id' =>
                $order->id,

                'menu_item_id' =>
                $menuItemId,

                'menu_item_variant_id' =>
                $variantId,

                'item_name_snapshot' =>
                $name,

                'variant_name_snapshot' =>
                $variantName,

                'quantity' =>
                $quantity,

                'unit_price' =>
                $unitPrice,

                'gross_total' =>
                $grossTotal,

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
                $status,

                'special_notes' =>
                null,

                'sent_to_kitchen_at' =>
                now()
                    ->subMinutes(15),

                'cancelled_at' =>
                $status
                    === OrderItem::STATUS_CANCELLED
                    ? now()
                    : null,
            ]);
    }

    private function addOrderItemAddon(
        OrderItem $orderItem,
        ?int $addonId,
        string $name,
        float $quantityPerItem,
        float $unitPrice,
        float $lineTotal
    ) {
        return $orderItem
            ->addons()
            ->create([
                'addon_id' =>
                $addonId,

                'addon_name_snapshot' =>
                $name,

                'quantity' =>
                $quantityPerItem,

                'unit_price' =>
                $unitPrice,

                'line_total' =>
                $lineTotal,

                'estimated_cost_total' =>
                0,
            ]);
    }

    private function createTable(
        int $number,
        int $capacity = 8
    ): RestaurantTable {
        return RestaurantTable::query()
            ->create([
                'table_number' =>
                $number,

                'code' =>
                sprintf(
                    'P27-TBL-%03d',
                    $number
                ),

                'name' =>
                sprintf(
                    'Table %02d',
                    $number
                ),

                'area' =>
                'Main Floor',

                'capacity' =>
                $capacity,

                'status' =>
                RestaurantTable::STATUS_OCCUPIED,

                'qr_ordering_enabled' =>
                true,

                'sort_order' =>
                $number,

                'is_active' =>
                true,

                'notes' =>
                null,
            ]);
    }

    private function createOpenSession(
        RestaurantTable $table,
        int $guestCount = 2
    ): TableSession {
        return TableSession::query()
            ->create([
                'session_number' =>
                'TS-P27-' .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'public_token' =>
                Str::random(48),

                'business_day_id' =>
                $this
                    ->businessDay
                    ->id,

                'table_id' =>
                $table->id,

                'merged_into_session_id' =>
                null,

                'guest_count' =>
                $guestCount,

                'opened_source' =>
                TableSession::SOURCE_STAFF,

                'status' =>
                TableSession::STATUS_OPEN,

                'opened_by' =>
                $this
                    ->billingUser
                    ->id,

                'opened_at' =>
                now()
                    ->subMinutes(30),

                'closed_at' =>
                null,

                'closed_by' =>
                null,

                'close_reason' =>
                null,

                'last_activity_at' =>
                now()
                    ->subMinutes(5),

                'bill_requested_at' =>
                null,

                'bill_requested_by' =>
                null,
            ]);
    }

    private function createLiveMenuWithVariantAndAddon(): array
    {
        $suffix =
            Str::lower(
                Str::random(10)
            );

        /*
        |--------------------------------------------------------------------------
        | Category
        |--------------------------------------------------------------------------
        */

        $categoryId =
            DB::table('categories')
            ->insertGetId([
                'parent_id' =>
                null,

                'name' =>
                'Phase 27 Rice',

                'slug' =>
                "phase-27-rice-{$suffix}",

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

        /*
        |--------------------------------------------------------------------------
        | Menu Item
        |--------------------------------------------------------------------------
        */

        $menuItemId =
            DB::table('menu_items')
            ->insertGetId([
                'category_id' =>
                $categoryId,

                'sku' =>
                'P27-MENU-' .
                    Str::upper(
                        Str::random(8)
                    ),

                'name' =>
                'Chicken Fried Rice',

                'slug' =>
                "phase-27-chicken-rice-{$suffix}",

                'description' =>
                null,

                'image_path' =>
                null,

                'price' =>
                1200,

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
                true,

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
        |--------------------------------------------------------------------------
        | Large Variant
        |--------------------------------------------------------------------------
        */

        $variantId =
            DB::table(
                'menu_item_variants'
            )
            ->insertGetId([
                'menu_item_id' =>
                $menuItemId,

                'sku' =>
                'P27-VAR-' .
                    Str::upper(
                        Str::random(8)
                    ),

                'name' =>
                'Large',

                'price' =>
                1500,

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
        |--------------------------------------------------------------------------
        | Add-on Group
        |--------------------------------------------------------------------------
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
        |--------------------------------------------------------------------------
        | Add-on
        |--------------------------------------------------------------------------
        */

        $addonId =
            DB::table('addons')
            ->insertGetId([
                'addon_group_id' =>
                $addonGroupId,

                'name' =>
                'Extra Cheese',

                'sku' =>
                'P27-ADD-' .
                    Str::upper(
                        Str::random(8)
                    ),

                'price' =>
                200,

                'is_available' =>
                true,

                'is_active' =>
                true,

                'consumes_inventory' =>
                false,

                'sort_order' =>
                1,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Menu -> Add-on Link
        |--------------------------------------------------------------------------
        */

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

        return [
            'category_id' =>
            $categoryId,

            'menu_item_id' =>
            $menuItemId,

            'variant_id' =>
            $variantId,

            'addon_group_id' =>
            $addonGroupId,

            'addon_id' =>
            $addonId,
        ];
    }

    private function createUserWithPermissions(
        string $roleCode,
        array $permissions
    ): User {
        $role =
            Role::query()
            ->create([
                'name' =>
                $roleCode,

                'code' =>
                $roleCode,

                'description' =>
                "Phase 27 {$roleCode} role.",

                'is_active' =>
                true,
            ]);

        $permissionIds =
            [];

        foreach (
            $permissions
            as $permissionCode
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
                        'Billing',

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
                "{$roleCode} Phase 27 User",

                'username' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_'
                    .
                    Str::lower(
                        Str::random(8)
                    ),

                'email' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_'
                    .
                    Str::lower(
                        Str::random(8)
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
}
