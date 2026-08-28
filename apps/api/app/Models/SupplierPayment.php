<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierPayment extends Model
{
    public const METHOD_CASH =
    'CASH';

    public const METHOD_CARD =
    'CARD';

    public const METHOD_BANK_TRANSFER =
    'BANK_TRANSFER';

    public const METHOD_CHEQUE =
    'CHEQUE';

    public const METHOD_OTHER =
    'OTHER';

    protected $fillable = [
        'payment_batch_id',

        'supplier_id',
        'purchase_id',

        'business_day_id',
        'cashier_shift_id',

        'payment_number',

        'payment_date',

        'amount',

        'payment_method',

        /*
         * Database column.
         *
         * The public API continues to call
         * this field "reference".
         */
        'reference_number',

        'notes',

        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' =>
            'date',

            'amount' =>
            'decimal:2',
        ];
    }

    public static function methods(): array
    {
        return [
            self::METHOD_CASH,
            self::METHOD_CARD,
            self::METHOD_BANK_TRANSFER,
            self::METHOD_CHEQUE,
            self::METHOD_OTHER,
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(
            SupplierPaymentBatch::class,
            'payment_batch_id'
        );
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(
            Supplier::class,
            'supplier_id'
        );
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(
            Purchase::class,
            'purchase_id'
        );
    }

    public function businessDay(): BelongsTo
    {
        return $this->belongsTo(
            BusinessDay::class,
            'business_day_id'
        );
    }

    public function cashierShift(): BelongsTo
    {
        return $this->belongsTo(
            CashierShift::class,
            'cashier_shift_id'
        );
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }
}
