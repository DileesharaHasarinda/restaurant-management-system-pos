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
        | Tables
        |--------------------------------------------------------------------------
        |
        | A fresh database creates this table in the later core migration.
        | Therefore this legacy extension is allowed to safely skip it.
        |
        */

        if (
            Schema::hasTable(
                'tables'
            )
        ) {
            if (
                ! Schema::hasColumn(
                    'tables',
                    'table_number'
                )
            ) {
                Schema::table(
                    'tables',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->unsignedInteger(
                                'table_number'
                            )
                            ->nullable()
                            ->unique()
                            ->after('id');
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'tables',
                    'qr_ordering_enabled'
                )
            ) {
                Schema::table(
                    'tables',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->boolean(
                                'qr_ordering_enabled'
                            )
                            ->default(true)
                            ->after('status');
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'tables',
                    'notes'
                )
            ) {
                Schema::table(
                    'tables',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->text('notes')
                            ->nullable()
                            ->after(
                                'sort_order'
                            );
                    }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Table QR Tokens
        |--------------------------------------------------------------------------
        */

        if (
            Schema::hasTable(
                'table_qr_tokens'
            )
        ) {
            if (
                ! Schema::hasColumn(
                    'table_qr_tokens',
                    'disabled_at'
                )
            ) {
                Schema::table(
                    'table_qr_tokens',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->timestamp(
                                'disabled_at'
                            )
                            ->nullable()
                            ->after(
                                'last_scanned_at'
                            );
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'table_qr_tokens',
                    'disabled_by'
                )
            ) {
                Schema::table(
                    'table_qr_tokens',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->foreignId(
                                'disabled_by'
                            )
                            ->nullable()
                            ->after(
                                'disabled_at'
                            )
                            ->constrained(
                                'users'
                            )
                            ->nullOnDelete();
                    }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Table Sessions
        |--------------------------------------------------------------------------
        */

        if (
            Schema::hasTable(
                'table_sessions'
            )
        ) {
            if (
                ! Schema::hasColumn(
                    'table_sessions',
                    'public_token'
                )
            ) {
                Schema::table(
                    'table_sessions',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->string(
                                'public_token',
                                64
                            )
                            ->nullable()
                            ->unique()
                            ->after(
                                'session_number'
                            );
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'table_sessions',
                    'opened_source'
                )
            ) {
                Schema::table(
                    'table_sessions',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->string(
                                'opened_source',
                                30
                            )
                            ->default(
                                'STAFF'
                            )
                            ->after(
                                'guest_count'
                            );
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'table_sessions',
                    'closed_by'
                )
            ) {
                Schema::table(
                    'table_sessions',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->foreignId(
                                'closed_by'
                            )
                            ->nullable()
                            ->after(
                                'closed_at'
                            )
                            ->constrained(
                                'users'
                            )
                            ->nullOnDelete();
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'table_sessions',
                    'close_reason'
                )
            ) {
                Schema::table(
                    'table_sessions',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->string(
                                'close_reason',
                                255
                            )
                            ->nullable()
                            ->after(
                                'closed_by'
                            );
                    }
                );
            }

            if (
                ! Schema::hasColumn(
                    'table_sessions',
                    'last_activity_at'
                )
            ) {
                Schema::table(
                    'table_sessions',
                    function (
                        Blueprint $table
                    ): void {
                        $table
                            ->timestamp(
                                'last_activity_at'
                            )
                            ->nullable()
                            ->after(
                                'close_reason'
                            );
                    }
                );
            }

            /*
             * The composite index is only needed when the
             * public_token extension was actually added by
             * this legacy migration.
             *
             * Fresh databases receive the index from the
             * core migration below.
             */
        }
    }

    public function down(): void
    {
        /*
         * Keep rollback safe when these legacy extensions
         * were skipped on a fresh database.
         */

        if (
            Schema::hasTable(
                'table_sessions'
            )
        ) {
            if (
                Schema::hasColumn(
                    'table_sessions',
                    'closed_by'
                )
            ) {
                Schema::table(
                    'table_sessions',
                    function (
                        Blueprint $table
                    ): void {
                        $table->dropForeign([
                            'closed_by',
                        ]);
                    }
                );
            }

            $columns = [];

            foreach (
                [
                    'public_token',
                    'opened_source',
                    'closed_by',
                    'close_reason',
                    'last_activity_at',
                ]
                as $column
            ) {
                if (
                    Schema::hasColumn(
                        'table_sessions',
                        $column
                    )
                ) {
                    $columns[] =
                        $column;
                }
            }

            if ($columns !== []) {
                Schema::table(
                    'table_sessions',
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

        if (
            Schema::hasTable(
                'table_qr_tokens'
            )
        ) {
            if (
                Schema::hasColumn(
                    'table_qr_tokens',
                    'disabled_by'
                )
            ) {
                Schema::table(
                    'table_qr_tokens',
                    function (
                        Blueprint $table
                    ): void {
                        $table->dropForeign([
                            'disabled_by',
                        ]);
                    }
                );
            }

            $columns = [];

            foreach (
                [
                    'disabled_at',
                    'disabled_by',
                ]
                as $column
            ) {
                if (
                    Schema::hasColumn(
                        'table_qr_tokens',
                        $column
                    )
                ) {
                    $columns[] =
                        $column;
                }
            }

            if ($columns !== []) {
                Schema::table(
                    'table_qr_tokens',
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

        if (
            Schema::hasTable(
                'tables'
            )
        ) {
            $columns = [];

            foreach (
                [
                    'table_number',
                    'qr_ordering_enabled',
                    'notes',
                ]
                as $column
            ) {
                if (
                    Schema::hasColumn(
                        'tables',
                        $column
                    )
                ) {
                    $columns[] =
                        $column;
                }
            }

            if ($columns !== []) {
                Schema::table(
                    'tables',
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
    }
};
