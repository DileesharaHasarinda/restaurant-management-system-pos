<?php

namespace Tests\Feature;

use App\Models\BusinessDay;
use App\Models\Order;
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

class TableTransferTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private User $unauthorizedUser;

    private BusinessDay $businessDay;

    private RestaurantTable $sourceTable;

    private RestaurantTable $destinationTable;

    protected function setUp(): void
    {
        parent::setUp();

        $this->manager =
            $this->createUserWithPermissions(
                roleCode: 'MANAGER',

                permissions: [
                    'tables.view',
                    'tables.transfer',
                    'orders.view',
                ]
            );

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'NO_TRANSFER',

                permissions: [
                    'tables.view',
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
                now(),

                'notes' =>
                'Phase 19 test business day.',
            ]);

        $this->sourceTable =
            $this->createTable(
                number: 3,

                status: RestaurantTable::STATUS_OCCUPIED,

                capacity: 4
            );

        $this->destinationTable =
            $this->createTable(
                number: 8,

                status: RestaurantTable::STATUS_AVAILABLE,

                capacity: 6
            );
    }

    public function test_active_table_session_orders_bill_and_customer_data_are_transferred_without_duplication(): void
    {
        $billRequestedAt =
            now()
            ->subMinutes(5);

        $session =
            $this->createOpenSession(
                table: $this->sourceTable,

                guestCount: 3,

                billRequestedAt: $billRequestedAt
            );

        $order =
            Order::query()
            ->create([
                'order_number' =>
                'ORD-P19-000001',

                'business_day_id' =>
                $this->businessDay->id,

                'table_session_id' =>
                $session->id,

                'table_id' =>
                $this->sourceTable->id,

                'order_type' =>
                Order::TYPE_DINE_IN,

                'order_source' =>
                Order::SOURCE_WAITER,

                'session_sequence' =>
                1,

                'table_name_snapshot' =>
                $this->sourceTable->name,

                'customer_name' =>
                'Nimal Perera',

                'customer_phone' =>
                '0771234567',

                'status' =>
                Order::STATUS_SENT_TO_KITCHEN,

                'subtotal' =>
                2500,

                'grand_total' =>
                2500,

                'customer_notes' =>
                'Window side customer.',

                'created_by' =>
                $this->manager->id,

                'confirmed_by' =>
                $this->manager->id,

                'confirmed_at' =>
                now()
                    ->subMinutes(20),

                'sent_to_kitchen_at' =>
                now()
                    ->subMinutes(15),
            ]);

        $sentAt =
            now()
            ->subMinutes(15)
            ->startOfSecond();

        $orderItemId =
            DB::table(
                'order_items'
            )
            ->insertGetId([
                'order_id' =>
                $order->id,

                'menu_item_id' =>
                null,

                'menu_item_variant_id' =>
                null,

                'item_name_snapshot' =>
                'Chicken Fried Rice',

                'variant_name_snapshot' =>
                null,

                'quantity' =>
                2,

                'unit_price' =>
                1250,

                'gross_total' =>
                2500,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'line_total' =>
                2500,

                'estimated_unit_cost' =>
                0,

                'estimated_cost_total' =>
                0,

                'status' =>
                'ACTIVE',

                'special_notes' =>
                'Less spicy',

                'sent_to_kitchen_at' =>
                $sentAt,

                'cancelled_at' =>
                null,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        $invoiceId =
            DB::table(
                'invoices'
            )
            ->insertGetId([
                'invoice_number' =>
                'INV-P19-000001',

                'business_day_id' =>
                $this->businessDay->id,

                'cashier_shift_id' =>
                null,

                'table_session_id' =>
                $session->id,

                'order_id' =>
                $order->id,

                'invoice_type' =>
                'SALE',

                'table_name_snapshot' =>
                $this->sourceTable->name,

                'customer_name' =>
                'Nimal Perera',

                'customer_phone' =>
                '0771234567',

                'subtotal' =>
                2500,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'service_charge_total' =>
                0,

                'grand_total' =>
                2500,

                'estimated_cost_total' =>
                0,

                'paid_amount' =>
                500,

                'change_amount' =>
                0,

                'balance_due' =>
                2000,

                'payment_status' =>
                'PARTIAL',

                'status' =>
                'ISSUED',

                'issued_by' =>
                $this->manager->id,

                'issued_at' =>
                now(),

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        $kitchenJobId =
            DB::table(
                'kitchen_print_jobs'
            )
            ->insertGetId([
                'job_number' =>
                'KOT-P19-000001',

                'idempotency_key' =>
                'P19-KOT-' .
                    Str::uuid(),

                'order_id' =>
                $order->id,

                'job_type' =>
                'INITIAL_ORDER',

                'printer_name' =>
                'Kitchen Printer',

                'printer_address' =>
                '192.168.1.50',

                'payload' =>
                json_encode([
                    'table' =>
                    $this
                        ->sourceTable
                        ->name,

                    'order' =>
                    $order
                        ->order_number,
                ]),

                'status' =>
                'PRINTED',

                'attempts' =>
                1,

                'last_error' =>
                null,

                'requested_by' =>
                $this->manager->id,

                'queued_at' =>
                now()
                    ->subMinutes(15),

                'printed_at' =>
                now()
                    ->subMinutes(14),

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        /*
         * Counts BEFORE transfer.
         */
        $sessionCountBefore =
            TableSession::query()
            ->count();

        $orderCountBefore =
            Order::query()
            ->count();

        $orderItemCountBefore =
            DB::table(
                'order_items'
            )
            ->count();

        $invoiceCountBefore =
            DB::table(
                'invoices'
            )
            ->count();

        $kitchenJobCountBefore =
            DB::table(
                'kitchen_print_jobs'
            )
            ->count();

        Sanctum::actingAs(
            $this->manager
        );

        $this->postJson(
            "/api/v1/tables/{$this->sourceTable->id}/transfer",
            [
                'to_table_id' =>
                $this
                    ->destinationTable
                    ->id,

                'reason' =>
                'Customer requested a larger table.',
            ]
        )
            ->assertStatus(200);

        /*
        |--------------------------------------------------------------------------
        | SAME Table Session
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $sessionCountBefore,
            TableSession::query()
                ->count()
        );

        $session->refresh();

        $this->assertSame(
            $this->destinationTable->id,
            (int)
            $session->table_id
        );

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $session->status
        );

        /*
         * Bill request survives.
         */
        $this->assertNotNull(
            $session->bill_requested_at
        );

        $this->assertSame(
            $this->manager->id,
            (int)
            $session->bill_requested_by
        );

        /*
        |--------------------------------------------------------------------------
        | Physical Table Status
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            RestaurantTable::STATUS_AVAILABLE,
            $this
                ->sourceTable
                ->fresh()
                ->status
        );

        $this->assertSame(
            RestaurantTable::STATUS_OCCUPIED,
            $this
                ->destinationTable
                ->fresh()
                ->status
        );

        /*
        |--------------------------------------------------------------------------
        | SAME Order
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $orderCountBefore,
            Order::query()
                ->count()
        );

        $order->refresh();

        $this->assertSame(
            $this->destinationTable->id,
            (int)
            $order->table_id
        );

        $this->assertSame(
            $session->id,
            (int)
            $order->table_session_id
        );

        $this->assertSame(
            $this->destinationTable->name,
            $order->table_name_snapshot
        );

        /*
         * Customer information survives.
         */
        $this->assertSame(
            'Nimal Perera',
            $order->customer_name
        );

        $this->assertSame(
            '0771234567',
            $order->customer_phone
        );

        $this->assertSame(
            'Window side customer.',
            $order->customer_notes
        );

        /*
         * Lifecycle does not restart.
         */
        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $order->status
        );

        /*
        |--------------------------------------------------------------------------
        | NO Order Item Duplication / Kitchen Re-send
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $orderItemCountBefore,
            DB::table(
                'order_items'
            )
                ->count()
        );

        $orderItem =
            DB::table(
                'order_items'
            )
            ->where(
                'id',
                $orderItemId
            )
            ->first();

        $this->assertNotNull(
            $orderItem
        );

        $this->assertSame(
            $sentAt->format(
                'Y-m-d H:i:s'
            ),
            $orderItem
                ->sent_to_kitchen_at
        );

        /*
        |--------------------------------------------------------------------------
        | SAME Bill
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $invoiceCountBefore,
            DB::table(
                'invoices'
            )
                ->count()
        );

        $invoice =
            DB::table(
                'invoices'
            )
            ->where(
                'id',
                $invoiceId
            )
            ->first();

        $this->assertNotNull(
            $invoice
        );

        $this->assertSame(
            $session->id,
            (int)
            $invoice
                ->table_session_id
        );

        $this->assertSame(
            $order->id,
            (int)
            $invoice->order_id
        );

        $this->assertSame(
            $this->destinationTable->name,
            $invoice
                ->table_name_snapshot
        );

        $this->assertSame(
            'Nimal Perera',
            $invoice->customer_name
        );

        $this->assertSame(
            '0771234567',
            $invoice->customer_phone
        );

        $this->assertSame(
            2500.0,
            (float)
            $invoice->grand_total
        );

        $this->assertSame(
            500.0,
            (float)
            $invoice->paid_amount
        );

        $this->assertSame(
            2000.0,
            (float)
            $invoice->balance_due
        );

        /*
        |--------------------------------------------------------------------------
        | DO NOT Reprint Old Kitchen Tickets
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $kitchenJobCountBefore,
            DB::table(
                'kitchen_print_jobs'
            )
                ->count()
        );

        $kitchenJob =
            DB::table(
                'kitchen_print_jobs'
            )
            ->where(
                'id',
                $kitchenJobId
            )
            ->first();

        $this->assertNotNull(
            $kitchenJob
        );

        $this->assertSame(
            'PRINTED',
            $kitchenJob->status
        );

        $this->assertSame(
            1,
            (int)
            $kitchenJob->attempts
        );

        /*
        |--------------------------------------------------------------------------
        | Transfer History
        |--------------------------------------------------------------------------
        */

        $this->assertDatabaseHas(
            'table_transfers',
            [
                'table_session_id' =>
                $session->id,

                'from_table_id' =>
                $this
                    ->sourceTable
                    ->id,

                'to_table_id' =>
                $this
                    ->destinationTable
                    ->id,

                'transferred_by' =>
                $this->manager
                    ->id,

                'reason' =>
                'Customer requested a larger table.',
            ]
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
                'TABLE_TRANSFERRED',

                'entity_type' =>
                'table_session',

                'entity_id' =>
                $session->id,

                'user_id' =>
                $this->manager
                    ->id,
            ]
        );
    }

    public function test_transfer_to_occupied_table_is_rejected_without_changing_source_session(): void
    {
        $sourceSession =
            $this->createOpenSession(
                $this->sourceTable
            );

        $this->destinationTable
            ->update([
                'status' =>
                RestaurantTable::STATUS_OCCUPIED,
            ]);

        $this->createOpenSession(
            $this->destinationTable
        );

        Sanctum::actingAs(
            $this->manager
        );

        $this->postJson(
            "/api/v1/tables/{$this->sourceTable->id}/transfer",
            [
                'to_table_id' =>
                $this
                    ->destinationTable
                    ->id,
            ]
        )
            ->assertStatus(409);

        $this->assertSame(
            $this->sourceTable->id,
            (int)
            $sourceSession
                ->fresh()
                ->table_id
        );

        $this->assertDatabaseCount(
            'table_transfers',
            0
        );
    }

    public function test_destination_capacity_must_support_current_guest_count(): void
    {
        $session =
            $this->createOpenSession(
                table: $this->sourceTable,

                guestCount: 4
            );

        $this->destinationTable
            ->update([
                'capacity' =>
                2,
            ]);

        Sanctum::actingAs(
            $this->manager
        );

        $this->postJson(
            "/api/v1/tables/{$this->sourceTable->id}/transfer",
            [
                'to_table_id' =>
                $this
                    ->destinationTable
                    ->id,
            ]
        )
            ->assertStatus(422);

        $this->assertSame(
            $this->sourceTable->id,
            (int)
            $session
                ->fresh()
                ->table_id
        );

        $this->assertDatabaseCount(
            'table_transfers',
            0
        );
    }

    public function test_table_without_active_session_cannot_be_transferred(): void
    {
        $this->sourceTable
            ->update([
                'status' =>
                RestaurantTable::STATUS_AVAILABLE,
            ]);

        Sanctum::actingAs(
            $this->manager
        );

        $this->postJson(
            "/api/v1/tables/{$this->sourceTable->id}/transfer",
            [
                'to_table_id' =>
                $this
                    ->destinationTable
                    ->id,
            ]
        )
            ->assertStatus(409);

        $this->assertDatabaseCount(
            'table_transfers',
            0
        );
    }

    public function test_table_cannot_be_transferred_to_itself(): void
    {
        $this->createOpenSession(
            $this->sourceTable
        );

        Sanctum::actingAs(
            $this->manager
        );

        $this->postJson(
            "/api/v1/tables/{$this->sourceTable->id}/transfer",
            [
                'to_table_id' =>
                $this
                    ->sourceTable
                    ->id,
            ]
        )
            ->assertStatus(422);

        $this->assertDatabaseCount(
            'table_transfers',
            0
        );
    }

    public function test_user_without_tables_transfer_permission_receives_403(): void
    {
        $session =
            $this->createOpenSession(
                $this->sourceTable
            );

        Sanctum::actingAs(
            $this->unauthorizedUser
        );

        $this->postJson(
            "/api/v1/tables/{$this->sourceTable->id}/transfer",
            [
                'to_table_id' =>
                $this
                    ->destinationTable
                    ->id,
            ]
        )
            ->assertStatus(403);

        $this->assertSame(
            $this->sourceTable->id,
            (int)
            $session
                ->fresh()
                ->table_id
        );

        $this->assertDatabaseCount(
            'table_transfers',
            0
        );
    }

    private function createTable(
        int $number,
        string $status,
        int $capacity
    ): RestaurantTable {
        return RestaurantTable::query()
            ->create([
                'table_number' =>
                $number,

                'code' =>
                sprintf(
                    'TBL-%03d',
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
                $status,

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
        int $guestCount = 2,
        $billRequestedAt = null
    ): TableSession {
        return TableSession::query()
            ->create([
                'session_number' =>
                'TS-' .
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

                'guest_count' =>
                $guestCount,

                'opened_source' =>
                TableSession::SOURCE_STAFF,

                'status' =>
                TableSession::STATUS_OPEN,

                'opened_by' =>
                $this->manager->id,

                'opened_at' =>
                now()
                    ->subMinutes(30),

                'last_activity_at' =>
                now()
                    ->subMinutes(5),

                'bill_requested_at' =>
                $billRequestedAt,

                'bill_requested_by' =>
                $billRequestedAt
                    ? $this
                    ->manager
                    ->id
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
                "Phase 19 {$roleCode} role.",

                'is_active' =>
                true,
            ]);

        $permissionIds = [];

        foreach (
            $permissions as $permissionCode
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
                        'tables',

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
                "{$roleCode} Phase 19 User",

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
