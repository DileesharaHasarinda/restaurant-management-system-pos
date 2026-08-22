<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'categories',
            function (Blueprint $table): void {
                $table->boolean(
                    'is_visible_on_website'
                )
                    ->default(true)
                    ->after('is_active');

                $table->boolean(
                    'is_visible_on_qr'
                )
                    ->default(true)
                    ->after(
                        'is_visible_on_website'
                    );

                $table->index(
                    [
                        'is_active',
                        'is_visible_on_website',
                        'sort_order',
                    ],
                    'categories_website_visibility_idx'
                );

                $table->index(
                    [
                        'is_active',
                        'is_visible_on_qr',
                        'sort_order',
                    ],
                    'categories_qr_visibility_idx'
                );
            }
        );

        Schema::table(
            'menu_items',
            function (Blueprint $table): void {
                $table->boolean(
                    'is_visible_on_website'
                )
                    ->default(true)
                    ->after('is_active');

                $table->boolean(
                    'is_visible_on_qr'
                )
                    ->default(true)
                    ->after(
                        'is_visible_on_website'
                    );

                $table->index(
                    [
                        'category_id',
                        'is_active',
                        'is_visible_on_website',
                        'sort_order',
                    ],
                    'menu_items_website_visibility_idx'
                );

                $table->index(
                    [
                        'category_id',
                        'is_active',
                        'is_visible_on_qr',
                        'sort_order',
                    ],
                    'menu_items_qr_visibility_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'menu_items',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'menu_items_website_visibility_idx'
                );

                $table->dropIndex(
                    'menu_items_qr_visibility_idx'
                );

                $table->dropColumn([
                    'is_visible_on_website',
                    'is_visible_on_qr',
                ]);
            }
        );

        Schema::table(
            'categories',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'categories_website_visibility_idx'
                );

                $table->dropIndex(
                    'categories_qr_visibility_idx'
                );

                $table->dropColumn([
                    'is_visible_on_website',
                    'is_visible_on_qr',
                ]);
            }
        );
    }
};
