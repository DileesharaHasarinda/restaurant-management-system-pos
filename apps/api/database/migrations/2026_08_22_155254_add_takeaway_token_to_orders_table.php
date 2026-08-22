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
                    ->string(
                        'takeaway_token',
                        60
                    )
                    ->nullable()
                    ->unique()
                    ->after(
                        'table_name_snapshot'
                    );
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'orders',
            function (Blueprint $table): void {
                $table->dropUnique([
                    'takeaway_token',
                ]);

                $table->dropColumn(
                    'takeaway_token'
                );
            }
        );
    }
};
