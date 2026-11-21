<?php

namespace Tests\Feature;

use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerMultiplePaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;

    private User $unauthorizedUser;

    private BusinessDay $businessDay;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cashier =
            $this->createUserWithPermissions(
                roleCode: 'P28_CASHIER',

                permissions: [
                    'payments.create',
                    'invoices.view',
                ]
            );

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'P28_NO_PAYMENT',

                permissions: []
            );

        $this->businessDay =
            BusinessDay::query()
            ->create([
                'business_date' =>
                now()->toDateString(),

                'status' =>
                BusinessDay::STATUS_OPEN,

                'opened_by' =>
                $this->cashier->id,

                'opened_at' =>
                now(),

                'notes' =>
                'Phase 28 automated payment test business day.',
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Cash + Card + QR
    |--------------------------------------------------------------------------
    */

    public function test_cash_card_and_qr_can_pay_one_invoice_atomically(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 10000
            );

        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,

                openingFloat: 20000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $response =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/payments",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'cashier_shift_id' =>
                    $shift->id,

                    'payments' => [
                        [
                            'payment_method' =>
                            Payment::METHOD_CASH,

                            'amount' =>
                            3000,

                            /*
                             * Customer gives Rs.5,000.
                             *
                             * Rs.2,000 is returned as change.
                             */
                            'tendered_amount' =>
                            5000,
                        ],

                        [
                            'payment_method' =>
                            Payment::METHOD_CARD,

                            'amount' =>
                            5000,

                            'reference_number' =>
                            'CARD-P28-001',
                        ],

                        [
                            'payment_method' =>
                            Payment::METHOD_QR,

                            'amount' =>
                            2000,

                            'reference_number' =>
                            'QR-P28-001',
                        ],
                    ],
                ]
            );

        $response
            ->assertStatus(201)
            ->assertJsonPath(
                'data.created',
                true
            )
            ->assertJsonPath(
                'data.cash_drawer.should_open',
                true
            );

        /*
        |--------------------------------------------------------------------------
        | Batch
        |--------------------------------------------------------------------------
        */

        $this->assertEquals(
            10000,
            $response->json(
                'data.batch.total_amount'
            )
        );

        $this->assertEquals(
            3000,
            $response->json(
                'data.batch.cash_amount'
            )
        );

        $this->assertSame(
            3,
            $response->json(
                'data.batch.payment_count'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Three Payment Rows
        |--------------------------------------------------------------------------
        */

        $response
            ->assertJsonCount(
                3,
                'data.payments'
            );

        $this->assertSame(
            Payment::METHOD_CASH,
            $response->json(
                'data.payments.0.payment_method'
            )
        );

        $this->assertSame(
            Payment::METHOD_CARD,
            $response->json(
                'data.payments.1.payment_method'
            )
        );

        $this->assertSame(
            Payment::METHOD_QR,
            $response->json(
                'data.payments.2.payment_method'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Cash Tender / Change
        |--------------------------------------------------------------------------
        */

        $this->assertEquals(
            3000,
            $response->json(
                'data.payments.0.amount'
            )
        );

        $this->assertEquals(
            5000,
            $response->json(
                'data.payments.0.tendered_amount'
            )
        );

        $this->assertEquals(
            2000,
            $response->json(
                'data.payments.0.change_given'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Invoice State
        |--------------------------------------------------------------------------
        */

        $this->assertEquals(
            10000,
            $response->json(
                'data.invoice.payment.paid_amount'
            )
        );

        $this->assertEquals(
            0,
            $response->json(
                'data.invoice.payment.balance_due'
            )
        );

        $this->assertEquals(
            2000,
            $response->json(
                'data.invoice.payment.change_amount'
            )
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_PAID,
            $response->json(
                'data.invoice.payment.status'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Database
        |--------------------------------------------------------------------------
        */

        $this->assertDatabaseCount(
            'payment_batches',
            1
        );

        $this->assertDatabaseCount(
            'payments',
            3
        );

        $this->assertDatabaseHas(
            'payments',
            [
                'invoice_id' =>
                $invoice->id,

                'payment_method' =>
                Payment::METHOD_CASH,

                'amount' =>
                3000,

                'tendered_amount' =>
                5000,

                'change_given' =>
                2000,
            ]
        );

        $this->assertDatabaseHas(
            'payments',
            [
                'invoice_id' =>
                $invoice->id,

                'payment_method' =>
                Payment::METHOD_CARD,

                'amount' =>
                5000,
            ]
        );

        $this->assertDatabaseHas(
            'payments',
            [
                'invoice_id' =>
                $invoice->id,

                'payment_method' =>
                Payment::METHOD_QR,

                'amount' =>
                2000,
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | Only CASH Enters Drawer
        |--------------------------------------------------------------------------
        |
        | Customer handed over Rs.5,000.
        | Rs.2,000 was returned.
        |
        | Net physical cash retained = Rs.3,000.
        |
        */

        $shift->refresh();

        $this->assertSame(
            '23000.00',
            $shift->expected_cash
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            1
        );

        $this->assertDatabaseHas(
            'cash_drawer_movements',
            [
                'cashier_shift_id' =>
                $shift->id,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_SALE,

                'amount' =>
                3000,

                'reference_type' =>
                'payment',
            ]
        );

        $invoice->refresh();

        $this->assertSame(
            '10000.00',
            $invoice->paid_amount
        );

        $this->assertSame(
            '0.00',
            $invoice->balance_due
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_PAID,
            $invoice->payment_status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Network Retry Idempotency
    |--------------------------------------------------------------------------
    */

    public function test_duplicate_payment_request_does_not_charge_or_open_drawer_twice(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 3000
            );

        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,

                openingFloat: 10000
            );

        $clientRequestId =
            (string)
            Str::uuid();

        $payload = [
            'client_request_id' =>
            $clientRequestId,

            /*
             * Intentionally omit cashier_shift_id.
             *
             * Service should automatically use
             * cashier's active shift.
             */
            'payments' => [
                [
                    'payment_method' =>
                    Payment::METHOD_CASH,

                    'amount' =>
                    3000,

                    'tendered_amount' =>
                    3000,
                ],
            ],
        ];

        Sanctum::actingAs($this->cashier, ['staff']);

        /*
        |--------------------------------------------------------------------------
        | First Request
        |--------------------------------------------------------------------------
        */

        $first =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/payments",
                $payload
            );

        $first
            ->assertStatus(201)
            ->assertJsonPath(
                'data.created',
                true
            )
            ->assertJsonPath(
                'data.cash_drawer.should_open',
                true
            );

        $batchId =
            (int)
            $first->json(
                'data.batch.id'
            );

        $paymentId =
            (int)
            $first->json(
                'data.payments.0.id'
            );

        /*
        |--------------------------------------------------------------------------
        | Same Network Request Retried
        |--------------------------------------------------------------------------
        */

        $second =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/payments",
                $payload
            );

        $second
            ->assertStatus(200)
            ->assertJsonPath(
                'data.created',
                false
            )
            ->assertJsonPath(
                'data.batch.id',
                $batchId
            )
            ->assertJsonPath(
                'data.payments.0.id',
                $paymentId
            )
            ->assertJsonPath(
                'data.cash_drawer.should_open',
                false
            );

        /*
         * Nothing duplicated.
         */
        $this->assertDatabaseCount(
            'payment_batches',
            1
        );

        $this->assertDatabaseCount(
            'payments',
            1
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            1
        );

        $shift->refresh();

        $this->assertSame(
            '13000.00',
            $shift->expected_cash
        );

        /*
         * Only one payment number consumed.
         */
        $this->assertSame(
            1,
            (int)
            DB::table(
                'document_sequences'
            )
                ->where(
                    'sequence_type',
                    'PAYMENT'
                )
                ->value(
                    'current_number'
                )
        );

        /*
         * Only one financial audit event.
         */
        $this->assertSame(
            1,
            DB::table(
                'audit_logs'
            )
                ->where(
                    'action',
                    'CUSTOMER_PAYMENT_BATCH_RECORDED'
                )
                ->where(
                    'entity_id',
                    $invoice->id
                )
                ->count()
        );

        /*
         * Auto-selected shift was persisted.
         */
        $this->assertDatabaseHas(
            'payment_batches',
            [
                'id' =>
                $batchId,

                'cashier_shift_id' =>
                $shift->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Reused UUID With Different Payment Data
    |--------------------------------------------------------------------------
    */

    public function test_same_client_request_id_with_different_payment_data_is_rejected(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 5000
            );

        $clientRequestId =
            (string)
            Str::uuid();

        Sanctum::actingAs($this->cashier, ['staff']);

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/payments",
            [
                'client_request_id' =>
                $clientRequestId,

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CARD,

                        'amount' =>
                        1000,

                        'reference_number' =>
                        'CARD-FIRST',
                    ],
                ],
            ]
        )
            ->assertStatus(201);

        /*
         * Same UUID but different amount.
         */
        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/payments",
            [
                'client_request_id' =>
                $clientRequestId,

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CARD,

                        'amount' =>
                        2000,

                        'reference_number' =>
                        'CARD-FIRST',
                    ],
                ],
            ]
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'payment_batches',
            1
        );

        $this->assertDatabaseCount(
            'payments',
            1
        );

        $invoice->refresh();

        $this->assertSame(
            '1000.00',
            $invoice->paid_amount
        );

        $this->assertSame(
            '4000.00',
            $invoice->balance_due
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_PARTIAL,
            $invoice->payment_status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Partial Payment Then Settlement
    |--------------------------------------------------------------------------
    */

    public function test_partial_payment_can_be_completed_by_later_payment(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 10000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        /*
        |--------------------------------------------------------------------------
        | First Payment - Card Rs.3,000
        |--------------------------------------------------------------------------
        */

        $first =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/payments",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'payments' => [
                        [
                            'payment_method' =>
                            Payment::METHOD_CARD,

                            'amount' =>
                            3000,

                            'reference_number' =>
                            'CARD-PARTIAL-001',
                        ],
                    ],
                ]
            );

        $first
            ->assertStatus(201);

        $this->assertEquals(
            3000,
            $first->json(
                'data.invoice.payment.paid_amount'
            )
        );

        $this->assertEquals(
            7000,
            $first->json(
                'data.invoice.payment.balance_due'
            )
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_PARTIAL,
            $first->json(
                'data.invoice.payment.status'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Second Payment - QR Rs.7,000
        |--------------------------------------------------------------------------
        */

        $second =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/payments",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'payments' => [
                        [
                            'payment_method' =>
                            Payment::METHOD_QR,

                            'amount' =>
                            7000,

                            'reference_number' =>
                            'QR-SETTLEMENT-001',
                        ],
                    ],
                ]
            );

        $second
            ->assertStatus(201);

        $this->assertEquals(
            10000,
            $second->json(
                'data.invoice.payment.paid_amount'
            )
        );

        $this->assertEquals(
            0,
            $second->json(
                'data.invoice.payment.balance_due'
            )
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_PAID,
            $second->json(
                'data.invoice.payment.status'
            )
        );

        $this->assertDatabaseCount(
            'payment_batches',
            2
        );

        $this->assertDatabaseCount(
            'payments',
            2
        );

        /*
         * No cash involved.
         */
        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Bank Transfer + Other
    |--------------------------------------------------------------------------
    */

    public function test_bank_transfer_and_other_payment_methods_are_supported(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 2000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $response =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/payments",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'payments' => [
                        [
                            'payment_method' =>
                            Payment::METHOD_BANK_TRANSFER,

                            'amount' =>
                            1200,

                            'reference_number' =>
                            'BANK-TRANSFER-001',
                        ],

                        [
                            'payment_method' =>
                            Payment::METHOD_OTHER,

                            'amount' =>
                            800,

                            'reference_number' =>
                            'OTHER-001',

                            'notes' =>
                            'Phase 28 alternative payment.',
                        ],
                    ],
                ]
            );

        $response
            ->assertStatus(201)
            ->assertJsonCount(
                2,
                'data.payments'
            );

        $this->assertSame(
            Payment::METHOD_BANK_TRANSFER,
            $response->json(
                'data.payments.0.payment_method'
            )
        );

        $this->assertSame(
            Payment::METHOD_OTHER,
            $response->json(
                'data.payments.1.payment_method'
            )
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_PAID,
            $response->json(
                'data.invoice.payment.status'
            )
        );

        $this->assertDatabaseHas(
            'payments',
            [
                'invoice_id' =>
                $invoice->id,

                'payment_method' =>
                Payment::METHOD_BANK_TRANSFER,

                'amount' =>
                1200,
            ]
        );

        $this->assertDatabaseHas(
            'payments',
            [
                'invoice_id' =>
                $invoice->id,

                'payment_method' =>
                Payment::METHOD_OTHER,

                'amount' =>
                800,
            ]
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Atomic Rollback
    |--------------------------------------------------------------------------
    */

    public function test_failure_on_third_payment_rolls_back_entire_multiple_payment_request(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 10000
            );

        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,

                openingFloat: 20000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        /*
         * CASH succeeds first internally.
         * CARD succeeds second internally.
         *
         * QR fails because tendered_amount is
         * only valid for CASH.
         *
         * Entire transaction MUST roll back.
         */
        $response =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/payments",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'cashier_shift_id' =>
                    $shift->id,

                    'payments' => [
                        [
                            'payment_method' =>
                            Payment::METHOD_CASH,

                            'amount' =>
                            3000,

                            'tendered_amount' =>
                            5000,
                        ],

                        [
                            'payment_method' =>
                            Payment::METHOD_CARD,

                            'amount' =>
                            5000,

                            'reference_number' =>
                            'CARD-ROLLBACK',
                        ],

                        [
                            'payment_method' =>
                            Payment::METHOD_QR,

                            'amount' =>
                            2000,

                            /*
                             * INVALID.
                             */
                            'tendered_amount' =>
                            2000,

                            'reference_number' =>
                            'QR-ROLLBACK',
                        ],
                    ],
                ]
            );

        $response
            ->assertStatus(422);

        /*
        |--------------------------------------------------------------------------
        | Nothing Financial Was Persisted
        |--------------------------------------------------------------------------
        */

        $this->assertDatabaseCount(
            'payment_batches',
            0
        );

        $this->assertDatabaseCount(
            'payments',
            0
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );

        /*
         * Even payment-number sequence increments
         * must roll back with the transaction.
         */
        $this->assertSame(
            0,
            (int)
            DB::table(
                'document_sequences'
            )
                ->where(
                    'sequence_type',
                    'PAYMENT'
                )
                ->value(
                    'current_number'
                )
        );

        $shift->refresh();

        $this->assertSame(
            '20000.00',
            $shift->expected_cash
        );

        $invoice->refresh();

        $this->assertSame(
            '0.00',
            $invoice->paid_amount
        );

        $this->assertSame(
            '10000.00',
            $invoice->balance_due
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_UNPAID,
            $invoice->payment_status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Overpayment
    |--------------------------------------------------------------------------
    */

    public function test_payment_total_cannot_exceed_invoice_balance(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 1000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/payments",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CARD,

                        'amount' =>
                        1001,
                    ],
                ],
            ]
        )
            ->assertStatus(422);

        $this->assertDatabaseCount(
            'payment_batches',
            0
        );

        $this->assertDatabaseCount(
            'payments',
            0
        );

        $invoice->refresh();

        $this->assertSame(
            '0.00',
            $invoice->paid_amount
        );

        $this->assertSame(
            '1000.00',
            $invoice->balance_due
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cash Tender Too Low
    |--------------------------------------------------------------------------
    */

    public function test_cash_tendered_amount_cannot_be_less_than_cash_allocation(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 1000
            );

        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,

                openingFloat: 5000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/payments",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'cashier_shift_id' =>
                $shift->id,

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CASH,

                        'amount' =>
                        1000,

                        'tendered_amount' =>
                        900,
                    ],
                ],
            ]
        )
            ->assertStatus(422);

        $this->assertDatabaseCount(
            'payment_batches',
            0
        );

        $this->assertDatabaseCount(
            'payments',
            0
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );

        $shift->refresh();

        $this->assertSame(
            '5000.00',
            $shift->expected_cash
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Closed Shift
    |--------------------------------------------------------------------------
    */

    public function test_cash_payment_cannot_use_closed_cashier_shift(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 1000
            );

        $shift =
            $this->createCashierShift(
                cashier: $this->cashier,

                openingFloat: 5000,

                status: CashierShift::STATUS_CLOSED
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/payments",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'cashier_shift_id' =>
                $shift->id,

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CASH,

                        'amount' =>
                        1000,
                    ],
                ],
            ]
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'payments',
            0
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Another Cashier's Shift
    |--------------------------------------------------------------------------
    */

    public function test_payment_cannot_modify_another_cashiers_shift(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 1000
            );

        $otherCashier =
            $this->createUserWithPermissions(
                roleCode: 'P28_OTHER_CASHIER',

                permissions: [
                    'payments.create',
                ]
            );

        $otherShift =
            $this->createCashierShift(
                cashier: $otherCashier,

                openingFloat: 5000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/payments",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'cashier_shift_id' =>
                $otherShift->id,

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CASH,

                        'amount' =>
                        1000,
                    ],
                ],
            ]
        )
            ->assertStatus(403);

        $this->assertDatabaseCount(
            'payments',
            0
        );

        $otherShift->refresh();

        $this->assertSame(
            '5000.00',
            $otherShift->expected_cash
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Invoice / Business-Day Protections
    |--------------------------------------------------------------------------
    */

    public function test_void_paid_and_closed_business_day_invoices_cannot_receive_new_payment(): void
    {
        Sanctum::actingAs($this->cashier, ['staff']);

        /*
        |--------------------------------------------------------------------------
        | VOID Invoice
        |--------------------------------------------------------------------------
        */

        $voidInvoice =
            $this->createInvoice(
                grandTotal: 1000,

                status: Invoice::STATUS_VOID
            );

        $this->postJson(
            "/api/v1/invoices/{$voidInvoice->id}/payments",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CARD,

                        'amount' =>
                        1000,
                    ],
                ],
            ]
        )
            ->assertStatus(409);

        /*
        |--------------------------------------------------------------------------
        | Already PAID Invoice
        |--------------------------------------------------------------------------
        */

        $paidInvoice =
            $this->createInvoice(
                grandTotal: 2000,

                paymentStatus: Invoice::PAYMENT_STATUS_PAID,

                paidAmount: 2000
            );

        $this->postJson(
            "/api/v1/invoices/{$paidInvoice->id}/payments",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CARD,

                        'amount' =>
                        100,
                    ],
                ],
            ]
        )
            ->assertStatus(409);

        /*
        |--------------------------------------------------------------------------
        | Closed Business Day
        |--------------------------------------------------------------------------
        */

        $closedDayInvoice =
            $this->createInvoice(
                grandTotal: 3000
            );

        /*
         * Service only needs the accounting status
         * to enforce immutability here.
         */
        DB::table(
            'business_days'
        )
            ->where(
                'id',
                $this->businessDay->id
            )
            ->update([
                'status' =>
                'CLOSED',
            ]);

        $this->postJson(
            "/api/v1/invoices/{$closedDayInvoice->id}/payments",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'payments' => [
                    [
                        'payment_method' =>
                        Payment::METHOD_CARD,

                        'amount' =>
                        3000,
                    ],
                ],
            ]
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'payments',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Permissions + Payment History
    |--------------------------------------------------------------------------
    */

    public function test_payment_creation_and_history_are_permission_protected(): void
    {
        $invoice =
            $this->createInvoice(
                grandTotal: 1000
            );

        $payload = [
            'client_request_id' =>
            (string)
            Str::uuid(),

            'payments' => [
                [
                    'payment_method' =>
                    Payment::METHOD_CARD,

                    'amount' =>
                    500,

                    'reference_number' =>
                    'CARD-HISTORY-001',
                ],
            ],
        ];

        /*
        |--------------------------------------------------------------------------
        | Unauthorized Create
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->unauthorizedUser, ['staff']);

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/payments",
            $payload
        )
            ->assertStatus(403);

        $this->assertDatabaseCount(
            'payments',
            0
        );

        /*
        |--------------------------------------------------------------------------
        | Authorized Create
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->cashier, ['staff']);

        $this->postJson(
            "/api/v1/invoices/{$invoice->id}/payments",
            $payload
        )
            ->assertStatus(201);

        /*
        |--------------------------------------------------------------------------
        | Authorized History
        |--------------------------------------------------------------------------
        */

        $history =
            $this->getJson(
                "/api/v1/invoices/{$invoice->id}/payments"
            );

        $history
            ->assertStatus(200)
            ->assertJsonCount(
                1,
                'data.payments'
            );

        $this->assertSame(
            Payment::METHOD_CARD,
            $history->json(
                'data.payments.0.payment_method'
            )
        );

        $this->assertEquals(
            500,
            $history->json(
                'data.paid_amount'
            )
        );

        $this->assertEquals(
            500,
            $history->json(
                'data.balance_due'
            )
        );

        $this->assertSame(
            Invoice::PAYMENT_STATUS_PARTIAL,
            $history->json(
                'data.payment_status'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Unauthorized History
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->unauthorizedUser, ['staff']);

        $this->getJson(
            "/api/v1/invoices/{$invoice->id}/payments"
        )
            ->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createInvoice(
        float $grandTotal,
        string $status = Invoice::STATUS_ISSUED,
        string $paymentStatus = Invoice::PAYMENT_STATUS_UNPAID,
        float $paidAmount = 0
    ): Invoice {
        $paidAmount =
            round(
                $paidAmount,
                2
            );

        $grandTotal =
            round(
                $grandTotal,
                2
            );

        $balanceDue =
            round(
                max(
                    0,
                    $grandTotal
                        -
                        $paidAmount
                ),
                2
            );

        return Invoice::query()
            ->create([
                'invoice_number' =>
                'INV-P28-' .
                    Str::upper(
                        Str::random(12)
                    ),

                'business_day_id' =>
                $this
                    ->businessDay
                    ->id,

                'cashier_shift_id' =>
                null,

                'table_session_id' =>
                null,

                'order_id' =>
                null,

                'invoice_type' =>
                Invoice::TYPE_SALE,

                'table_name_snapshot' =>
                null,

                'customer_name' =>
                'Phase 28 Customer',

                'customer_phone' =>
                '0771234567',

                'subtotal' =>
                $grandTotal,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'service_charge_total' =>
                0,

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
                $status,

                'issued_by' =>
                $this
                    ->cashier
                    ->id,

                'issued_at' =>
                now(),

                'voided_at' =>
                $status
                    ===
                    Invoice::STATUS_VOID
                    ? now()
                    : null,

                'voided_by' =>
                $status
                    ===
                    Invoice::STATUS_VOID
                    ? $this
                    ->cashier
                    ->id
                    : null,

                'void_reason' =>
                $status
                    ===
                    Invoice::STATUS_VOID
                    ? 'Phase 28 payment protection test.'
                    : null,
            ]);
    }

    private function createCashierShift(
        User $cashier,
        float $openingFloat = 0,
        string $status = CashierShift::STATUS_OPEN
    ): CashierShift {
        return CashierShift::query()
            ->create([
                'shift_number' =>
                'SHIFT-P28-' .
                    Str::upper(
                        Str::random(12)
                    ),

                'business_day_id' =>
                $this
                    ->businessDay
                    ->id,

                'cashier_id' =>
                $cashier->id,

                'opening_float' =>
                $openingFloat,

                'expected_cash' =>
                $openingFloat,

                'status' =>
                $status,

                'opened_at' =>
                now()
                    ->subHour(),

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
                    ? $cashier->id
                    : null,

                'opening_notes' =>
                'Phase 28 automated payment shift.',

                'closing_notes' =>
                $status
                    ===
                    CashierShift::STATUS_CLOSED
                    ? 'Closed for Phase 28 test.'
                    : null,
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
                "Phase 28 {$roleCode} role.",

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
                "{$roleCode} Phase 28 User",

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
