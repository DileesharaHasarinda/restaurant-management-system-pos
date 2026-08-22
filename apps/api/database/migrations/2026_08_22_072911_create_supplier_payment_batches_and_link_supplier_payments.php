<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'supplier_payment_batches',
            function (Blueprint $table): void {
                $table->id();

                $table->string(
                    'batch_number',
                    60
                )->unique();

                /*
                 * Protects against duplicate submissions.
                 *
                 * Frontend generates one UUID when the
                 * user clicks Pay.
                 */
                $table->string(
                    'idempotency_key',
                    64
                )->unique();

                /*
                 * Allows us to detect reuse of the same
                 * idempotency key with different data.
                 */
                $table->char(
                    'request_hash',
                    64
                );

                $table->foreignId(
                    'supplier_id'
                )
                    ->constrained('suppliers')
                    ->restrictOnDelete();

                $table->foreignId(
                    'purchase_id'
                )
                    ->constrained('purchases')
                    ->restrictOnDelete();

                $table->date(
                    'payment_date'
                );

                $table->decimal(
                    'total_amount',
                    14,
                    2
                );

                $table->text(
                    'notes'
                )->nullable();

                $table->foreignId(
                    'created_by'
                )
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->index([
                    'supplier_id',
                    'payment_date',
                ]);

                $table->index([
                    'purchase_id',
                    'payment_date',
                ]);
            }
        );

        Schema::table(
            'supplier_payments',
            function (Blueprint $table): void {
                $table->foreignId(
                    'payment_batch_id'
                )
                    ->nullable()
                    ->after('id')
                    ->constrained(
                        'supplier_payment_batches'
                    )
                    ->restrictOnDelete();

                $table->index([
                    'payment_method',
                    'payment_date',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'supplier_payments',
            function (Blueprint $table): void {
                $table->dropIndex([
                    'payment_method',
                    'payment_date',
                ]);

                $table->dropForeign([
                    'payment_batch_id',
                ]);

                $table->dropColumn(
                    'payment_batch_id'
                );
            }
        );

        Schema::dropIfExists(
            'supplier_payment_batches'
        );
    }
};
