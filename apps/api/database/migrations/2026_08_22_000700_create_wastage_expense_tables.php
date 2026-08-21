<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'wastages',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'wastage_number',
                    50
                )->unique();

                $table->foreignId('business_day_id')
                    ->constrained('business_days')
                    ->restrictOnDelete();

                /*
                 * INGREDIENT
                 * PREPARED_ITEM
                 */
                $table->string(
                    'wastage_type',
                    30
                );

                $table->foreignId('ingredient_id')
                    ->nullable()
                    ->constrained('ingredients')
                    ->nullOnDelete();

                $table->foreignId('menu_item_id')
                    ->nullable()
                    ->constrained('menu_items')
                    ->nullOnDelete();

                $table->foreignId('unit_id')
                    ->nullable()
                    ->constrained('units')
                    ->nullOnDelete();

                $table->decimal(
                    'quantity',
                    18,
                    4
                );

                $table->decimal(
                    'base_quantity',
                    18,
                    4
                )->nullable();

                /*
                 * EXPIRED
                 * SPOILED
                 * DAMAGED
                 * COOKING_ERROR
                 * DROPPED
                 * OVERPRODUCTION
                 * STAFF_MEAL
                 * OTHER
                 */
                $table->string(
                    'reason_code',
                    50
                )->index();

                $table->string(
                    'reason',
                    255
                )->nullable();

                $table->decimal(
                    'estimated_cost',
                    15,
                    2
                )->default(0);

                $table->string('status', 30)
                    ->default('POSTED')
                    ->index();

                $table->foreignId('created_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->timestamp('wasted_at');

                $table->timestamps();
            }
        );

        Schema::create(
            'expense_categories',
            function (Blueprint $table) {
                $table->id();

                $table->string('name', 150);

                $table->string('code', 80)
                    ->unique();

                $table->boolean('is_active')
                    ->default(true);

                $table->timestamps();
            }
        );

        Schema::create(
            'expenses',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'expense_number',
                    50
                )->unique();

                $table->foreignId(
                    'expense_category_id'
                )
                    ->constrained(
                        'expense_categories'
                    )
                    ->restrictOnDelete();

                $table->foreignId('business_day_id')
                    ->constrained('business_days')
                    ->restrictOnDelete();

                $table->foreignId('cashier_shift_id')
                    ->nullable()
                    ->constrained('cashier_shifts')
                    ->nullOnDelete();

                $table->string(
                    'description',
                    255
                );

                $table->decimal(
                    'amount',
                    15,
                    2
                );

                $table->string(
                    'payment_method',
                    40
                );

                $table->string(
                    'reference_number',
                    150
                )->nullable();

                $table->string(
                    'receipt_path'
                )->nullable();

                $table->string('status', 30)
                    ->default('POSTED')
                    ->index();

                $table->date('expense_date');

                $table->foreignId('created_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('expense_categories');
        Schema::dropIfExists('wastages');
    }
};
