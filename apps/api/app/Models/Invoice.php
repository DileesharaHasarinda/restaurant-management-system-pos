<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    /*
    |--------------------------------------------------------------------------
    | Invoice Types
    |--------------------------------------------------------------------------
    */

    public const TYPE_SALE =
    'SALE';

    /*
    |--------------------------------------------------------------------------
    | Invoice Statuses
    |--------------------------------------------------------------------------
    */

    public const STATUS_ISSUED =
    'ISSUED';

    public const STATUS_VOID =
    'VOID';

    /*
    |--------------------------------------------------------------------------
    | Payment Statuses
    |--------------------------------------------------------------------------
    */

    public const PAYMENT_STATUS_UNPAID =
    'UNPAID';

    public const PAYMENT_STATUS_PARTIAL =
    'PARTIAL';

    public const PAYMENT_STATUS_PAID =
    'PAID';

    protected $fillable = [
        'invoice_number',

        'business_day_id',
        'cashier_shift_id',

        'table_session_id',
        'order_id',

        'invoice_type',

        'table_name_snapshot',

        'customer_name',
        'customer_phone',

        'subtotal',
        'discount_total',
        'tax_total',
        'service_charge_total',
        'grand_total',

        'estimated_cost_total',

        'paid_amount',
        'change_amount',
        'balance_due',

        'payment_status',
        'status',

        'issued_by',
        'issued_at',

        'voided_at',
        'voided_by',
        'void_reason',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' =>
            'decimal:2',

            'discount_total' =>
            'decimal:2',

            'tax_total' =>
            'decimal:2',

            'service_charge_total' =>
            'decimal:2',

            'grand_total' =>
            'decimal:2',

            'estimated_cost_total' =>
            'decimal:2',

            'paid_amount' =>
            'decimal:2',

            'change_amount' =>
            'decimal:2',

            'balance_due' =>
            'decimal:2',

            'issued_at' =>
            'datetime',

            'voided_at' =>
            'datetime',
        ];
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

    public function tableSession(): BelongsTo
    {
        return $this->belongsTo(
            TableSession::class,
            'table_session_id'
        );
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(
            Order::class,
            'order_id'
        );
    }

    public function issuedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'issued_by'
        );
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'voided_by'
        );
    }

    public function items(): HasMany
    {
        return $this->hasMany(
            InvoiceItem::class,
            'invoice_id'
        );
    }

    public function isIssued(): bool
    {
        return $this->status
            === self::STATUS_ISSUED;
    }

    public function isVoid(): bool
    {
        return $this->status
            === self::STATUS_VOID;
    }

    public function isPaid(): bool
    {
        return $this->payment_status
            === self::PAYMENT_STATUS_PAID;
    }
}
