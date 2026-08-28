<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CashierShift extends Model
{
    public const STATUS_OPEN =
    'OPEN';

    public const STATUS_CLOSED =
    'CLOSED';

    protected $fillable = [
        'open_request_id',
        'open_request_hash',

        'close_request_id',
        'close_request_hash',

        'shift_number',

        'business_day_id',
        'cashier_id',

        'terminal_name',

        'open_shift_key',

        'opening_float',
        'expected_cash',

        'actual_cash',
        'cash_difference',

        'status',

        'opened_at',
        'closed_at',
        'closed_by',

        'opening_notes',
        'closing_notes',
    ];

    protected $hidden = [
        'open_request_hash',
        'close_request_hash',
        'open_shift_key',
    ];

    protected function casts(): array
    {
        return [
            'opening_float' =>
            'decimal:2',

            'expected_cash' =>
            'decimal:2',

            'actual_cash' =>
            'decimal:2',

            'cash_difference' =>
            'decimal:2',

            'opened_at' =>
            'datetime',

            'closed_at' =>
            'datetime',
        ];
    }

    public function businessDay(): BelongsTo
    {
        return $this->belongsTo(
            BusinessDay::class
        );
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'cashier_id'
        );
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'closed_by'
        );
    }

    public function cashDrawerMovements(): HasMany
    {
        return $this->hasMany(
            CashDrawerMovement::class
        );
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(
            Expense::class
        );
    }
}
