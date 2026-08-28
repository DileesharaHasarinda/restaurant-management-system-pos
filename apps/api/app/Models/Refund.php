<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Refund extends Model
{
    public const STATUS_COMPLETED =
    'COMPLETED';

    protected $fillable = [
        'client_request_id',
        'request_hash',

        'refund_number',

        'invoice_id',
        'payment_id',

        'business_day_id',
        'cashier_shift_id',

        'amount',
        'refund_method',

        'status',

        'reason',
        'details',

        'initiated_by',
        'authorized_by',
        'processed_by',

        'refunded_at',
    ];

    protected $hidden = [
        'request_hash',
    ];

    protected function casts(): array
    {
        return [
            'amount' =>
            'decimal:2',

            'details' =>
            'array',

            'refunded_at' =>
            'datetime',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(
            Invoice::class
        );
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(
            Payment::class
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

    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'initiated_by'
        );
    }

    public function authorizedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'authorized_by'
        );
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'processed_by'
        );
    }
}
