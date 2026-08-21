<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'categories',
            function (Blueprint $table) {
                $table->id();

                $table->unsignedBigInteger(
                    'parent_id'
                )->nullable();

                $table->string('name', 150);

                $table->string('slug', 180)
                    ->unique();

                $table->text('description')
                    ->nullable();

                $table->string('image_path')
                    ->nullable();

                $table->unsignedInteger('sort_order')
                    ->default(0);

                $table->boolean('is_active')
                    ->default(true)
                    ->index();

                $table->timestamps();
            }
        );

        Schema::table(
            'categories',
            function (Blueprint $table) {
                $table->foreign('parent_id')
                    ->references('id')
                    ->on('categories')
                    ->nullOnDelete();
            }
        );

        Schema::create(
            'menu_items',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('category_id')
                    ->constrained('categories')
                    ->restrictOnDelete();

                $table->string('sku', 100)
                    ->nullable()
                    ->unique();

                $table->string('name', 190);

                $table->string('slug', 220)
                    ->unique();

                $table->text('description')
                    ->nullable();

                $table->string('image_path')
                    ->nullable();

                $table->decimal('price', 15, 2);

                $table->decimal(
                    'tax_rate',
                    8,
                    4
                )->default(0);

                $table->boolean('is_available')
                    ->default(true)
                    ->index();

                $table->boolean('is_active')
                    ->default(true)
                    ->index();

                $table->boolean('has_variants')
                    ->default(false);

                $table->unsignedInteger('sort_order')
                    ->default(0);

                $table->json('metadata')
                    ->nullable();

                $table->timestamps();
            }
        );

        Schema::create(
            'menu_item_variants',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('menu_item_id')
                    ->constrained('menu_items')
                    ->cascadeOnDelete();

                $table->string('sku', 100)
                    ->nullable()
                    ->unique();

                $table->string('name', 150);

                $table->decimal('price', 15, 2);

                $table->boolean('is_default')
                    ->default(false);

                $table->boolean('is_available')
                    ->default(true);

                $table->boolean('is_active')
                    ->default(true);

                $table->unsignedInteger('sort_order')
                    ->default(0);

                $table->timestamps();

                $table->index([
                    'menu_item_id',
                    'is_active',
                ]);
            }
        );

        Schema::create(
            'addon_groups',
            function (Blueprint $table) {
                $table->id();

                $table->string('name', 150);

                $table->string('description', 255)
                    ->nullable();

                $table->unsignedInteger('minimum_select')
                    ->default(0);

                $table->unsignedInteger('maximum_select')
                    ->default(1);

                $table->boolean('is_required')
                    ->default(false);

                $table->boolean('is_active')
                    ->default(true);

                $table->unsignedInteger('sort_order')
                    ->default(0);

                $table->timestamps();
            }
        );

        Schema::create(
            'addons',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('addon_group_id')
                    ->constrained('addon_groups')
                    ->cascadeOnDelete();

                $table->string('name', 150);

                $table->string('sku', 100)
                    ->nullable()
                    ->unique();

                $table->decimal('price', 15, 2)
                    ->default(0);

                $table->boolean('is_available')
                    ->default(true);

                $table->boolean('is_active')
                    ->default(true);

                $table->unsignedInteger('sort_order')
                    ->default(0);

                $table->timestamps();
            }
        );

        Schema::create(
            'menu_item_addons',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('menu_item_id')
                    ->constrained('menu_items')
                    ->cascadeOnDelete();

                $table->foreignId('addon_id')
                    ->constrained('addons')
                    ->cascadeOnDelete();

                $table->decimal(
                    'price_override',
                    15,
                    2
                )->nullable();

                $table->boolean('is_default')
                    ->default(false);

                $table->unsignedInteger('sort_order')
                    ->default(0);

                $table->timestamps();

                $table->unique([
                    'menu_item_id',
                    'addon_id',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_item_addons');
        Schema::dropIfExists('addons');
        Schema::dropIfExists('addon_groups');
        Schema::dropIfExists('menu_item_variants');
        Schema::dropIfExists('menu_items');
        Schema::dropIfExists('categories');
    }
};
