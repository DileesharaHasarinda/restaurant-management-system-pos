<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'expenses',
            function (Blueprint $table): void {
                /*
                 * Protect against duplicate submissions
                 * caused by double-clicks / network retries.
                 */
                $table
                    ->uuid('client_request_id')
                    ->nullable()
                    ->unique()
                    ->after('id');

                /*
                 * Existing description remains the short
                 * explanation/title of the expense.
                 *
                 * Notes allow longer optional information.
                 */
                $table
                    ->text('notes')
                    ->nullable()
                    ->after('description');

                /*
                 * Receipt is stored privately.
                 *
                 * receipt_path itself is never exposed
                 * directly through the public API.
                 */
                $table
                    ->string(
                        'receipt_original_name',
                        255
                    )
                    ->nullable()
                    ->after('receipt_path');

                $table
                    ->string(
                        'receipt_mime_type',
                        120
                    )
                    ->nullable()
                    ->after('receipt_original_name');

                $table
                    ->unsignedBigInteger(
                        'receipt_size'
                    )
                    ->nullable()
                    ->after('receipt_mime_type');

                $table
                    ->timestamp(
                        'receipt_uploaded_at'
                    )
                    ->nullable()
                    ->after('receipt_size');

                /*
                 * Reporting indexes.
                 */
                $table->index(
                    'expense_date',
                    'expenses_expense_date_index'
                );

                $table->index(
                    'payment_method',
                    'expenses_payment_method_index'
                );

                $table->index(
                    [
                        'expense_category_id',
                        'expense_date',
                    ],
                    'expenses_category_date_index'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'expenses',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'expenses_category_date_index'
                );

                $table->dropIndex(
                    'expenses_payment_method_index'
                );

                $table->dropIndex(
                    'expenses_expense_date_index'
                );

                $table->dropUnique(
                    'expenses_client_request_id_unique'
                );

                $table->dropColumn([
                    'client_request_id',
                    'notes',
                    'receipt_original_name',
                    'receipt_mime_type',
                    'receipt_size',
                    'receipt_uploaded_at',
                ]);
            }
        );
    }
};
