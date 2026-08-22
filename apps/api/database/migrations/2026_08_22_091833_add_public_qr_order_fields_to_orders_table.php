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
                $table->uuid(
                    'client_order_id'
                )
                    ->nullable()
                    ->unique()
                    ->after('order_number');

                $table->char(
                    'submission_hash',
                    64
                )
                    ->nullable()
                    ->after('client_order_id');

                $table->string(
                    'public_status_token',
                    64
                )
                    ->nullable()
                    ->unique()
                    ->after('submission_hash');
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'orders',
            function (Blueprint $table): void {
                $table->dropUnique([
                    'client_order_id',
                ]);

                $table->dropUnique([
                    'public_status_token',
                ]);

                $table->dropColumn([
                    'client_order_id',
                    'submission_hash',
                    'public_status_token',
                ]);
            }
        );
    }
};
