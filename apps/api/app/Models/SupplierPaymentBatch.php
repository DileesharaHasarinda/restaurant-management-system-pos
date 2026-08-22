<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierPaymentBatch extends Model
{
    protected $fillable = [
        'batch_number',
        'idempotency_key',
        'request_hash',
        'supplier_id',
        'purchase_id',
        'payment_date',
        'total_amount',
        'notes',
        'created_by',
    ];

    protected $hidden = [
        'idempotency_key',
        'request_hash',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' =>
            'date',

            'total_amount' =>
            'decimal:2',
        ];
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

    public function payments(): HasMany
    {
        return $this->hasMany(
            SupplierPayment::class,
            'payment_batch_id'
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
