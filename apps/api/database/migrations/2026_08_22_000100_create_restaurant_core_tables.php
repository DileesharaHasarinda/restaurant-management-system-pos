<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Restaurant Settings
        |--------------------------------------------------------------------------
        */

        Schema::create(
            'restaurant_settings',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table->string(
                    'business_name',
                    190
                );

                $table
                    ->string(
                        'legal_name',
                        190
                    )
                    ->nullable();

                $table
                    ->string(
                        'phone',
                        50
                    )
                    ->nullable();

                $table
                    ->string(
                        'email',
                        190
                    )
                    ->nullable();

                $table
                    ->text('address')
                    ->nullable();

                $table
                    ->string(
                        'currency',
                        10
                    )
                    ->default('LKR');

                $table
                    ->string(
                        'timezone',
                        100
                    )
                    ->default(
                        'Asia/Colombo'
                    );

                $table
                    ->boolean(
                        'tax_enabled'
                    )
                    ->default(false);

                $table
                    ->decimal(
                        'default_tax_rate',
                        8,
                        4
                    )
                    ->default(0);

                $table
                    ->boolean(
                        'service_charge_enabled'
                    )
                    ->default(false);

                $table
                    ->decimal(
                        'default_service_charge_rate',
                        8,
                        4
                    )
                    ->default(0);

                $table
                    ->string(
                        'logo_path'
                    )
                    ->nullable();

                $table
                    ->text(
                        'receipt_header'
                    )
                    ->nullable();

                $table
                    ->text(
                        'receipt_footer'
                    )
                    ->nullable();

                $table
                    ->json('settings')
                    ->nullable();

                /*
                 * These fields originally existed in
                 * the earlier extension migration.
                 *
                 * They are included here so a fresh
                 * database receives the complete
                 * restaurant_settings schema.
                 */
                $table
                    ->json(
                        'opening_hours'
                    )
                    ->nullable();

                $table
                    ->json(
                        'social_media'
                    )
                    ->nullable();

                $table
                    ->json(
                        'website_contact'
                    )
                    ->nullable();

                $table->timestamps();
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Business Days
        |--------------------------------------------------------------------------
        */

        Schema::create(
            'business_days',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table
                    ->date(
                        'business_date'
                    )
                    ->unique();

                $table
                    ->string(
                        'status',
                        20
                    )
                    ->default('OPEN')
                    ->index();

                $table
                    ->foreignId(
                        'opened_by'
                    )
                    ->nullable()
                    ->constrained(
                        'users'
                    )
                    ->nullOnDelete();

                $table
                    ->foreignId(
                        'closed_by'
                    )
                    ->nullable()
                    ->constrained(
                        'users'
                    )
                    ->nullOnDelete();

                $table
                    ->timestamp(
                        'opened_at'
                    )
                    ->nullable();

                $table
                    ->timestamp(
                        'closed_at'
                    )
                    ->nullable();

                $table
                    ->text('notes')
                    ->nullable();

                $table->timestamps();
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Restaurant Tables
        |--------------------------------------------------------------------------
        */

        Schema::create(
            'tables',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table
                    ->unsignedInteger(
                        'table_number'
                    )
                    ->nullable()
                    ->unique();

                $table
                    ->string(
                        'code',
                        50
                    )
                    ->unique();

                $table->string(
                    'name',
                    100
                );

                $table
                    ->string(
                        'area',
                        100
                    )
                    ->nullable();

                $table
                    ->unsignedInteger(
                        'capacity'
                    )
                    ->default(4);

                $table
                    ->string(
                        'status',
                        30
                    )
                    ->default(
                        'AVAILABLE'
                    )
                    ->index();

                $table
                    ->boolean(
                        'qr_ordering_enabled'
                    )
                    ->default(true);

                $table
                    ->unsignedInteger(
                        'sort_order'
                    )
                    ->default(0);

                $table
                    ->text('notes')
                    ->nullable();

                $table
                    ->boolean(
                        'is_active'
                    )
                    ->default(true)
                    ->index();

                $table->timestamps();
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Table QR Tokens
        |--------------------------------------------------------------------------
        */

        Schema::create(
            'table_qr_tokens',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table
                    ->foreignId(
                        'table_id'
                    )
                    ->constrained(
                        'tables'
                    )
                    ->cascadeOnDelete();

                $table
                    ->string(
                        'token',
                        128
                    )
                    ->unique();

                $table
                    ->boolean(
                        'is_active'
                    )
                    ->default(true)
                    ->index();

                $table
                    ->timestamp(
                        'expires_at'
                    )
                    ->nullable();

                $table
                    ->timestamp(
                        'last_scanned_at'
                    )
                    ->nullable();

                $table
                    ->timestamp(
                        'disabled_at'
                    )
                    ->nullable();

                $table
                    ->foreignId(
                        'disabled_by'
                    )
                    ->nullable()
                    ->constrained(
                        'users'
                    )
                    ->nullOnDelete();

                $table
                    ->foreignId(
                        'generated_by'
                    )
                    ->nullable()
                    ->constrained(
                        'users'
                    )
                    ->nullOnDelete();

                $table->timestamps();
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Table Sessions
        |--------------------------------------------------------------------------
        */

        Schema::create(
            'table_sessions',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table
                    ->string(
                        'session_number',
                        50
                    )
                    ->unique();

                $table
                    ->string(
                        'public_token',
                        64
                    )
                    ->nullable()
                    ->unique();

                $table
                    ->foreignId(
                        'business_day_id'
                    )
                    ->constrained(
                        'business_days'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'table_id'
                    )
                    ->constrained(
                        'tables'
                    )
                    ->restrictOnDelete();

                $table
                    ->unsignedBigInteger(
                        'merged_into_session_id'
                    )
                    ->nullable();

                $table
                    ->unsignedInteger(
                        'guest_count'
                    )
                    ->default(1);

                /*
                 * STAFF
                 * QR_CUSTOMER
                 */
                $table
                    ->string(
                        'opened_source',
                        30
                    )
                    ->default(
                        'STAFF'
                    );

                $table
                    ->string(
                        'status',
                        30
                    )
                    ->default('OPEN')
                    ->index();

                $table
                    ->foreignId(
                        'opened_by'
                    )
                    ->nullable()
                    ->constrained(
                        'users'
                    )
                    ->nullOnDelete();

                $table->timestamp(
                    'opened_at'
                );

                $table
                    ->timestamp(
                        'closed_at'
                    )
                    ->nullable();

                $table
                    ->foreignId(
                        'closed_by'
                    )
                    ->nullable()
                    ->constrained(
                        'users'
                    )
                    ->nullOnDelete();

                $table
                    ->string(
                        'close_reason',
                        255
                    )
                    ->nullable();

                $table
                    ->timestamp(
                        'last_activity_at'
                    )
                    ->nullable();

                $table->timestamps();

                $table->index([
                    'table_id',
                    'status',
                ]);

                $table->index([
                    'public_token',
                    'status',
                ]);
            }
        );

        /*
         * Self-referencing table-session relation.
         */
        Schema::table(
            'table_sessions',
            function (
                Blueprint $table
            ): void {
                $table
                    ->foreign(
                        'merged_into_session_id'
                    )
                    ->references('id')
                    ->on(
                        'table_sessions'
                    )
                    ->nullOnDelete();
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Table Transfers
        |--------------------------------------------------------------------------
        */

        Schema::create(
            'table_transfers',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table
                    ->foreignId(
                        'table_session_id'
                    )
                    ->constrained(
                        'table_sessions'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'from_table_id'
                    )
                    ->constrained(
                        'tables'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'to_table_id'
                    )
                    ->constrained(
                        'tables'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'transferred_by'
                    )
                    ->constrained(
                        'users'
                    )
                    ->restrictOnDelete();

                $table
                    ->string(
                        'reason',
                        255
                    )
                    ->nullable();

                $table->timestamp(
                    'transferred_at'
                );

                $table->timestamps();
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Table Merges
        |--------------------------------------------------------------------------
        */

        Schema::create(
            'table_merges',
            function (
                Blueprint $table
            ): void {
                $table->id();

                $table
                    ->foreignId(
                        'source_session_id'
                    )
                    ->constrained(
                        'table_sessions'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'target_session_id'
                    )
                    ->constrained(
                        'table_sessions'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'source_table_id'
                    )
                    ->constrained(
                        'tables'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'target_table_id'
                    )
                    ->constrained(
                        'tables'
                    )
                    ->restrictOnDelete();

                $table
                    ->foreignId(
                        'merged_by'
                    )
                    ->constrained(
                        'users'
                    )
                    ->restrictOnDelete();

                $table
                    ->string(
                        'reason',
                        255
                    )
                    ->nullable();

                $table->timestamp(
                    'merged_at'
                );

                $table->timestamps();
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'table_merges'
        );

        Schema::dropIfExists(
            'table_transfers'
        );

        Schema::dropIfExists(
            'table_sessions'
        );

        Schema::dropIfExists(
            'table_qr_tokens'
        );

        Schema::dropIfExists(
            'tables'
        );

        Schema::dropIfExists(
            'business_days'
        );

        Schema::dropIfExists(
            'restaurant_settings'
        );
    }
};
