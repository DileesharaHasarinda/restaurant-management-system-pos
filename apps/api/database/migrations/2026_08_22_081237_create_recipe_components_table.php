<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'recipe_components',
            function (Blueprint $table): void {
                $table->id();

                /*
                 * The menu product this recipe belongs to.
                 *
                 * Example:
                 * Chicken Fried Rice
                 */
                $table->foreignId(
                    'menu_item_id'
                )
                    ->constrained(
                        'menu_items'
                    )
                    ->cascadeOnDelete();

                /*
                 * NULL:
                 * Base menu-item recipe.
                 *
                 * Not NULL:
                 * Variant-specific recipe such as
                 * Regular or Large.
                 */
                $table->foreignId(
                    'variant_id'
                )
                    ->nullable()
                    ->constrained(
                        'menu_item_variants'
                    )
                    ->cascadeOnDelete();

                /*
                 * Ingredient used by the recipe.
                 *
                 * Example:
                 * Rice, Chicken, Carrot, Oil.
                 */
                $table->foreignId(
                    'ingredient_id'
                )
                    ->constrained(
                        'ingredients'
                    )
                    ->restrictOnDelete();

                /*
                 * Recipe quantity in the selected unit.
                 *
                 * Examples:
                 * 250 G
                 * 0.25 KG
                 * 20 ML
                 * 1 PCS
                 */
                $table->decimal(
                    'quantity',
                    14,
                    4
                );

                /*
                 * Unit entered in the recipe.
                 *
                 * It does not have to be the
                 * ingredient's base unit because the
                 * UnitConversionService handles:
                 *
                 * KG -> G
                 * L  -> ML
                 */
                $table->foreignId(
                    'unit_id'
                )
                    ->constrained(
                        'units'
                    )
                    ->restrictOnDelete();

                $table->timestamps();

                /*
                 * Helpful indexes for retrieving
                 * base and variant recipes.
                 */
                $table->index(
                    [
                        'menu_item_id',
                        'variant_id',
                    ],
                    'recipe_components_recipe_idx'
                );

                $table->index(
                    [
                        'ingredient_id',
                        'menu_item_id',
                    ],
                    'recipe_components_ingredient_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'recipe_components'
        );
    }
};
