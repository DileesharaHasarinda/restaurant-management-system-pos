<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'business_day_closings',
            function (
                Blueprint $table
            ): void {
                /*
                |--------------------------------------------------------------------------
                | Idempotent Closing Request
                |--------------------------------------------------------------------------
                |
                | Nullable so any historical closing rows remain valid.
                |
                */

                $table
                    ->char(
                        'client_request_id',
                        36
                    )
                    ->nullable()
                    ->unique()
                    ->after(
                        'business_day_id'
                    );

                $table
                    ->char(
                        'request_hash',
                        64
                    )
                    ->nullable()
                    ->after(
                        'client_request_id'
                    );

                /*
                |--------------------------------------------------------------------------
                | Manager / Owner Closing Notes
                |--------------------------------------------------------------------------
                */

                $table
                    ->text(
                        'closing_notes'
                    )
                    ->nullable()
                    ->after(
                        'snapshot'
                    );
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'business_day_closings',
            function (
                Blueprint $table
            ): void {
                $table->dropUnique(
                    'business_day_closings_client_request_id_unique'
                );

                $table->dropColumn([
                    'client_request_id',
                    'request_hash',
                    'closing_notes',
                ]);
            }
        );
    }
};
