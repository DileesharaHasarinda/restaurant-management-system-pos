<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'orders',
            function (Blueprint $table): void {
                $table
                    ->foreignId('rejected_by')
                    ->nullable()
                    ->after('cancelled_by')
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->timestamp('rejected_at')
                    ->nullable()
                    ->after('cancelled_at');

                $table
                    ->text('rejection_reason')
                    ->nullable()
                    ->after('cancellation_reason');
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'orders',
            function (Blueprint $table): void {
                $table->dropForeign([
                    'rejected_by',
                ]);

                $table->dropColumn([
                    'rejected_by',
                    'rejected_at',
                    'rejection_reason',
                ]);
            }
        );
    }
};
