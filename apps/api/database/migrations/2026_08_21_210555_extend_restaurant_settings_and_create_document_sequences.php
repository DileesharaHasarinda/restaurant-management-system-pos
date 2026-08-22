<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Restaurant Settings Extensions
        |--------------------------------------------------------------------------
        |
        | On older incremental databases the restaurant_settings table may
        | already exist at this point.
        |
        | On a completely fresh installation, however, the base table is
        | created later by:
        |
        | 2026_08_22_000100_create_restaurant_core_tables.php
        |
        | Therefore this migration must not fail when the table does not
        | exist yet.
        |
        */

        if (
            Schema::hasTable(
                'restaurant_settings'
            )
        ) {
            if (
                ! Schema::hasColumn(
                    'restaurant_settings',
                    'opening_hours'
                )
            ) {
                Schema::table(
                    'restaurant_settings',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->json(
                                'opening_hours'
                            )
                            ->nullable();
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'restaurant_settings',
                    'social_media'
                )
            ) {
                Schema::table(
                    'restaurant_settings',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->json(
                                'social_media'
                            )
                            ->nullable();
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'restaurant_settings',
                    'website_contact'
                )
            ) {
                Schema::table(
                    'restaurant_settings',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->json(
                                'website_contact'
                            )
                            ->nullable();
                    }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Document Sequences
        |--------------------------------------------------------------------------
        */

        if (
            ! Schema::hasTable(
                'document_sequences'
            )
        ) {
            Schema::create(
                'document_sequences',
                function (
                    Blueprint $table
                ): void {
                    $table->id();

                    /*
                     * INVOICE
                     * ORDER
                     * TOKEN
                     */
                    $table
                        ->string(
                            'sequence_type',
                            30
                        )
                        ->unique();

                    $table->string(
                        'prefix',
                        20
                    );

                    $table
                        ->unsignedBigInteger(
                            'current_number'
                        )
                        ->default(0);

                    $table
                        ->unsignedTinyInteger(
                            'padding'
                        )
                        ->default(6);

                    /*
                     * NEVER
                     * DAILY
                     * MONTHLY
                     * YEARLY
                     */
                    $table
                        ->string(
                            'reset_period',
                            20
                        )
                        ->default(
                            'NEVER'
                        );

                    $table
                        ->string(
                            'last_reset_key',
                            20
                        )
                        ->nullable();

                    $table
                        ->boolean(
                            'is_active'
                        )
                        ->default(true);

                    $table->timestamps();

                    $table->index([
                        'sequence_type',
                        'is_active',
                    ]);
                }
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'document_sequences'
        );

        if (
            ! Schema::hasTable(
                'restaurant_settings'
            )
        ) {
            return;
        }

        $columns = [];

        foreach (
            [
                'opening_hours',
                'social_media',
                'website_contact',
            ]
            as $column
        ) {
            if (
                Schema::hasColumn(
                    'restaurant_settings',
                    $column
                )
            ) {
                $columns[] =
                    $column;
            }
        }

        if ($columns !== []) {
            Schema::table(
                'restaurant_settings',
                function (
                    Blueprint $table
                ) use (
                    $columns
                ): void {
                    $table->dropColumn(
                        $columns
                    );
                }
            );
        }
    }
};
