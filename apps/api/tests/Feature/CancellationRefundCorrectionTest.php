<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Ingredient;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CancellationRefundCorrectionTest extends TestCase
{
    use RefreshDatabase;

    private BusinessDay $businessDay;

    private User $cashier;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cashier =
            $this->createUserWithPermissions(
                roleCode: 'CASHIER_P33_' . Str::upper(Str::random(6)),
                permissions: [
                    'orders.cancel',
                    'refunds.view',
                    'refunds.create',
                    'inventory.cancellation_reversal.request',
                ]
            );

        $this->manager =
            $this->createUserWithPermissions(
                roleCode: 'MANAGER_P33_' . Str::upper(Str::random(6)),
                permissions: [
                    'orders.cancel',
                    'orders.cancel_after_kitchen',
                    'refunds.view',
                    'refunds.create',
                    'refunds.authorize',
                    'inventory.view',
                    'inventory.cancellation_reversal.request',
                    'inventory.cancellation_reversal',
                ]
            );

        $this->businessDay =
            BusinessDay::query()
            ->create([
                'business_date' =>
                now()->toDateString(),

                'status' =>
                BusinessDay::STATUS_OPEN,

                'opened_by' =>
                $this->manager->id,

                'opened_at' =>
                now()->subHour(),

                'notes' =>
                'Phase 33 automated test business day.',
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Order Cancellation
    |--------------------------------------------------------------------------
    */

    public function test_order_cancellation_requires_reason(): void
    {
        $order =
            $this->createOrder(
                status: Order::STATUS_PENDING
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/orders/{$order->id}/cancel",
                []
            );

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'reason',
            ]);

        $this->assertSame(
            Order::STATUS_PENDING,
            $order->fresh()->status
        );
    }

    public function test_before_kitchen_cancellation_does_not_require_manager_authorization(): void
    {
        $order =
            $this->createOrder(
                status: Order::STATUS_PENDING
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/orders/{$order->id}/cancel",
                [
                    'reason' =>
                    'Customer changed their mind before preparation.',
                ]
            );

        $response->assertOk();

        $fresh =
            $order->fresh();

        $this->assertSame(
            Order::STATUS_CANCELLED,
            $fresh->status
        );

        $this->assertSame(
            'Customer changed their mind before preparation.',
            $fresh->cancellation_reason
        );

        $this->assertSame(
            $this->cashier->id,
            $fresh->cancelled_by
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            0
        );
    }

    public function test_after_kitchen_cancellation_requires_manager_authorization(): void
    {
        $order =
            $this->createOrder(
                status: Order::STATUS_SENT_TO_KITCHEN
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/orders/{$order->id}/cancel",
                [
                    'reason' =>
                    'Customer cancelled after kitchen preparation started.',
                ]
            );

        $response->assertStatus(403);

        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $order->fresh()->status
        );
    }

    public function test_after_kitchen_cancellation_rejects_wrong_manager_credentials(): void
    {
        $order =
            $this->createOrder(
                status: Order::STATUS_SENT_TO_KITCHEN
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/orders/{$order->id}/cancel",
                [
                    'reason' =>
                    'Customer cancelled after preparation started.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'wrong-password',
                ]
            );

        $response->assertStatus(403);

        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $order->fresh()->status
        );
    }

    public function test_valid_manager_can_authorize_after_kitchen_cancellation_and_audit_is_recorded(): void
    {
        $order =
            $this->createOrder(
                status: Order::STATUS_SENT_TO_KITCHEN
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/orders/{$order->id}/cancel",
                [
                    'reason' =>
                    'Customer requested cancellation after kitchen send.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'password',
                ]
            );

        $response->assertOk();

        $this->assertSame(
            Order::STATUS_CANCELLED,
            $order->fresh()->status
        );

        /** @var AuditLog $audit */
        $audit =
            AuditLog::query()
            ->where(
                'action',
                'ORDER_CANCELLED'
            )
            ->where(
                'entity_type',
                'order'
            )
            ->where(
                'entity_id',
                $order->id
            )
            ->latest('id')
            ->firstOrFail();

        $this->assertSame(
            $this->cashier->id,
            $audit->metadata['initiated_by'] ?? null
        );

        $this->assertSame(
            $this->manager->id,
            $audit->metadata['authorized_by'] ?? null
        );

        $this->assertFalse(
            (bool) (
                $audit->metadata['inventory_reversed']
                ?? true
            )
        );

        $this->assertFalse(
            (bool) (
                $audit->metadata['financial_refund_created']
                ?? true
            )
        );
    }

    public function test_order_cancellation_never_automatically_reverses_inventory(): void
    {
        [
            $ingredient,
            $consumption,
        ] =
            $this->createSaleConsumptionFixture();

        $order =
            $this->createOrder(
                status: Order::STATUS_SENT_TO_KITCHEN
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this->postJson(
            "/api/v1/orders/{$order->id}/cancel",
            [
                'reason' =>
                'Cancel after preparation with stock intentionally remaining consumed.',

                'manager_login' =>
                $this->manager->username,

                'manager_password' =>
                'password',
            ]
        )->assertOk();

        $this->assertEqualsWithDelta(
            90.0,
            (float) $ingredient->fresh()->current_stock,
            0.0001
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );

        $this->assertDatabaseMissing(
            'stock_movements',
            [
                'movement_type' =>
                StockMovement::TYPE_CANCELLATION_REVERSAL,

                'source_id' =>
                $consumption->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Refunds
    |--------------------------------------------------------------------------
    */

    public function test_cash_refund_requires_manager_authorization(): void
    {
        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,
                openingFloat: 2000
            );

        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CASH,
                amount: 1000,
                shift: $shift
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/refunds",
                [
                    'client_request_id' =>
                    (string) Str::uuid(),

                    'payment_id' =>
                    $payment->id,

                    'amount' =>
                    500,

                    'refund_method' =>
                    Payment::METHOD_CASH,

                    'reason' =>
                    'Customer approved cash refund.',
                ]
            );

        $response->assertStatus(403);

        $this->assertDatabaseCount(
            'refunds',
            0
        );

        $this->assertEqualsWithDelta(
            2000.0,
            (float) $shift->fresh()->expected_cash,
            0.009
        );
    }

    public function test_cash_refund_is_recorded_and_reduces_expected_drawer_cash_once(): void
    {
        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,
                openingFloat: 2000
            );

        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CASH,
                amount: 1000,
                shift: $shift
            );

        $requestId =
            (string) Str::uuid();

        $payload = [
            'client_request_id' =>
            $requestId,

            'payment_id' =>
            $payment->id,

            'cashier_shift_id' =>
                $shift->id,

            'amount' =>
            400,

            'refund_method' =>
            Payment::METHOD_CASH,

            'reason' =>
            'Cash refund requested by customer.',

            'manager_login' =>
            $this->manager->username,

            'manager_password' =>
            'password',
        ];

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $first =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/refunds",
                $payload
            );

        $first->assertCreated();

        $this->assertDatabaseHas(
            'refunds',
            [
                'invoice_id' =>
                $invoice->id,

                'payment_id' =>
                $payment->id,

                'client_request_id' =>
                $requestId,

                'amount' =>
                '400.00',

                'refund_method' =>
                Payment::METHOD_CASH,

                'status' =>
                'COMPLETED',

                'initiated_by' =>
                $this->cashier->id,

                'authorized_by' =>
                $this->manager->id,
            ]
        );

        $this->assertDatabaseHas(
            'cash_drawer_movements',
            [
                'cashier_shift_id' =>
                $shift->id,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_REFUND,

                'amount' =>
                '400.00',
            ]
        );

        $this->assertEqualsWithDelta(
            1600.0,
            (float) $shift->fresh()->expected_cash,
            0.009
        );

        $second =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/refunds",
                $payload
            );

        $second->assertOk();

        $this->assertDatabaseCount(
            'refunds',
            1
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            1
        );

        $this->assertEqualsWithDelta(
            1600.0,
            (float) $shift->fresh()->expected_cash,
            0.009
        );
    }

    public function test_same_refund_uuid_with_different_payload_is_rejected(): void
    {
        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,
                openingFloat: 2000
            );

        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CASH,
                amount: 1000,
                shift: $shift
            );

        $requestId =
            (string) Str::uuid();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $base = [
            'client_request_id' =>
            $requestId,

            'payment_id' =>
            $payment->id,

            
            'cashier_shift_id' =>
                $shift->id,

'refund_method' =>
            Payment::METHOD_CASH,

            'reason' =>
            'Phase 33 duplicate refund request.',

            'manager_login' =>
            $this->manager->username,

            'manager_password' =>
            'password',
        ];

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/refunds",
            [
                ...$base,
                'amount' => 300,
            ]
        )->assertCreated();

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/refunds",
            [
                ...$base,
                'amount' => 350,
            ]
        )->assertStatus(409);

        $this->assertDatabaseCount(
            'refunds',
            1
        );

        $this->assertEqualsWithDelta(
            1700.0,
            (float) $shift->fresh()->expected_cash,
            0.009
        );
    }

    public function test_refund_cannot_exceed_paid_amount(): void
    {
        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CARD,
                amount: 1000
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/refunds",
                [
                    'client_request_id' =>
                    (string) Str::uuid(),

                    'payment_id' =>
                    $payment->id,

                    'amount' =>
                    1000.01,

                    'refund_method' =>
                    Payment::METHOD_CARD,

                    'reason' =>
                    'Attempted excessive refund.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'password',
                ]
            );

        $response->assertStatus(422);

        $this->assertDatabaseCount(
            'refunds',
            0
        );
    }

    public function test_refund_method_must_match_selected_payment_method(): void
    {
        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CARD,
                amount: 1000
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/refunds",
                [
                    'client_request_id' =>
                    (string) Str::uuid(),

                    'payment_id' =>
                    $payment->id,

                    'amount' =>
                    500,

                    'refund_method' =>
                    Payment::METHOD_CASH,

                    'reason' =>
                    'Attempt to refund card payment as cash.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'password',
                ]
            );

        $response->assertStatus(422);

        $this->assertDatabaseCount(
            'refunds',
            0
        );
    }

    public function test_non_cash_refund_does_not_change_cash_drawer(): void
    {
        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,
                openingFloat: 1500
            );

        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CARD,
                amount: 900,
                shift: null
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/refunds",
            [
                'client_request_id' =>
                (string) Str::uuid(),

                'payment_id' =>
                $payment->id,

                'amount' =>
                300,

                'refund_method' =>
                Payment::METHOD_CARD,

                'reason' =>
                'Card payment refund.',

                'manager_login' =>
                $this->manager->username,

                'manager_password' =>
                'password',
            ]
        )->assertCreated();

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );

        $this->assertEqualsWithDelta(
            1500.0,
            (float) $shift->fresh()->expected_cash,
            0.009
        );
    }

    public function test_refund_does_not_change_invoice_settlement_state(): void
    {
        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CARD,
                amount: 1200
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/refunds",
            [
                'client_request_id' =>
                (string) Str::uuid(),

                'payment_id' =>
                $payment->id,

                'amount' =>
                500,

                'refund_method' =>
                Payment::METHOD_CARD,

                'reason' =>
                'Partial financial refund.',

                'manager_login' =>
                $this->manager->username,

                'manager_password' =>
                'password',
            ]
        )->assertCreated();

        $fresh =
            $invoice->fresh();

        $this->assertEqualsWithDelta(
            1200.0,
            (float) $fresh->paid_amount,
            0.009
        );

        $this->assertEqualsWithDelta(
            0.0,
            (float) $fresh->balance_due,
            0.009
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_PAID,
            $fresh->payment_status
        );
    }

    public function test_financial_refund_never_automatically_changes_inventory(): void
    {
        [
            $ingredient,
        ] =
            $this->createSaleConsumptionFixture();

        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CARD,
                amount: 1000
            );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/refunds",
            [
                'client_request_id' =>
                (string) Str::uuid(),

                'payment_id' =>
                $payment->id,

                'amount' =>
                250,

                'refund_method' =>
                Payment::METHOD_CARD,

                'reason' =>
                'Financial correction only.',

                'manager_login' =>
                $this->manager->username,

                'manager_password' =>
                'password',
            ]
        )->assertCreated();

        $this->assertEqualsWithDelta(
            90.0,
            (float) $ingredient->fresh()->current_stock,
            0.0001
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );

        $this->assertDatabaseMissing(
            'stock_movements',
            [
                'movement_type' =>
                StockMovement::TYPE_CANCELLATION_REVERSAL,
            ]
        );
    }

    public function test_refund_is_blocked_when_business_day_is_closed(): void
    {
        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CARD,
                amount: 1000
            );

        $this->closeBusinessDay();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/refunds",
                [
                    'client_request_id' =>
                    (string) Str::uuid(),

                    'payment_id' =>
                    $payment->id,

                    'amount' =>
                    100,

                    'refund_method' =>
                    Payment::METHOD_CARD,

                    'reason' =>
                    'Refund after business day close.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'password',
                ]
            );

        $response->assertStatus(409);

        $this->assertDatabaseCount(
            'refunds',
            0
        );
    }

    public function test_refund_route_requires_refunds_create_permission(): void
    {
        $unauthorized =
            $this->createUserWithPermissions(
                roleCode: 'NO_REFUND_P33_' . Str::upper(Str::random(6)),
                permissions: []
            );

        [
            $invoice,
            $payment,
        ] =
            $this->createPaidInvoiceWithPayment(
                method: Payment::METHOD_CARD,
                amount: 500
            );

        Sanctum::actingAs(
            $unauthorized,
            ['*']
        );

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/refunds",
            [
                'client_request_id' =>
                (string) Str::uuid(),

                'payment_id' =>
                $payment->id,

                'amount' =>
                100,

                'refund_method' =>
                Payment::METHOD_CARD,

                'reason' =>
                'Unauthorized refund attempt.',
            ]
        )->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Explicit Inventory Correction
    |--------------------------------------------------------------------------
    */

    public function test_stock_reversal_only_accepts_sale_consumption_movements(): void
    {
        [
            $ingredient,
        ] =
            $this->createSaleConsumptionFixture();

        $movement =
            StockMovement::query()
            ->create([
                'movement_key' =>
                'p33-adjustment-' . Str::uuid(),

                'ingredient_id' =>
                $ingredient->id,

                'business_day_id' =>
                $this->businessDay->id,

                'movement_type' =>
                'ADJUSTMENT_OUT',

                'quantity_delta' =>
                -1,

                'balance_after' =>
                89,

                'unit_cost' =>
                400,

                'total_cost' =>
                -400,

                'source_type' =>
                'phase33_test',

                'source_id' =>
                999,

                'reference' =>
                'P33-ADJUSTMENT',

                'notes' =>
                'Not a sale consumption movement.',

                'created_by' =>
                $this->manager->id,

                'occurred_at' =>
                now(),
            ]);

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/stock-movements/{$movement->id}/cancellation-reversal",
                [
                    'client_request_id' =>
                    (string) Str::uuid(),

                    'quantity' =>
                    1,

                    'reason' =>
                    'Attempt reversal of wrong movement type.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'password',
                ]
            );

        $response->assertStatus(422);
    }

    public function test_stock_reversal_requires_manager_authorization(): void
    {
        [,
            $consumption,
        ] =
            $this->createSaleConsumptionFixture();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/stock-movements/{$consumption->id}/cancellation-reversal",
                [
                    'client_request_id' =>
                    (string) Str::uuid(),

                    'quantity' =>
                    2,

                    'reason' =>
                    'Ingredient was not actually consumed.',
                ]
            );

        $response->assertStatus(403);

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );
    }

    public function test_authorized_stock_reversal_restores_inventory_and_creates_immutable_reversal_movement(): void
    {
        [
            $ingredient,
            $consumption,
        ] =
            $this->createSaleConsumptionFixture();

        $requestId =
            (string) Str::uuid();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/stock-movements/{$consumption->id}/cancellation-reversal",
                [
                    'client_request_id' =>
                    $requestId,

                    'quantity' =>
                    2.5,

                    'reason' =>
                    'Unused ingredients were physically returned to stock.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'password',
                ]
            );

        $response->assertOk();

        $this->assertEqualsWithDelta(
            92.5,
            (float) $ingredient->fresh()->current_stock,
            0.0001
        );

        /** @var StockMovement $reversal */
        $reversal =
            StockMovement::query()
            ->where(
                'movement_type',
                StockMovement::TYPE_CANCELLATION_REVERSAL
            )
            ->where(
                'source_id',
                $consumption->id
            )
            ->firstOrFail();

        $this->assertEqualsWithDelta(
            2.5,
            (float) $reversal->quantity_delta,
            0.0001
        );

        $this->assertEqualsWithDelta(
            1000.0,
            (float) $reversal->total_cost,
            0.009
        );

        $this->assertSame(
            $this->businessDay->id,
            $reversal->business_day_id
        );
    }

    public function test_stock_reversal_cannot_exceed_remaining_consumed_quantity(): void
    {
        [,
            $consumption,
        ] =
            $this->createSaleConsumptionFixture();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this->postJson(
            "/api/v1/stock-movements/{$consumption->id}/cancellation-reversal",
            [
                'client_request_id' =>
                (string) Str::uuid(),

                'quantity' =>
                6,

                'reason' =>
                'First partial reversal.',

                'manager_login' =>
                $this->manager->username,

                'manager_password' =>
                'password',
            ]
        )->assertOk();

        $response =
            $this->postJson(
                "/api/v1/stock-movements/{$consumption->id}/cancellation-reversal",
                [
                    'client_request_id' =>
                    (string) Str::uuid(),

                    'quantity' =>
                    5,

                    'reason' =>
                    'Attempt to reverse more than remaining quantity.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'password',
                ]
            );

        $response->assertStatus(422);

        $this->assertSame(
            1,
            StockMovement::query()
                ->where(
                    'movement_type',
                    StockMovement::TYPE_CANCELLATION_REVERSAL
                )
                ->count()
        );
    }

    public function test_duplicate_stock_reversal_request_is_idempotent(): void
    {
        [
            $ingredient,
            $consumption,
        ] =
            $this->createSaleConsumptionFixture();

        $requestId =
            (string) Str::uuid();

        $payload = [
            'client_request_id' =>
            $requestId,

            'quantity' =>
            2,

            'reason' =>
            'Duplicate-safe stock correction.',

            'manager_login' =>
            $this->manager->username,

            'manager_password' =>
            'password',
        ];

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this->postJson(
            "/api/v1/stock-movements/{$consumption->id}/cancellation-reversal",
            $payload
        )->assertOk();

        $this->postJson(
            "/api/v1/stock-movements/{$consumption->id}/cancellation-reversal",
            $payload
        )->assertOk();

        $this->assertSame(
            1,
            StockMovement::query()
                ->where(
                    'movement_type',
                    StockMovement::TYPE_CANCELLATION_REVERSAL
                )
                ->count()
        );

        $this->assertEqualsWithDelta(
            92.0,
            (float) $ingredient->fresh()->current_stock,
            0.0001
        );
    }

    public function test_stock_reversal_is_blocked_when_business_day_is_closed(): void
    {
        [
            $ingredient,
            $consumption,
        ] =
            $this->createSaleConsumptionFixture();

        $this->closeBusinessDay();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                "/api/v1/stock-movements/{$consumption->id}/cancellation-reversal",
                [
                    'client_request_id' =>
                    (string) Str::uuid(),

                    'quantity' =>
                    1,

                    'reason' =>
                    'Attempted correction after day close.',

                    'manager_login' =>
                    $this->manager->username,

                    'manager_password' =>
                    'password',
                ]
            );

        $response->assertStatus(409);

        $this->assertEqualsWithDelta(
            90.0,
            (float) $ingredient->fresh()->current_stock,
            0.0001
        );

        $this->assertSame(
            0,
            StockMovement::query()
                ->where(
                    'movement_type',
                    StockMovement::TYPE_CANCELLATION_REVERSAL
                )
                ->count()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createOrder(
        string $status
    ): Order {
        $confirmedAt =
            in_array(
                $status,
                [
                    Order::STATUS_CONFIRMED,
                    Order::STATUS_SENT_TO_KITCHEN,
                    Order::STATUS_SERVED,
                ],
                true
            )
            ? now()->subMinutes(20)
            : null;

        $sentAt =
            in_array(
                $status,
                [
                    Order::STATUS_SENT_TO_KITCHEN,
                    Order::STATUS_SERVED,
                ],
                true
            )
            ? now()->subMinutes(15)
            : null;

        $servedAt =
            $status === Order::STATUS_SERVED
            ? now()->subMinutes(5)
            : null;

        return Order::query()
            ->create([
                'order_number' =>
                'ORD-P33-' .
                    Str::upper(
                        Str::random(10)
                    ),

                'client_order_id' =>
                null,

                'submission_hash' =>
                null,

                'public_status_token' =>
                null,

                'business_day_id' =>
                $this->businessDay->id,

                'table_session_id' =>
                null,

                'table_id' =>
                null,

                'order_type' =>
                Order::TYPE_TAKEAWAY,

                'order_source' =>
                Order::SOURCE_CASHIER,

                'session_sequence' =>
                null,

                'table_name_snapshot' =>
                null,

                'takeaway_token' =>
                null,

                'customer_name' =>
                'Phase 33 Customer',

                'customer_phone' =>
                '0771234567',

                'status' =>
                $status,

                'subtotal' =>
                1000,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'service_charge_total' =>
                0,

                'grand_total' =>
                1000,

                'estimated_cost_total' =>
                0,

                'customer_notes' =>
                null,

                'internal_notes' =>
                null,

                'created_by' =>
                $this->cashier->id,

                'confirmed_by' =>
                $confirmedAt
                    ? $this->cashier->id
                    : null,

                'cancelled_by' =>
                null,

                'rejected_by' =>
                null,

                'confirmed_at' =>
                $confirmedAt,

                'sent_to_kitchen_at' =>
                $sentAt,

                'served_at' =>
                $servedAt,

                'completed_at' =>
                null,

                'cancelled_at' =>
                null,

                'rejected_at' =>
                null,

                'cancellation_reason' =>
                null,

                'rejection_reason' =>
                null,
            ]);
    }

    private function createPaidInvoiceWithPayment(
        string $method,
        float $amount,
        ?CashierShift $shift = null
    ): array {
        $invoice =
            Invoice::query()
            ->create([
                'invoice_number' =>
                'INV-P33-' .
                    Str::upper(
                        Str::random(12)
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_shift_id' =>
                $shift?->id,

                'table_session_id' =>
                null,

                'order_id' =>
                null,

                'invoice_type' =>
                Invoice::TYPE_SALE,

                'table_name_snapshot' =>
                null,

                'customer_name' =>
                'Phase 33 Customer',

                'customer_phone' =>
                '0771234567',

                'subtotal' =>
                $amount,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'service_charge_total' =>
                0,

                'grand_total' =>
                $amount,

                'estimated_cost_total' =>
                0,

                'paid_amount' =>
                $amount,

                'change_amount' =>
                0,

                'balance_due' =>
                0,

                'payment_status' =>
                Invoice::PAYMENT_STATUS_PAID,

                'status' =>
                Invoice::STATUS_ISSUED,

                'issued_by' =>
                $this->cashier->id,

                'issued_at' =>
                now(),

                'voided_at' =>
                null,

                'voided_by' =>
                null,

                'void_reason' =>
                null,
            ]);

        $payment =
            Payment::query()
            ->create([
                'payment_batch_id' =>
                null,

                'payment_number' =>
                'PAY-P33-' .
                    Str::upper(
                        Str::random(12)
                    ),

                'invoice_id' =>
                $invoice->id,

                'cashier_shift_id' =>
                $shift?->id,

                'payment_method' =>
                $method,

                'amount' =>
                $amount,

                'tendered_amount' =>
                $method === Payment::METHOD_CASH
                    ? $amount
                    : null,

                'change_given' =>
                0,

                'reference_number' =>
                $method === Payment::METHOD_CASH
                    ? null
                    : 'P33-' .
                    Str::upper(
                        Str::random(8)
                    ),

                'status' =>
                Payment::STATUS_COMPLETED,

                'received_by' =>
                $this->cashier->id,

                'paid_at' =>
                now(),

                'notes' =>
                'Phase 33 payment fixture.',
            ]);

        return [
            $invoice,
            $payment,
        ];
    }

    private function createCashierShift(
        User $cashier,
        float $openingFloat = 0
    ): CashierShift {
        return CashierShift::query()
            ->create([
                'shift_number' =>
                'SHIFT-P33-' .
                    Str::upper(
                        Str::random(12)
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_id' =>
                $cashier->id,

                'opening_float' =>
                $openingFloat,

                'expected_cash' =>
                $openingFloat,

                'status' =>
                CashierShift::STATUS_OPEN,

                'opened_at' =>
                now()->subHour(),

                'closed_at' =>
                null,

                'closed_by' =>
                null,

                'opening_notes' =>
                'Phase 33 automated shift.',

                'closing_notes' =>
                null,
            ]);
    }

    private function createSaleConsumptionFixture(): array
    {
        $unit =
            Unit::query()
            ->create([
                'name' =>
                'Gram Phase 33 ' .
                    Str::upper(
                        Str::random(5)
                    ),

                'symbol' =>
                'G33' .
                    Str::upper(
                        Str::random(8)
                    ),

                'measurement_type' =>
                'MASS',

                'base_unit_id' =>
                null,

                'conversion_factor' =>
                1,

                'is_active' =>
                true,
            ]);

        $ingredient =
            Ingredient::query()
            ->create([
                'sku' =>
                'ING-P33-' .
                    Str::upper(
                        Str::random(8)
                    ),

                'name' =>
                'Phase 33 Ingredient ' .
                    Str::upper(
                        Str::random(5)
                    ),

                'base_unit_id' =>
                $unit->id,

                'current_stock' =>
                90,

                'reorder_level' =>
                10,

                'average_cost' =>
                400,

                'track_stock' =>
                true,

                'is_active' =>
                true,

                'storage_location' =>
                'Phase 33 Test Shelf',
            ]);

        $movement =
            StockMovement::query()
            ->create([
                'movement_key' =>
                'p33-sale-consumption-' .
                    Str::uuid(),

                'ingredient_id' =>
                $ingredient->id,

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
                'phase33_test',

                'source_id' =>
                1,

                'reference' =>
                'P33-SALE',

                'notes' =>
                'Phase 33 sale consumption fixture.',

                'created_by' =>
                $this->cashier->id,

                'occurred_at' =>
                now(),
            ]);

        return [
            $ingredient,
            $movement,
        ];
    }

    private function closeBusinessDay(): void
    {
        $this->businessDay->update([
            'status' =>
            BusinessDay::STATUS_CLOSED,

            'closed_by' =>
            $this->manager->id,

            'closed_at' =>
            now(),
        ]);

        $this->businessDay->refresh();
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
                "Phase 33 {$roleCode} role.",

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
                        'Phase 33',

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
                "{$roleCode} Phase 33 User",

                'username' =>
                strtolower(
                    $roleCode
                ) .
                    '_' .
                    Str::lower(
                        Str::random(8)
                    ),

                'email' =>
                strtolower(
                    $roleCode
                ) .
                    '_' .
                    Str::lower(
                        Str::random(8)
                    ) .
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
