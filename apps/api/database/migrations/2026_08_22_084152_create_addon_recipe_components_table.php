<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasColumn(
                'addons',
                'consumes_inventory'
            )
        ) {
            Schema::table(
                'addons',
                function (Blueprint $table): void {
                    $table->boolean(
                        'consumes_inventory'
                    )
                        ->default(false)
                        ->after('is_available');

                    $table->index(
                        'consumes_inventory'
                    );
                }
            );
        }

        if (
            ! Schema::hasTable(
                'addon_recipe_components'
            )
        ) {
            Schema::create(
                'addon_recipe_components',
                function (Blueprint $table): void {
                    $table->id();

                    $table->foreignId(
                        'addon_id'
                    )
                        ->constrained('addons')
                        ->cascadeOnDelete();

                    $table->foreignId(
                        'ingredient_id'
                    )
                        ->constrained('ingredients')
                        ->restrictOnDelete();

                    $table->decimal(
                        'quantity',
                        14,
                        4
                    );

                    $table->foreignId(
                        'unit_id'
                    )
                        ->constrained('units')
                        ->restrictOnDelete();

                    $table->timestamps();

                    /*
                     * One ingredient should appear
                     * only once inside an add-on recipe.
                     */
                    $table->unique(
                        [
                            'addon_id',
                            'ingredient_id',
                        ],
                        'addon_recipe_ingredient_unique'
                    );
                }
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'addon_recipe_components'
        );

        if (
            Schema::hasColumn(
                'addons',
                'consumes_inventory'
            )
        ) {
            Schema::table(
                'addons',
                function (Blueprint $table): void {
                    $table->dropIndex([
                        'consumes_inventory',
                    ]);

                    $table->dropColumn(
                        'consumes_inventory'
                    );
                }
            );
        }
    }
};
