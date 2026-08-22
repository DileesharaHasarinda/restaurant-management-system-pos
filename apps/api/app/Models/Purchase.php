<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    public const STATUS_DRAFT =
    'DRAFT';

    public const STATUS_COMPLETED =
    'COMPLETED';

    public const STATUS_CANCELLED =
    'CANCELLED';

    public const PAYMENT_STATUS_UNPAID =
    'UNPAID';

    public const PAYMENT_STATUS_PARTIALLY_PAID =
    'PARTIALLY_PAID';

    public const PAYMENT_STATUS_PAID =
    'PAID';

    protected $fillable = [
        'purchase_number',
        'supplier_id',
        'supplier_invoice_number',
        'purchase_date',

        'subtotal',
        'discount_total',
        'tax_total',
        'grand_total',

        'paid_amount',
        'balance_due',
        'payment_status',

        'status',
        'notes',

        'created_by',
        'completed_by',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' =>
            'date',

            'subtotal' =>
            'decimal:2',

            'discount_total' =>
            'decimal:2',

            'tax_total' =>
            'decimal:2',

            'grand_total' =>
            'decimal:2',

            'paid_amount' =>
            'decimal:2',

            'balance_due' =>
            'decimal:2',

            'completed_at' =>
            'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(
            Supplier::class,
            'supplier_id'
        );
    }

    public function items(): HasMany
    {
        return $this->hasMany(
            PurchaseItem::class,
            'purchase_id'
        );
    }

    public function payments(): HasMany
    {
        return $this->hasMany(
            SupplierPayment::class,
            'purchase_id'
        );
    }

    public function paymentBatches(): HasMany
    {
        return $this->hasMany(
            SupplierPaymentBatch::class,
            'purchase_id'
        );
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'completed_by'
        );
    }

    public function isDraft(): bool
    {
        return $this->status
            === self::STATUS_DRAFT;
    }

    public function isCompleted(): bool
    {
        return $this->status
            === self::STATUS_COMPLETED;
    }

    public function isCancelled(): bool
    {
        return $this->status
            === self::STATUS_CANCELLED;
    }

    public function isPaid(): bool
    {
        return $this->payment_status
            === self::PAYMENT_STATUS_PAID;
    }
}
