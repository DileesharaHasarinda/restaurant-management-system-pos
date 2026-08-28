<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class BusinessDayClosing extends Model
{
    protected $fillable = [
        'business_day_id',

        'client_request_id',
        'request_hash',

        'total_sales',
        'total_discounts',
        'total_refunds',

        'cash_sales',
        'card_sales',
        'qr_sales',
        'bank_sales',
        'other_sales',

        'total_cogs',
        'gross_profit',

        'total_expenses',
        'total_wastage_cost',
        'estimated_net_profit',

        'total_purchases',
        'supplier_payments',

        'expected_cash',
        'actual_cash',
        'cash_difference',

        'snapshot',
        'closing_notes',

        'closed_by',
        'closed_at',
    ];

    protected $hidden = [
        'request_hash',
    ];

    protected function casts(): array
    {
        return [
            'total_sales' =>
            'decimal:2',

            'total_discounts' =>
            'decimal:2',

            'total_refunds' =>
            'decimal:2',

            'cash_sales' =>
            'decimal:2',

            'card_sales' =>
            'decimal:2',

            'qr_sales' =>
            'decimal:2',

            'bank_sales' =>
            'decimal:2',

            'other_sales' =>
            'decimal:2',

            'total_cogs' =>
            'decimal:2',

            'gross_profit' =>
            'decimal:2',

            'total_expenses' =>
            'decimal:2',

            'total_wastage_cost' =>
            'decimal:2',

            'estimated_net_profit' =>
            'decimal:2',

            'total_purchases' =>
            'decimal:2',

            'supplier_payments' =>
            'decimal:2',

            'expected_cash' =>
            'decimal:2',

            'actual_cash' =>
            'decimal:2',

            'cash_difference' =>
            'decimal:2',

            'snapshot' =>
            'array',

            'closed_at' =>
            'datetime',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Immutable Historical Closing
    |--------------------------------------------------------------------------
    */

    protected static function booted(): void
    {
        static::updating(
            function (): never {
                throw new LogicException(
                    'Business day closing snapshots are immutable.'
                );
            }
        );

        static::deleting(
            function (): never {
                throw new LogicException(
                    'Business day closing snapshots cannot be deleted.'
                );
            }
        );
    }

    public function businessDay(): BelongsTo
    {
        return $this->belongsTo(
            BusinessDay::class
        );
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'closed_by'
        );
    }
}
