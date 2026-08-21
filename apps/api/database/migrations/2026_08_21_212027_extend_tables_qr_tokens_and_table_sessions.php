<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'tables',
            function (Blueprint $table): void {
                $table->unsignedInteger('table_number')
                    ->nullable()
                    ->unique()
                    ->after('id');

                $table->boolean('qr_ordering_enabled')
                    ->default(true)
                    ->after('status');

                $table->text('notes')
                    ->nullable()
                    ->after('sort_order');
            }
        );

        Schema::table(
            'table_qr_tokens',
            function (Blueprint $table): void {
                $table->timestamp('disabled_at')
                    ->nullable()
                    ->after('last_scanned_at');

                $table->foreignId('disabled_by')
                    ->nullable()
                    ->after('disabled_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        );

        Schema::table(
            'table_sessions',
            function (Blueprint $table): void {
                $table->string('public_token', 64)
                    ->nullable()
                    ->unique()
                    ->after('session_number');

                /*
                 * STAFF
                 * QR_CUSTOMER
                 */
                $table->string('opened_source', 30)
                    ->default('STAFF')
                    ->after('guest_count');

                $table->foreignId('closed_by')
                    ->nullable()
                    ->after('closed_at')
                    ->constrained('users')
                    ->nullOnDelete();

                $table->string('close_reason', 255)
                    ->nullable()
                    ->after('closed_by');

                $table->timestamp('last_activity_at')
                    ->nullable()
                    ->after('close_reason');

                $table->index([
                    'public_token',
                    'status',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'table_sessions',
            function (Blueprint $table): void {
                $table->dropIndex([
                    'public_token',
                    'status',
                ]);

                $table->dropForeign([
                    'closed_by',
                ]);

                $table->dropColumn([
                    'public_token',
                    'opened_source',
                    'closed_by',
                    'close_reason',
                    'last_activity_at',
                ]);
            }
        );

        Schema::table(
            'table_qr_tokens',
            function (Blueprint $table): void {
                $table->dropForeign([
                    'disabled_by',
                ]);

                $table->dropColumn([
                    'disabled_at',
                    'disabled_by',
                ]);
            }
        );

        Schema::table(
            'tables',
            function (Blueprint $table): void {
                $table->dropUnique([
                    'table_number',
                ]);

                $table->dropColumn([
                    'table_number',
                    'qr_ordering_enabled',
                    'notes',
                ]);
            }
        );
    }
};
