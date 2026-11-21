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

class TableMergeTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private User $unauthorizedUser;

    private BusinessDay $businessDay;

    private RestaurantTable $primaryTable;

    private RestaurantTable $secondaryTable;

    protected function setUp(): void
    {
        parent::setUp();

        $this->manager =
            $this->createUserWithPermissions(
                roleCode: 'MANAGER',
                permissions: [
                    'tables.view',
                    'tables.merge',
                    'orders.view',
                ]
            );

        $this->unauthorizedUser =
            $this->createUserWithPermissions(
                roleCode: 'NO_MERGE',
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
                'Phase 20 merge test business day.',
            ]);

        $this->primaryTable =
            $this->createTable(
                number: 5,
                status: RestaurantTable::STATUS_OCCUPIED,
                capacity: 10
            );

        $this->secondaryTable =
            $this->createTable(
                number: 6,
                status: RestaurantTable::STATUS_OCCUPIED,
                capacity: 6
            );
    }

    public function test_two_active_table_sessions_can_be_merged_into_selected_primary_table_without_duplication(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Primary Session - Table 05
        |--------------------------------------------------------------------------
        */

        $primarySession =
            $this->createOpenSession(
                table: $this->primaryTable,

                guestCount: 2
            );

        $primaryOrder =
            $this->createOrder(
                session: $primarySession,

                table: $this->primaryTable,

                sequence: 1,

                name: 'Primary Table Order',

                customerName: 'Primary Customer',

                customerPhone: '0770000001'
            );

        /*
        |--------------------------------------------------------------------------
        | Secondary Session - Table 06
        |--------------------------------------------------------------------------
        */

        $billRequestedAt =
            now()
            ->subMinutes(5);

        $secondarySession =
            $this->createOpenSession(
                table: $this->secondaryTable,

                guestCount: 3,

                billRequestedAt: $billRequestedAt
            );

        $secondaryOrderOne =
            $this->createOrder(
                session: $secondarySession,

                table: $this->secondaryTable,

                sequence: 1,

                name: 'Secondary Order One',

                customerName: 'Nimal Perera',

                customerPhone: '0771234567',

                customerNotes: 'Birthday group.'
            );

        $secondaryOrderTwo =
            $this->createOrder(
                session: $secondarySession,

                table: $this->secondaryTable,

                sequence: 2,

                name: 'Secondary Order Two',

                customerName: 'Nimal Perera',

                customerPhone: '0771234567'
            );

        /*
        |--------------------------------------------------------------------------
        | Existing Kitchen-Sent Item
        |--------------------------------------------------------------------------
        */

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
                $secondaryOrderOne->id,

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

        /*
        |--------------------------------------------------------------------------
        | Existing Order History
        |--------------------------------------------------------------------------
        */

        $historyId =
            DB::table(
                'order_status_histories'
            )
            ->insertGetId([
                'order_id' =>
                $secondaryOrderOne->id,

                'from_status' =>
                Order::STATUS_CONFIRMED,

                'to_status' =>
                Order::STATUS_SENT_TO_KITCHEN,

                'changed_by' =>
                $this->manager->id,

                'notes' =>
                'Already sent before merge.',

                'changed_at' =>
                $sentAt,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Existing Printed Kitchen Ticket
        |--------------------------------------------------------------------------
        */

        $kitchenJobId =
            DB::table(
                'kitchen_print_jobs'
            )
            ->insertGetId([
                'job_number' =>
                'KOT-P20-000001',

                'idempotency_key' =>
                'P20-' .
                    Str::uuid(),

                'order_id' =>
                $secondaryOrderOne->id,

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
                        ->secondaryTable
                        ->name,

                    'order' =>
                    $secondaryOrderOne
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
                $sentAt,

                'printed_at' =>
                $sentAt,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Counts Before Merge
        |--------------------------------------------------------------------------
        */

        $sessionCountBefore =
            TableSession::query()
            ->count();

        $orderCountBefore =
            Order::query()
            ->count();

        $itemCountBefore =
            DB::table(
                'order_items'
            )
            ->count();

        $historyCountBefore =
            DB::table(
                'order_status_histories'
            )
            ->count();

        $kitchenJobCountBefore =
            DB::table(
                'kitchen_print_jobs'
            )
            ->count();

        /*
        |--------------------------------------------------------------------------
        | Merge
        |--------------------------------------------------------------------------
        */

        Sanctum::actingAs($this->manager, ['staff']);

        $response =
            $this->postJson(
                "/api/v1/tables/{$this->primaryTable->id}/merge",
                [
                    'secondary_table_id' =>
                    $this
                        ->secondaryTable
                        ->id,

                    'reason' =>
                    'Guests requested to combine tables.',
                ]
            );

        $response
            ->assertStatus(200);

        $response
            ->assertJsonPath(
                'data.final_billing_session_id',
                $primarySession->id
            );

        $response
            ->assertJsonPath(
                'data.orders_moved',
                2
            );

        /*
        |--------------------------------------------------------------------------
        | Session IDs Were NOT Duplicated
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $sessionCountBefore,
            TableSession::query()
                ->count()
        );

        /*
        |--------------------------------------------------------------------------
        | Primary Session Survives
        |--------------------------------------------------------------------------
        */

        $primarySession->refresh();

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $primarySession->status
        );

        $this->assertSame(
            $this->primaryTable->id,
            (int)
            $primarySession->table_id
        );

        $this->assertSame(
            5,
            (int)
            $primarySession->guest_count
        );

        /*
         * Secondary bill request must survive
         * on the final billing session.
         */
        $this->assertNotNull(
            $primarySession
                ->bill_requested_at
        );

        $this->assertSame(
            $this->manager->id,
            (int)
            $primarySession
                ->bill_requested_by
        );

        /*
        |--------------------------------------------------------------------------
        | Secondary Session Preserved As MERGED
        |--------------------------------------------------------------------------
        */

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
         * Historical table link stays Table 06.
         */
        $this->assertSame(
            $this->secondaryTable->id,
            (int)
            $secondarySession->table_id
        );

        $this->assertNotNull(
            $secondarySession->closed_at
        );

        $this->assertSame(
            $this->manager->id,
            (int)
            $secondarySession->closed_by
        );

        /*
        |--------------------------------------------------------------------------
        | Physical Table State
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            RestaurantTable::STATUS_OCCUPIED,
            $this
                ->primaryTable
                ->fresh()
                ->status
        );

        $this->assertSame(
            RestaurantTable::STATUS_AVAILABLE,
            $this
                ->secondaryTable
                ->fresh()
                ->status
        );

        /*
        |--------------------------------------------------------------------------
        | Orders Are MOVED, Not Copied
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $orderCountBefore,
            Order::query()
                ->count()
        );

        $primaryOrder->refresh();

        $secondaryOrderOne->refresh();

        $secondaryOrderTwo->refresh();

        $this->assertSame(
            $primarySession->id,
            (int)
            $primaryOrder
                ->table_session_id
        );

        $this->assertSame(
            1,
            (int)
            $primaryOrder
                ->session_sequence
        );

        $this->assertSame(
            $primarySession->id,
            (int)
            $secondaryOrderOne
                ->table_session_id
        );

        $this->assertSame(
            $primarySession->id,
            (int)
            $secondaryOrderTwo
                ->table_session_id
        );

        $this->assertSame(
            $this->primaryTable->id,
            (int)
            $secondaryOrderOne
                ->table_id
        );

        $this->assertSame(
            $this->primaryTable->id,
            (int)
            $secondaryOrderTwo
                ->table_id
        );

        /*
         * Sequence numbers must now be unique
         * within the surviving session.
         */
        $this->assertSame(
            2,
            (int)
            $secondaryOrderOne
                ->session_sequence
        );

        $this->assertSame(
            3,
            (int)
            $secondaryOrderTwo
                ->session_sequence
        );

        $this->assertSame(
            $this->primaryTable->name,
            $secondaryOrderOne
                ->table_name_snapshot
        );

        /*
        |--------------------------------------------------------------------------
        | Customer Data Preserved
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            'Nimal Perera',
            $secondaryOrderOne
                ->customer_name
        );

        $this->assertSame(
            '0771234567',
            $secondaryOrderOne
                ->customer_phone
        );

        $this->assertSame(
            'Birthday group.',
            $secondaryOrderOne
                ->customer_notes
        );

        /*
        |--------------------------------------------------------------------------
        | Kitchen Lifecycle Preserved
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            Order::STATUS_SENT_TO_KITCHEN,
            $secondaryOrderOne
                ->status
        );

        $this->assertSame(
            $itemCountBefore,
            DB::table(
                'order_items'
            )
                ->count()
        );

        $item =
            DB::table(
                'order_items'
            )
            ->where(
                'id',
                $orderItemId
            )
            ->first();

        $this->assertNotNull(
            $item
        );

        $this->assertSame(
            $secondaryOrderOne->id,
            (int)
            $item->order_id
        );

        $this->assertSame(
            $sentAt->format(
                'Y-m-d H:i:s'
            ),
            $item
                ->sent_to_kitchen_at
        );

        /*
        |--------------------------------------------------------------------------
        | Order Status History Preserved
        |--------------------------------------------------------------------------
        */

        $this->assertSame(
            $historyCountBefore,
            DB::table(
                'order_status_histories'
            )
                ->count()
        );

        $this->assertDatabaseHas(
            'order_status_histories',
            [
                'id' =>
                $historyId,

                'order_id' =>
                $secondaryOrderOne->id,

                'from_status' =>
                Order::STATUS_CONFIRMED,

                'to_status' =>
                Order::STATUS_SENT_TO_KITCHEN,
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | NO Old KOT Reprint
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
            $secondaryOrderOne->id,
            (int)
            $kitchenJob->order_id
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
        | Merge History
        |--------------------------------------------------------------------------
        */

        $this->assertDatabaseHas(
            'table_merges',
            [
                'source_session_id' =>
                $secondarySession->id,

                'target_session_id' =>
                $primarySession->id,

                'source_table_id' =>
                $this
                    ->secondaryTable
                    ->id,

                'target_table_id' =>
                $this
                    ->primaryTable
                    ->id,

                'merged_by' =>
                $this
                    ->manager
                    ->id,

                'reason' =>
                'Guests requested to combine tables.',
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | Audit Trail
        |--------------------------------------------------------------------------
        */

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'TABLE_MERGED',

                'entity_type' =>
                'table_session',

                'entity_id' =>
                $primarySession->id,

                'user_id' =>
                $this
                    ->manager
                    ->id,
            ]
        );
    }

    public function test_primary_table_is_explicitly_selected_by_route(): void
    {
        $sessionFive =
            $this->createOpenSession(
                $this->primaryTable,
                2
            );

        $sessionSix =
            $this->createOpenSession(
                $this->secondaryTable,
                2
            );

        /*
         * Here Table 06 is deliberately
         * selected as PRIMARY.
         */
        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            "/api/v1/tables/{$this->secondaryTable->id}/merge",
            [
                'secondary_table_id' =>
                $this
                    ->primaryTable
                    ->id,
            ]
        )
            ->assertStatus(200);

        $sessionFive->refresh();
        $sessionSix->refresh();

        $this->assertSame(
            TableSession::STATUS_MERGED,
            $sessionFive->status
        );

        $this->assertSame(
            $sessionSix->id,
            (int)
            $sessionFive
                ->merged_into_session_id
        );

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $sessionSix->status
        );

        $this->assertSame(
            RestaurantTable::STATUS_AVAILABLE,
            $this
                ->primaryTable
                ->fresh()
                ->status
        );

        $this->assertSame(
            RestaurantTable::STATUS_OCCUPIED,
            $this
                ->secondaryTable
                ->fresh()
                ->status
        );
    }

    public function test_merge_is_rejected_when_primary_capacity_is_too_small(): void
    {
        $this->primaryTable
            ->update([
                'capacity' =>
                3,
            ]);

        $primarySession =
            $this->createOpenSession(
                $this->primaryTable,
                2
            );

        $secondarySession =
            $this->createOpenSession(
                $this->secondaryTable,
                2
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            "/api/v1/tables/{$this->primaryTable->id}/merge",
            [
                'secondary_table_id' =>
                $this
                    ->secondaryTable
                    ->id,
            ]
        )
            ->assertStatus(422);

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $primarySession
                ->fresh()
                ->status
        );

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $secondarySession
                ->fresh()
                ->status
        );

        $this->assertDatabaseCount(
            'table_merges',
            0
        );
    }

    public function test_sessions_from_different_business_days_cannot_be_merged(): void
    {
        $primarySession =
            $this->createOpenSession(
                $this->primaryTable,
                2
            );

        $otherBusinessDay =
            BusinessDay::query()
            ->create([
                'business_date' =>
                now()
                    ->addDay()
                    ->toDateString(),

                'status' =>
                BusinessDay::STATUS_OPEN,

                'opened_by' =>
                $this->manager->id,

                'opened_at' =>
                now(),

                'notes' =>
                'Different Phase 20 business day.',
            ]);

        $secondarySession =
            $this->createOpenSession(
                table: $this->secondaryTable,

                guestCount: 2,

                businessDay: $otherBusinessDay
            );

        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            "/api/v1/tables/{$this->primaryTable->id}/merge",
            [
                'secondary_table_id' =>
                $this
                    ->secondaryTable
                    ->id,
            ]
        )
            ->assertStatus(409);

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $primarySession
                ->fresh()
                ->status
        );

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $secondarySession
                ->fresh()
                ->status
        );

        $this->assertDatabaseCount(
            'table_merges',
            0
        );
    }

    public function test_non_void_existing_invoice_blocks_merge_to_prevent_double_billing(): void
    {
        $primarySession =
            $this->createOpenSession(
                $this->primaryTable,
                2
            );

        $secondarySession =
            $this->createOpenSession(
                $this->secondaryTable,
                2
            );

        DB::table(
            'invoices'
        )
            ->insert([
                'invoice_number' =>
                'INV-P20-000001',

                'business_day_id' =>
                $this
                    ->businessDay
                    ->id,

                'cashier_shift_id' =>
                null,

                'table_session_id' =>
                $secondarySession
                    ->id,

                'order_id' =>
                null,

                'invoice_type' =>
                'SALE',

                'table_name_snapshot' =>
                $this
                    ->secondaryTable
                    ->name,

                'customer_name' =>
                'Existing Customer',

                'customer_phone' =>
                '0771111111',

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

                'paid_amount' =>
                0,

                'change_amount' =>
                0,

                'balance_due' =>
                1000,

                'payment_status' =>
                'UNPAID',

                'status' =>
                'ISSUED',

                'issued_by' =>
                $this
                    ->manager
                    ->id,

                'issued_at' =>
                now(),

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            "/api/v1/tables/{$this->primaryTable->id}/merge",
            [
                'secondary_table_id' =>
                $this
                    ->secondaryTable
                    ->id,
            ]
        )
            ->assertStatus(409);

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $primarySession
                ->fresh()
                ->status
        );

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $secondarySession
                ->fresh()
                ->status
        );

        $this->assertDatabaseCount(
            'table_merges',
            0
        );
    }

    public function test_void_invoice_does_not_block_merge(): void
    {
        $primarySession =
            $this->createOpenSession(
                $this->primaryTable,
                2
            );

        $secondarySession =
            $this->createOpenSession(
                $this->secondaryTable,
                2
            );

        DB::table(
            'invoices'
        )
            ->insert([
                'invoice_number' =>
                'INV-P20-VOID-001',

                'business_day_id' =>
                $this
                    ->businessDay
                    ->id,

                'cashier_shift_id' =>
                null,

                'table_session_id' =>
                $secondarySession
                    ->id,

                'order_id' =>
                null,

                'invoice_type' =>
                'SALE',

                'table_name_snapshot' =>
                $this
                    ->secondaryTable
                    ->name,

                'customer_name' =>
                null,

                'customer_phone' =>
                null,

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

                'paid_amount' =>
                0,

                'change_amount' =>
                0,

                'balance_due' =>
                0,

                'payment_status' =>
                'UNPAID',

                'status' =>
                'VOID',

                'issued_by' =>
                $this
                    ->manager
                    ->id,

                'issued_at' =>
                now(),

                'voided_at' =>
                now(),

                'voided_by' =>
                $this
                    ->manager
                    ->id,

                'void_reason' =>
                'Phase 20 test void invoice.',

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);

        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            "/api/v1/tables/{$this->primaryTable->id}/merge",
            [
                'secondary_table_id' =>
                $this
                    ->secondaryTable
                    ->id,
            ]
        )
            ->assertStatus(200);

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $primarySession
                ->fresh()
                ->status
        );

        $this->assertSame(
            TableSession::STATUS_MERGED,
            $secondarySession
                ->fresh()
                ->status
        );

        $this->assertDatabaseCount(
            'table_merges',
            1
        );
    }

    public function test_table_cannot_be_merged_with_itself(): void
    {
        $this->createOpenSession(
            $this->primaryTable,
            2
        );

        Sanctum::actingAs($this->manager, ['staff']);

        $this->postJson(
            "/api/v1/tables/{$this->primaryTable->id}/merge",
            [
                'secondary_table_id' =>
                $this
                    ->primaryTable
                    ->id,
            ]
        )
            ->assertStatus(422);

        $this->assertDatabaseCount(
            'table_merges',
            0
        );
    }

    public function test_user_without_tables_merge_permission_receives_403(): void
    {
        $primarySession =
            $this->createOpenSession(
                $this->primaryTable,
                2
            );

        $secondarySession =
            $this->createOpenSession(
                $this->secondaryTable,
                2
            );

        Sanctum::actingAs($this->unauthorizedUser, ['staff']);

        $this->postJson(
            "/api/v1/tables/{$this->primaryTable->id}/merge",
            [
                'secondary_table_id' =>
                $this
                    ->secondaryTable
                    ->id,
            ]
        )
            ->assertStatus(403);

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $primarySession
                ->fresh()
                ->status
        );

        $this->assertSame(
            TableSession::STATUS_OPEN,
            $secondarySession
                ->fresh()
                ->status
        );

        $this->assertDatabaseCount(
            'table_merges',
            0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

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
        $billRequestedAt = null,
        ?BusinessDay $businessDay = null
    ): TableSession {
        $businessDay ??=
            $this->businessDay;

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
                $businessDay->id,

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
                    ->manager
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
                $billRequestedAt,

                'bill_requested_by' =>
                $billRequestedAt
                    ? $this
                    ->manager
                    ->id
                    : null,
            ]);
    }

    private function createOrder(
        TableSession $session,
        RestaurantTable $table,
        int $sequence,
        string $name,
        ?string $customerName = null,
        ?string $customerPhone = null,
        ?string $customerNotes = null
    ): Order {
        return Order::query()
            ->create([
                'order_number' =>
                'ORD-P20-' .
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
                $session
                    ->business_day_id,

                'table_session_id' =>
                $session->id,

                'table_id' =>
                $table->id,

                'order_type' =>
                Order::TYPE_DINE_IN,

                'order_source' =>
                Order::SOURCE_WAITER,

                'session_sequence' =>
                $sequence,

                'table_name_snapshot' =>
                $table->name,

                'customer_name' =>
                $customerName,

                'customer_phone' =>
                $customerPhone,

                'status' =>
                Order::STATUS_SENT_TO_KITCHEN,

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

                'customer_notes' =>
                $customerNotes,

                'internal_notes' =>
                $name,

                'created_by' =>
                $this
                    ->manager
                    ->id,

                'confirmed_by' =>
                $this
                    ->manager
                    ->id,

                'confirmed_at' =>
                now()
                    ->subMinutes(20),

                'sent_to_kitchen_at' =>
                now()
                    ->subMinutes(15),
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
                "Phase 20 {$roleCode} role.",

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
                "{$roleCode} Phase 20 User",

                'username' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_p20_'
                    .
                    Str::lower(
                        Str::random(8)
                    ),

                'email' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_p20_'
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
