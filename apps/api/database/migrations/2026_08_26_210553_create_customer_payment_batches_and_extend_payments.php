<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Customer Payment Batches
        |--------------------------------------------------------------------------
        |
        | One API request may contain:
        |
        | CASH + CARD + QR + BANK_TRANSFER + OTHER
        |
        | client_request_id protects the complete payment request
        | from being processed twice.
        |
        */

        if (! Schema::hasTable('payment_batches')) {
            Schema::create(
                'payment_batches',
                function (Blueprint $table): void {
                    $table->id();

                    $table->uuid(
                        'client_request_id'
                    )->unique();

                    $table->char(
                        'request_hash',
                        64
                    );

                    $table->foreignId(
                        'invoice_id'
                    )
                        ->constrained('invoices')
                        ->restrictOnDelete();

                    $table->foreignId(
                        'cashier_shift_id'
                    )
                        ->nullable()
                        ->constrained('cashier_shifts')
                        ->nullOnDelete();

                    $table->decimal(
                        'total_amount',
                        15,
                        2
                    );

                    $table->decimal(
                        'cash_amount',
                        15,
                        2
                    )->default(0);

                    $table->unsignedInteger(
                        'payment_count'
                    );

                    $table->string(
                        'status',
                        30
                    )
                        ->default('COMPLETED')
                        ->index();

                    $table->foreignId(
                        'created_by'
                    )
                        ->constrained('users')
                        ->restrictOnDelete();

                    $table->timestamp(
                        'processed_at'
                    );

                    $table->timestamps();

                    $table->index([
                        'invoice_id',
                        'processed_at',
                    ]);
                }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Link Individual Payments To Batch
        |--------------------------------------------------------------------------
        */

        if (
            ! Schema::hasColumn(
                'payments',
                'payment_batch_id'
            )
        ) {
            Schema::table(
                'payments',
                function (Blueprint $table): void {
                    $table->foreignId(
                        'payment_batch_id'
                    )
                        ->nullable()
                        ->after('id')
                        ->constrained('payment_batches')
                        ->restrictOnDelete();
                }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Payment Number Sequence
        |--------------------------------------------------------------------------
        */

        $exists =
            DB::table('document_sequences')
            ->where(
                'sequence_type',
                'PAYMENT'
            )
            ->exists();

        if (! $exists) {
            DB::table('document_sequences')
                ->insert([
                    'sequence_type' =>
                    'PAYMENT',

                    'prefix' =>
                    'PAY',

                    'current_number' =>
                    0,

                    'padding' =>
                    6,

                    'reset_period' =>
                    'NEVER',

                    'last_reset_key' =>
                    null,

                    'is_active' =>
                    true,

                    'created_at' =>
                    now(),

                    'updated_at' =>
                    now(),
                ]);
        }
    }

    public function down(): void
    {
        if (
            Schema::hasColumn(
                'payments',
                'payment_batch_id'
            )
        ) {
            Schema::table(
                'payments',
                function (Blueprint $table): void {
                    $table->dropConstrainedForeignId(
                        'payment_batch_id'
                    );
                }
            );
        }

        Schema::dropIfExists(
            'payment_batches'
        );

        DB::table('document_sequences')
            ->where(
                'sequence_type',
                'PAYMENT'
            )
            ->delete();
    }
};
