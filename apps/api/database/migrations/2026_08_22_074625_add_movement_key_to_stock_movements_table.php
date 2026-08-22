<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'stock_movements',
            function (Blueprint $table): void {
                $table->string(
                    'movement_key',
                    190
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
            'stock_movements',
            function (Blueprint $table): void {
                $table->dropUnique([
                    'movement_key',
                ]);

                $table->dropColumn(
                    'movement_key'
                );
            }
        );
    }
};
