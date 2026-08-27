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
        | Cashier Shift Extensions
        |--------------------------------------------------------------------------
        |
        | open_request_id
        | -> Makes opening a shift idempotent.
        |
        | close_request_id
        | -> Makes closing a shift idempotent.
        |
        | open_shift_key
        | -> Database-level protection against two OPEN shifts
        |    for the same cashier.
        |
        */

        Schema::table(
            'cashier_shifts',
            function (Blueprint $table): void {
                $table->uuid(
                    'open_request_id'
                )
                    ->nullable()
                    ->unique()
                    ->after('id');

                $table->char(
                    'open_request_hash',
                    64
                )
                    ->nullable()
                    ->after('open_request_id');

                $table->uuid(
                    'close_request_id'
                )
                    ->nullable()
                    ->unique()
                    ->after('open_request_hash');

                $table->char(
                    'close_request_hash',
                    64
                )
                    ->nullable()
                    ->after('close_request_id');

                /*
                 * Example while shift is OPEN:
                 *
                 * CASHIER:15
                 *
                 * When shift closes:
                 *
                 * NULL
                 *
                 * Unique nullable column protects against
                 * two open shifts for the same cashier.
                 */
                $table->string(
                    'open_shift_key',
                    100
                )
                    ->nullable()
                    ->unique()
                    ->after('cashier_id');

                $table->index(
                    [
                        'business_day_id',
                        'cashier_id',
                        'status',
                    ],
                    'cashier_shifts_day_cashier_status_idx'
                );
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Manual Drawer Movement Idempotency
        |--------------------------------------------------------------------------
        |
        | Phase 26 / Phase 28 existing movements remain NULL.
        |
        | Phase 29 manual CASH_IN / CASH_OUT requests receive
        | a UUID so a network retry cannot move cash twice.
        |
        */

        Schema::table(
            'cash_drawer_movements',
            function (Blueprint $table): void {
                $table->uuid(
                    'client_request_id'
                )
                    ->nullable()
                    ->unique()
                    ->after('id');
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'cash_drawer_movements',
            function (Blueprint $table): void {
                $table->dropUnique(
                    'cash_drawer_movements_client_request_id_unique'
                );

                $table->dropColumn(
                    'client_request_id'
                );
            }
        );

        Schema::table(
            'cashier_shifts',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'cashier_shifts_day_cashier_status_idx'
                );

                $table->dropUnique(
                    'cashier_shifts_open_request_id_unique'
                );

                $table->dropUnique(
                    'cashier_shifts_close_request_id_unique'
                );

                $table->dropUnique(
                    'cashier_shifts_open_shift_key_unique'
                );

                $table->dropColumn([
                    'open_request_id',
                    'open_request_hash',
                    'close_request_id',
                    'close_request_hash',
                    'open_shift_key',
                ]);
            }
        );
    }
};
