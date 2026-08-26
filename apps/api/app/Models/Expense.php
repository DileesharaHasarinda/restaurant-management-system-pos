<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    public const STATUS_POSTED =
    'POSTED';

    public const STATUS_VOID =
    'VOID';

    public const METHOD_CASH =
    'CASH';

    public const METHOD_CARD =
    'CARD';

    public const METHOD_BANK_TRANSFER =
    'BANK_TRANSFER';

    public const METHOD_CHEQUE =
    'CHEQUE';

    public const METHOD_QR =
    'QR';

    public const METHOD_OTHER =
    'OTHER';

    protected $fillable = [
        'client_request_id',
        'expense_number',
        'expense_category_id',
        'business_day_id',
        'cashier_shift_id',
        'description',
        'notes',
        'amount',
        'payment_method',
        'reference_number',

        'receipt_path',
        'receipt_original_name',
        'receipt_mime_type',
        'receipt_size',
        'receipt_uploaded_at',

        'status',
        'expense_date',
        'created_by',
        'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' =>
            'decimal:2',

            'expense_date' =>
            'date',

            'receipt_size' =>
            'integer',

            'receipt_uploaded_at' =>
            'datetime',
        ];
    }

    public static function paymentMethods(): array
    {
        return [
            self::METHOD_CASH,
            self::METHOD_CARD,
            self::METHOD_BANK_TRANSFER,
            self::METHOD_CHEQUE,
            self::METHOD_QR,
            self::METHOD_OTHER,
        ];
    }

    public static function paymentMethodLabels(): array
    {
        return [
            self::METHOD_CASH =>
            'Cash',

            self::METHOD_CARD =>
            'Card',

            self::METHOD_BANK_TRANSFER =>
            'Bank Transfer',

            self::METHOD_CHEQUE =>
            'Cheque',

            self::METHOD_QR =>
            'QR Payment',

            self::METHOD_OTHER =>
            'Other',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(
            ExpenseCategory::class,
            'expense_category_id'
        );
    }

    public function businessDay(): BelongsTo
    {
        return $this->belongsTo(
            BusinessDay::class
        );
    }

    public function cashierShift(): BelongsTo
    {
        return $this->belongsTo(
            CashierShift::class
        );
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'approved_by'
        );
    }
}
