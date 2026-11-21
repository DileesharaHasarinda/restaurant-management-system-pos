<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\ExpenseService;
use Database\Seeders\ExpenseCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExpenseManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private User $creatorOnly;

    private User $unauthorizedUser;

    private BusinessDay $businessDay;

    protected function setUp(): void
    {
        parent::setUp();

        /*
        |--------------------------------------------------------------------------
        | Seed Required Expense Categories
        |--------------------------------------------------------------------------
        */

        $this->seed(
            ExpenseCategorySeeder::class
        );

        /*
        |--------------------------------------------------------------------------
        | Manager
        |--------------------------------------------------------------------------
        |
        | Full Phase 26 permissions.
        |
        */

        $this->manager =
            $this->createUserWithPermissions(
                roleCode: 'P26_MANAGER',

                permissions: [
                    'expenses.view',
                    'expenses.create',
                    'expenses.manage',
                    'reports.view',
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | Expense Creator Only
        |--------------------------------------------------------------------------
        |
        | Can create expenses but cannot edit/manage them.
        |
        */

        $this->creatorOnly =
            $this->createUserWithPermissions(
                roleCode: 'P26_CREATOR',

                permissions: [
                    'expenses.create',
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | Unauthorized User
        |--------------------------------------------------------------------------
        */

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'P26_NONE',

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
                $this->manager
                    ->id,

                'closed_by' =>
                null,

                'opened_at' =>
                now(),

                'closed_at' =>
                null,

                'notes' =>
                'Phase 26 expense management automated tests.',
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Categories
    |--------------------------------------------------------------------------
    */

    public function test_required_expense_categories_are_available(): void
    {
        $categories =
            ExpenseCategory::query()
            ->orderBy(
                'id'
            )
            ->get();

        $this->assertCount(
            11,
            $categories
        );

        $this->assertSame(
            [
                'Electricity',
                'Water',
                'Gas',
                'Rent',
                'Salary',
                'Transport',
                'Internet',
                'Cleaning',
                'Maintenance',
                'Marketing',
                'Other',
            ],
            $categories
                ->pluck(
                    'name'
                )
                ->all()
        );

        $this->assertSame(
            [
                'ELECTRICITY',
                'WATER',
                'GAS',
                'RENT',
                'SALARY',
                'TRANSPORT',
                'INTERNET',
                'CLEANING',
                'MAINTENANCE',
                'MARKETING',
                'OTHER',
            ],
            $categories
                ->pluck(
                    'code'
                )
                ->all()
        );

        $this->assertTrue(
            $categories
                ->every(
                    fn(
                        ExpenseCategory $category
                    ): bool =>
                    $category
                        ->is_active
                )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | CASH Expense
    |--------------------------------------------------------------------------
    */

    public function test_cash_expense_creates_cash_out_and_reduces_expected_cash(): void
    {
        $shift =
            $this->createShift(
                user: $this->manager,

                expectedCash: 20000
            );

        $gas =
            $this->category(
                'GAS'
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $requestId =
            (string)
            Str::uuid();

        $response =
            $this->postJson(
                '/api/v1/expenses',
                [
                    'client_request_id' =>
                    $requestId,

                    'expense_category_id' =>
                    $gas->id,

                    'expense_date' =>
                    $this
                        ->businessDay
                        ->business_date
                        ->toDateString(),

                    'description' =>
                    'Gas cylinder refill',

                    'notes' =>
                    'Main kitchen gas expense.',

                    'amount' =>
                    3000,

                    'payment_method' =>
                    Expense::METHOD_CASH,

                    'reference_number' =>
                    'GAS-001',

                    'cashier_shift_id' =>
                    $shift->id,
                ]
            );

        $response
            ->assertStatus(
                201
            );

        $expense =
            Expense::query()
            ->where(
                'client_request_id',
                $requestId
            )
            ->firstOrFail();

        $this->assertSame(
            Expense::STATUS_POSTED,
            $expense->status
        );

        $this->assertSame(
            Expense::METHOD_CASH,
            $expense->payment_method
        );

        $this->assertEqualsWithDelta(
            3000,
            (float)
            $expense->amount,
            0.01
        );

        $this->assertSame(
            $gas->id,
            (int)
            $expense
                ->expense_category_id
        );

        $this->assertSame(
            $this
                ->businessDay
                ->id,
            (int)
            $expense
                ->business_day_id
        );

        $this->assertSame(
            $shift->id,
            (int)
            $expense
                ->cashier_shift_id
        );

        $this->assertSame(
            $this
                ->manager
                ->id,
            (int)
            $expense
                ->created_by
        );

        /*
        |--------------------------------------------------------------------------
        | Cash Drawer
        |--------------------------------------------------------------------------
        */

        $shift->refresh();

        $this->assertEqualsWithDelta(
            17000,
            (float)
            $shift
                ->expected_cash,
            0.01
        );

        $movement =
            CashDrawerMovement::query()
            ->where(
                'reference_type',
                'expense'
            )
            ->where(
                'reference_id',
                $expense->id
            )
            ->firstOrFail();

        $this->assertSame(
            CashDrawerMovement::TYPE_CASH_OUT,
            $movement->movement_type
        );

        $this->assertEqualsWithDelta(
            3000,
            (float)
            $movement->amount,
            0.01
        );

        $this->assertSame(
            $shift->id,
            (int)
            $movement
                ->cashier_shift_id
        );

        $this->assertSame(
            $this
                ->manager
                ->id,
            (int)
            $movement
                ->created_by
        );

        $this->assertNotNull(
            $movement
                ->occurred_at
        );

        /*
        |--------------------------------------------------------------------------
        | Audit
        |--------------------------------------------------------------------------
        */

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'EXPENSE_CREATED',

                'entity_type' =>
                'expense',

                'entity_id' =>
                $expense->id,

                'user_id' =>
                $this
                    ->manager
                    ->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Non-Cash Expense
    |--------------------------------------------------------------------------
    */

    public function test_non_cash_expense_does_not_affect_cash_drawer(): void
    {
        $shift =
            $this->createShift(
                user: $this->manager,

                expectedCash: 10000
            );

        $internet =
            $this->category(
                'INTERNET'
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $requestId =
            (string)
            Str::uuid();

        $this->postJson(
            '/api/v1/expenses',
            [
                'client_request_id' =>
                $requestId,

                'expense_category_id' =>
                $internet->id,

                'expense_date' =>
                $this
                    ->businessDay
                    ->business_date
                    ->toDateString(),

                'description' =>
                'Monthly internet bill',

                'notes' =>
                null,

                'amount' =>
                4500,

                'payment_method' =>
                Expense::METHOD_BANK_TRANSFER,

                'reference_number' =>
                'BANK-0001',
            ]
        )
            ->assertStatus(
                201
            );

        $expense =
            Expense::query()
            ->where(
                'client_request_id',
                $requestId
            )
            ->firstOrFail();

        $this->assertNull(
            $expense
                ->cashier_shift_id
        );

        $this->assertSame(
            Expense::METHOD_BANK_TRANSFER,
            $expense
                ->payment_method
        );

        $shift->refresh();

        $this->assertEqualsWithDelta(
            10000,
            (float)
            $shift
                ->expected_cash,
            0.01
        );

        $this->assertSame(
            0,
            CashDrawerMovement::query()
                ->where(
                    'reference_type',
                    'expense'
                )
                ->where(
                    'reference_id',
                    $expense->id
                )
                ->count()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Expense Editing / Drawer Reconciliation
    |--------------------------------------------------------------------------
    */

    public function test_cash_expense_edits_reconcile_drawer_without_corrupting_cash(): void
    {
        $shift =
            $this->createShift(
                user: $this->manager,

                expectedCash: 20000
            );

        $gas =
            $this->category(
                'GAS'
            );

        $maintenance =
            $this->category(
                'MAINTENANCE'
            );

        $service =
            app(
                ExpenseService::class
            );

        /*
        |--------------------------------------------------------------------------
        | Create CASH Rs.3,000
        |--------------------------------------------------------------------------
        */

        $result =
            $service
            ->create(
                actor: $this->manager,

                data: [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'expense_category_id' =>
                    $gas->id,

                    'expense_date' =>
                    $this
                        ->businessDay
                        ->business_date
                        ->toDateString(),

                    'description' =>
                    'Gas cylinder',

                    'notes' =>
                    'Original expense.',

                    'amount' =>
                    3000,

                    'payment_method' =>
                    Expense::METHOD_CASH,

                    'reference_number' =>
                    'EDIT-001',

                    'cashier_shift_id' =>
                    $shift->id,
                ]
            );

        $expense =
            $result['expense'];

        $this->assertEqualsWithDelta(
            17000,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | CASH 3,000 -> CASH 3,500
        |--------------------------------------------------------------------------
        */

        $expense =
            $service
            ->update(
                actor: $this->manager,

                expense: $expense,

                data: $this->updatePayload(
                    category: $gas,

                    amount: 3500,

                    paymentMethod: Expense::METHOD_CASH,

                    shift: $shift,

                    notes: 'Amount corrected upward.'
                )
            );

        $this->assertEqualsWithDelta(
            16500,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | CASH 3,500 -> CASH 2,000
        |--------------------------------------------------------------------------
        */

        $expense =
            $service
            ->update(
                actor: $this->manager,

                expense: $expense,

                data: $this->updatePayload(
                    category: $gas,

                    amount: 2000,

                    paymentMethod: Expense::METHOD_CASH,

                    shift: $shift,

                    notes: 'Amount corrected downward.'
                )
            );

        $this->assertEqualsWithDelta(
            18000,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | CASH -> BANK_TRANSFER
        |--------------------------------------------------------------------------
        */

        $expense =
            $service
            ->update(
                actor: $this->manager,

                expense: $expense,

                data: [
                    'expense_category_id' =>
                    $gas->id,

                    'expense_date' =>
                    $this
                        ->businessDay
                        ->business_date
                        ->toDateString(),

                    'description' =>
                    'Gas cylinder',

                    'notes' =>
                    'Corrected to bank transfer.',

                    'amount' =>
                    2000,

                    'payment_method' =>
                    Expense::METHOD_BANK_TRANSFER,

                    'reference_number' =>
                    'BANK-EDIT-001',
                ]
            );

        $this->assertNull(
            $expense
                ->cashier_shift_id
        );

        $this->assertEqualsWithDelta(
            20000,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | BANK_TRANSFER -> CASH Rs.2,500
        |--------------------------------------------------------------------------
        */

        $expense =
            $service
            ->update(
                actor: $this->manager,

                expense: $expense,

                data: $this->updatePayload(
                    category: $gas,

                    amount: 2500,

                    paymentMethod: Expense::METHOD_CASH,

                    shift: $shift,

                    notes: 'Corrected back to cash.'
                )
            );

        $this->assertEqualsWithDelta(
            17500,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        $movementCountBefore =
            CashDrawerMovement::query()
            ->where(
                'reference_type',
                'expense'
            )
            ->where(
                'reference_id',
                $expense->id
            )
            ->count();

        /*
        |--------------------------------------------------------------------------
        | Metadata-only Edit
        |--------------------------------------------------------------------------
        */

        $expense =
            $service
            ->update(
                actor: $this->manager,

                expense: $expense,

                data: [
                    'expense_category_id' =>
                    $maintenance->id,

                    'expense_date' =>
                    $this
                        ->businessDay
                        ->business_date
                        ->toDateString(),

                    'description' =>
                    'Kitchen gas system maintenance',

                    'notes' =>
                    'Metadata/category only changed.',

                    'amount' =>
                    2500,

                    'payment_method' =>
                    Expense::METHOD_CASH,

                    'reference_number' =>
                    'EDIT-001',

                    'cashier_shift_id' =>
                    $shift->id,
                ]
            );

        $movementCountAfter =
            CashDrawerMovement::query()
            ->where(
                'reference_type',
                'expense'
            )
            ->where(
                'reference_id',
                $expense->id
            )
            ->count();

        $this->assertSame(
            $movementCountBefore,
            $movementCountAfter
        );

        $this->assertSame(
            5,
            $movementCountAfter
        );

        $this->assertEqualsWithDelta(
            17500,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        $this->assertSame(
            'MAINTENANCE',
            $expense
                ->category
                ->code
        );

        $this->assertEqualsWithDelta(
            2500,
            (float)
            $expense
                ->amount,
            0.01
        );

        $this->assertSame(
            Expense::METHOD_CASH,
            $expense
                ->payment_method
        );

        /*
        |--------------------------------------------------------------------------
        | Exact Movement History
        |--------------------------------------------------------------------------
        */

        $movements =
            CashDrawerMovement::query()
            ->where(
                'reference_type',
                'expense'
            )
            ->where(
                'reference_id',
                $expense->id
            )
            ->orderBy(
                'id'
            )
            ->get();

        $this->assertSame(
            [
                CashDrawerMovement::TYPE_CASH_OUT,
                CashDrawerMovement::TYPE_CASH_OUT,
                CashDrawerMovement::TYPE_CASH_IN,
                CashDrawerMovement::TYPE_CASH_IN,
                CashDrawerMovement::TYPE_CASH_OUT,
            ],
            $movements
                ->pluck(
                    'movement_type'
                )
                ->all()
        );

        $this->assertEquals(
            [
                3000.0,
                500.0,
                1500.0,
                2000.0,
                2500.0,
            ],
            $movements
                ->map(
                    fn(
                        CashDrawerMovement $movement
                    ): float =>
                    (float)
                    $movement
                        ->amount
                )
                ->all()
        );

        $this->assertSame(
            5,
            AuditLog::query()
                ->where(
                    'action',
                    'EXPENSE_UPDATED'
                )
                ->where(
                    'entity_type',
                    'expense'
                )
                ->where(
                    'entity_id',
                    $expense->id
                )
                ->count()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency
    |--------------------------------------------------------------------------
    */

    public function test_duplicate_expense_request_is_idempotent_and_conflict_is_rejected(): void
    {
        $shift =
            $this->createShift(
                user: $this->manager,

                expectedCash: 10000
            );

        $cleaning =
            $this->category(
                'CLEANING'
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $requestId =
            (string)
            Str::uuid();

        $payload = [
            'client_request_id' =>
            $requestId,

            'expense_category_id' =>
            $cleaning->id,

            'expense_date' =>
            $this
                ->businessDay
                ->business_date
                ->toDateString(),

            'description' =>
            'Cleaning supplies',

            'notes' =>
            'Idempotency test.',

            'amount' =>
            1500,

            'payment_method' =>
            Expense::METHOD_CASH,

            'reference_number' =>
            'CLEAN-001',

            'cashier_shift_id' =>
            $shift->id,
        ];

        $this->postJson(
            '/api/v1/expenses',
            $payload
        )
            ->assertStatus(
                201
            );

        $this->assertEqualsWithDelta(
            8500,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        /*
         * Exact retry.
         */
        $this->postJson(
            '/api/v1/expenses',
            $payload
        )
            ->assertStatus(
                200
            );

        $this->assertEqualsWithDelta(
            8500,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        $expense =
            Expense::query()
            ->where(
                'client_request_id',
                $requestId
            )
            ->firstOrFail();

        $this->assertSame(
            1,
            Expense::query()
                ->where(
                    'client_request_id',
                    $requestId
                )
                ->count()
        );

        $this->assertSame(
            1,
            CashDrawerMovement::query()
                ->where(
                    'reference_type',
                    'expense'
                )
                ->where(
                    'reference_id',
                    $expense->id
                )
                ->count()
        );

        $this->assertSame(
            1,
            AuditLog::query()
                ->where(
                    'action',
                    'EXPENSE_CREATED'
                )
                ->where(
                    'entity_type',
                    'expense'
                )
                ->where(
                    'entity_id',
                    $expense->id
                )
                ->count()
        );

        /*
         * Same UUID with different amount.
         */
        $conflictPayload =
            $payload;

        $conflictPayload['amount'] =
            2000;

        $this->postJson(
            '/api/v1/expenses',
            $conflictPayload
        )
            ->assertStatus(
                409
            );

        $this->assertEqualsWithDelta(
            8500,
            (float)
            $shift
                ->fresh()
                ->expected_cash,
            0.01
        );

        $this->assertSame(
            1,
            Expense::query()
                ->where(
                    'client_request_id',
                    $requestId
                )
                ->count()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Invalid Financial Configuration
    |--------------------------------------------------------------------------
    */

    public function test_invalid_expense_configuration_is_rejected_without_financial_changes(): void
    {
        $openShift =
            $this->createShift(
                user: $this->manager,

                expectedCash: 10000
            );

        $cleaning =
            $this->category(
                'CLEANING'
            );

        Sanctum::actingAs($this->manager, ['staff']);

        /*
        |--------------------------------------------------------------------------
        | Non-Cash Expense Cannot Link Drawer
        |--------------------------------------------------------------------------
        */

        $this->postJson(
            '/api/v1/expenses',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'expense_category_id' =>
                $cleaning->id,

                'expense_date' =>
                $this
                    ->businessDay
                    ->business_date
                    ->toDateString(),

                'description' =>
                'Invalid bank expense',

                'amount' =>
                500,

                'payment_method' =>
                Expense::METHOD_BANK_TRANSFER,

                'reference_number' =>
                'BANK-INVALID',

                'cashier_shift_id' =>
                $openShift->id,
            ]
        )
            ->assertStatus(
                422
            );

        /*
        |--------------------------------------------------------------------------
        | Closed Shift
        |--------------------------------------------------------------------------
        */

        $closedShift =
            $this->createShift(
                user: $this->manager,

                expectedCash: 5000,

                status: CashierShift::STATUS_CLOSED
            );

        $this->postJson(
            '/api/v1/expenses',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'expense_category_id' =>
                $cleaning->id,

                'expense_date' =>
                $this
                    ->businessDay
                    ->business_date
                    ->toDateString(),

                'description' =>
                'Closed shift expense',

                'amount' =>
                500,

                'payment_method' =>
                Expense::METHOD_CASH,

                'cashier_shift_id' =>
                $closedShift->id,
            ]
        )
            ->assertStatus(
                409
            );

        /*
        |--------------------------------------------------------------------------
        | Inactive Category
        |--------------------------------------------------------------------------
        */

        $inactiveCategory =
            ExpenseCategory::query()
            ->create([
                'name' =>
                'Inactive Test',

                'code' =>
                'P26_INACTIVE',

                'is_active' =>
                false,
            ]);

        $this->postJson(
            '/api/v1/expenses',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'expense_category_id' =>
                $inactiveCategory->id,

                'expense_date' =>
                $this
                    ->businessDay
                    ->business_date
                    ->toDateString(),

                'description' =>
                'Inactive category expense',

                'amount' =>
                500,

                'payment_method' =>
                Expense::METHOD_BANK_TRANSFER,
            ]
        )
            ->assertStatus(
                422
            );

        /*
        |--------------------------------------------------------------------------
        | Cheque Requires Reference
        |--------------------------------------------------------------------------
        */

        $this->postJson(
            '/api/v1/expenses',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'expense_category_id' =>
                $cleaning->id,

                'expense_date' =>
                $this
                    ->businessDay
                    ->business_date
                    ->toDateString(),

                'description' =>
                'Cheque expense without cheque number',

                'amount' =>
                500,

                'payment_method' =>
                Expense::METHOD_CHEQUE,
            ]
        )
            ->assertStatus(
                422
            );

        /*
        |--------------------------------------------------------------------------
        | No Invalid Operation Changed Cash
        |--------------------------------------------------------------------------
        */

        $this->assertEqualsWithDelta(
            10000,
            (float)
            $openShift
                ->fresh()
                ->expected_cash,
            0.01
        );

        $this->assertDatabaseCount(
            'expenses',
            0
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Reports
    |--------------------------------------------------------------------------
    */

    public function test_expense_reports_return_totals_breakdowns_filters_and_string_dates(): void
    {
        $electricity =
            $this->category(
                'ELECTRICITY'
            );

        $internet =
            $this->category(
                'INTERNET'
            );

        $marketing =
            $this->category(
                'MARKETING'
            );

        $date =
            $this
            ->businessDay
            ->business_date
            ->toDateString();

        $service =
            app(
                ExpenseService::class
            );

        $service->create(
            actor: $this->manager,

            data: $this->nonCashCreatePayload(
                category: $electricity,

                amount: 1200,

                paymentMethod: Expense::METHOD_BANK_TRANSFER,

                description: 'Electricity bill'
            )
        );

        $service->create(
            actor: $this->manager,

            data: $this->nonCashCreatePayload(
                category: $internet,

                amount: 800,

                paymentMethod: Expense::METHOD_CARD,

                description: 'Internet bill'
            )
        );

        $service->create(
            actor: $this->manager,

            data: $this->nonCashCreatePayload(
                category: $marketing,

                amount: 500,

                paymentMethod: Expense::METHOD_QR,

                description: 'Social media campaign'
            )
        );

        Sanctum::actingAs($this->manager, ['staff']);

        $response =
            $this->getJson(
                '/api/v1/expense-reports/summary'
                    .
                    '?date_from='
                    .
                    $date
                    .
                    '&date_to='
                    .
                    $date
            );

        $response
            ->assertStatus(
                200
            );

        $data =
            $response
            ->json(
                'data'
            );

        $this->assertSame(
            3,
            (int)
            $data['expense_count']
        );

        $this->assertEqualsWithDelta(
            2500,
            (float)
            $data['total_amount'],
            0.01
        );

        $this->assertEqualsWithDelta(
            833.33,
            (float)
            $data['average_expense'],
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | Category Totals
        |--------------------------------------------------------------------------
        */

        $categoryTotals =
            collect(
                $data['by_category']
            )
            ->keyBy(
                'category_code'
            );

        $this->assertEqualsWithDelta(
            1200,
            (float)
            $categoryTotals['ELECTRICITY']['total_amount'],
            0.01
        );

        $this->assertEqualsWithDelta(
            800,
            (float)
            $categoryTotals['INTERNET']['total_amount'],
            0.01
        );

        $this->assertEqualsWithDelta(
            500,
            (float)
            $categoryTotals['MARKETING']['total_amount'],
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | Payment Totals
        |--------------------------------------------------------------------------
        */

        $paymentTotals =
            collect(
                $data['by_payment_method']
            )
            ->keyBy(
                'payment_method'
            );

        $this->assertEqualsWithDelta(
            1200,
            (float)
            $paymentTotals[Expense::METHOD_BANK_TRANSFER]['total_amount'],
            0.01
        );

        $this->assertEqualsWithDelta(
            800,
            (float)
            $paymentTotals[Expense::METHOD_CARD]['total_amount'],
            0.01
        );

        $this->assertEqualsWithDelta(
            500,
            (float)
            $paymentTotals[Expense::METHOD_QR]['total_amount'],
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | Daily Total + Date Serialization
        |--------------------------------------------------------------------------
        */

        $this->assertCount(
            1,
            $data['daily_totals']
        );

        $daily =
            $data['daily_totals'][0];

        $this->assertSame(
            $date,
            $daily['expense_date']
        );

        $this->assertSame(
            3,
            (int)
            $daily['expense_count']
        );

        $this->assertEqualsWithDelta(
            2500,
            (float)
            $daily['total_amount'],
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | Category Filter
        |--------------------------------------------------------------------------
        */

        $categoryResponse =
            $this->getJson(
                '/api/v1/expense-reports/summary'
                    .
                    '?date_from='
                    .
                    $date
                    .
                    '&date_to='
                    .
                    $date
                    .
                    '&expense_category_id='
                    .
                    $electricity->id
            );

        $categoryResponse
            ->assertStatus(
                200
            );

        $this->assertSame(
            1,
            (int)
            $categoryResponse
                ->json(
                    'data.expense_count'
                )
        );

        $this->assertEqualsWithDelta(
            1200,
            (float)
            $categoryResponse
                ->json(
                    'data.total_amount'
                ),
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | Payment Filter
        |--------------------------------------------------------------------------
        */

        $cardResponse =
            $this->getJson(
                '/api/v1/expense-reports/summary'
                    .
                    '?date_from='
                    .
                    $date
                    .
                    '&date_to='
                    .
                    $date
                    .
                    '&payment_method=CARD'
            );

        $cardResponse
            ->assertStatus(
                200
            );

        $this->assertSame(
            1,
            (int)
            $cardResponse
                ->json(
                    'data.expense_count'
                )
        );

        $this->assertEqualsWithDelta(
            800,
            (float)
            $cardResponse
                ->json(
                    'data.total_amount'
                ),
            0.01
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Private Receipt
    |--------------------------------------------------------------------------
    */

    public function test_expense_receipt_is_private_downloadable_authorized_and_removable(): void
    {
        Storage::fake(
            'local'
        );

        $electricity =
            $this->category(
                'ELECTRICITY'
            );

        $result =
            app(
                ExpenseService::class
            )
            ->create(
                actor: $this->manager,

                data: $this->nonCashCreatePayload(
                    category: $electricity,

                    amount: 1200,

                    paymentMethod: Expense::METHOD_BANK_TRANSFER,

                    description: 'Electricity bill'
                )
            );

        $expense =
            $result['expense'];

        Sanctum::actingAs($this->manager, ['staff']);

        /*
        |--------------------------------------------------------------------------
        | Upload
        |--------------------------------------------------------------------------
        */

        $receipt =
            UploadedFile::fake()
            ->create(
                'electricity-receipt.pdf',
                64,
                'application/pdf'
            );

        $response =
            $this->post(
                "/api/v1/expenses/{$expense->id}/receipt",
                [
                    'receipt' =>
                    $receipt,
                ],
                [
                    'Accept' =>
                    'application/json',
                ]
            );

        $response
            ->assertStatus(
                200
            );

        $expense->refresh();

        $this->assertNotNull(
            $expense
                ->receipt_path
        );

        $this->assertSame(
            'electricity-receipt.pdf',
            $expense
                ->receipt_original_name
        );

        $this->assertNotNull(
            $expense
                ->receipt_mime_type
        );

        $this->assertNotNull(
            $expense
                ->receipt_size
        );

        $this->assertNotNull(
            $expense
                ->receipt_uploaded_at
        );

        $this->assertTrue(
            Storage::disk(
                'local'
            )
                ->exists(
                    (string)
                    $expense
                        ->receipt_path
                )
        );

        /*
         * Private server path must not be exposed
         * through ExpenseResource.
         */
        $resourceData =
            $response
            ->json(
                'data'
            );

        $this->assertIsArray(
            $resourceData
        );

        $this->assertArrayNotHasKey(
            'receipt_path',
            $resourceData
        );

        $this->assertTrue(
            (bool)
            $resourceData['receipt']['available']
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'EXPENSE_RECEIPT_UPDATED',

                'entity_type' =>
                'expense',

                'entity_id' =>
                $expense->id,

                'user_id' =>
                $this
                    ->manager
                    ->id,
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | Authorized Download
        |--------------------------------------------------------------------------
        */

        $this->get(
            "/api/v1/expenses/{$expense->id}/receipt"
        )
            ->assertStatus(
                200
            );

        /*
        |--------------------------------------------------------------------------
        | Unauthorized Download
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->unauthorizedUser, ['staff']);

        $this->getJson(
            "/api/v1/expenses/{$expense->id}/receipt"
        )
            ->assertStatus(
                403
            );

        /*
        |--------------------------------------------------------------------------
        | Remove
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->manager, ['staff']);

        $storedPath =
            $expense
            ->receipt_path;

        $this->deleteJson(
            "/api/v1/expenses/{$expense->id}/receipt"
        )
            ->assertStatus(
                200
            );

        $expense->refresh();

        $this->assertNull(
            $expense
                ->receipt_path
        );

        $this->assertNull(
            $expense
                ->receipt_original_name
        );

        $this->assertNull(
            $expense
                ->receipt_mime_type
        );

        $this->assertNull(
            $expense
                ->receipt_size
        );

        $this->assertNull(
            $expense
                ->receipt_uploaded_at
        );

        $this->assertFalse(
            Storage::disk(
                'local'
            )
                ->exists(
                    (string)
                    $storedPath
                )
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'EXPENSE_RECEIPT_REMOVED',

                'entity_type' =>
                'expense',

                'entity_id' =>
                $expense->id,

                'user_id' =>
                $this
                    ->manager
                    ->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | History / Show / Update / RBAC
    |--------------------------------------------------------------------------
    */

    public function test_expense_history_show_edit_and_permissions_work(): void
    {
        $gas =
            $this->category(
                'GAS'
            );

        $maintenance =
            $this->category(
                'MAINTENANCE'
            );

        $result =
            app(
                ExpenseService::class
            )
            ->create(
                actor: $this->manager,

                data: $this->nonCashCreatePayload(
                    category: $gas,

                    amount: 1000,

                    paymentMethod: Expense::METHOD_CARD,

                    description: 'Initial expense'
                )
            );

        $expense =
            $result['expense'];

        /*
        |--------------------------------------------------------------------------
        | Manager Can View
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->manager, ['staff']);

        $this->getJson(
            '/api/v1/expenses'
        )
            ->assertStatus(
                200
            );

        $this->getJson(
            "/api/v1/expenses/{$expense->id}"
        )
            ->assertStatus(
                200
            );

        $this->getJson(
            '/api/v1/expense-categories'
        )
            ->assertStatus(
                200
            );

        $this->getJson(
            '/api/v1/expenses/payment-methods'
        )
            ->assertStatus(
                200
            );

        /*
        |--------------------------------------------------------------------------
        | Manager Can Edit
        |--------------------------------------------------------------------------
        */

        $this->putJson(
            "/api/v1/expenses/{$expense->id}",
            [
                'expense_category_id' =>
                $maintenance->id,

                'expense_date' =>
                $this
                    ->businessDay
                    ->business_date
                    ->toDateString(),

                'description' =>
                'Updated maintenance expense',

                'notes' =>
                'Edited by manager.',

                'amount' =>
                1250,

                'payment_method' =>
                Expense::METHOD_CARD,

                'reference_number' =>
                'CARD-UPDATED',
            ]
        )
            ->assertStatus(
                200
            );

        $expense->refresh();

        $this->assertSame(
            $maintenance->id,
            (int)
            $expense
                ->expense_category_id
        );

        $this->assertEqualsWithDelta(
            1250,
            (float)
            $expense->amount,
            0.01
        );

        /*
        |--------------------------------------------------------------------------
        | Creator-Only Cannot Edit
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->creatorOnly, ['staff']);

        $this->putJson(
            "/api/v1/expenses/{$expense->id}",
            [
                'expense_category_id' =>
                $gas->id,

                'expense_date' =>
                $this
                    ->businessDay
                    ->business_date
                    ->toDateString(),

                'description' =>
                'Unauthorized edit',

                'amount' =>
                999,

                'payment_method' =>
                Expense::METHOD_CARD,
            ]
        )
            ->assertStatus(
                403
            );

        /*
        |--------------------------------------------------------------------------
        | User With No Expense Permissions
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->unauthorizedUser, ['staff']);

        $this->getJson(
            '/api/v1/expenses'
        )
            ->assertStatus(
                403
            );

        $this->getJson(
            "/api/v1/expenses/{$expense->id}"
        )
            ->assertStatus(
                403
            );

        $this->getJson(
            '/api/v1/expense-categories'
        )
            ->assertStatus(
                403
            );

        $this->getJson(
            '/api/v1/expenses/payment-methods'
        )
            ->assertStatus(
                403
            );

        /*
         * Unauthorized edit made no financial change.
         */
        $this->assertEqualsWithDelta(
            1250,
            (float)
            $expense
                ->fresh()
                ->amount,
            0.01
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Open Business Day
    |--------------------------------------------------------------------------
    */

    public function test_expense_creation_requires_open_business_day(): void
    {
        $gas =
            $this->category(
                'GAS'
            );

        /*
         * No dependent records exist in this test,
         * so the test business day can safely be removed.
         */
        BusinessDay::query()
            ->delete();

        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            '/api/v1/expenses',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'expense_category_id' =>
                $gas->id,

                'expense_date' =>
                now()
                    ->toDateString(),

                'description' =>
                'No business day test',

                'amount' =>
                500,

                'payment_method' =>
                Expense::METHOD_CARD,
            ]
        )
            ->assertStatus(
                409
            );

        $this->assertDatabaseCount(
            'expenses',
            0
        );

        $this->assertDatabaseCount(
            'cash_drawer_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function category(
        string $code
    ): ExpenseCategory {
        return ExpenseCategory::query()
            ->where(
                'code',
                $code
            )
            ->firstOrFail();
    }

    private function createShift(
        User $user,
        float $expectedCash,
        string $status =
        CashierShift::STATUS_OPEN
    ): CashierShift {
        $closed =
            $status
            ===
            CashierShift::STATUS_CLOSED;

        return CashierShift::query()
            ->create([
                'shift_number' =>
                'P26-'
                    .
                    Str::upper(
                        Str::random(12)
                    ),

                'business_day_id' =>
                $this
                    ->businessDay
                    ->id,

                'cashier_id' =>
                $user
                    ->id,

                'opening_float' =>
                $expectedCash,

                'expected_cash' =>
                $expectedCash,

                'actual_cash' =>
                $closed
                    ? $expectedCash
                    : null,

                'cash_difference' =>
                $closed
                    ? 0
                    : null,

                'status' =>
                $status,

                'opened_at' =>
                $closed
                    ? now()
                    ->subHours(
                        2
                    )
                    : now(),

                'closed_at' =>
                $closed
                    ? now()
                    : null,

                'closed_by' =>
                $closed
                    ? $user->id
                    : null,

                'opening_notes' =>
                'Phase 26 automated test shift.',

                'closing_notes' =>
                $closed
                    ? 'Closed test shift.'
                    : null,
            ]);
    }

    private function nonCashCreatePayload(
        ExpenseCategory $category,
        float $amount,
        string $paymentMethod,
        string $description
    ): array {
        return [
            'client_request_id' =>
            (string)
            Str::uuid(),

            'expense_category_id' =>
            $category->id,

            'expense_date' =>
            $this
                ->businessDay
                ->business_date
                ->toDateString(),

            'description' =>
            $description,

            'notes' =>
            'Phase 26 automated test.',

            'amount' =>
            $amount,

            'payment_method' =>
            $paymentMethod,

            'reference_number' =>
            'P26-'
                .
                Str::upper(
                    Str::random(8)
                ),
        ];
    }

    private function updatePayload(
        ExpenseCategory $category,
        float $amount,
        string $paymentMethod,
        CashierShift $shift,
        ?string $notes = null
    ): array {
        return [
            'expense_category_id' =>
            $category->id,

            'expense_date' =>
            $this
                ->businessDay
                ->business_date
                ->toDateString(),

            'description' =>
            'Gas cylinder',

            'notes' =>
            $notes,

            'amount' =>
            $amount,

            'payment_method' =>
            $paymentMethod,

            'reference_number' =>
            'EDIT-001',

            'cashier_shift_id' =>
            $shift->id,
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
                Str::headline(
                    strtolower(
                        $roleCode
                    )
                ),

                'code' =>
                $roleCode,

                'description' =>
                "{$roleCode} Phase 26 test role.",

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
                                'Expenses',

                                'description' =>
                                null,
                            ]
                        );

                    return (int)
                    $permission
                        ->id;
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
}
