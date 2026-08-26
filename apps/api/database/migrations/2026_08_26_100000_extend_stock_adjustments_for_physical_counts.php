<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'stock_adjustments',
            function (Blueprint $table): void {
                /*
                 * Protect physical counts from duplicate
                 * submissions / network retries.
                 */
                $table
                    ->uuid('client_request_id')
                    ->nullable()
                    ->unique()
                    ->after('id');

                /*
                 * Snapshot of the quantities at the exact
                 * moment the physical count was posted.
                 *
                 * system_quantity / actual_quantity
                 * are represented in unit_id.
                 *
                 * system_base_quantity / actual_base_quantity
                 * are represented in the ingredient base unit.
                 */
                $table
                    ->decimal(
                        'system_quantity',
                        18,
                        4
                    )
                    ->nullable()
                    ->after('unit_id');

                $table
                    ->decimal(
                        'actual_quantity',
                        18,
                        4
                    )
                    ->nullable()
                    ->after('system_quantity');

                $table
                    ->decimal(
                        'system_base_quantity',
                        18,
                        4
                    )
                    ->nullable()
                    ->after('actual_quantity');

                $table
                    ->decimal(
                        'actual_base_quantity',
                        18,
                        4
                    )
                    ->nullable()
                    ->after('system_base_quantity');

                /*
                 * Null when the physical count matched the
                 * system stock and therefore no movement
                 * was necessary.
                 */
                $table
                    ->foreignId('stock_movement_id')
                    ->nullable()
                    ->unique()
                    ->after('posted_at')
                    ->constrained('stock_movements')
                    ->nullOnDelete();
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'stock_adjustments',
            function (Blueprint $table): void {
                $table->dropConstrainedForeignId(
                    'stock_movement_id'
                );

                $table->dropColumn([
                    'system_quantity',
                    'actual_quantity',
                    'system_base_quantity',
                    'actual_base_quantity',
                ]);

                $table->dropUnique([
                    'client_request_id',
                ]);

                $table->dropColumn(
                    'client_request_id'
                );
            }
        );
    }
};
