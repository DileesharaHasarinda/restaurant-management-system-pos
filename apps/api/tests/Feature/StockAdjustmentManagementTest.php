<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\BusinessDay;
use App\Models\Ingredient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\StockAdjustment;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\StockAdjustmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockAdjustmentManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private User $unauthorizedUser;

    private BusinessDay $businessDay;

    private int $gramUnitId;

    private int $kilogramUnitId;

    private int $milliliterUnitId;

    protected function setUp(): void
    {
        parent::setUp();

        /*
        |--------------------------------------------------------------------------
        | Authorized Manager
        |--------------------------------------------------------------------------
        */

        $this->manager =
            $this->createUserWithPermissions(
                roleCode: 'P25_MANAGER',

                permissions: [
                    'inventory.view',
                    'inventory.adjust',
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | Unauthorized User
        |--------------------------------------------------------------------------
        */

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'P25_NO_INVENTORY',

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
                $this->manager->id,

                'closed_by' =>
                null,

                'opened_at' =>
                now(),

                'closed_at' =>
                null,

                'notes' =>
                'Phase 25 automated stock adjustment test.',
            ]);

        /*
        |--------------------------------------------------------------------------
        | Gram
        |--------------------------------------------------------------------------
        */

        $this->gramUnitId =
            $this->createUnit(
                name: 'Gram',

                symbol: 'G',

                measurementType: 'WEIGHT',

                baseUnitId: null,

                conversionFactor: 1
            );

        /*
        |--------------------------------------------------------------------------
        | Kilogram
        |--------------------------------------------------------------------------
        |
        | 1 KG = 1000 G
        |
        */

        $this->kilogramUnitId =
            $this->createUnit(
                name: 'Kilogram',

                symbol: 'KG',

                measurementType: 'WEIGHT',

                baseUnitId: $this->gramUnitId,

                conversionFactor: 1000
            );

        /*
        |--------------------------------------------------------------------------
        | Milliliter
        |--------------------------------------------------------------------------
        |
        | Separate VOLUME root used for incompatibility tests.
        |
        */

        $this->milliliterUnitId =
            $this->createUnit(
                name: 'Milliliter',

                symbol: 'ML',

                measurementType: 'VOLUME',

                baseUnitId: null,

                conversionFactor: 1
            );
    }

    /*
    |--------------------------------------------------------------------------
    | ADJUSTMENT OUT
    |--------------------------------------------------------------------------
    |
    | System = 10 KG
    | Actual = 9.5 KG
    |
    | Difference = -0.5 KG
    |            = -500 G
    |
    */

    public function test_physical_count_shortage_creates_adjustment_out(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Chicken',

                stock: 10000,

                averageCost: 0.50
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $clientRequestId =
            (string)
            Str::uuid();

        $response =
            $this->postJson(
                "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
                [
                    'client_request_id' =>
                    $clientRequestId,

                    'unit_id' =>
                    $this->kilogramUnitId,

                    'actual_quantity' =>
                    9.5,

                    'reason' =>
                    'Physical count found 0.5 KG shortage.',
                ]
            );

        $response
            ->assertStatus(
                201
            );

        $adjustment =
            StockAdjustment::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->firstOrFail();

        /*
        |--------------------------------------------------------------------------
        | Physical Count Snapshot
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            StockAdjustment::DIRECTION_OUT,
            $adjustment->direction
        );

        $this->assertSame(
            StockAdjustment::STATUS_POSTED,
            $adjustment->status
        );

        $this->assertEqualsWithDelta(
            10,
            (float)
            $adjustment->system_quantity,
            0.0001
        );

        $this->assertEqualsWithDelta(
            9.5,
            (float)
            $adjustment->actual_quantity,
            0.0001
        );

        $this->assertEqualsWithDelta(
            -0.5,
            $adjustment->signedDifference(),
            0.0001
        );

        /*
        |--------------------------------------------------------------------------
        | Base Unit Snapshot
        |--------------------------------------------------------------------------
        */

        $this->assertEqualsWithDelta(
            10000,
            (float)
            $adjustment->system_base_quantity,
            0.0001
        );

        $this->assertEqualsWithDelta(
            9500,
            (float)
            $adjustment->actual_base_quantity,
            0.0001
        );

        $this->assertEqualsWithDelta(
            -500,
            $adjustment->signedBaseDifference(),
            0.0001
        );

        /*
         * Stored adjustment quantity is absolute.
         */
        $this->assertEqualsWithDelta(
            0.5,
            (float)
            $adjustment->quantity,
            0.0001
        );

        $this->assertEqualsWithDelta(
            500,
            (float)
            $adjustment->base_quantity,
            0.0001
        );

        /*
        |--------------------------------------------------------------------------
        | Mandatory Metadata
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            'Physical count found 0.5 KG shortage.',
            $adjustment->reason
        );

        $this->assertSame(
            $this->manager->id,
            (int)
            $adjustment->created_by
        );

        $this->assertSame(
            $this->businessDay->id,
            (int)
            $adjustment->business_day_id
        );

        $this->assertNotNull(
            $adjustment->posted_at
        );

        /*
        |--------------------------------------------------------------------------
        | Inventory
        |--------------------------------------------------------------------------
        */

        $ingredient->refresh();

        $this->assertEqualsWithDelta(
            9500,
            (float)
            $ingredient->current_stock,
            0.0001
        );

        $this->assertEqualsWithDelta(
            0.50,
            (float)
            $ingredient->average_cost,
            0.000001
        );

        /*
        |--------------------------------------------------------------------------
        | Immutable Movement
        |--------------------------------------------------------------------------
        */

        $movement =
            StockMovement::query()
            ->where(
                'source_type',
                StockAdjustment::class
            )
            ->where(
                'source_id',
                $adjustment->id
            )
            ->firstOrFail();

        $this->assertSame(
            StockMovement::TYPE_ADJUSTMENT_OUT,
            $movement->movement_type
        );

        $this->assertEqualsWithDelta(
            -500,
            (float)
            $movement->quantity_delta,
            0.0001
        );

        $this->assertEqualsWithDelta(
            9500,
            (float)
            $movement->balance_after,
            0.0001
        );

        $this->assertEqualsWithDelta(
            0.50,
            (float)
            $movement->unit_cost,
            0.000001
        );

        $this->assertEqualsWithDelta(
            -250,
            (float)
            $movement->total_cost,
            0.01
        );

        $this->assertSame(
            $adjustment->adjustment_number,
            $movement->reference
        );

        $this->assertSame(
            $movement->id,
            (int)
            $adjustment->stock_movement_id
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
                'PHYSICAL_STOCK_COUNT_RECORDED',

                'entity_type' =>
                'stock_adjustment',

                'entity_id' =>
                $adjustment->id,

                'user_id' =>
                $this->manager->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | ADJUSTMENT IN
    |--------------------------------------------------------------------------
    */

    public function test_physical_count_surplus_creates_adjustment_in(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Chicken Surplus',

                stock: 10000,

                averageCost: 0.50
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $clientRequestId =
            (string)
            Str::uuid();

        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            [
                'client_request_id' =>
                $clientRequestId,

                'unit_id' =>
                $this->kilogramUnitId,

                'actual_quantity' =>
                10.75,

                'reason' =>
                'Physical count found additional stock.',
            ]
        )
            ->assertStatus(
                201
            );

        $adjustment =
            StockAdjustment::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->firstOrFail();

        $this->assertSame(
            StockAdjustment::DIRECTION_IN,
            $adjustment->direction
        );

        $this->assertEqualsWithDelta(
            0.75,
            $adjustment->signedDifference(),
            0.0001
        );

        $this->assertEqualsWithDelta(
            750,
            $adjustment->signedBaseDifference(),
            0.0001
        );

        $ingredient->refresh();

        $this->assertEqualsWithDelta(
            10750,
            (float)
            $ingredient->current_stock,
            0.0001
        );

        /*
         * Physical-count IN preserves existing
         * moving-average cost.
         */
        $this->assertEqualsWithDelta(
            0.50,
            (float)
            $ingredient->average_cost,
            0.000001
        );

        $movement =
            $adjustment
            ->stockMovement()
            ->firstOrFail();

        $this->assertSame(
            StockMovement::TYPE_ADJUSTMENT_IN,
            $movement->movement_type
        );

        $this->assertEqualsWithDelta(
            750,
            (float)
            $movement->quantity_delta,
            0.0001
        );

        $this->assertEqualsWithDelta(
            10750,
            (float)
            $movement->balance_after,
            0.0001
        );

        $this->assertEqualsWithDelta(
            375,
            (float)
            $movement->total_cost,
            0.01
        );
    }

    /*
    |--------------------------------------------------------------------------
    | ZERO DIFFERENCE
    |--------------------------------------------------------------------------
    */

    public function test_matching_physical_count_is_recorded_without_stock_movement(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Exact Count Ingredient',

                stock: 10000,

                averageCost: 0.50
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $clientRequestId =
            (string)
            Str::uuid();

        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            [
                'client_request_id' =>
                $clientRequestId,

                'unit_id' =>
                $this->kilogramUnitId,

                'actual_quantity' =>
                10,

                'reason' =>
                'Routine physical stock verification.',
            ]
        )
            ->assertStatus(
                201
            );

        $adjustment =
            StockAdjustment::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->firstOrFail();

        $this->assertSame(
            StockAdjustment::DIRECTION_NONE,
            $adjustment->direction
        );

        $this->assertEqualsWithDelta(
            0,
            $adjustment->signedDifference(),
            0.0001
        );

        $this->assertEqualsWithDelta(
            0,
            $adjustment->signedBaseDifference(),
            0.0001
        );

        $this->assertEqualsWithDelta(
            0,
            (float)
            $adjustment->quantity,
            0.0001
        );

        $this->assertEqualsWithDelta(
            0,
            (float)
            $adjustment->base_quantity,
            0.0001
        );

        $this->assertNull(
            $adjustment->stock_movement_id
        );

        $this->assertSame(
            0,
            StockMovement::query()
                ->where(
                    'source_type',
                    StockAdjustment::class
                )
                ->where(
                    'source_id',
                    $adjustment->id
                )
                ->count()
        );

        $this->assertEqualsWithDelta(
            10000,
            (float)
            $ingredient
                ->fresh()
                ->current_stock,
            0.0001
        );

        /*
         * Audit still required even though
         * inventory did not change.
         */
        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'PHYSICAL_STOCK_COUNT_RECORDED',

                'entity_type' =>
                'stock_adjustment',

                'entity_id' =>
                $adjustment->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | IDEMPOTENCY
    |--------------------------------------------------------------------------
    */

    public function test_exact_duplicate_physical_count_does_not_adjust_stock_twice(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Duplicate Count Ingredient',

                stock: 10000,

                averageCost: 1
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $clientRequestId =
            (string)
            Str::uuid();

        $payload = [
            'client_request_id' =>
            $clientRequestId,

            'unit_id' =>
            $this->kilogramUnitId,

            'actual_quantity' =>
            9.5,

            'reason' =>
            'Duplicate physical stock count test.',
        ];

        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            $payload
        )
            ->assertStatus(
                201
            );

        $stockAfterFirst =
            (float)
            $ingredient
                ->fresh()
                ->current_stock;

        $second =
            $this->postJson(
                "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
                $payload
            );

        $second
            ->assertStatus(
                200
            );

        $stockAfterSecond =
            (float)
            $ingredient
                ->fresh()
                ->current_stock;

        $this->assertEqualsWithDelta(
            9500,
            $stockAfterFirst,
            0.0001
        );

        $this->assertEqualsWithDelta(
            9500,
            $stockAfterSecond,
            0.0001
        );

        $this->assertSame(
            1,
            StockAdjustment::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->count()
        );

        $adjustment =
            StockAdjustment::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->firstOrFail();

        $this->assertSame(
            1,
            StockMovement::query()
                ->where(
                    'source_type',
                    StockAdjustment::class
                )
                ->where(
                    'source_id',
                    $adjustment->id
                )
                ->count()
        );

        /*
         * Exact retry must not duplicate
         * the business audit either.
         */
        $this->assertSame(
            1,
            AuditLog::query()
                ->where(
                    'action',
                    'PHYSICAL_STOCK_COUNT_RECORDED'
                )
                ->where(
                    'entity_type',
                    'stock_adjustment'
                )
                ->where(
                    'entity_id',
                    $adjustment->id
                )
                ->count()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | IDEMPOTENCY CONFLICT
    |--------------------------------------------------------------------------
    */

    public function test_same_request_id_with_different_count_is_rejected(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Conflict Ingredient',

                stock: 100,

                averageCost: 1
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $clientRequestId =
            (string)
            Str::uuid();

        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            [
                'client_request_id' =>
                $clientRequestId,

                'unit_id' =>
                $this->gramUnitId,

                'actual_quantity' =>
                90,

                'reason' =>
                'Physical count test.',
            ]
        )
            ->assertStatus(
                201
            );

        /*
         * Same UUID, different physical count.
         */
        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            [
                'client_request_id' =>
                $clientRequestId,

                'unit_id' =>
                $this->gramUnitId,

                'actual_quantity' =>
                80,

                'reason' =>
                'Physical count test.',
            ]
        )
            ->assertStatus(
                409
            );

        /*
         * Only first count survives.
         */
        $this->assertEqualsWithDelta(
            90,
            (float)
            $ingredient
                ->fresh()
                ->current_stock,
            0.0001
        );

        $this->assertSame(
            1,
            StockAdjustment::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->count()
        );

        $this->assertDatabaseCount(
            'stock_movements',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | INVALID INVENTORY CONFIGURATION
    |--------------------------------------------------------------------------
    */

    public function test_invalid_inventory_configuration_is_rejected_without_changes(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        /*
        |--------------------------------------------------------------------------
        | Incompatible Unit
        |--------------------------------------------------------------------------
        */

        $normal =
            $this->createIngredient(
                name: 'Normal Ingredient',

                stock: 100,

                averageCost: 1
            );

        $this->postJson(
            "/api/v1/inventory/ingredients/{$normal->id}/physical-count",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'unit_id' =>
                $this->milliliterUnitId,

                'actual_quantity' =>
                90,

                'reason' =>
                'Incompatible unit test.',
            ]
        )
            ->assertStatus(
                422
            );

        /*
        |--------------------------------------------------------------------------
        | Inactive Ingredient
        |--------------------------------------------------------------------------
        */

        $inactive =
            $this->createIngredient(
                name: 'Inactive Ingredient',

                stock: 100,

                averageCost: 1,

                active: false
            );

        $this->postJson(
            "/api/v1/inventory/ingredients/{$inactive->id}/physical-count",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'unit_id' =>
                $this->gramUnitId,

                'actual_quantity' =>
                90,

                'reason' =>
                'Inactive ingredient test.',
            ]
        )
            ->assertStatus(
                422
            );

        /*
        |--------------------------------------------------------------------------
        | Tracking Disabled
        |--------------------------------------------------------------------------
        */

        $untracked =
            $this->createIngredient(
                name: 'Untracked Ingredient',

                stock: 100,

                averageCost: 1,

                trackStock: false
            );

        $this->postJson(
            "/api/v1/inventory/ingredients/{$untracked->id}/physical-count",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'unit_id' =>
                $this->gramUnitId,

                'actual_quantity' =>
                90,

                'reason' =>
                'Tracking disabled test.',
            ]
        )
            ->assertStatus(
                422
            );

        /*
        |--------------------------------------------------------------------------
        | Nothing Changed
        |--------------------------------------------------------------------------
        */

        $this->assertEqualsWithDelta(
            100,
            (float)
            $normal
                ->fresh()
                ->current_stock,
            0.0001
        );

        $this->assertEqualsWithDelta(
            100,
            (float)
            $inactive
                ->fresh()
                ->current_stock,
            0.0001
        );

        $this->assertEqualsWithDelta(
            100,
            (float)
            $untracked
                ->fresh()
                ->current_stock,
            0.0001
        );

        $this->assertDatabaseCount(
            'stock_adjustments',
            0
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | REQUEST VALIDATION
    |--------------------------------------------------------------------------
    */

    public function test_negative_count_and_missing_reason_are_rejected(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Validation Ingredient',

                stock: 100,

                averageCost: 1
            );

        Sanctum::actingAs($this->manager, ['staff']);

        /*
         * Negative physical count.
         */
        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'unit_id' =>
                $this->gramUnitId,

                'actual_quantity' =>
                -1,

                'reason' =>
                'Negative quantity.',
            ]
        )
            ->assertStatus(
                422
            );

        /*
         * Missing reason.
         */
        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'unit_id' =>
                $this->gramUnitId,

                'actual_quantity' =>
                90,
            ]
        )
            ->assertStatus(
                422
            );

        $this->assertEqualsWithDelta(
            100,
            (float)
            $ingredient
                ->fresh()
                ->current_stock,
            0.0001
        );

        $this->assertDatabaseCount(
            'stock_adjustments',
            0
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | BUSINESS DAY
    |--------------------------------------------------------------------------
    */

    public function test_physical_count_requires_open_business_day(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Business Day Ingredient',

                stock: 100,

                averageCost: 1
            );

        /*
         * Remove open business day.
         */
        BusinessDay::query()
            ->delete();

        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'unit_id' =>
                $this->gramUnitId,

                'actual_quantity' =>
                90,

                'reason' =>
                'Business day validation test.',
            ]
        )
            ->assertStatus(
                409
            );

        $this->assertEqualsWithDelta(
            100,
            (float)
            $ingredient
                ->fresh()
                ->current_stock,
            0.0001
        );

        $this->assertDatabaseCount(
            'stock_adjustments',
            0
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | HISTORY + SHOW + RBAC
    |--------------------------------------------------------------------------
    */

    public function test_stock_adjustment_history_show_and_permissions_work(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'History Ingredient',

                stock: 100,

                averageCost: 1
            );

        /*
         * Create one count using production service.
         */
        $result =
            app(
                StockAdjustmentService::class
            )
            ->recordPhysicalCount(
                actor: $this->manager,

                ingredient: $ingredient,

                clientRequestId: (string)
                Str::uuid(),

                unitId: $this->gramUnitId,

                actualQuantity: 95,

                reason: 'Stock adjustment history test.'
            );

        $adjustment =
            $result['adjustment'];

        /*
        |--------------------------------------------------------------------------
        | Authorized
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->manager, ['staff']);

        $this->getJson(
            '/api/v1/inventory/stock-adjustments'
        )
            ->assertStatus(
                200
            );

        $this->getJson(
            "/api/v1/inventory/stock-adjustments/{$adjustment->id}"
        )
            ->assertStatus(
                200
            );

        /*
        |--------------------------------------------------------------------------
        | Unauthorized
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->unauthorizedUser, ['staff']);

        $this->getJson(
            '/api/v1/inventory/stock-adjustments'
        )
            ->assertStatus(
                403
            );

        $this->getJson(
            "/api/v1/inventory/stock-adjustments/{$adjustment->id}"
        )
            ->assertStatus(
                403
            );

        $this->postJson(
            "/api/v1/inventory/ingredients/{$ingredient->id}/physical-count",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'unit_id' =>
                $this->gramUnitId,

                'actual_quantity' =>
                90,

                'reason' =>
                'Unauthorized physical count.',
            ]
        )
            ->assertStatus(
                403
            );

        /*
         * Original legitimate count:
         *
         * 100 -> 95
         *
         * Unauthorized attempt must do nothing.
         */
        $this->assertEqualsWithDelta(
            95,
            (float)
            $ingredient
                ->fresh()
                ->current_stock,
            0.0001
        );

        $this->assertDatabaseCount(
            'stock_adjustments',
            1
        );

        $this->assertDatabaseCount(
            'stock_movements',
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
                "{$roleCode} Phase 25 test role.",

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
                                'Inventory',

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
                "{$roleCode} Phase 25 User",

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

    private function createUnit(
        string $name,
        string $symbol,
        string $measurementType,
        ?int $baseUnitId,
        float $conversionFactor
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
                $baseUnitId,

                'conversion_factor' =>
                $conversionFactor,

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
        float $averageCost,
        ?int $baseUnitId = null,
        bool $trackStock = true,
        bool $active = true
    ): Ingredient {
        return Ingredient::query()
            ->create([
                'sku' =>
                'P25-ING-'
                    .
                    Str::upper(
                        Str::random(10)
                    ),

                'name' =>
                $name,

                'base_unit_id' =>
                $baseUnitId
                    ?? $this->gramUnitId,

                'current_stock' =>
                $stock,

                'reorder_level' =>
                0,

                'average_cost' =>
                $averageCost,

                'track_stock' =>
                $trackStock,

                'is_active' =>
                $active,

                'storage_location' =>
                'PHASE-25-TEST',
            ]);
    }
}
