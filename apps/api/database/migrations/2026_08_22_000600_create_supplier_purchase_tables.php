<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'suppliers',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'supplier_code',
                    50
                )->unique();

                $table->string('name', 190);

                $table->string(
                    'contact_person',
                    150
                )->nullable();

                $table->string('phone', 50)
                    ->nullable();

                $table->string('email', 190)
                    ->nullable();

                $table->text('address')
                    ->nullable();

                $table->string(
                    'tax_number',
                    100
                )->nullable();

                $table->decimal(
                    'current_balance',
                    15,
                    2
                )->default(0);

                $table->boolean('is_active')
                    ->default(true)
                    ->index();

                $table->text('notes')
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'purchases',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'purchase_number',
                    50
                )->unique();

                $table->foreignId('supplier_id')
                    ->constrained('suppliers')
                    ->restrictOnDelete();

                $table->foreignId('business_day_id')
                    ->constrained('business_days')
                    ->restrictOnDelete();

                $table->string(
                    'supplier_invoice_number',
                    100
                )->nullable();

                $table->date('purchase_date');

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
                    'grand_total',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'paid_amount',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'outstanding_amount',
                    15,
                    2
                )->default(0);

                /*
                 * DRAFT
                 * POSTED
                 * PARTIALLY_PAID
                 * PAID
                 * CANCELLED
                 */
                $table->string('status', 30)
                    ->default('DRAFT')
                    ->index();

                $table->foreignId('created_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->foreignId('posted_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('posted_at')
                    ->nullable();

                $table->text('notes')
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'purchase_items',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('purchase_id')
                    ->constrained('purchases')
                    ->cascadeOnDelete();

                $table->foreignId('ingredient_id')
                    ->constrained('ingredients')
                    ->restrictOnDelete();

                $table->foreignId('unit_id')
                    ->constrained('units')
                    ->restrictOnDelete();

                $table->decimal(
                    'quantity',
                    18,
                    4
                );

                /*
                 * Quantity converted to
                 * ingredient base unit.
                 */
                $table->decimal(
                    'base_quantity',
                    18,
                    4
                );

                $table->decimal(
                    'unit_cost',
                    18,
                    6
                );

                $table->decimal(
                    'line_total',
                    15,
                    2
                );

                $table->string(
                    'batch_number',
                    100
                )->nullable();

                $table->date('manufactured_date')
                    ->nullable();

                $table->date('expiry_date')
                    ->nullable();

                $table->text('notes')
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'supplier_payments',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'payment_number',
                    50
                )->unique();

                $table->foreignId('supplier_id')
                    ->constrained('suppliers')
                    ->restrictOnDelete();

                $table->foreignId('purchase_id')
                    ->nullable()
                    ->constrained('purchases')
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

                /*
                 * CASH
                 * BANK_TRANSFER
                 * CARD
                 * CHEQUE
                 * OTHER
                 */
                $table->string(
                    'payment_method',
                    40
                );

                $table->string(
                    'reference_number',
                    150
                )->nullable();

                $table->date('payment_date');

                $table->foreignId('created_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->text('notes')
                    ->nullable();

                $table->timestamps();

                $table->index([
                    'supplier_id',
                    'payment_date',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_payments');
        Schema::dropIfExists('purchase_items');
        Schema::dropIfExists('purchases');
        Schema::dropIfExists('suppliers');
    }
};
