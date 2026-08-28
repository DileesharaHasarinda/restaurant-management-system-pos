<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'cashier_shifts',
            function (
                Blueprint $table
            ): void {
                $table
                    ->string(
                        'terminal_name',
                        100
                    )
                    ->nullable()
                    ->after(
                        'cashier_id'
                    )
                    ->index();
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'cashier_shifts',
            function (
                Blueprint $table
            ): void {
                $table->dropIndex([
                    'terminal_name',
                ]);

                $table->dropColumn(
                    'terminal_name'
                );
            }
        );
    }
};
