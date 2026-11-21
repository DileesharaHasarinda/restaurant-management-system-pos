<?php

namespace Tests\Feature;

use App\Models\BusinessDay;
use App\Models\BusinessDayClosing;
use App\Models\CashierShift;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Purchase;
use App\Models\Refund;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\TableSession;
use App\Models\User;
use App\Models\Wastage;
use Database\Seeders\ExpenseCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use LogicException;
use Tests\TestCase;

class BusinessDayClosingTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private User $viewer;

    private User $unauthorizedUser;

    private BusinessDay $businessDay;

    protected function setUp(): void
    {
        parent::setUp();

        /*
        |--------------------------------------------------------------------------
        | Required Supporting Data
        |--------------------------------------------------------------------------
        */

        $this->seed(
            ExpenseCategorySeeder::class
        );

        /*
        |--------------------------------------------------------------------------
        | Manager
        |--------------------------------------------------------------------------
        */

        $this->manager =
            $this->createUserWithPermissions(
                roleCode: 'P32_MANAGER',

                permissions: [
                    'business_day.view',
                    'business_day.close',

                    /*
                     * Used by historical-protection
                     * integration checks.
                     */
                    'expenses.view',
                    'expenses.manage',

                    'payments.create',
                    'invoices.view',
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | Viewer
        |--------------------------------------------------------------------------
        */

        $this->viewer =
            $this->createUserWithPermissions(
                roleCode: 'P32_VIEWER',

                permissions: [
                    'business_day.view',
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | Unauthorized
        |--------------------------------------------------------------------------
        */

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'P32_NONE',

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
                now()
                    ->toDateString(),

                'status' =>
                BusinessDay::STATUS_OPEN,

                'opened_by' =>
                $this
                    ->manager
                    ->id,

                'closed_by' =>
                null,

                'opened_at' =>
                now(),

                'closed_at' =>
                null,

                'notes' =>
                'Phase 32 automated business-day closing test.',
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Current Day / Preview
    |--------------------------------------------------------------------------
    */

    public function test_manager_can_view_current_business_day_closing_preview(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        $response =
            $this->getJson(
                '/api/v1/business-days/current'
            );

        $response
            ->assertOk()
            ->assertJsonPath(
                'data.business_day.id',
                $this->businessDay->id
            )
            ->assertJsonPath(
                'data.business_day.status',
                BusinessDay::STATUS_OPEN
            )
            ->assertJsonPath(
                'data.blockers.open_tables',
                0
            )
            ->assertJsonPath(
                'data.blockers.active_orders',
                0
            )
            ->assertJsonPath(
                'data.blockers.unpaid_invoices',
                0
            )
            ->assertJsonPath(
                'data.blockers.open_cashier_shifts',
                0
            )
            ->assertJsonPath(
                'data.blockers.can_close',
                true
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Open Table Blocker
    |--------------------------------------------------------------------------
    */

    public function test_open_table_session_blocks_business_day_close(): void
    {
        $this->createOpenTableSession();

        Sanctum::actingAs($this->manager, ['staff']);

        $preview =
            $this->getJson(
                "/api/v1/business-days/{$this->businessDay->id}/closing-preview"
            );

        $preview
            ->assertOk()
            ->assertJsonPath(
                'data.blockers.open_tables',
                1
            )
            ->assertJsonPath(
                'data.blockers.can_close',
                false
            );

        $close =
            $this->closeBusinessDay();

        $close
            ->assertStatus(
                409
            );

        $this->assertSame(
            BusinessDay::STATUS_OPEN,
            $this
                ->businessDay
                ->fresh()
                ->status
        );

        $this->assertDatabaseCount(
            'business_day_closings',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Active Order Blocker
    |--------------------------------------------------------------------------
    */

    public function test_all_active_order_states_block_business_day_close(): void
    {
        foreach (
            [
                Order::STATUS_PENDING,
                Order::STATUS_CONFIRMED,
                Order::STATUS_SENT_TO_KITCHEN,
                Order::STATUS_SERVED,
            ]
            as $status
        ) {
            $this->createOrder(
                status: $status
            );
        }

        Sanctum::actingAs($this->manager, ['staff']);

        $preview =
            $this->getJson(
                "/api/v1/business-days/{$this->businessDay->id}/closing-preview"
            );

        $preview
            ->assertOk()
            ->assertJsonPath(
                'data.blockers.active_orders',
                4
            )
            ->assertJsonPath(
                'data.blockers.can_close',
                false
            );

        $this
            ->closeBusinessDay()
            ->assertStatus(
                409
            );

        $this->assertDatabaseCount(
            'business_day_closings',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Unpaid Invoice Blocker
    |--------------------------------------------------------------------------
    */

    public function test_unpaid_and_partial_invoices_block_business_day_close(): void
    {
        $this->createInvoice(
            grandTotal: 1000,

            paymentStatus: Invoice::PAYMENT_STATUS_UNPAID,

            paidAmount: 0,

            balanceDue: 1000
        );

        $this->createInvoice(
            grandTotal: 2000,

            paymentStatus: Invoice::PAYMENT_STATUS_PARTIAL,

            paidAmount: 500,

            balanceDue: 1500
        );

        Sanctum::actingAs($this->manager, ['staff']);

        $preview =
            $this->getJson(
                "/api/v1/business-days/{$this->businessDay->id}/closing-preview"
            );

        $preview
            ->assertOk()
            ->assertJsonPath(
                'data.blockers.unpaid_invoices',
                2
            )
            ->assertJsonPath(
                'data.blockers.can_close',
                false
            );

        $this
            ->closeBusinessDay()
            ->assertStatus(
                409
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Open Cashier Shift Blocker
    |--------------------------------------------------------------------------
    */

    public function test_open_cashier_shift_blocks_business_day_close(): void
    {
        $this->createCashierShift(
            status: CashierShift::STATUS_OPEN,

            expectedCash: 5000,

            actualCash: null,

            difference: null
        );

        Sanctum::actingAs($this->manager, ['staff']);

        $preview =
            $this->getJson(
                "/api/v1/business-days/{$this->businessDay->id}/closing-preview"
            );

        $preview
            ->assertOk()
            ->assertJsonPath(
                'data.blockers.open_cashier_shifts',
                1
            )
            ->assertJsonPath(
                'data.blockers.can_close',
                false
            );

        $this
            ->closeBusinessDay()
            ->assertStatus(
                409
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Final Recheck / Race Protection
    |--------------------------------------------------------------------------
    */

    public function test_final_close_rechecks_blockers_after_preview(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        /*
         * Preview says the day is currently safe.
         */
        $this
            ->getJson(
                "/api/v1/business-days/{$this->businessDay->id}/closing-preview"
            )
            ->assertOk()
            ->assertJsonPath(
                'data.blockers.can_close',
                true
            );

        /*
         * Something changes after preview.
         */
        $this->createOrder(
            status: Order::STATUS_CONFIRMED
        );

        /*
         * Final close MUST re-query database
         * and reject the stale preview.
         */
        $this
            ->closeBusinessDay()
            ->assertStatus(
                409
            );

        $this->assertSame(
            BusinessDay::STATUS_OPEN,
            $this
                ->businessDay
                ->fresh()
                ->status
        );

        $this->assertDatabaseCount(
            'business_day_closings',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Successful Empty Day Closing
    |--------------------------------------------------------------------------
    */

    public function test_clean_business_day_closes_successfully(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        $requestId =
            (string)
            Str::uuid();

        $response =
            $this->postJson(
                "/api/v1/business-days/{$this->businessDay->id}/close",

                [
                    'client_request_id' =>
                    $requestId,

                    'closing_notes' =>
                    'Manager reviewed and reconciled the restaurant day.',
                ]
            );

        $response
            ->assertOk()
            ->assertJsonPath(
                'data.closed',
                true
            )
            ->assertJsonPath(
                'data.closing.business_day_id',
                $this->businessDay->id
            )
            ->assertJsonPath(
                'data.closing.total_sales',
                0
            )
            ->assertJsonPath(
                'data.closing.total_cogs',
                0
            )
            ->assertJsonPath(
                'data.closing.estimated_net_profit',
                0
            );

        $day =
            $this
            ->businessDay
            ->fresh();

        $this->assertSame(
            BusinessDay::STATUS_CLOSED,
            $day->status
        );

        $this->assertSame(
            $this->manager->id,
            $day->closed_by
        );

        $this->assertNotNull(
            $day->closed_at
        );

        $this->assertDatabaseHas(
            'business_day_closings',
            [
                'business_day_id' =>
                $this->businessDay->id,

                'client_request_id' =>
                $requestId,

                'closed_by' =>
                $this->manager->id,

                'closing_notes' =>
                'Manager reviewed and reconciled the restaurant day.',
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'BUSINESS_DAY_CLOSED',

                'entity_type' =>
                'business_day',

                'entity_id' =>
                $this->businessDay->id,
            ]
        );

        /*
         * There is no OPEN day now.
         */
        $this
            ->getJson(
                '/api/v1/business-days/current'
            )
            ->assertOk()
            ->assertJsonPath(
                'data.business_day',
                null
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Financial Snapshot
    |--------------------------------------------------------------------------
    */

    public function test_closing_calculates_complete_financial_snapshot_correctly(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Completed Order
        |--------------------------------------------------------------------------
        */

        $this->createOrder(
            status: Order::STATUS_COMPLETED
        );

        /*
        |--------------------------------------------------------------------------
        | Invoice
        |--------------------------------------------------------------------------
        |
        | Subtotal            10,000
        | Discounts              500
        | Tax                    200
        | Service charge         300
        | ---------------------------
        | Invoice total       10,000
        |
        */

        $invoice =
            $this->createInvoice(
                grandTotal: 10000,

                paymentStatus: Invoice::PAYMENT_STATUS_PAID,

                paidAmount: 10000,

                balanceDue: 0,

                subtotal: 10000,

                discount: 500,

                tax: 200,

                serviceCharge: 300
            );

        /*
        |--------------------------------------------------------------------------
        | Payments
        |--------------------------------------------------------------------------
        */

        $this->createPayment(
            invoice: $invoice,

            method: Payment::METHOD_CASH,

            amount: 4000
        );

        $this->createPayment(
            invoice: $invoice,

            method: Payment::METHOD_CARD,

            amount: 3000
        );

        $this->createPayment(
            invoice: $invoice,

            method: Payment::METHOD_QR,

            amount: 2000
        );

        $this->createPayment(
            invoice: $invoice,

            method: Payment::METHOD_BANK_TRANSFER,

            amount: 500
        );

        $this->createPayment(
            invoice: $invoice,

            method: Payment::METHOD_OTHER,

            amount: 500
        );

        /*
        |--------------------------------------------------------------------------
        | Cash Refund
        |--------------------------------------------------------------------------
        |
        | Gross invoice sales = 10,000
        | Refund              =    500
        | Net sales           =  9,500
        |
        | Cash payment        =  4,000
        | Cash refund         =    500
        | Net cash sales      =  3,500
        |
        */

        Refund::query()
            ->create([
                'refund_number' =>
                'P32-REF-001',

                'invoice_id' =>
                $invoice->id,

                'payment_id' =>
                null,

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_shift_id' =>
                null,

                'amount' =>
                500,

                'refund_method' =>
                Payment::METHOD_CASH,

                'status' =>
                Refund::STATUS_COMPLETED,

                'reason' =>
                'Phase 32 refund reporting test.',

                'details' =>
                [
                    'test' =>
                    true,
                ],

                'processed_by' =>
                $this->manager->id,

                'refunded_at' =>
                now(),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Purchase + Supplier Payment
        |--------------------------------------------------------------------------
        */

        $supplierId =
            DB::table(
                'suppliers'
            )
            ->insertGetId([
                'supplier_code' =>
                'P32-SUP-001',

                'name' =>
                'Phase 32 Supplier',

                'contact_person' =>
                'Supplier Contact',

                'phone' =>
                null,

                'email' =>
                null,

                'address' =>
                null,

                'notes' =>
                'Phase 32 supplier fixture.',

                'current_balance' =>
                1300,

                'is_active' =>
                true,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        $supplier =
            Supplier::query()
            ->findOrFail(
                $supplierId
            );

        $purchase =
            $this->createCompletedPurchase(
                supplier: $supplier,

                total: 2000,

                paidAmount: 700,

                balanceDue: 1300
            );

        SupplierPayment::query()
            ->create([
                'payment_batch_id' =>
                null,

                'payment_number' =>
                'P32-SP-001',

                'supplier_id' =>
                $supplier->id,

                'purchase_id' =>
                $purchase->id,

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_shift_id' =>
                null,

                'amount' =>
                700,

                'payment_method' =>
                SupplierPayment::METHOD_BANK_TRANSFER,

                'reference_number' =>
                'P32-BANK-001',

                'payment_date' =>
                now()
                    ->toDateString(),

                'created_by' =>
                $this->manager->id,

                'notes' =>
                'Phase 32 supplier payment test.',
            ]);

        /*
        |--------------------------------------------------------------------------
        | COGS
        |--------------------------------------------------------------------------
        |
        | Sale consumption       -4,000
        | Cancellation reversal  +  500
        | -----------------------------
        | Net COGS                3,500
        |
        */

        $ingredientId =
            $this->createIngredientFixture();

        StockMovement::query()
            ->create([
                'movement_key' =>
                'p32-sale-consumption',

                'ingredient_id' =>
                $ingredientId,

                'business_day_id' =>
                $this->businessDay->id,

                'movement_type' =>
                StockMovement::TYPE_SALE_CONSUMPTION,

                'quantity_delta' =>
                -10,

                'balance_after' =>
                90,

                'unit_cost' =>
                400,

                'total_cost' =>
                -4000,

                'source_type' =>
                'phase32_test',

                'source_id' =>
                1,

                'reference' =>
                'P32-SALE',

                'notes' =>
                'Phase 32 COGS consumption.',

                'created_by' =>
                $this->manager->id,

                'occurred_at' =>
                now(),
            ]);

        StockMovement::query()
            ->create([
                'movement_key' =>
                'p32-cancellation-reversal',

                'ingredient_id' =>
                $ingredientId,

                'business_day_id' =>
                $this->businessDay->id,

                'movement_type' =>
                StockMovement::TYPE_CANCELLATION_REVERSAL,

                'quantity_delta' =>
                1.25,

                'balance_after' =>
                91.25,

                'unit_cost' =>
                400,

                'total_cost' =>
                500,

                'source_type' =>
                'phase32_test',

                'source_id' =>
                2,

                'reference' =>
                'P32-REVERSAL',

                'notes' =>
                'Phase 32 cancellation reversal.',

                'created_by' =>
                $this->manager->id,

                'occurred_at' =>
                now(),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Expense
        |--------------------------------------------------------------------------
        */

        $category =
            ExpenseCategory::query()
            ->firstOrFail();

        Expense::query()
            ->create([
                'client_request_id' =>
                (string)
                Str::uuid(),

                'expense_number' =>
                'P32-EXP-001',

                'expense_category_id' =>
                $category->id,

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_shift_id' =>
                null,

                'description' =>
                'Phase 32 operating expense.',

                'notes' =>
                null,

                'amount' =>
                1000,

                'payment_method' =>
                Expense::METHOD_CARD,

                'reference_number' =>
                'EXP-CARD-001',

                'status' =>
                Expense::STATUS_POSTED,

                'expense_date' =>
                now()
                    ->toDateString(),

                'created_by' =>
                $this->manager->id,

                'approved_by' =>
                $this->manager->id,
            ]);

        /*
        |--------------------------------------------------------------------------
        | Wastage
        |--------------------------------------------------------------------------
        */

        Wastage::query()
            ->create([
                'client_request_id' =>
                (string)
                Str::uuid(),

                'wastage_number' =>
                'P32-WST-001',

                'business_day_id' =>
                $this->businessDay->id,

                'wastage_type' =>
                Wastage::TYPE_PREPARED_ITEM,

                'ingredient_id' =>
                null,

                'menu_item_id' =>
                null,

                'unit_id' =>
                null,

                'quantity' =>
                1,

                'base_quantity' =>
                null,

                'reason_code' =>
                'OTHER',

                'reason' =>
                'Phase 32 wastage fixture.',

                'estimated_cost' =>
                250,

                'status' =>
                Wastage::STATUS_POSTED,

                'created_by' =>
                $this->manager->id,

                'wasted_at' =>
                now(),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Closed Cashier Shift
        |--------------------------------------------------------------------------
        |
        | Opening float 2,000
        | Net cash      3,500
        | Expected      5,500
        | Actual        5,400
        | Difference     -100
        |
        */

        $this->createCashierShift(
            status: CashierShift::STATUS_CLOSED,

            openingCash: 2000,

            expectedCash: 5500,

            actualCash: 5400,

            difference: -100
        );

        /*
        |--------------------------------------------------------------------------
        | Close Day
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->manager, ['staff']);

        $response =
            $this->closeBusinessDay(
                notes: 'Financial snapshot test.'
            );

        $response
            ->assertOk()
            ->assertJsonPath(
                'data.closed',
                true
            );

        /*
        |--------------------------------------------------------------------------
        | Headline DB Snapshot
        |--------------------------------------------------------------------------
        */

        $closing =
            BusinessDayClosing::query()
            ->where(
                'business_day_id',
                $this->businessDay->id
            )
            ->firstOrFail();

        /*
         * Net Sales:
         *
         * 10,000 gross invoice
         * - 500 refund
         * = 9,500.
         */
        $this->assertEquals(
            9500,
            $closing->total_sales
        );

        $this->assertEquals(
            500,
            $closing->total_discounts
        );

        $this->assertEquals(
            500,
            $closing->total_refunds
        );

        /*
         * Payment breakdown after refund.
         */
        $this->assertEquals(
            3500,
            $closing->cash_sales
        );

        $this->assertEquals(
            3000,
            $closing->card_sales
        );

        $this->assertEquals(
            2000,
            $closing->qr_sales
        );

        $this->assertEquals(
            500,
            $closing->bank_sales
        );

        $this->assertEquals(
            500,
            $closing->other_sales
        );

        /*
         * Cash-flow information.
         */
        $this->assertEquals(
            2000,
            $closing->total_purchases
        );

        $this->assertEquals(
            700,
            $closing->supplier_payments
        );

        /*
         * Profit.
         *
         * Net Sales      9,500
         * COGS          -3,500
         * -------------------
         * Gross Profit   6,000
         *
         * Expenses      -1,000
         * Wastage         -250
         * -------------------
         * Est. Net       4,750
         */
        $this->assertEquals(
            3500,
            $closing->total_cogs
        );

        $this->assertEquals(
            6000,
            $closing->gross_profit
        );

        $this->assertEquals(
            1000,
            $closing->total_expenses
        );

        $this->assertEquals(
            250,
            $closing->total_wastage_cost
        );

        $this->assertEquals(
            4750,
            $closing->estimated_net_profit
        );

        /*
         * Purchases and supplier payments were
         * NOT deducted from estimated profit.
         */
        $this->assertEquals(
            4750,
            $closing->estimated_net_profit
        );

        /*
         * Shift totals.
         */
        $this->assertEquals(
            5500,
            $closing->expected_cash
        );

        $this->assertEquals(
            5400,
            $closing->actual_cash
        );

        $this->assertEquals(
            -100,
            $closing->cash_difference
        );

        /*
        |--------------------------------------------------------------------------
        | Detailed Immutable JSON Snapshot
        |--------------------------------------------------------------------------
        */

        $snapshot =
            $closing->snapshot;

        $this->assertIsArray(
            $snapshot
        );

        $this->assertSame(
            1,
            $snapshot['version']
        );

        $this->assertSame(
            1,
            $snapshot['orders']['completed']
        );

        $this->assertEquals(
            10000,
            $snapshot['sales']['gross_invoice_sales']
        );

        $this->assertEquals(
            500,
            $snapshot['sales']['refunds']
        );

        $this->assertEquals(
            9500,
            $snapshot['sales']['net_sales']
        );

        $this->assertEquals(
            3500,
            $snapshot['payments']['net']['cash']
        );

        $this->assertEquals(
            3500,
            $snapshot['profit']['cogs']
        );

        $this->assertEquals(
            4750,
            $snapshot['profit']['estimated_net_profit']
        );

        $this->assertEquals(
            -100,
            $snapshot['cash_reconciliation']['difference']
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Closing Idempotency
    |--------------------------------------------------------------------------
    */

    public function test_exact_business_day_close_retry_is_idempotent(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        $requestId =
            (string)
            Str::uuid();

        $payload = [
            'client_request_id' =>
            $requestId,

            'closing_notes' =>
            'Same closing request.',
        ];

        $first =
            $this->postJson(
                "/api/v1/business-days/{$this->businessDay->id}/close",
                $payload
            );

        $first
            ->assertOk()
            ->assertJsonPath(
                'data.closed',
                true
            );

        $second =
            $this->postJson(
                "/api/v1/business-days/{$this->businessDay->id}/close",
                $payload
            );

        $second
            ->assertOk()
            ->assertJsonPath(
                'data.closed',
                false
            );

        $this->assertDatabaseCount(
            'business_day_closings',
            1
        );
    }

    public function test_same_closing_uuid_with_different_data_is_rejected(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        $requestId =
            (string)
            Str::uuid();

        $this
            ->postJson(
                "/api/v1/business-days/{$this->businessDay->id}/close",

                [
                    'client_request_id' =>
                    $requestId,

                    'closing_notes' =>
                    'Original closing.',
                ]
            )
            ->assertOk();

        $this
            ->postJson(
                "/api/v1/business-days/{$this->businessDay->id}/close",

                [
                    'client_request_id' =>
                    $requestId,

                    'closing_notes' =>
                    'Changed closing data.',
                ]
            )
            ->assertStatus(
                409
            );

        $this->assertDatabaseCount(
            'business_day_closings',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Permissions
    |--------------------------------------------------------------------------
    */

    public function test_business_day_routes_enforce_view_and_close_permissions(): void
    {
        /*
         * No permission.
         */
        Sanctum::actingAs($this->unauthorizedUser, ['staff']);

        $this
            ->getJson(
                '/api/v1/business-days/current'
            )
            ->assertStatus(
                403
            );

        /*
         * View-only user can inspect.
         */
        Sanctum::actingAs($this->viewer, ['staff']);

        $this
            ->getJson(
                '/api/v1/business-days/current'
            )
            ->assertOk();

        /*
         * But cannot close.
         */
        $this
            ->postJson(
                "/api/v1/business-days/{$this->businessDay->id}/close",

                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),
                ]
            )
            ->assertStatus(
                403
            );

        $this->assertSame(
            BusinessDay::STATUS_OPEN,
            $this
                ->businessDay
                ->fresh()
                ->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Historical Closing Retrieval
    |--------------------------------------------------------------------------
    */

    public function test_closed_business_day_snapshot_can_be_retrieved(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        $this
            ->closeBusinessDay()
            ->assertOk();

        $closing =
            BusinessDayClosing::query()
            ->firstOrFail();

        $this
            ->getJson(
                "/api/v1/business-day-closings/{$closing->id}"
            )
            ->assertOk()
            ->assertJsonPath(
                'data.id',
                $closing->id
            )
            ->assertJsonPath(
                'data.business_day.status',
                BusinessDay::STATUS_CLOSED
            )
            ->assertJsonPath(
                'data.closed_by.id',
                $this->manager->id
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Immutable Snapshot
    |--------------------------------------------------------------------------
    */

    public function test_business_day_closing_snapshot_cannot_be_updated(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        $this
            ->closeBusinessDay()
            ->assertOk();

        $closing =
            BusinessDayClosing::query()
            ->firstOrFail();

        $this->expectException(
            LogicException::class
        );

        $closing->update([
            'total_sales' =>
            999999,
        ]);
    }

    public function test_business_day_closing_snapshot_cannot_be_deleted(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        $this
            ->closeBusinessDay()
            ->assertOk();

        $closing =
            BusinessDayClosing::query()
            ->firstOrFail();

        $this->expectException(
            LogicException::class
        );

        $closing->delete();
    }

    /*
    |--------------------------------------------------------------------------
    | Historical Expense Protection
    |--------------------------------------------------------------------------
    */

    public function test_expense_from_closed_business_day_cannot_be_edited(): void
    {
        $category =
            ExpenseCategory::query()
            ->firstOrFail();

        $expense =
            Expense::query()
            ->create([
                'client_request_id' =>
                (string)
                Str::uuid(),

                'expense_number' =>
                'P32-HIST-EXP-001',

                'expense_category_id' =>
                $category->id,

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_shift_id' =>
                null,

                'description' =>
                'Historical expense protection test.',

                'notes' =>
                null,

                'amount' =>
                100,

                'payment_method' =>
                Expense::METHOD_CARD,

                'reference_number' =>
                'CARD-P32-HISTORY',

                'status' =>
                Expense::STATUS_POSTED,

                'expense_date' =>
                now()
                    ->toDateString(),

                'created_by' =>
                $this->manager->id,

                'approved_by' =>
                $this->manager->id,
            ]);

        Sanctum::actingAs($this->manager, ['staff']);

        /*
         * Expense itself does not block closing.
         */
        $this
            ->closeBusinessDay()
            ->assertOk();

        /*
         * Ordinary historical mutation must fail.
         */
        $this
            ->putJson(
                "/api/v1/expenses/{$expense->id}",

                [
                    'expense_category_id' =>
                    $category->id,

                    'expense_date' =>
                    now()
                        ->toDateString(),

                    'description' =>
                    'Attempted historical modification.',

                    'notes' =>
                    null,

                    'amount' =>
                    999,

                    'payment_method' =>
                    Expense::METHOD_CARD,

                    'reference_number' =>
                    'CARD-P32-HISTORY-CHANGED',
                ]
            )
            ->assertStatus(
                409
            );

        $this->assertEquals(
            100,
            $expense
                ->fresh()
                ->amount
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function closeBusinessDay(
        ?string $requestId = null,
        ?string $notes = 'Phase 32 automated close.'
    ) {
        return $this->postJson(
            "/api/v1/business-days/{$this->businessDay->id}/close",

            [
                'client_request_id' =>
                $requestId
                    ??
                    (string)
                    Str::uuid(),

                'closing_notes' =>
                $notes,
            ]
        );
    }

    private function createOpenTableSession(): TableSession
    {
        $number =
            9000
            +
            RestaurantTable::query()
            ->count()
            +
            1;

        $table =
            RestaurantTable::query()
            ->create([
                'table_number' =>
                $number,

                'code' =>
                "P32-T{$number}",

                'name' =>
                "Phase 32 Table {$number}",

                'area' =>
                'Test Area',

                'capacity' =>
                4,

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

        return TableSession::query()
            ->create([
                'session_number' =>
                'P32-SESSION-'
                    .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'public_token' =>
                (string)
                Str::uuid(),

                'business_day_id' =>
                $this->businessDay->id,

                'table_id' =>
                $table->id,

                'merged_into_session_id' =>
                null,

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

                'closed_at' =>
                null,

                'closed_by' =>
                null,

                'close_reason' =>
                null,

                'last_activity_at' =>
                now(),

                'bill_requested_at' =>
                null,

                'bill_requested_by' =>
                null,
            ]);
    }

    private function createOrder(
        string $status
    ): Order {
        return Order::query()
            ->create([
                'order_number' =>
                'P32-ORD-'
                    .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'client_order_id' =>
                null,

                'business_day_id' =>
                $this->businessDay->id,

                'table_session_id' =>
                null,

                'table_id' =>
                null,

                'order_type' =>
                Order::TYPE_DINE_IN,

                'order_source' =>
                'CASHIER',

                'status' =>
                $status,

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

                'created_by' =>
                $this->manager->id,

                'completed_at' =>
                $status
                    ===
                    Order::STATUS_COMPLETED
                    ? now()
                    : null,

                'cancelled_at' =>
                $status
                    ===
                    Order::STATUS_CANCELLED
                    ? now()
                    : null,

                'rejected_at' =>
                $status
                    ===
                    Order::STATUS_REJECTED
                    ? now()
                    : null,
            ]);
    }

    private function createInvoice(
        float $grandTotal,
        string $paymentStatus,
        float $paidAmount,
        float $balanceDue,
        ?float $subtotal = null,
        float $discount = 0,
        float $tax = 0,
        float $serviceCharge = 0
    ): Invoice {
        $subtotal ??=
            $grandTotal
            +
            $discount
            -
            $tax
            -
            $serviceCharge;

        return Invoice::query()
            ->create([
                'invoice_number' =>
                'P32-INV-'
                    .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_shift_id' =>
                null,

                'table_session_id' =>
                null,

                'order_id' =>
                null,

                'invoice_type' =>
                Invoice::TYPE_SALE,

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

                'paid_amount' =>
                $paidAmount,

                'change_amount' =>
                0,

                'balance_due' =>
                $balanceDue,

                'payment_status' =>
                $paymentStatus,

                'status' =>
                Invoice::STATUS_ISSUED,

                'issued_by' =>
                $this->manager->id,

                'issued_at' =>
                now(),
            ]);
    }

    private function createPayment(
        Invoice $invoice,
        string $method,
        float $amount
    ): Payment {
        return Payment::query()
            ->create([
                'payment_batch_id' =>
                null,

                'payment_number' =>
                'P32-PAY-'
                    .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'invoice_id' =>
                $invoice->id,

                'cashier_shift_id' =>
                null,

                'payment_method' =>
                $method,

                'amount' =>
                $amount,

                'tendered_amount' =>
                null,

                'change_given' =>
                0,

                'reference_number' =>
                $method
                    ===
                    Payment::METHOD_CASH
                    ? null
                    : 'P32-REF-'
                    .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'status' =>
                Payment::STATUS_COMPLETED,

                'received_by' =>
                $this->manager->id,

                'paid_at' =>
                now(),

                'notes' =>
                'Phase 32 payment fixture.',
            ]);
    }

    private function createCashierShift(
        string $status,
        float $expectedCash,
        ?float $actualCash,
        ?float $difference,
        float $openingCash = 0
    ): CashierShift {
        return CashierShift::query()
            ->create([
                'shift_number' =>
                'P32-SHIFT-'
                    .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_id' =>
                $this->manager->id,

                'terminal_name' =>
                'Phase 32 Test POS',

                'opening_float' =>
                $openingCash,

                'expected_cash' =>
                $expectedCash,

                'actual_cash' =>
                $actualCash,

                'cash_difference' =>
                $difference,

                'status' =>
                $status,

                'opened_at' =>
                now(),

                'closed_at' =>
                $status
                    ===
                    CashierShift::STATUS_CLOSED
                    ? now()
                    : null,

                'closed_by' =>
                $status
                    ===
                    CashierShift::STATUS_CLOSED
                    ? $this->manager->id
                    : null,

                'opening_notes' =>
                'Phase 32 shift fixture.',

                'closing_notes' =>
                $status
                    ===
                    CashierShift::STATUS_CLOSED
                    ? 'Phase 32 closed shift fixture.'
                    : null,
            ]);
    }

    private function createCompletedPurchase(
        Supplier $supplier,
        float $total,
        float $paidAmount,
        float $balanceDue
    ): Purchase {
        /*
         * Direct insert deliberately avoids invoking
         * purchase-management stock logic. This test
         * only needs an already-completed historical
         * purchase for the closing summary.
         */

        $id =
            DB::table(
                'purchases'
            )
            ->insertGetId([
                'purchase_number' =>
                'P32-PUR-'
                    .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'supplier_id' =>
                $supplier->id,

                'business_day_id' =>
                $this->businessDay->id,

                'supplier_invoice_number' =>
                'SUP-P32-001',

                'purchase_date' =>
                now()
                    ->toDateString(),

                'subtotal' =>
                $total,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'grand_total' =>
                $total,

                'paid_amount' =>
                $paidAmount,

                'balance_due' =>
                $balanceDue,

                'payment_status' =>
                $balanceDue > 0
                    ? Purchase::PAYMENT_STATUS_PARTIALLY_PAID
                    : Purchase::PAYMENT_STATUS_PAID,

                'status' =>
                Purchase::STATUS_COMPLETED,

                'created_by' =>
                $this->manager->id,

                'completed_by' =>
                $this->manager->id,

                'completed_at' =>
                now(),

                'notes' =>
                'Phase 32 completed purchase fixture.',

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        return Purchase::query()
            ->findOrFail(
                $id
            );
    }

    private function createIngredientFixture(): int
    {
        /*
         * Root MASS unit.
         */
        $unitId =
            DB::table(
                'units'
            )
            ->insertGetId([
                'name' =>
                'Phase 32 Gram',

                'symbol' =>
                'P32-G',

                'measurement_type' =>
                'MASS',

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

        return DB::table(
            'ingredients'
        )
            ->insertGetId([
                'sku' =>
                'P32-ING-001',

                'name' =>
                'Phase 32 Ingredient',

                'base_unit_id' =>
                $unitId,

                'current_stock' =>
                100,

                'reorder_level' =>
                10,

                'average_cost_per_base_unit' =>
                400,

                'track_stock' =>
                true,

                'is_active' =>
                true,

                'storage_location' =>
                'Phase 32 Test Storage',

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
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
                'Phase 32 automated test role.',

                'is_active' =>
                true,
            ]);

        $permissionIds = [];

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
                        'PHASE_32',

                        'description' =>
                        'Phase 32 automated test permission.',
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
                $roleCode,

                'username' =>
                Str::lower(
                    $roleCode
                ),

                'email' =>
                Str::lower(
                    $roleCode
                )
                    .
                    '@phase32.test',

                'phone' =>
                null,

                'password' =>
                Hash::make(
                    'Password@123'
                ),

                'status' =>
                'ACTIVE',
            ]);
    }
}
