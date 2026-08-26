<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustment extends Model
{
    public const DIRECTION_IN =
    'IN';

    public const DIRECTION_OUT =
    'OUT';

    public const DIRECTION_NONE =
    'NONE';

    public const STATUS_DRAFT =
    'DRAFT';

    public const STATUS_POSTED =
    'POSTED';

    protected $fillable = [
        'client_request_id',
        'adjustment_number',
        'business_day_id',
        'ingredient_id',
        'unit_id',

        'system_quantity',
        'actual_quantity',

        'system_base_quantity',
        'actual_base_quantity',

        'direction',
        'quantity',
        'base_quantity',
        'unit_cost',

        'reason',
        'status',

        'created_by',
        'approved_by',

        'posted_at',
        'stock_movement_id',
    ];

    protected function casts(): array
    {
        return [
            'system_quantity' =>
            'decimal:4',

            'actual_quantity' =>
            'decimal:4',

            'system_base_quantity' =>
            'decimal:4',

            'actual_base_quantity' =>
            'decimal:4',

            'quantity' =>
            'decimal:4',

            'base_quantity' =>
            'decimal:4',

            /*
             * Cost is per ingredient BASE unit.
             */
            'unit_cost' =>
            'decimal:6',

            'posted_at' =>
            'datetime',
        ];
    }

    public function businessDay(): BelongsTo
    {
        return $this->belongsTo(
            BusinessDay::class
        );
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(
            Ingredient::class
        );
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(
            Unit::class
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

    public function stockMovement(): BelongsTo
    {
        return $this->belongsTo(
            StockMovement::class,
            'stock_movement_id'
        );
    }

    public function signedDifference(): float
    {
        $quantity =
            (float)
            $this->quantity;

        return match ($this->direction) {
            self::DIRECTION_IN =>
            $quantity,

            self::DIRECTION_OUT =>
            -$quantity,

            default =>
            0.0,
        };
    }

    public function signedBaseDifference(): float
    {
        $quantity =
            (float)
            $this->base_quantity;

        return match ($this->direction) {
            self::DIRECTION_IN =>
            $quantity,

            self::DIRECTION_OUT =>
            -$quantity,

            default =>
            0.0,
        };
    }
}
