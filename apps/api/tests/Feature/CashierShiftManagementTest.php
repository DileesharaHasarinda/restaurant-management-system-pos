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

class CashierShiftManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;

    private User $otherCashier;

    private User $unauthorizedUser;

    private BusinessDay $businessDay;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cashier =
            $this->createUserWithPermissions(
                roleCode: 'P29_CASHIER',

                permissions: [
                    'cash_shift.view',
                    'cash_shift.open',
                    'cash_shift.close',
                    'cash_drawer.movement',

                    /*
                     * Required for the Phase 28
                     * cash-sale integration test.
                     */
                    'payments.create',
                    'invoices.view',
                ]
            );

        $this->otherCashier =
            $this->createUserWithPermissions(
                roleCode: 'P29_OTHER_CASHIER',

                permissions: [
                    'cash_shift.view',
                    'cash_shift.open',
                    'cash_shift.close',
                    'cash_drawer.movement',
                ]
            );

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'P29_UNAUTHORIZED',

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
                'Phase 29 automated test business day.',
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Open Shift
    |--------------------------------------------------------------------------
    */

    public function test_cashier_can_open_shift_with_opening_cash(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $response =
            $this->postJson(
                '/api/v1/cashier-shifts/open',
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'opening_cash' =>
                    10000,

                    'opening_notes' =>
                    'Morning opening float.',
                ]
            );

        $response
            ->assertStatus(201)
            ->assertJsonPath(
                'data.created',
                true
            )
            ->assertJsonPath(
                'data.shift.status',
                CashierShift::STATUS_OPEN
            );

        $this->assertEquals(
            10000,
            $response->json(
                'data.shift.opening_cash'
            )
        );

        $this->assertEquals(
            10000,
            $response->json(
                'data.shift.expected_cash'
            )
        );

        $this->assertEquals(
            10000,
            $response->json(
                'data.summary.opening_cash'
            )
        );

        $this->assertEquals(
            10000,
            $response->json(
                'data.summary.calculated_expected_cash'
            )
        );

        $this->assertDatabaseCount(
            'cashier_shifts',
            1
        );

        $this->assertDatabaseHas(
            'cashier_shifts',
            [
                'cashier_id' =>
                $this->cashier->id,

                'opening_float' =>
                10000,

                'expected_cash' =>
                10000,

                'status' =>
                CashierShift::STATUS_OPEN,
            ]
        );

        /*
         * Opening float must exist in ledger.
         */
        $this->assertDatabaseCount(
            'cash_drawer_movements',
            1
        );

        $this->assertDatabaseHas(
            'cash_drawer_movements',
            [
                'movement_type' =>
                CashDrawerMovement::TYPE_OPENING_FLOAT,

                'amount' =>
                10000,

                'reference_type' =>
                'cashier_shift',
            ]
        );

        /*
         * Very important:
         *
         * Opening float is NOT added twice.
         */
        $shift =
            CashierShift::query()
            ->firstOrFail();

        $this->assertSame(
            '10000.00',
            $shift->expected_cash
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Opening Is Idempotent
    |--------------------------------------------------------------------------
    */

    public function test_duplicate_open_shift_request_is_idempotent(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $requestId =
            (string)
            Str::uuid();

        $payload = [
            'client_request_id' =>
            $requestId,

            'opening_cash' =>
            10000,

            'opening_notes' =>
            'Morning float.',
        ];

        $first =
            $this->postJson(
                '/api/v1/cashier-shifts/open',
                $payload
            );

        $first
            ->assertStatus(201)
            ->assertJsonPath(
                'data.created',
                true
            );

        $shiftId =
            (int)
            $first->json(
                'data.shift.id'
            );

        $second =
            $this->postJson(
                '/api/v1/cashier-shifts/open',
                $payload
            );

        $second
            ->assertStatus(200)
            ->assertJsonPath(
                'data.created',
                false
            )
            ->assertJsonPath(
                'data.shift.id',
                $shiftId
            );

        $this->assertDatabaseCount(
            'cashier_shifts',
            1
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            1
        );

        /*
         * Same UUID with different financial data
         * must be rejected.
         */
        $this->postJson(
            '/api/v1/cashier-shifts/open',
            [
                'client_request_id' =>
                $requestId,

                'opening_cash' =>
                12000,

                'opening_notes' =>
                'Morning float.',
            ]
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'cashier_shifts',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Only One Open Shift Per Cashier
    |--------------------------------------------------------------------------
    */

    public function test_cashier_cannot_have_two_open_shifts(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $this->openShiftViaApi(
            openingCash: 10000
        );

        $this->postJson(
            '/api/v1/cashier-shifts/open',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'opening_cash' =>
                5000,
            ]
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'cashier_shifts',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Current Shift
    |--------------------------------------------------------------------------
    */

    public function test_current_shift_returns_open_shift_and_summary(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        $response =
            $this->getJson(
                '/api/v1/cashier-shifts/current'
            );

        $response
            ->assertStatus(200)
            ->assertJsonPath(
                'data.shift.id',
                $shiftId
            )
            ->assertJsonPath(
                'data.shift.status',
                CashierShift::STATUS_OPEN
            );

        $this->assertEquals(
            10000,
            $response->json(
                'data.summary.opening_cash'
            )
        );

        $this->assertEquals(
            10000,
            $response->json(
                'data.summary.expected_cash'
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Manual Cash In / Cash Out
    |--------------------------------------------------------------------------
    */

    public function test_manual_cash_in_and_cash_out_update_expected_cash(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        /*
        |--------------------------------------------------------------------------
        | Cash In + Rs.2,000
        |--------------------------------------------------------------------------
        */

        $cashIn =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shiftId}/cash-in",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'amount' =>
                    2000,

                    'reason' =>
                    'Added change money to drawer.',
                ]
            );

        $cashIn
            ->assertStatus(201)
            ->assertJsonPath(
                'data.created',
                true
            );

        $this->assertEquals(
            12000,
            $cashIn->json(
                'data.shift.expected_cash'
            )
        );

        $this->assertEquals(
            2000,
            $cashIn->json(
                'data.summary.cash_in'
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Cash Out - Rs.3,000
        |--------------------------------------------------------------------------
        */

        $cashOut =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shiftId}/cash-out",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'amount' =>
                    3000,

                    'reason' =>
                    'Cash removed for bank deposit.',
                ]
            );

        $cashOut
            ->assertStatus(201);

        $this->assertEquals(
            9000,
            $cashOut->json(
                'data.shift.expected_cash'
            )
        );

        $this->assertEquals(
            2000,
            $cashOut->json(
                'data.summary.cash_in'
            )
        );

        $this->assertEquals(
            3000,
            $cashOut->json(
                'data.summary.cash_out'
            )
        );

        $this->assertEquals(
            9000,
            $cashOut->json(
                'data.summary.calculated_expected_cash'
            )
        );

        $this->assertDatabaseHas(
            'cash_drawer_movements',
            [
                'cashier_shift_id' =>
                $shiftId,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_IN,

                'amount' =>
                2000,
            ]
        );

        $this->assertDatabaseHas(
            'cash_drawer_movements',
            [
                'cashier_shift_id' =>
                $shiftId,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_OUT,

                'amount' =>
                3000,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Manual Movement Idempotency
    |--------------------------------------------------------------------------
    */

    public function test_duplicate_manual_cash_movement_does_not_move_cash_twice(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        $requestId =
            (string)
            Str::uuid();

        $payload = [
            'client_request_id' =>
            $requestId,

            'amount' =>
            1000,

            'reason' =>
            'Additional drawer float.',
        ];

        $first =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shiftId}/cash-in",
                $payload
            );

        $first
            ->assertStatus(201)
            ->assertJsonPath(
                'data.created',
                true
            );

        $movementId =
            (int)
            $first->json(
                'data.movement.id'
            );

        $second =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shiftId}/cash-in",
                $payload
            );

        $second
            ->assertStatus(200)
            ->assertJsonPath(
                'data.created',
                false
            )
            ->assertJsonPath(
                'data.movement.id',
                $movementId
            );

        /*
         * Opening float + one cash-in only.
         */
        $this->assertDatabaseCount(
            'cash_drawer_movements',
            2
        );

        $shift =
            CashierShift::query()
            ->findOrFail(
                $shiftId
            );

        $this->assertSame(
            '11000.00',
            $shift->expected_cash
        );

        /*
         * Same UUID, different amount = conflict.
         */
        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-in",
            [
                'client_request_id' =>
                $requestId,

                'amount' =>
                2000,

                'reason' =>
                'Additional drawer float.',
            ]
        )
            ->assertStatus(409);

        $shift->refresh();

        $this->assertSame(
            '11000.00',
            $shift->expected_cash
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cash Out Protection
    |--------------------------------------------------------------------------
    */

    public function test_cash_out_cannot_exceed_expected_drawer_balance(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-out",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                10001,

                'reason' =>
                'Invalid excessive withdrawal.',
            ]
        )
            ->assertStatus(422);

        $shift =
            CashierShift::query()
            ->findOrFail(
                $shiftId
            );

        $this->assertSame(
            '10000.00',
            $shift->expected_cash
        );

        /*
         * Only opening float exists.
         */
        $this->assertDatabaseCount(
            'cash_drawer_movements',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Phase 28 Cash Sale Integration
    |--------------------------------------------------------------------------
    */

    public function test_phase_28_cash_sale_is_included_in_shift_expected_cash(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        $invoice =
            $this->createInvoice(
                grandTotal: 5000
            );

        /*
         * Customer gives Rs.7,000 for
         * Rs.5,000 cash allocation.
         *
         * Change = Rs.2,000.
         *
         * Net cash retained = Rs.5,000.
         */
        $paymentResponse =
            $this->postJson(
                "/api/v1/invoices/{$invoice->id}/payments",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'cashier_shift_id' =>
                    $shiftId,

                    'payments' => [
                        [
                            'payment_method' =>
                            Payment::METHOD_CASH,

                            'amount' =>
                            5000,

                            'tendered_amount' =>
                            7000,
                        ],
                    ],
                ]
            );

        $paymentResponse
            ->assertStatus(201);

        $shiftResponse =
            $this->getJson(
                "/api/v1/cashier-shifts/{$shiftId}"
            );

        $shiftResponse
            ->assertStatus(200);

        $this->assertEquals(
            5000,
            $shiftResponse->json(
                'data.summary.cash_sales'
            )
        );

        $this->assertEquals(
            15000,
            $shiftResponse->json(
                'data.summary.expected_cash'
            )
        );

        $this->assertEquals(
            15000,
            $shiftResponse->json(
                'data.summary.calculated_expected_cash'
            )
        );

        $this->assertDatabaseHas(
            'cash_drawer_movements',
            [
                'cashier_shift_id' =>
                $shiftId,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_SALE,

                'amount' =>
                5000,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Full Expected Balance Formula
    |--------------------------------------------------------------------------
    */

    public function test_shift_summary_calculates_opening_sales_refunds_cash_in_and_cash_out(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        $shift =
            CashierShift::query()
            ->findOrFail(
                $shiftId
            );

        /*
         * Cash sale + Rs.25,000.
         *
         * Normally created by Phase 28.
         */
        CashDrawerMovement::query()
            ->create([
                'cashier_shift_id' =>
                $shift->id,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_SALE,

                'amount' =>
                25000,

                'reference_type' =>
                'payment',

                'reference_id' =>
                999001,

                'reason' =>
                'Phase 29 summary test sale.',

                'created_by' =>
                $this->cashier->id,

                'occurred_at' =>
                now(),
            ]);

        /*
         * Cash refund - Rs.2,000.
         *
         * Refund processing phase will create
         * this movement automatically.
         */
        CashDrawerMovement::query()
            ->create([
                'cashier_shift_id' =>
                $shift->id,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_REFUND,

                'amount' =>
                2000,

                'reference_type' =>
                'refund',

                'reference_id' =>
                999002,

                'reason' =>
                'Phase 29 summary test refund.',

                'created_by' =>
                $this->cashier->id,

                'occurred_at' =>
                now(),
            ]);

        /*
         * Keep stored expected_cash synchronized
         * with those external ledger movements.
         *
         * 10,000 + 25,000 - 2,000 = 33,000.
         */
        $shift->expected_cash =
            33000;

        $shift->save();

        /*
         * Cash In +1,000.
         */
        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-in",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                1000,

                'reason' =>
                'Added drawer cash.',
            ]
        )
            ->assertStatus(201);

        /*
         * Cash Out -3,000.
         */
        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-out",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                3000,

                'reason' =>
                'Removed cash for bank deposit.',
            ]
        )
            ->assertStatus(201);

        /*
         * Expected:
         *
         * 10,000
         * +25,000
         * - 2,000
         * + 1,000
         * - 3,000
         * --------
         * 31,000
         */
        $response =
            $this->getJson(
                "/api/v1/cashier-shifts/{$shiftId}"
            );

        $response
            ->assertStatus(200);

        $this->assertEquals(
            10000,
            $response->json(
                'data.summary.opening_cash'
            )
        );

        $this->assertEquals(
            25000,
            $response->json(
                'data.summary.cash_sales'
            )
        );

        $this->assertEquals(
            2000,
            $response->json(
                'data.summary.cash_refunds'
            )
        );

        $this->assertEquals(
            1000,
            $response->json(
                'data.summary.cash_in'
            )
        );

        $this->assertEquals(
            3000,
            $response->json(
                'data.summary.cash_out'
            )
        );

        $this->assertEquals(
            31000,
            $response->json(
                'data.summary.calculated_expected_cash'
            )
        );

        $this->assertEquals(
            31000,
            $response->json(
                'data.summary.expected_cash'
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Close Shift / Shortage
    |--------------------------------------------------------------------------
    */

    public function test_shift_close_records_actual_cash_and_shortage(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        /*
         * + Rs.21,000 manual test flow.
         *
         * Expected becomes Rs.31,000.
         */
        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-in",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                21000,

                'reason' =>
                'Phase 29 close test cash.',
            ]
        )
            ->assertStatus(201);

        $closeRequestId =
            (string)
            Str::uuid();

        $close =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shiftId}/close",
                [
                    'client_request_id' =>
                    $closeRequestId,

                    'actual_cash' =>
                    30500,

                    'closing_notes' =>
                    'Drawer physically counted.',
                ]
            );

        $close
            ->assertStatus(200)
            ->assertJsonPath(
                'data.closed',
                true
            )
            ->assertJsonPath(
                'data.shift.status',
                CashierShift::STATUS_CLOSED
            );

        $this->assertEquals(
            31000,
            $close->json(
                'data.shift.expected_cash'
            )
        );

        $this->assertEquals(
            30500,
            $close->json(
                'data.shift.actual_cash'
            )
        );

        $this->assertEquals(
            -500,
            $close->json(
                'data.shift.cash_difference'
            )
        );

        $shift =
            CashierShift::query()
            ->findOrFail(
                $shiftId
            );

        $this->assertSame(
            CashierShift::STATUS_CLOSED,
            $shift->status
        );

        $this->assertSame(
            '31000.00',
            $shift->expected_cash
        );

        $this->assertSame(
            '30500.00',
            $shift->actual_cash
        );

        $this->assertSame(
            '-500.00',
            $shift->cash_difference
        );

        $this->assertNull(
            $shift->open_shift_key
        );

        /*
        |--------------------------------------------------------------------------
        | Close Retry
        |--------------------------------------------------------------------------
        */

        $retry =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shiftId}/close",
                [
                    'client_request_id' =>
                    $closeRequestId,

                    'actual_cash' =>
                    30500,

                    'closing_notes' =>
                    'Drawer physically counted.',
                ]
            );

        $retry
            ->assertStatus(200)
            ->assertJsonPath(
                'data.closed',
                false
            );

        /*
         * Cashier may start a new shift after
         * the previous shift is closed.
         */
        $newShift =
            $this->postJson(
                '/api/v1/cashier-shifts/open',
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'opening_cash' =>
                    5000,
                ]
            );

        $newShift
            ->assertStatus(201);

        $this->assertDatabaseCount(
            'cashier_shifts',
            2
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Ledger Integrity
    |--------------------------------------------------------------------------
    */

    public function test_shift_cannot_close_when_expected_cash_and_ledger_do_not_match(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        /*
         * Deliberately corrupt stored expected cash.
         */
        DB::table(
            'cashier_shifts'
        )
            ->where(
                'id',
                $shiftId
            )
            ->update([
                'expected_cash' =>
                15000,
            ]);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/close",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'actual_cash' =>
                15000,
            ]
        )
            ->assertStatus(409);

        $shift =
            CashierShift::query()
            ->findOrFail(
                $shiftId
            );

        $this->assertSame(
            CashierShift::STATUS_OPEN,
            $shift->status
        );

        $this->assertNull(
            $shift->actual_cash
        );

        $this->assertNull(
            $shift->closed_at
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Closed Shift Protection
    |--------------------------------------------------------------------------
    */

    public function test_closed_shift_cannot_receive_manual_cash_movements(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/close",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'actual_cash' =>
                10000,
            ]
        )
            ->assertStatus(200);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-in",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                1000,

                'reason' =>
                'Should not be accepted.',
            ]
        )
            ->assertStatus(409);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-out",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                1000,

                'reason' =>
                'Should not be accepted.',
            ]
        )
            ->assertStatus(409);

        /*
         * Only opening float exists.
         */
        $this->assertDatabaseCount(
            'cash_drawer_movements',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Ownership
    |--------------------------------------------------------------------------
    */

    public function test_cashier_cannot_modify_or_close_another_cashiers_shift(): void
    {
        Sanctum::actingAs(
            $this->otherCashier
        );

        $otherOpened =
            $this->openShiftViaApi(
                openingCash: 5000
            );

        $otherShiftId =
            (int)
            $otherOpened->json(
                'data.shift.id'
            );

        Sanctum::actingAs(
            $this->cashier
        );

        $this->postJson(
            "/api/v1/cashier-shifts/{$otherShiftId}/cash-in",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                1000,

                'reason' =>
                'Unauthorized cash movement.',
            ]
        )
            ->assertStatus(403);

        $this->postJson(
            "/api/v1/cashier-shifts/{$otherShiftId}/close",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'actual_cash' =>
                5000,
            ]
        )
            ->assertStatus(403);

        $shift =
            CashierShift::query()
            ->findOrFail(
                $otherShiftId
            );

        $this->assertSame(
            CashierShift::STATUS_OPEN,
            $shift->status
        );

        $this->assertSame(
            '5000.00',
            $shift->expected_cash
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Business Day Protection
    |--------------------------------------------------------------------------
    */

    public function test_shift_open_requires_open_business_day(): void
    {
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

        Sanctum::actingAs(
            $this->cashier
        );

        $this->postJson(
            '/api/v1/cashier-shifts/open',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'opening_cash' =>
                10000,
            ]
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'cashier_shifts',
            0
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Permissions
    |--------------------------------------------------------------------------
    */

    public function test_cashier_shift_routes_enforce_permissions(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        Sanctum::actingAs(
            $this->unauthorizedUser
        );

        $this->getJson(
            '/api/v1/cashier-shifts/current'
        )
            ->assertStatus(403);

        $this->postJson(
            '/api/v1/cashier-shifts/open',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'opening_cash' =>
                5000,
            ]
        )
            ->assertStatus(403);

        $this->getJson(
            "/api/v1/cashier-shifts/{$shiftId}"
        )
            ->assertStatus(403);

        $this->getJson(
            "/api/v1/cashier-shifts/{$shiftId}/movements"
        )
            ->assertStatus(403);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-in",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                1000,

                'reason' =>
                'Unauthorized.',
            ]
        )
            ->assertStatus(403);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-out",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                1000,

                'reason' =>
                'Unauthorized.',
            ]
        )
            ->assertStatus(403);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/close",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'actual_cash' =>
                10000,
            ]
        )
            ->assertStatus(403);

        /*
         * Unauthorized calls changed nothing.
         */
        $shift =
            CashierShift::query()
            ->findOrFail(
                $shiftId
            );

        $this->assertSame(
            CashierShift::STATUS_OPEN,
            $shift->status
        );

        $this->assertSame(
            '10000.00',
            $shift->expected_cash
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Movement History
    |--------------------------------------------------------------------------
    */

    public function test_movement_history_returns_shift_cash_ledger(): void
    {
        Sanctum::actingAs(
            $this->cashier
        );

        $opened =
            $this->openShiftViaApi(
                openingCash: 10000
            );

        $shiftId =
            (int)
            $opened->json(
                'data.shift.id'
            );

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-in",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                2000,

                'reason' =>
                'Added change float.',
            ]
        )
            ->assertStatus(201);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shiftId}/cash-out",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'amount' =>
                500,

                'reason' =>
                'Small bank deposit.',
            ]
        )
            ->assertStatus(201);

        $response =
            $this->getJson(
                "/api/v1/cashier-shifts/{$shiftId}/movements"
            );

        $response
            ->assertStatus(200)
            ->assertJsonCount(
                3,
                'data.movements'
            );

        $this->assertSame(
            CashDrawerMovement::TYPE_OPENING_FLOAT,
            $response->json(
                'data.movements.0.movement_type'
            )
        );

        $this->assertSame(
            CashDrawerMovement::TYPE_CASH_IN,
            $response->json(
                'data.movements.1.movement_type'
            )
        );

        $this->assertSame(
            CashDrawerMovement::TYPE_CASH_OUT,
            $response->json(
                'data.movements.2.movement_type'
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function openShiftViaApi(
        float $openingCash
    ) {
        return $this->postJson(
            '/api/v1/cashier-shifts/open',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'opening_cash' =>
                $openingCash,

                'opening_notes' =>
                'Phase 29 automated test.',
            ]
        );
    }

    private function createInvoice(
        float $grandTotal
    ): Invoice {
        $grandTotal =
            round(
                $grandTotal,
                2
            );

        return Invoice::query()
            ->create([
                'invoice_number' =>
                'INV-P29-' .
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
                'Phase 29 Customer',

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
                0,

                'change_amount' =>
                0,

                'balance_due' =>
                $grandTotal,

                'payment_status' =>
                Invoice::PAYMENT_STATUS_UNPAID,

                'status' =>
                Invoice::STATUS_ISSUED,

                'issued_by' =>
                $this
                    ->cashier
                    ->id,

                'issued_at' =>
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
                "Phase 29 {$roleCode} role.",

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
                        'Cash',

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
                "{$roleCode} User",

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
