<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->id();

            $table->string('name', 100);
            $table->string('symbol', 30)->unique();

            $table->string(
                'measurement_type',
                30
            )->index();

            $table->unsignedBigInteger(
                'base_unit_id'
            )->nullable();

            $table->decimal(
                'conversion_factor',
                18,
                6
            )->default(1);

            $table->boolean('is_active')
                ->default(true);

            $table->timestamps();
        });

        Schema::table('units', function (Blueprint $table) {
            $table->foreign('base_unit_id')
                ->references('id')
                ->on('units')
                ->nullOnDelete();
        });

        Schema::create(
            'ingredients',
            function (Blueprint $table) {
                $table->id();

                $table->string('sku', 100)
                    ->nullable()
                    ->unique();

                $table->string('name', 190);

                $table->foreignId('base_unit_id')
                    ->constrained('units')
                    ->restrictOnDelete();

                $table->decimal(
                    'current_stock',
                    18,
                    4
                )->default(0);

                $table->decimal(
                    'reorder_level',
                    18,
                    4
                )->default(0);

                $table->decimal(
                    'average_cost_per_base_unit',
                    18,
                    6
                )->default(0);

                $table->boolean('track_stock')
                    ->default(true);

                $table->boolean('is_active')
                    ->default(true);

                $table->string('storage_location', 150)
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'stock_adjustments',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'adjustment_number',
                    50
                )->unique();

                $table->foreignId('business_day_id')
                    ->constrained('business_days')
                    ->restrictOnDelete();

                $table->foreignId('ingredient_id')
                    ->constrained('ingredients')
                    ->restrictOnDelete();

                $table->foreignId('unit_id')
                    ->constrained('units')
                    ->restrictOnDelete();

                $table->string('direction', 20);

                $table->decimal(
                    'quantity',
                    18,
                    4
                );

                $table->decimal(
                    'base_quantity',
                    18,
                    4
                );

                $table->decimal(
                    'unit_cost',
                    18,
                    6
                )->nullable();

                $table->string('reason', 255);

                $table->string('status', 30)
                    ->default('DRAFT')
                    ->index();

                $table->foreignId('created_by')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('posted_at')
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'recipes',
            function (Blueprint $table) {
                $table->id();

                /*
                 * recipeable_type:
                 * menu_item
                 * menu_item_variant
                 * addon
                 */
                $table->string(
                    'recipeable_type',
                    50
                );

                $table->unsignedBigInteger(
                    'recipeable_id'
                );

                $table->unsignedInteger('version')
                    ->default(1);

                $table->decimal(
                    'yield_quantity',
                    18,
                    4
                )->default(1);

                $table->boolean('is_active')
                    ->default(true);

                $table->text('notes')
                    ->nullable();

                $table->timestamps();

                $table->index([
                    'recipeable_type',
                    'recipeable_id',
                ]);

                $table->unique(
                    [
                        'recipeable_type',
                        'recipeable_id',
                        'version',
                    ],
                    'recipes_target_version_unique'
                );
            }
        );

        Schema::create(
            'recipe_items',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('recipe_id')
                    ->constrained('recipes')
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

                $table->decimal(
                    'base_quantity',
                    18,
                    4
                );

                $table->decimal(
                    'waste_percentage',
                    8,
                    4
                )->default(0);

                $table->timestamps();

                $table->unique([
                    'recipe_id',
                    'ingredient_id',
                ]);
            }
        );

        Schema::create(
            'stock_movements',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('ingredient_id')
                    ->constrained('ingredients')
                    ->restrictOnDelete();

                $table->foreignId('business_day_id')
                    ->nullable()
                    ->constrained('business_days')
                    ->nullOnDelete();

                /*
                 * OPENING_BALANCE
                 * PURCHASE
                 * SALE_CONSUMPTION
                 * WASTAGE
                 * ADJUSTMENT_IN
                 * ADJUSTMENT_OUT
                 * CANCELLATION_REVERSAL
                 */
                $table->string(
                    'movement_type',
                    50
                )->index();

                /*
                 * Signed base-unit quantity.
                 * +100 = stock in
                 * -100 = stock out
                 */
                $table->decimal(
                    'quantity_delta',
                    18,
                    4
                );

                $table->decimal(
                    'balance_after',
                    18,
                    4
                )->nullable();

                $table->decimal(
                    'unit_cost',
                    18,
                    6
                )->nullable();

                $table->decimal(
                    'total_cost',
                    18,
                    2
                )->nullable();

                $table->string(
                    'source_type',
                    80
                )->nullable();

                $table->unsignedBigInteger(
                    'source_id'
                )->nullable();

                $table->string('reference', 150)
                    ->nullable();

                $table->text('notes')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('occurred_at');

                $table->timestamps();

                $table->index([
                    'source_type',
                    'source_id',
                ]);

                $table->index([
                    'ingredient_id',
                    'occurred_at',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('recipe_items');
        Schema::dropIfExists('recipes');
        Schema::dropIfExists('stock_adjustments');
        Schema::dropIfExists('ingredients');
        Schema::dropIfExists('units');
    }
};
