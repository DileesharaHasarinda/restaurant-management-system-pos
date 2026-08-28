<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'refunds',
            function (Blueprint $table): void {
                $table
                    ->char(
                        'client_request_id',
                        36
                    )
                    ->nullable()
                    ->unique()
                    ->after('id');

                $table
                    ->char(
                        'request_hash',
                        64
                    )
                    ->nullable()
                    ->after('client_request_id');

                $table
                    ->foreignId(
                        'initiated_by'
                    )
                    ->nullable()
                    ->after('details')
                    ->constrained(
                        'users'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'authorized_by'
                    )
                    ->nullable()
                    ->after('initiated_by')
                    ->constrained(
                        'users'
                    )
                    ->restrictOnDelete();
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'refunds',
            function (Blueprint $table): void {
                $table->dropForeign([
                    'authorized_by',
                ]);

                $table->dropForeign([
                    'initiated_by',
                ]);

                $table->dropColumn([
                    'authorized_by',
                    'initiated_by',
                    'request_hash',
                    'client_request_id',
                ]);
            }
        );
    }
};
