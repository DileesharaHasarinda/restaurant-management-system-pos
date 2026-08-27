<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Purchases
        |--------------------------------------------------------------------------
        |
        | Align the original supplier-purchase schema with the authoritative
        | Purchase model/service implemented by the application.
        |
        */

        Schema::table(
            'purchases',
            function (Blueprint $table): void {
                $table->renameColumn(
                    'outstanding_amount',
                    'balance_due'
                );

                $table->renameColumn(
                    'posted_by',
                    'completed_by'
                );

                $table->renameColumn(
                    'posted_at',
                    'completed_at'
                );
            }
        );

        Schema::table(
            'purchases',
            function (Blueprint $table): void {
                $table->string(
                    'payment_status',
                    30
                )
                    ->default('UNPAID')
                    ->after('balance_due')
                    ->index();
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Purchase Items
        |--------------------------------------------------------------------------
        |
        | Conversion snapshots do not exist while a purchase is still DRAFT.
        | They are calculated only when the purchase is completed.
        |
        */

        Schema::table(
            'purchase_items',
            function (Blueprint $table): void {
                $table->decimal(
                    'base_quantity',
                    18,
                    4
                )
                    ->nullable()
                    ->change();
            }
        );

        Schema::table(
            'purchase_items',
            function (Blueprint $table): void {
                $table->decimal(
                    'base_unit_cost',
                    18,
                    4
                )
                    ->nullable()
                    ->after('base_quantity');
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'purchase_items',
            function (Blueprint $table): void {
                $table->dropColumn(
                    'base_unit_cost'
                );
            }
        );

        /*
         * The historic schema required base_quantity.
         * A draft created after this migration may contain NULL,
         * so normalize those rows before restoring NOT NULL.
         */
        DB::table('purchase_items')
            ->whereNull('base_quantity')
            ->update([
                'base_quantity' => 0,
            ]);

        Schema::table(
            'purchase_items',
            function (Blueprint $table): void {
                $table->decimal(
                    'base_quantity',
                    18,
                    4
                )
                    ->nullable(false)
                    ->change();
            }
        );

        Schema::table(
            'purchases',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'purchases_payment_status_index'
                );

                $table->dropColumn(
                    'payment_status'
                );
            }
        );

        Schema::table(
            'purchases',
            function (Blueprint $table): void {
                $table->renameColumn(
                    'balance_due',
                    'outstanding_amount'
                );

                $table->renameColumn(
                    'completed_by',
                    'posted_by'
                );

                $table->renameColumn(
                    'completed_at',
                    'posted_at'
                );
            }
        );
    }
};
