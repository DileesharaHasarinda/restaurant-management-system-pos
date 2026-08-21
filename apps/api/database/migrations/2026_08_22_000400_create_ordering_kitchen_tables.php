<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();

            $table->string('order_number', 50)
                ->unique();

            $table->foreignId('business_day_id')
                ->constrained('business_days')
                ->restrictOnDelete();

            $table->foreignId('table_session_id')
                ->nullable()
                ->constrained('table_sessions')
                ->nullOnDelete();

            $table->foreignId('table_id')
                ->nullable()
                ->constrained('tables')
                ->nullOnDelete();

            /*
             * DINE_IN
             * TAKEAWAY
             */
            $table->string('order_type', 30)
                ->index();

            /*
             * QR_CUSTOMER
             * WAITER
             * CASHIER
             */
            $table->string('order_source', 30)
                ->index();

            $table->unsignedInteger(
                'session_sequence'
            )->nullable();

            $table->string(
                'table_name_snapshot',
                100
            )->nullable();

            $table->string(
                'customer_name',
                150
            )->nullable();

            $table->string(
                'customer_phone',
                50
            )->nullable();

            /*
             * PENDING
             * CONFIRMED
             * SENT_TO_KITCHEN
             * SERVED
             * COMPLETED
             * CANCELLED
             * REJECTED
             */
            $table->string('status', 40)
                ->default('PENDING')
                ->index();

            $table->decimal(
                'subtotal',
                15,
                2
            )->default(0);

            $table->decimal(
                'discount_total',
                15,
                2
            )->default(0);

            $table->decimal(
                'tax_total',
                15,
                2
            )->default(0);

            $table->decimal(
                'service_charge_total',
                15,
                2
            )->default(0);

            $table->decimal(
                'grand_total',
                15,
                2
            )->default(0);

            $table->decimal(
                'estimated_cost_total',
                15,
                2
            )->default(0);

            $table->text('customer_notes')
                ->nullable();

            $table->text('internal_notes')
                ->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('confirmed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('cancelled_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('confirmed_at')
                ->nullable();

            $table->timestamp('sent_to_kitchen_at')
                ->nullable();

            $table->timestamp('served_at')
                ->nullable();

            $table->timestamp('completed_at')
                ->nullable();

            $table->timestamp('cancelled_at')
                ->nullable();

            $table->text('cancellation_reason')
                ->nullable();

            $table->timestamps();

            $table->index([
                'table_session_id',
                'status',
            ]);

            $table->index([
                'business_day_id',
                'created_at',
            ]);
        });

        Schema::create(
            'order_items',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('order_id')
                    ->constrained('orders')
                    ->cascadeOnDelete();

                $table->foreignId('menu_item_id')
                    ->nullable()
                    ->constrained('menu_items')
                    ->nullOnDelete();

                $table->foreignId(
                    'menu_item_variant_id'
                )
                    ->nullable()
                    ->constrained(
                        'menu_item_variants'
                    )
                    ->nullOnDelete();

                /*
                 * Historical snapshot fields
                 */
                $table->string(
                    'item_name_snapshot',
                    190
                );

                $table->string(
                    'variant_name_snapshot',
                    150
                )->nullable();

                $table->decimal(
                    'quantity',
                    12,
                    3
                );

                $table->decimal(
                    'unit_price',
                    15,
                    2
                );

                $table->decimal(
                    'gross_total',
                    15,
                    2
                );

                $table->decimal(
                    'discount_total',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'tax_total',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'line_total',
                    15,
                    2
                );

                $table->decimal(
                    'estimated_unit_cost',
                    15,
                    4
                )->default(0);

                $table->decimal(
                    'estimated_cost_total',
                    15,
                    2
                )->default(0);

                $table->string('status', 30)
                    ->default('ACTIVE')
                    ->index();

                $table->text('special_notes')
                    ->nullable();

                $table->timestamp(
                    'sent_to_kitchen_at'
                )->nullable();

                $table->timestamp(
                    'cancelled_at'
                )->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'order_item_addons',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('order_item_id')
                    ->constrained('order_items')
                    ->cascadeOnDelete();

                $table->foreignId('addon_id')
                    ->nullable()
                    ->constrained('addons')
                    ->nullOnDelete();

                $table->string(
                    'addon_name_snapshot',
                    150
                );

                $table->decimal(
                    'quantity',
                    12,
                    3
                )->default(1);

                $table->decimal(
                    'unit_price',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'line_total',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'estimated_cost_total',
                    15,
                    2
                )->default(0);

                $table->timestamps();
            }
        );

        Schema::create(
            'order_status_histories',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('order_id')
                    ->constrained('orders')
                    ->cascadeOnDelete();

                $table->string(
                    'from_status',
                    40
                )->nullable();

                $table->string(
                    'to_status',
                    40
                );

                $table->foreignId('changed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->text('notes')
                    ->nullable();

                $table->timestamp('changed_at');

                $table->timestamps();

                $table->index([
                    'order_id',
                    'changed_at',
                ]);
            }
        );

        Schema::create(
            'kitchen_print_jobs',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'job_number',
                    60
                )->unique();

                $table->string(
                    'idempotency_key',
                    100
                )->unique();

                $table->foreignId('order_id')
                    ->constrained('orders')
                    ->restrictOnDelete();

                /*
                 * INITIAL_ORDER
                 * ADDITIONAL_ORDER
                 * CANCELLATION
                 * REPRINT
                 */
                $table->string('job_type', 40)
                    ->index();

                $table->string(
                    'printer_name',
                    190
                )->nullable();

                $table->string(
                    'printer_address',
                    190
                )->nullable();

                $table->json('payload');

                /*
                 * PENDING
                 * PROCESSING
                 * PRINTED
                 * FAILED
                 */
                $table->string('status', 30)
                    ->default('PENDING')
                    ->index();

                $table->unsignedInteger('attempts')
                    ->default(0);

                $table->text('last_error')
                    ->nullable();

                $table->foreignId('requested_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('queued_at');
                $table->timestamp('printed_at')
                    ->nullable();

                $table->timestamps();

                $table->index([
                    'status',
                    'queued_at',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('kitchen_print_jobs');
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('order_item_addons');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
