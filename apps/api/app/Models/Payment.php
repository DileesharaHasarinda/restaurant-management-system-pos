<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    public const METHOD_CASH =
    'CASH';

    public const METHOD_CARD =
    'CARD';

    public const METHOD_QR =
    'QR';

    public const METHOD_BANK_TRANSFER =
    'BANK_TRANSFER';

    public const METHOD_OTHER =
    'OTHER';

    public const METHODS = [
        self::METHOD_CASH,
        self::METHOD_CARD,
        self::METHOD_QR,
        self::METHOD_BANK_TRANSFER,
        self::METHOD_OTHER,
    ];

    public const STATUS_COMPLETED =
    'COMPLETED';

    protected $fillable = [
        'payment_batch_id',
        'payment_number',
        'invoice_id',
        'cashier_shift_id',
        'payment_method',
        'amount',
        'tendered_amount',
        'change_given',
        'reference_number',
        'status',
        'received_by',
        'paid_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' =>
            'decimal:2',

            'tendered_amount' =>
            'decimal:2',

            'change_given' =>
            'decimal:2',

            'paid_at' =>
            'datetime',
        ];
    }

    public function paymentBatch(): BelongsTo
    {
        return $this->belongsTo(
            PaymentBatch::class
        );
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(
            Invoice::class
        );
    }

    public function cashierShift(): BelongsTo
    {
        return $this->belongsTo(
            CashierShift::class
        );
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'received_by'
        );
    }
}
