<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'cashier_shifts',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'shift_number',
                    50
                )->unique();

                $table->foreignId('business_day_id')
                    ->constrained('business_days')
                    ->restrictOnDelete();

                $table->foreignId('cashier_id')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->decimal(
                    'opening_float',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'expected_cash',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'actual_cash',
                    15,
                    2
                )->nullable();

                $table->decimal(
                    'cash_difference',
                    15,
                    2
                )->nullable();

                $table->string('status', 20)
                    ->default('OPEN')
                    ->index();

                $table->timestamp('opened_at');

                $table->timestamp('closed_at')
                    ->nullable();

                $table->foreignId('closed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->text('opening_notes')
                    ->nullable();

                $table->text('closing_notes')
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'cash_drawer_movements',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('cashier_shift_id')
                    ->constrained('cashier_shifts')
                    ->restrictOnDelete();

                /*
                 * OPENING_FLOAT
                 * CASH_SALE
                 * CASH_REFUND
                 * CASH_IN
                 * CASH_OUT
                 * MANUAL_OPEN
                 */
                $table->string(
                    'movement_type',
                    40
                )->index();

                $table->decimal(
                    'amount',
                    15,
                    2
                )->default(0);

                $table->string(
                    'reference_type',
                    80
                )->nullable();

                $table->unsignedBigInteger(
                    'reference_id'
                )->nullable();

                $table->string('reason', 255)
                    ->nullable();

                $table->foreignId('created_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->timestamp('occurred_at');

                $table->timestamps();

                $table->index([
                    'reference_type',
                    'reference_id',
                ]);
            }
        );

        Schema::create(
            'invoices',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'invoice_number',
                    50
                )->unique();

                $table->foreignId('business_day_id')
                    ->constrained('business_days')
                    ->restrictOnDelete();

                $table->foreignId('cashier_shift_id')
                    ->nullable()
                    ->constrained('cashier_shifts')
                    ->nullOnDelete();

                $table->foreignId('table_session_id')
                    ->nullable()
                    ->constrained('table_sessions')
                    ->nullOnDelete();

                $table->foreignId('order_id')
                    ->nullable()
                    ->constrained('orders')
                    ->nullOnDelete();

                $table->string(
                    'invoice_type',
                    30
                )->default('SALE');

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

                $table->decimal(
                    'subtotal',
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
                    'service_charge_total',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'grand_total',
                    15,
                    2
                );

                $table->decimal(
                    'estimated_cost_total',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'paid_amount',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'change_amount',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'balance_due',
                    15,
                    2
                )->default(0);

                $table->string(
                    'payment_status',
                    30
                )->default('UNPAID')
                    ->index();

                $table->string('status', 30)
                    ->default('ISSUED')
                    ->index();

                $table->foreignId('issued_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->timestamp('issued_at');

                $table->timestamp('voided_at')
                    ->nullable();

                $table->foreignId('voided_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->text('void_reason')
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'invoice_items',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('invoice_id')
                    ->constrained('invoices')
                    ->cascadeOnDelete();

                $table->foreignId('order_item_id')
                    ->nullable()
                    ->constrained('order_items')
                    ->nullOnDelete();

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
                    'unit_cost_snapshot',
                    15,
                    4
                )->default(0);

                $table->decimal(
                    'cost_total_snapshot',
                    15,
                    2
                )->default(0);

                $table->json(
                    'addons_snapshot'
                )->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'payments',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'payment_number',
                    50
                )->unique();

                $table->foreignId('invoice_id')
                    ->constrained('invoices')
                    ->restrictOnDelete();

                $table->foreignId('cashier_shift_id')
                    ->nullable()
                    ->constrained('cashier_shifts')
                    ->nullOnDelete();

                /*
                 * CASH
                 * CARD
                 * QR
                 * BANK
                 * OTHER
                 */
                $table->string(
                    'payment_method',
                    30
                )->index();

                $table->decimal(
                    'amount',
                    15,
                    2
                );

                $table->decimal(
                    'tendered_amount',
                    15,
                    2
                )->nullable();

                $table->decimal(
                    'change_given',
                    15,
                    2
                )->default(0);

                $table->string(
                    'reference_number',
                    150
                )->nullable();

                $table->string('status', 30)
                    ->default('COMPLETED')
                    ->index();

                $table->foreignId('received_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->timestamp('paid_at');

                $table->text('notes')
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'refunds',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'refund_number',
                    50
                )->unique();

                $table->foreignId('invoice_id')
                    ->constrained('invoices')
                    ->restrictOnDelete();

                $table->foreignId('payment_id')
                    ->nullable()
                    ->constrained('payments')
                    ->nullOnDelete();

                $table->foreignId('business_day_id')
                    ->constrained('business_days')
                    ->restrictOnDelete();

                $table->foreignId('cashier_shift_id')
                    ->nullable()
                    ->constrained('cashier_shifts')
                    ->nullOnDelete();

                $table->decimal(
                    'amount',
                    15,
                    2
                );

                $table->string(
                    'refund_method',
                    30
                );

                $table->string('status', 30)
                    ->default('COMPLETED');

                $table->text('reason');

                $table->json('details')
                    ->nullable();

                $table->foreignId('processed_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->timestamp('refunded_at');

                $table->timestamps();
            }
        );

        Schema::create(
            'business_day_closings',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('business_day_id')
                    ->unique()
                    ->constrained('business_days')
                    ->restrictOnDelete();

                $table->decimal(
                    'total_sales',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'total_discounts',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'total_refunds',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'cash_sales',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'card_sales',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'qr_sales',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'bank_sales',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'other_sales',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'total_cogs',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'gross_profit',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'total_expenses',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'total_wastage_cost',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'estimated_net_profit',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'total_purchases',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'supplier_payments',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'expected_cash',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'actual_cash',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'cash_difference',
                    15,
                    2
                )->default(0);

                $table->json(
                    'snapshot'
                )->nullable();

                $table->foreignId('closed_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->timestamp('closed_at');

                $table->timestamps();
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'business_day_closings'
        );

        Schema::dropIfExists('refunds');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('cash_drawer_movements');
        Schema::dropIfExists('cashier_shifts');
    }
};
