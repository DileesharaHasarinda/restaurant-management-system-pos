<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'wastages',
            function (Blueprint $table): void {
                /*
                 * Phase 24 idempotency key.
                 *
                 * Nullable so existing historical rows remain valid.
                 * New API requests will require this UUID.
                 */
                $table
                    ->uuid('client_request_id')
                    ->nullable()
                    ->unique()
                    ->after('id');
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'wastages',
            function (Blueprint $table): void {
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
