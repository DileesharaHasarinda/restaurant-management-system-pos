<?php

namespace Tests\Feature;

use App\Models\BusinessDay;
use App\Models\Ingredient;
use App\Models\Permission;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Wastage;
use App\Services\WastageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WastageManagementTest extends TestCase
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
                roleCode: 'P24_MANAGER',

                permissions: [
                    'wastage.view',
                    'wastage.create',
                    'wastage.manage',
                ]
            );

        /*
        |--------------------------------------------------------------------------
        | User Without Wastage Permissions
        |--------------------------------------------------------------------------
        */

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'P24_NO_WASTAGE',

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
                'Phase 24 automated wastage test business day.',
            ]);

        /*
        |--------------------------------------------------------------------------
        | Base Gram Unit
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
        | Separate VOLUME root.
        |
        | This lets us prove:
        |
        | KG/G -> ML is rejected.
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
    | Reason Catalogue
    |--------------------------------------------------------------------------
    */

    public function test_wastage_reason_catalog_contains_all_required_reasons(): void
    {
        $this->assertSame(
            [
                'EXPIRED' =>
                'Expired',

                'SPOILED' =>
                'Spoiled',

                'DAMAGED' =>
                'Damaged',

                'COOKING_ERROR' =>
                'Cooking Error',

                'DROPPED' =>
                'Dropped',

                'OVERPRODUCTION' =>
                'Overproduction',

                'STAFF_MEAL' =>
                'Staff Meal',

                'OTHER' =>
                'Other',
            ],
            Wastage::reasonLabels()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Main Phase 24 Business Case
    |--------------------------------------------------------------------------
    |
    | Chicken
    | 2 KG
    | Spoiled
    |
    | 2 KG = 2000 G
    |
    | Stock:
    |
    | 10000 G - 2000 G
    | = 8000 G
    |
    | Cost:
    |
    | 2000 × Rs.0.50
    | = Rs.1000
    |
    */

    public function test_spoiled_chicken_two_kg_reduces_stock_and_calculates_wastage_value(): void
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
                '/api/v1/wastages',
                [
                    'client_request_id' =>
                    $clientRequestId,

                    'ingredient_id' =>
                    $ingredient->id,

                    'quantity' =>
                    2,

                    'unit_id' =>
                    $this->kilogramUnitId,

                    'reason_code' =>
                    Wastage::REASON_SPOILED,

                    'reason' =>
                    'Chicken spoiled during storage.',
                ]
            );

        $response
            ->assertStatus(
                201
            );

        $wastage =
            Wastage::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->firstOrFail();

        $this->assertSame(
            Wastage::TYPE_INGREDIENT,
            $wastage->wastage_type
        );

        $this->assertSame(
            Wastage::REASON_SPOILED,
            $wastage->reason_code
        );

        $this->assertSame(
            Wastage::STATUS_POSTED,
            $wastage->status
        );

        $this->assertSame(
            $ingredient->id,
            (int)
            $wastage->ingredient_id
        );

        $this->assertSame(
            $this->kilogramUnitId,
            (int)
            $wastage->unit_id
        );

        $this->assertEqualsWithDelta(
            2,
            (float)
            $wastage->quantity,
            0.0001
        );

        $this->assertEqualsWithDelta(
            2000,
            (float)
            $wastage->base_quantity,
            0.0001
        );

        /*
         * Positive reporting value.
         */
        $this->assertEqualsWithDelta(
            1000,
            (float)
            $wastage->estimated_cost,
            0.01
        );

        /*
         * Inventory reduced.
         */
        $ingredient->refresh();

        $this->assertEqualsWithDelta(
            8000,
            (float)
            $ingredient->current_stock,
            0.0001
        );

        /*
         * Average cost does NOT change
         * on outbound wastage.
         */
        $this->assertEqualsWithDelta(
            0.50,
            (float)
            $ingredient->average_cost,
            0.000001
        );

        /*
        |--------------------------------------------------------------------------
        | Immutable Stock Movement
        |--------------------------------------------------------------------------
        */

        $movement =
            StockMovement::query()
            ->where(
                'source_type',
                'wastage'
            )
            ->where(
                'source_id',
                $wastage->id
            )
            ->firstOrFail();

        $this->assertSame(
            StockMovement::TYPE_WASTAGE,
            $movement->movement_type
        );

        $this->assertSame(
            $ingredient->id,
            (int)
            $movement->ingredient_id
        );

        $this->assertEqualsWithDelta(
            -2000,
            (float)
            $movement->quantity_delta,
            0.0001
        );

        $this->assertEqualsWithDelta(
            8000,
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

        /*
         * Stock leaving inventory is represented
         * as negative ledger value.
         */
        $this->assertEqualsWithDelta(
            -1000,
            (float)
            $movement->total_cost,
            0.01
        );

        $this->assertSame(
            'wastage',
            $movement->source_type
        );

        $this->assertSame(
            $wastage->id,
            (int)
            $movement->source_id
        );

        $this->assertSame(
            $wastage->wastage_number,
            $movement->reference
        );

        $this->assertNotNull(
            $movement->movement_key
        );

        $this->assertNotSame(
            '',
            trim(
                (string)
                $movement->movement_key
            )
        );

        /*
        |--------------------------------------------------------------------------
        | Business Day + Creator
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $this->businessDay->id,
            (int)
            $wastage->business_day_id
        );

        $this->assertSame(
            $this->manager->id,
            (int)
            $wastage->created_by
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
                'WASTAGE_RECORDED',

                'entity_type' =>
                'wastage',

                'entity_id' =>
                $wastage->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | All Eight Reasons
    |--------------------------------------------------------------------------
    */

    public function test_all_eight_wastage_reason_codes_can_be_recorded(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Reason Test Ingredient',

                stock: 1000,

                averageCost: 1
            );

        $service =
            app(
                WastageService::class
            );

        foreach (
            Wastage::reasonCodes()
            as $reasonCode
        ) {
            $result =
                $service
                ->createIngredientWastage(
                    actor: $this->manager,

                    clientRequestId: (string)
                    Str::uuid(),

                    ingredientId: $ingredient->id,

                    unitId: $this->gramUnitId,

                    quantity: 1,

                    reasonCode: $reasonCode,

                    reason: $reasonCode
                        === Wastage::REASON_OTHER
                        ? 'Custom wastage reason.'
                        : null
                );

            $this->assertTrue(
                $result['created']
            );

            $this->assertSame(
                $reasonCode,
                $result['wastage']
                    ->reason_code
            );
        }

        $this->assertDatabaseCount(
            'wastages',
            8
        );

        $this->assertDatabaseCount(
            'stock_movements',
            8
        );

        /*
         * 1000 - 8 = 992
         */
        $ingredient->refresh();

        $this->assertEqualsWithDelta(
            992,
            (float)
            $ingredient->current_stock,
            0.0001
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Exact Duplicate Request
    |--------------------------------------------------------------------------
    */

    public function test_exact_duplicate_request_does_not_deduct_stock_twice(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Duplicate Test Ingredient',

                stock: 100,

                averageCost: 2
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $clientRequestId =
            (string)
            Str::uuid();

        $payload = [
            'client_request_id' =>
            $clientRequestId,

            'ingredient_id' =>
            $ingredient->id,

            'quantity' =>
            10,

            'unit_id' =>
            $this->gramUnitId,

            'reason_code' =>
            Wastage::REASON_DAMAGED,

            'reason' =>
            'Duplicate request test.',
        ];

        /*
         * First request.
         */
        $this->postJson(
            '/api/v1/wastages',
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

        /*
         * Exact same request again.
         */
        $this->postJson(
            '/api/v1/wastages',
            $payload
        )
            ->assertStatus(
                200
            );

        $stockAfterSecond =
            (float)
            $ingredient
                ->fresh()
                ->current_stock;

        $this->assertEqualsWithDelta(
            90,
            $stockAfterFirst,
            0.0001
        );

        $this->assertEqualsWithDelta(
            90,
            $stockAfterSecond,
            0.0001
        );

        $this->assertSame(
            $stockAfterFirst,
            $stockAfterSecond
        );

        $this->assertSame(
            1,
            Wastage::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->count()
        );

        $wastage =
            Wastage::query()
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
                    'wastage'
                )
                ->where(
                    'source_id',
                    $wastage->id
                )
                ->count()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency Key Reuse
    |--------------------------------------------------------------------------
    */

    public function test_same_request_id_with_different_data_is_rejected(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Idempotency Conflict Ingredient',

                stock: 100,

                averageCost: 1
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $clientRequestId =
            (string)
            Str::uuid();

        $this->postJson(
            '/api/v1/wastages',
            [
                'client_request_id' =>
                $clientRequestId,

                'ingredient_id' =>
                $ingredient->id,

                'quantity' =>
                10,

                'unit_id' =>
                $this->gramUnitId,

                'reason_code' =>
                Wastage::REASON_DAMAGED,
            ]
        )
            ->assertStatus(
                201
            );

        /*
         * Same UUID but different quantity.
         */
        $this->postJson(
            '/api/v1/wastages',
            [
                'client_request_id' =>
                $clientRequestId,

                'ingredient_id' =>
                $ingredient->id,

                'quantity' =>
                20,

                'unit_id' =>
                $this->gramUnitId,

                'reason_code' =>
                Wastage::REASON_DAMAGED,
            ]
        )
            ->assertStatus(
                409
            );

        /*
         * Only first deduction survives.
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
            Wastage::query()
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
    | OTHER Requires Description
    |--------------------------------------------------------------------------
    */

    public function test_other_reason_requires_description(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Other Reason Ingredient',

                stock: 100,

                averageCost: 1
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            '/api/v1/wastages',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'ingredient_id' =>
                $ingredient->id,

                'quantity' =>
                1,

                'unit_id' =>
                $this->gramUnitId,

                'reason_code' =>
                Wastage::REASON_OTHER,

                'reason' =>
                null,
            ]
        )
            ->assertStatus(
                422
            );

        $this->assertDatabaseCount(
            'wastages',
            0
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );

        $this->assertEqualsWithDelta(
            100,
            (float)
            $ingredient
                ->fresh()
                ->current_stock,
            0.0001
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Insufficient Stock
    |--------------------------------------------------------------------------
    */

    public function test_insufficient_stock_rolls_back_entire_wastage_transaction(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'Insufficient Stock Ingredient',

                stock: 5,

                averageCost: 10
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $clientRequestId =
            (string)
            Str::uuid();

        $this->postJson(
            '/api/v1/wastages',
            [
                'client_request_id' =>
                $clientRequestId,

                'ingredient_id' =>
                $ingredient->id,

                'quantity' =>
                10,

                'unit_id' =>
                $this->gramUnitId,

                'reason_code' =>
                Wastage::REASON_SPOILED,
            ]
        )
            ->assertStatus(
                409
            );

        /*
         * Stock unchanged.
         */
        $this->assertEqualsWithDelta(
            5,
            (float)
            $ingredient
                ->fresh()
                ->current_stock,
            0.0001
        );

        /*
         * Wastage row created before the stock
         * operation must have been rolled back.
         */
        $this->assertSame(
            0,
            Wastage::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->count()
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Invalid Ingredient / Unit Configuration
    |--------------------------------------------------------------------------
    */

    public function test_invalid_inventory_configuration_is_rejected_without_stock_changes(): void
    {
        Sanctum::actingAs($this->manager, ['staff']);

        /*
        |--------------------------------------------------------------------------
        | Incompatible Unit
        |--------------------------------------------------------------------------
        |
        | Ingredient base unit = Gram
        | Entered unit = Milliliter
        |
        */

        $ingredient =
            $this->createIngredient(
                name: 'Unit Validation Ingredient',

                stock: 100,

                averageCost: 1
            );

        $this->postJson(
            '/api/v1/wastages',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'ingredient_id' =>
                $ingredient->id,

                'quantity' =>
                10,

                'unit_id' =>
                $this->milliliterUnitId,

                'reason_code' =>
                Wastage::REASON_DAMAGED,
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

        /*
        |--------------------------------------------------------------------------
        | Inactive Ingredient
        |--------------------------------------------------------------------------
        */

        $inactiveIngredient =
            $this->createIngredient(
                name: 'Inactive Ingredient',

                stock: 100,

                averageCost: 1,

                active: false
            );

        $this->postJson(
            '/api/v1/wastages',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'ingredient_id' =>
                $inactiveIngredient->id,

                'quantity' =>
                1,

                'unit_id' =>
                $this->gramUnitId,

                'reason_code' =>
                Wastage::REASON_DAMAGED,
            ]
        )
            ->assertStatus(
                422
            );

        $this->assertEqualsWithDelta(
            100,
            (float)
            $inactiveIngredient
                ->fresh()
                ->current_stock,
            0.0001
        );

        /*
        |--------------------------------------------------------------------------
        | Stock Tracking Disabled
        |--------------------------------------------------------------------------
        */

        $untrackedIngredient =
            $this->createIngredient(
                name: 'Untracked Ingredient',

                stock: 100,

                averageCost: 1,

                trackStock: false
            );

        $this->postJson(
            '/api/v1/wastages',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'ingredient_id' =>
                $untrackedIngredient->id,

                'quantity' =>
                1,

                'unit_id' =>
                $this->gramUnitId,

                'reason_code' =>
                Wastage::REASON_DAMAGED,
            ]
        )
            ->assertStatus(
                422
            );

        $this->assertEqualsWithDelta(
            100,
            (float)
            $untrackedIngredient
                ->fresh()
                ->current_stock,
            0.0001
        );

        /*
         * No failed attempt can leave a wastage
         * or stock movement behind.
         */
        $this->assertDatabaseCount(
            'wastages',
            0
        );

        $this->assertDatabaseCount(
            'stock_movements',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Routes + RBAC
    |--------------------------------------------------------------------------
    */

    public function test_wastage_routes_support_history_show_and_permissions(): void
    {
        $ingredient =
            $this->createIngredient(
                name: 'History Ingredient',

                stock: 100,

                averageCost: 1
            );

        /*
         * Create one valid wastage directly through
         * the production service.
         */
        $result =
            app(
                WastageService::class
            )
            ->createIngredientWastage(
                actor: $this->manager,

                clientRequestId: (string)
                Str::uuid(),

                ingredientId: $ingredient->id,

                unitId: $this->gramUnitId,

                quantity: 5,

                reasonCode: Wastage::REASON_EXPIRED,

                reason: 'History route test.'
            );

        $wastage =
            $result['wastage'];

        /*
        |--------------------------------------------------------------------------
        | Authorized
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->manager, ['staff']);

        $this->getJson(
            '/api/v1/wastages'
        )
            ->assertStatus(
                200
            );

        $this->getJson(
            "/api/v1/wastages/{$wastage->id}"
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
            '/api/v1/wastages'
        )
            ->assertStatus(
                403
            );

        $this->getJson(
            "/api/v1/wastages/{$wastage->id}"
        )
            ->assertStatus(
                403
            );

        $this->postJson(
            '/api/v1/wastages',
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'ingredient_id' =>
                $ingredient->id,

                'quantity' =>
                1,

                'unit_id' =>
                $this->gramUnitId,

                'reason_code' =>
                Wastage::REASON_DAMAGED,
            ]
        )
            ->assertStatus(
                403
            );

        /*
         * Unauthorized POST cannot change stock.
         *
         * Original valid wastage consumed 5:
         *
         * 100 - 5 = 95
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
            'wastages',
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
                "{$roleCode} Phase 24 test role.",

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
                                'Wastage',

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
                "{$roleCode} Phase 24 User",

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
                'P24-ING-'
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

                /*
                 * Application alias maps this to:
                 *
                 * average_cost_per_base_unit
                 */
                'average_cost' =>
                $averageCost,

                'track_stock' =>
                $trackStock,

                'is_active' =>
                $active,

                'storage_location' =>
                'PHASE-24-TEST',
            ]);
    }
}
