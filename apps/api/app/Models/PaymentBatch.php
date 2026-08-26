<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentBatch extends Model
{
    public const STATUS_COMPLETED =
    'COMPLETED';

    protected $fillable = [
        'client_request_id',
        'request_hash',
        'invoice_id',
        'cashier_shift_id',
        'total_amount',
        'cash_amount',
        'payment_count',
        'status',
        'created_by',
        'processed_at',
    ];

    protected $hidden = [
        'request_hash',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' =>
            'decimal:2',

            'cash_amount' =>
            'decimal:2',

            'payment_count' =>
            'integer',

            'processed_at' =>
            'datetime',
        ];
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

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    public function payments(): HasMany
    {
        return $this->hasMany(
            Payment::class,
            'payment_batch_id'
        );
    }
}
