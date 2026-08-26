<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashDrawerMovement extends Model
{
    public const TYPE_OPENING_FLOAT =
    'OPENING_FLOAT';

    public const TYPE_CASH_SALE =
    'CASH_SALE';

    public const TYPE_CASH_REFUND =
    'CASH_REFUND';

    public const TYPE_CASH_IN =
    'CASH_IN';

    public const TYPE_CASH_OUT =
    'CASH_OUT';

    public const TYPE_MANUAL_OPEN =
    'MANUAL_OPEN';

    protected $fillable = [
        'cashier_shift_id',
        'movement_type',
        'amount',
        'reference_type',
        'reference_id',
        'reason',
        'created_by',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' =>
            'decimal:2',

            'occurred_at' =>
            'datetime',
        ];
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
}
