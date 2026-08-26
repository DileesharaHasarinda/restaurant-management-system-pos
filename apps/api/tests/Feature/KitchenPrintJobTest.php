<?php

namespace Tests\Feature;

use App\Models\BusinessDay;
use App\Models\KitchenPrintJob;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Permission;
use App\Models\RestaurantTable;
use App\Models\Role;
use App\Models\TableSession;
use App\Models\User;
use App\Services\OrderLifecycleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class KitchenPrintJobTest extends TestCase
{
    use RefreshDatabase;

    private OrderLifecycleService $lifecycle;

    private User $cashier;

    private BusinessDay $businessDay;

    private RestaurantTable $table;

    private TableSession $tableSession;

    protected function setUp(): void
    {
        parent::setUp();

        $this->lifecycle =
            app(
                OrderLifecycleService::class
            );

        $this->cashier =
            $this->createUserWithPermissions(
                roleCode: 'CASHIER',

                permissions: [
                    'orders.view',
                    'orders.create',
                    'orders.confirm',
                    'orders.send_kitchen',
                    'orders.serve',
                    'orders.complete',
                    'orders.cancel',
                    'kitchen.reprint',
                ]
            );

        $this->businessDay =
            BusinessDay::query()
            ->create([
                'business_date' =>
                now()
                    ->toDateString(),

                'status' =>
                BusinessDay::STATUS_OPEN,

                'opened_by' =>
                $this->cashier->id,

                'opened_at' =>
                now(),

                'notes' =>
                'Phase 22 kitchen print test business day.',
            ]);

        $this->table =
            RestaurantTable::query()
            ->create([
                'table_number' =>
                5,

                'code' =>
                'T-P22-005',

                'name' =>
                'Table 05',

                'area' =>
                'Main Restaurant',

                'capacity' =>
                6,

                'status' =>
                RestaurantTable::STATUS_OCCUPIED,

                'qr_ordering_enabled' =>
                true,

                'sort_order' =>
                5,

                'notes' =>
                null,

                'is_active' =>
                true,
            ]);

        $this->tableSession =
            TableSession::query()
            ->create([
                'session_number' =>
                'TS-' .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'table_id' =>
                $this->table->id,

                'guest_count' =>
                2,

                'opened_source' =>
                TableSession::SOURCE_STAFF,

                'status' =>
                TableSession::STATUS_OPEN,

                'opened_by' =>
                $this->cashier->id,

                'opened_at' =>
                now(),

                'last_activity_at' =>
                now(),
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Initial Kitchen Order
    |--------------------------------------------------------------------------
    */

    public function test_initial_kitchen_send_creates_single_initial_order_kot_with_snapshot_payload(): void
    {
        $order =
            $this->createOrder();

        $item =
            $this->addItem(
                order: $order,
                name: 'Chicken Fried Rice',
                variant: 'Large',
                quantity: 2,
                price: 1250.00,
                notes: 'No onion'
            );

        $this->addAddon(
            item: $item,
            name: 'Egg',
            quantity: 1
        );

        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->cashier
            );

        $result =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        $this->assertTrue(
            $result['changed']
        );

        $this->assertSame(
            [
                $item->id,
            ],
            $result['affected_item_ids']
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );

        /** @var KitchenPrintJob $job */
        $job =
            KitchenPrintJob::query()
            ->firstOrFail();

        $this->assertSame(
            KitchenPrintJob::TYPE_INITIAL_ORDER,
            $job->job_type
        );

        $this->assertSame(
            KitchenPrintJob::STATUS_PENDING,
            $job->status
        );

        $this->assertSame(
            0,
            $job->attempts
        );

        $this->assertSame(
            $order->id,
            $job->order_id
        );

        $this->assertSame(
            $this->cashier->id,
            $job->requested_by
        );

        $this->assertNotEmpty(
            $job->job_number
        );

        $this->assertNotEmpty(
            $job->idempotency_key
        );

        $payload =
            $job->payload;

        $this->assertSame(
            1,
            $payload['version']
        );

        $this->assertSame(
            KitchenPrintJob::TYPE_INITIAL_ORDER,
            $payload['document_type']
        );

        $this->assertSame(
            'KITCHEN ORDER',
            $payload['heading']
        );

        $this->assertSame(
            $order->id,
            $payload['order_id']
        );

        $this->assertSame(
            $order->order_number,
            $payload['order_number']
        );

        $this->assertSame(
            Order::TYPE_DINE_IN,
            $payload['order_type']
        );

        $this->assertSame(
            'Table 05',
            $payload['table']
        );

        $this->assertNotEmpty(
            $payload['token']
        );

        $this->assertCount(
            1,
            $payload['items']
        );

        $printedItem =
            $payload['items'][0];

        $this->assertSame(
            $item->id,
            $printedItem['id']
        );

        $this->assertSame(
            'Chicken Fried Rice',
            $printedItem['name']
        );

        $this->assertSame(
            'Large',
            $printedItem['variant']
        );

        $this->assertSame(
            2.0,
            (float) $printedItem['quantity']
        );

        $this->assertSame(
            'No onion',
            $printedItem['notes']
        );

        $this->assertCount(
            1,
            $printedItem['addons']
        );

        $this->assertSame(
            'Egg',
            $printedItem['addons'][0]['name']
        );
        
        $this->assertSame(
            1.0,
            (float) $printedItem['addons'][0]['quantity']
        );

        $this->assertNotNull(
            $item
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'KITCHEN_PRINT_JOB_QUEUED',

                'entity_type' =>
                'kitchen_print_job',

                'entity_id' =>
                $job->id,

                'user_id' =>
                $this->cashier->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Additional Order
    |--------------------------------------------------------------------------
    */

    public function test_additional_kitchen_send_creates_additional_order_kot_for_only_new_items(): void
    {
        $order =
            $this->createOrder(
                source: Order::SOURCE_WAITER
            );

        $originalItem =
            $this->addItem(
                order: $order,
                name: 'Chicken Kottu'
            );

        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->cashier
            );

        $firstSend =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        $this->assertSame(
            [
                $originalItem->id,
            ],
            $firstSend['affected_item_ids']
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );

        $firstJob =
            KitchenPrintJob::query()
            ->firstOrFail();

        $this->assertSame(
            KitchenPrintJob::TYPE_INITIAL_ORDER,
            $firstJob->job_type
        );

        /*
         * New items are added after the original
         * kitchen ticket has already been created.
         */
        $additionalItem =
            $this->addItem(
                order: $order,
                name: 'Coca Cola',
                quantity: 2,
                price: 350.00,
                notes: 'Serve cold'
            );

        $this->lifecycle
            ->reopenForAdditionalItems(
                order: $order,
                actor: $this->cashier,
                source: Order::SOURCE_WAITER
            );

        $this->assertSame(
            Order::STATUS_CONFIRMED,
            $order->fresh()->status
        );

        $secondSend =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        $this->assertSame(
            [
                $additionalItem->id,
            ],
            $secondSend['affected_item_ids']
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            2
        );

        /** @var KitchenPrintJob $additionalJob */
        $additionalJob =
            KitchenPrintJob::query()
            ->where(
                'job_type',
                KitchenPrintJob::TYPE_ADDITIONAL_ORDER
            )
            ->firstOrFail();

        $this->assertSame(
            '*** ADDITIONAL ORDER ***',
            $additionalJob
                ->payload['heading']
        );

        $this->assertCount(
            1,
            $additionalJob
                ->payload['items']
        );

        $this->assertSame(
            $additionalItem->id,
            $additionalJob
                ->payload['items'][0]['id']
        );

        $this->assertSame(
            'Coca Cola',
            $additionalJob
                ->payload['items'][0]['name']
        );

        /*
         * The original item must NOT appear
         * on the additional KOT.
         */
        $additionalIds =
            collect(
                $additionalJob
                    ->payload['items']
            )
            ->pluck(
                'id'
            )
            ->all();

        $this->assertNotContains(
            $originalItem->id,
            $additionalIds
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Duplicate Prevention
    |--------------------------------------------------------------------------
    */

    public function test_repeated_kitchen_send_does_not_create_duplicate_print_job(): void
    {
        $order =
            $this->createOrder();

        $item =
            $this->addItem(
                order: $order,
                name: 'Seafood Fried Rice'
            );

        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->cashier
            );

        $first =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        $this->assertTrue(
            $first['changed']
        );

        $this->assertSame(
            [
                $item->id,
            ],
            $first['affected_item_ids']
        );

        $job =
            KitchenPrintJob::query()
            ->firstOrFail();

        $firstIdempotencyKey =
            $job->idempotency_key;

        /*
         * Simulates a repeated Send to Kitchen
         * request after the same items are
         * already sent.
         */
        $second =
            $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        $this->assertFalse(
            $second['changed']
        );

        $this->assertSame(
            [],
            $second['affected_item_ids']
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );

        $this->assertSame(
            $firstIdempotencyKey,
            KitchenPrintJob::query()
                ->firstOrFail()
                ->idempotency_key
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cancel Before Kitchen
    |--------------------------------------------------------------------------
    */

    public function test_order_cancelled_before_kitchen_send_does_not_create_cancellation_kot(): void
    {
        $order =
            $this->createOrder();

        $item =
            $this->addItem(
                order: $order,
                name: 'Chicken Burger'
            );

        $result =
            $this->lifecycle
            ->cancel(
                order: $order,
                actor: $this->cashier,
                reason: 'Customer changed their mind.'
            );

        $this->assertTrue(
            $result['changed']
        );

        $this->assertSame(
            [],
            $result['affected_item_ids']
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            0
        );

        $this->assertNull(
            $item
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertSame(
            OrderItem::STATUS_CANCELLED,
            $item
                ->fresh()
                ->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cancel After Kitchen
    |--------------------------------------------------------------------------
    */

    public function test_order_cancelled_after_kitchen_send_creates_cancellation_kot_for_sent_items(): void
    {
        $order =
            $this->createOrder();

        $item =
            $this->addItem(
                order: $order,
                name: 'Chicken Fried Rice',
                variant: 'Large',
                quantity: 1,
                price: 1250.00,
                notes: 'Extra spicy'
            );

        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->cashier
            );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );

        $reason =
            'Customer requested cancellation.';

        $cancelResult =
            $this->lifecycle
            ->cancel(
                order: $order,
                actor: $this->cashier,
                reason: $reason
            );

        $this->assertTrue(
            $cancelResult['changed']
        );

        $this->assertSame(
            [
                $item->id,
            ],
            $cancelResult['affected_item_ids']
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            2
        );

        /** @var KitchenPrintJob $job */
        $job =
            KitchenPrintJob::query()
            ->where(
                'job_type',
                KitchenPrintJob::TYPE_CANCELLATION
            )
            ->firstOrFail();

        $this->assertSame(
            KitchenPrintJob::STATUS_PENDING,
            $job->status
        );

        $this->assertSame(
            '*** CANCEL ITEM ***',
            $job
                ->payload['heading']
        );

        $this->assertSame(
            $reason,
            $job
                ->payload['cancellation_reason']
        );

        $this->assertCount(
            1,
            $job
                ->payload['items']
        );

        $this->assertSame(
            $item->id,
            $job
                ->payload['items'][0]['id']
        );

        $this->assertSame(
            'Chicken Fried Rice',
            $job
                ->payload['items'][0]['name']
        );

        /*
         * sent_to_kitchen_at remains preserved.
         */
        $this->assertNotNull(
            $item
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertSame(
            OrderItem::STATUS_CANCELLED,
            $item
                ->fresh()
                ->status
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Claim + Printed
    |--------------------------------------------------------------------------
    */

    public function test_authorized_worker_can_claim_and_mark_job_as_printed(): void
    {
        $job =
            $this->createPendingKitchenJob();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $response =
            $this->postJson(
                '/api/v1/kitchen/print-jobs/claim-next',
                [
                    'printer_name' =>
                    'Kitchen Printer',

                    'printer_address' =>
                    '192.168.1.150:9100',
                ]
            );

        $response
            ->assertOk()
            ->assertJsonPath(
                'success',
                true
            )
            ->assertJsonPath(
                'data.id',
                $job->id
            )
            ->assertJsonPath(
                'data.status',
                KitchenPrintJob::STATUS_PROCESSING
            )
            ->assertJsonPath(
                'data.attempts',
                1
            )
            ->assertJsonPath(
                'data.printer_name',
                'Kitchen Printer'
            )
            ->assertJsonPath(
                'data.printer_address',
                '192.168.1.150:9100'
            );

        $this->assertSame(
            KitchenPrintJob::STATUS_PROCESSING,
            $job
                ->fresh()
                ->status
        );

        $this->assertSame(
            1,
            $job
                ->fresh()
                ->attempts
        );

        $this
            ->postJson(
                "/api/v1/kitchen/print-jobs/{$job->id}/printed"
            )
            ->assertOk()
            ->assertJsonPath(
                'success',
                true
            )
            ->assertJsonPath(
                'data.status',
                KitchenPrintJob::STATUS_PRINTED
            );

        $fresh =
            $job->fresh();

        $this->assertSame(
            KitchenPrintJob::STATUS_PRINTED,
            $fresh->status
        );

        $this->assertNotNull(
            $fresh->printed_at
        );

        $this->assertNull(
            $fresh->last_error
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'KITCHEN_PRINT_JOB_CLAIMED',

                'entity_type' =>
                'kitchen_print_job',

                'entity_id' =>
                $job->id,
            ]
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'KITCHEN_PRINT_JOB_PRINTED',

                'entity_type' =>
                'kitchen_print_job',

                'entity_id' =>
                $job->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Failure + Retry
    |--------------------------------------------------------------------------
    */

    public function test_failed_job_can_be_retried_and_attempt_count_increases_on_next_claim(): void
    {
        $job =
            $this->createPendingKitchenJob();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this
            ->postJson(
                '/api/v1/kitchen/print-jobs/claim-next',
                [
                    'printer_name' =>
                    'Kitchen Printer',

                    'printer_address' =>
                    '192.168.1.150:9100',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                KitchenPrintJob::STATUS_PROCESSING
            )
            ->assertJsonPath(
                'data.attempts',
                1
            );

        $printerError =
            'connect ECONNREFUSED 192.168.1.150:9100';

        $this
            ->postJson(
                "/api/v1/kitchen/print-jobs/{$job->id}/failed",
                [
                    'error' =>
                    $printerError,
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                KitchenPrintJob::STATUS_FAILED
            )
            ->assertJsonPath(
                'data.last_error',
                $printerError
            );

        $fresh =
            $job->fresh();

        $this->assertSame(
            KitchenPrintJob::STATUS_FAILED,
            $fresh->status
        );

        $this->assertSame(
            1,
            $fresh->attempts
        );

        $this->assertSame(
            $printerError,
            $fresh->last_error
        );

        /*
         * Manual retry returns the same logical
         * print job to PENDING.
         */
        $this
            ->postJson(
                "/api/v1/kitchen/print-jobs/{$job->id}/retry"
            )
            ->assertOk()
            ->assertJsonPath(
                'data.id',
                $job->id
            )
            ->assertJsonPath(
                'data.status',
                KitchenPrintJob::STATUS_PENDING
            );

        $fresh =
            $job->fresh();

        $this->assertSame(
            KitchenPrintJob::STATUS_PENDING,
            $fresh->status
        );

        $this->assertSame(
            1,
            $fresh->attempts
        );

        $this->assertNull(
            $fresh->last_error
        );

        /*
         * Worker claims the same job again.
         * Attempts now becomes 2.
         */
        $this
            ->postJson(
                '/api/v1/kitchen/print-jobs/claim-next',
                [
                    'printer_name' =>
                    'Kitchen Printer',

                    'printer_address' =>
                    '192.168.1.150:9100',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'data.id',
                $job->id
            )
            ->assertJsonPath(
                'data.status',
                KitchenPrintJob::STATUS_PROCESSING
            )
            ->assertJsonPath(
                'data.attempts',
                2
            );

        $this->assertSame(
            2,
            $job
                ->fresh()
                ->attempts
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            1
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Reprint
    |--------------------------------------------------------------------------
    */

    public function test_printed_job_can_be_reprinted_as_separate_job(): void
    {
        $original =
            $this->createPendingKitchenJob();

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this
            ->postJson(
                '/api/v1/kitchen/print-jobs/claim-next'
            )
            ->assertOk();

        $this
            ->postJson(
                "/api/v1/kitchen/print-jobs/{$original->id}/printed"
            )
            ->assertOk();

        $this->assertSame(
            KitchenPrintJob::STATUS_PRINTED,
            $original
                ->fresh()
                ->status
        );

        $response =
            $this->postJson(
                "/api/v1/kitchen/print-jobs/{$original->id}/reprint"
            );

        $response
            ->assertOk()
            ->assertJsonPath(
                'success',
                true
            )
            ->assertJsonPath(
                'data.job_type',
                KitchenPrintJob::TYPE_REPRINT
            )
            ->assertJsonPath(
                'data.status',
                KitchenPrintJob::STATUS_PENDING
            );

        $reprintId =
            $response
            ->json(
                'data.id'
            );

        $this->assertNotSame(
            $original->id,
            $reprintId
        );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            2
        );

        /** @var KitchenPrintJob $reprint */
        $reprint =
            KitchenPrintJob::query()
            ->findOrFail(
                $reprintId
            );

        $this->assertSame(
            KitchenPrintJob::TYPE_REPRINT,
            $reprint->job_type
        );

        $this->assertTrue(
            $reprint
                ->payload['reprint']
        );

        $this->assertSame(
            $original->id,
            $reprint
                ->payload['reprint_of_job_id']
        );

        $this->assertSame(
            $original->job_number,
            $reprint
                ->payload['reprint_of_job_number']
        );

        /*
         * Original document type is preserved
         * inside the payload.
         */
        $this->assertSame(
            KitchenPrintJob::TYPE_INITIAL_ORDER,
            $reprint
                ->payload['document_type']
        );

        /*
         * Original successful print stays untouched.
         */
        $this->assertSame(
            KitchenPrintJob::STATUS_PRINTED,
            $original
                ->fresh()
                ->status
        );

        $this->assertDatabaseHas(
            'audit_logs',
            [
                'action' =>
                'KITCHEN_PRINT_JOB_REPRINT_REQUESTED',

                'entity_type' =>
                'kitchen_print_job',

                'entity_id' =>
                $reprint->id,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Print Job History
    |--------------------------------------------------------------------------
    */

    public function test_kitchen_print_history_can_be_filtered(): void
    {
        $order =
            $this->createOrder(
                source: Order::SOURCE_WAITER
            );

        $first =
            $this->addItem(
                order: $order,
                name: 'Original Item'
            );

        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->cashier
            );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        $second =
            $this->addItem(
                order: $order,
                name: 'Additional Item'
            );

        $this->lifecycle
            ->reopenForAdditionalItems(
                order: $order,
                actor: $this->cashier,
                source: Order::SOURCE_WAITER
            );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        $this->assertDatabaseCount(
            'kitchen_print_jobs',
            2
        );

        $this->assertNotNull(
            $first
                ->fresh()
                ->sent_to_kitchen_at
        );

        $this->assertNotNull(
            $second
                ->fresh()
                ->sent_to_kitchen_at
        );

        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this
            ->getJson(
                '/api/v1/kitchen/print-jobs'
                    .
                    '?job_type='
                    .
                    KitchenPrintJob::TYPE_ADDITIONAL_ORDER
            )
            ->assertOk()
            ->assertJsonPath(
                'success',
                true
            )
            ->assertJsonCount(
                1,
                'data'
            )
            ->assertJsonPath(
                'data.0.job_type',
                KitchenPrintJob::TYPE_ADDITIONAL_ORDER
            )
            ->assertJsonPath(
                'meta.pagination.total',
                1
            );

        $this
            ->getJson(
                '/api/v1/kitchen/print-jobs'
                    .
                    '?status='
                    .
                    KitchenPrintJob::STATUS_PENDING
            )
            ->assertOk()
            ->assertJsonCount(
                2,
                'data'
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Permissions
    |--------------------------------------------------------------------------
    */

    public function test_kitchen_print_routes_enforce_required_permissions(): void
    {
        $job =
            $this->createPendingKitchenJob();

        $limitedUser =
            $this->createUserWithPermissions(
                roleCode: 'LIMITED',

                permissions: [
                    'orders.view',
                ]
            );

        Sanctum::actingAs(
            $limitedUser,
            ['*']
        );

        /*
         * No kitchen.reprint permission.
         */
        $this
            ->getJson(
                '/api/v1/kitchen/print-jobs'
            )
            ->assertForbidden();

        /*
         * No orders.send_kitchen permission.
         */
        $this
            ->postJson(
                '/api/v1/kitchen/print-jobs/claim-next'
            )
            ->assertForbidden();

        $this
            ->postJson(
                "/api/v1/kitchen/print-jobs/{$job->id}/printed"
            )
            ->assertForbidden();

        $this
            ->postJson(
                "/api/v1/kitchen/print-jobs/{$job->id}/failed",
                [
                    'error' =>
                    'Printer offline.',
                ]
            )
            ->assertForbidden();

        /*
         * No kitchen.reprint permission.
         */
        $this
            ->postJson(
                "/api/v1/kitchen/print-jobs/{$job->id}/retry"
            )
            ->assertForbidden();

        $this
            ->postJson(
                "/api/v1/kitchen/print-jobs/{$job->id}/reprint"
            )
            ->assertForbidden();

        /*
         * Middleware must leave the pending
         * job completely untouched.
         */
        $fresh =
            $job->fresh();

        $this->assertSame(
            KitchenPrintJob::STATUS_PENDING,
            $fresh->status
        );

        $this->assertSame(
            0,
            $fresh->attempts
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Empty Queue
    |--------------------------------------------------------------------------
    */

    public function test_claim_next_returns_null_when_print_queue_is_empty(): void
    {
        Sanctum::actingAs(
            $this->cashier,
            ['*']
        );

        $this
            ->postJson(
                '/api/v1/kitchen/print-jobs/claim-next',
                [
                    'printer_name' =>
                    'Kitchen Printer',

                    'printer_address' =>
                    '192.168.1.150:9100',
                ]
            )
            ->assertOk()
            ->assertJsonPath(
                'success',
                true
            )
            ->assertJsonPath(
                'data',
                null
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function createPendingKitchenJob(): KitchenPrintJob
    {
        $order =
            $this->createOrder();

        $this->addItem(
            order: $order,
            name: 'Kitchen Print Test Item'
        );

        $this->lifecycle
            ->confirm(
                order: $order,
                actor: $this->cashier
            );

        $this->lifecycle
            ->sendToKitchen(
                order: $order,
                actor: $this->cashier
            );

        return KitchenPrintJob::query()
            ->where(
                'order_id',
                $order->id
            )
            ->where(
                'job_type',
                KitchenPrintJob::TYPE_INITIAL_ORDER
            )
            ->firstOrFail();
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
                "{$roleCode} test role.",

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
                    $group =
                        str_starts_with(
                            $code,
                            'kitchen.'
                        )
                        ? 'Kitchen'
                        : 'Orders';

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
                                $group,

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
                "{$roleCode} Test User",

                'username' =>
                strtolower(
                    $roleCode
                )
                    .
                    '_'
                    .
                    Str::lower(
                        Str::random(
                            8
                        )
                    ),

                'email' =>
                Str::lower(
                    Str::random(
                        12
                    )
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

    private function createOrder(
        string $source =
        Order::SOURCE_QR_CUSTOMER
    ): Order {
        $sequence =
            Order::query()
            ->where(
                'table_session_id',
                $this
                    ->tableSession
                    ->id
            )
            ->count()
            + 1;

        return Order::query()
            ->create([
                'order_number' =>
                'ORD-P22-' .
                    Str::upper(
                        (string)
                        Str::ulid()
                    ),

                'business_day_id' =>
                $this->businessDay->id,

                'table_session_id' =>
                $this->tableSession->id,

                'table_id' =>
                $this->table->id,

                'order_type' =>
                Order::TYPE_DINE_IN,

                'order_source' =>
                $source,

                'session_sequence' =>
                $sequence,

                'table_name_snapshot' =>
                $this->table->name,

                'customer_name' =>
                null,

                'customer_phone' =>
                null,

                'status' =>
                Order::STATUS_PENDING,

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

                'customer_notes' =>
                null,

                'internal_notes' =>
                null,

                'created_by' =>
                $source
                    === Order::SOURCE_QR_CUSTOMER
                    ? null
                    : $this->cashier->id,
            ]);
    }

    private function addItem(
        Order $order,
        string $name =
        'Test Kitchen Item',
        ?string $variant = null,
        float $quantity = 1,
        float $price = 100.00,
        ?string $notes = null
    ): OrderItem {
        $lineTotal =
            round(
                $price
                    *
                    $quantity,
                2
            );

        $item =
            OrderItem::query()
            ->create([
                'order_id' =>
                $order->id,

                'menu_item_id' =>
                null,

                'menu_item_variant_id' =>
                null,

                'item_name_snapshot' =>
                $name,

                'variant_name_snapshot' =>
                $variant,

                'quantity' =>
                $quantity,

                'unit_price' =>
                $price,

                'gross_total' =>
                $lineTotal,

                'discount_total' =>
                0,

                'tax_total' =>
                0,

                'line_total' =>
                $lineTotal,

                'estimated_unit_cost' =>
                0,

                'estimated_cost_total' =>
                0,

                'status' =>
                OrderItem::STATUS_ACTIVE,

                'special_notes' =>
                $notes,

                'sent_to_kitchen_at' =>
                null,

                'cancelled_at' =>
                null,
            ]);

        $freshOrder =
            $order->fresh();

        $subtotal =
            round(
                (float)
                $freshOrder->subtotal
                    +
                    $lineTotal,
                2
            );

        $freshOrder
            ->update([
                'subtotal' =>
                $subtotal,

                'grand_total' =>
                $subtotal,
            ]);

        return $item;
    }

    private function addAddon(
        OrderItem $item,
        string $name,
        float $quantity = 1
    ): int {
        return (int)
        DB::table(
            'order_item_addons'
        )
            ->insertGetId([
                'order_item_id' =>
                $item->id,

                'addon_id' =>
                null,

                'addon_name_snapshot' =>
                $name,

                'quantity' =>
                $quantity,

                'unit_price' =>
                0,

                'line_total' =>
                0,

                'estimated_cost_total' =>
                0,

                'created_at' =>
                now(),

                'updated_at' =>
                now(),
            ]);
    }
}
