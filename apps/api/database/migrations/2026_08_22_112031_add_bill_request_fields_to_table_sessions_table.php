<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'table_sessions',
            function (Blueprint $table): void {
                $table
                    ->timestamp('bill_requested_at')
                    ->nullable()
                    ->after('last_activity_at');

                $table
                    ->foreignId('bill_requested_by')
                    ->nullable()
                    ->after('bill_requested_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'table_sessions',
            function (Blueprint $table): void {
                $table->dropForeign([
                    'bill_requested_by',
                ]);

                $table->dropColumn([
                    'bill_requested_at',
                    'bill_requested_by',
                ]);
            }
        );
    }
};
