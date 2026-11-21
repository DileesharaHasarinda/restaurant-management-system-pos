<?php

namespace Tests\Feature;

use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashDrawerHardwareTest extends TestCase
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
                roleCode: 'P30_CASHIER',

                permissions: [
                    'cash_drawer.open',
                ]
            );

        $this->otherCashier =
            $this->createUserWithPermissions(
                roleCode: 'P30_OTHER_CASHIER',

                permissions: [
                    'cash_drawer.open',
                ]
            );

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'P30_NO_DRAWER',

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
                'Phase 30 cash drawer test.',
            ]);
    }

    public function test_manual_open_authorizes_single_hardware_pulse(): void
    {
        $shift =
            $this->createShift(
                user: $this->cashier,

                openingCash: 10000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $response =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shift->id}/manual-open",
                [
                    'client_request_id' =>
                    (string)
                    Str::uuid(),

                    'reason' =>
                    'Customer requested change.',
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
            )
            ->assertJsonPath(
                'data.movement.movement_type',
                CashDrawerMovement::TYPE_MANUAL_OPEN
            );

        $this->assertDatabaseHas(
            'cash_drawer_movements',
            [
                'cashier_shift_id' =>
                $shift->id,

                'movement_type' =>
                CashDrawerMovement::TYPE_MANUAL_OPEN,

                'amount' =>
                0,

                'reason' =>
                'Customer requested change.',

                'created_by' =>
                $this->cashier->id,
            ]
        );

        $shift->refresh();

        /*
         * Manual opening must never alter cash.
         */
        $this->assertSame(
            '10000.00',
            $shift->expected_cash
        );
    }

    public function test_duplicate_manual_open_does_not_authorize_second_hardware_pulse(): void
    {
        $shift =
            $this->createShift(
                user: $this->cashier,

                openingCash: 10000
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $requestId =
            (string)
            Str::uuid();

        $payload = [
            'client_request_id' =>
            $requestId,

            'reason' =>
            'Open drawer for change.',
        ];

        $first =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shift->id}/manual-open",
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

        $movementId =
            (int)
            $first->json(
                'data.movement.id'
            );

        /*
         * Simulates HTTP/network retry.
         */
        $second =
            $this->postJson(
                "/api/v1/cashier-shifts/{$shift->id}/manual-open",
                $payload
            );

        $second
            ->assertStatus(200)
            ->assertJsonPath(
                'data.created',
                false
            )
            ->assertJsonPath(
                'data.cash_drawer.should_open',
                false
            )
            ->assertJsonPath(
                'data.movement.id',
                $movementId
            );

        $this->assertEquals(
            1,
            CashDrawerMovement::query()
                ->where(
                    'movement_type',
                    CashDrawerMovement::TYPE_MANUAL_OPEN
                )
                ->count()
        );

        $shift->refresh();

        $this->assertSame(
            '10000.00',
            $shift->expected_cash
        );
    }

    public function test_same_manual_open_uuid_with_different_data_is_rejected(): void
    {
        $shift =
            $this->createShift(
                user: $this->cashier
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $requestId =
            (string)
            Str::uuid();

        $this->postJson(
            "/api/v1/cashier-shifts/{$shift->id}/manual-open",
            [
                'client_request_id' =>
                $requestId,

                'reason' =>
                'First reason.',
            ]
        )
            ->assertStatus(201);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shift->id}/manual-open",
            [
                'client_request_id' =>
                $requestId,

                'reason' =>
                'Different reason.',
            ]
        )
            ->assertStatus(409);

        $this->assertEquals(
            1,
            CashDrawerMovement::query()
                ->where(
                    'movement_type',
                    CashDrawerMovement::TYPE_MANUAL_OPEN
                )
                ->count()
        );
    }

    public function test_closed_shift_cannot_authorize_manual_drawer_open(): void
    {
        $shift =
            $this->createShift(
                user: $this->cashier,

                status: CashierShift::STATUS_CLOSED
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shift->id}/manual-open",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'reason' =>
                'Should fail.',
            ]
        )
            ->assertStatus(409);

        $this->assertDatabaseMissing(
            'cash_drawer_movements',
            [
                'movement_type' =>
                CashDrawerMovement::TYPE_MANUAL_OPEN,
            ]
        );
    }

    public function test_cashier_cannot_open_another_cashiers_drawer(): void
    {
        $shift =
            $this->createShift(
                user: $this->otherCashier
            );

        Sanctum::actingAs($this->cashier, ['staff']);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shift->id}/manual-open",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'reason' =>
                'Unauthorized drawer opening.',
            ]
        )
            ->assertStatus(403);

        $this->assertDatabaseMissing(
            'cash_drawer_movements',
            [
                'movement_type' =>
                CashDrawerMovement::TYPE_MANUAL_OPEN,
            ]
        );
    }

    public function test_manual_drawer_open_requires_permission(): void
    {
        $shift =
            $this->createShift(
                user: $this->unauthorizedUser
            );

        Sanctum::actingAs($this->unauthorizedUser, ['staff']);

        $this->postJson(
            "/api/v1/cashier-shifts/{$shift->id}/manual-open",
            [
                'client_request_id' =>
                (string)
                Str::uuid(),

                'reason' =>
                'Unauthorized.',
            ]
        )
            ->assertStatus(403);

        $this->assertDatabaseMissing(
            'cash_drawer_movements',
            [
                'movement_type' =>
                CashDrawerMovement::TYPE_MANUAL_OPEN,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createShift(
        User $user,
        float $openingCash = 10000,
        string $status = CashierShift::STATUS_OPEN
    ): CashierShift {
        $isOpen =
            $status
            ===
            CashierShift::STATUS_OPEN;

        return CashierShift::query()
            ->create([
                'shift_number' =>
                'P30-' .
                    Str::upper(
                        Str::random(12)
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_id' =>
                $user->id,

                'open_shift_key' =>
                $isOpen
                    ? "CASHIER:{$user->id}"
                    : null,

                'opening_float' =>
                $openingCash,

                'expected_cash' =>
                $openingCash,

                'actual_cash' =>
                $isOpen
                    ? null
                    : $openingCash,

                'cash_difference' =>
                $isOpen
                    ? null
                    : 0,

                'status' =>
                $status,

                'opened_at' =>
                now(),

                'closed_at' =>
                $isOpen
                    ? null
                    : now(),

                'closed_by' =>
                $isOpen
                    ? null
                    : $user->id,

                'opening_notes' =>
                'Phase 30 test shift.',

                'closing_notes' =>
                $isOpen
                    ? null
                    : 'Phase 30 closed test shift.',
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
                "Phase 30 {$roleCode} role.",

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
