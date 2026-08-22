<?php

namespace App\Models;

use LogicException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    public const TYPE_OPENING_BALANCE =
    'OPENING_BALANCE';

    public const TYPE_PURCHASE =
    'PURCHASE';

    public const TYPE_SALE_CONSUMPTION =
    'SALE_CONSUMPTION';

    public const TYPE_WASTAGE =
    'WASTAGE';

    public const TYPE_ADJUSTMENT_IN =
    'ADJUSTMENT_IN';

    public const TYPE_ADJUSTMENT_OUT =
    'ADJUSTMENT_OUT';

    public const TYPE_CANCELLATION_REVERSAL =
    'CANCELLATION_REVERSAL';

    public $timestamps = false;

    protected $fillable = [
        'movement_key',
        'ingredient_id',
        'business_day_id',
        'movement_type',
        'quantity_delta',
        'balance_after',
        'unit_cost',
        'total_cost',
        'source_type',
        'source_id',
        'reference',
        'notes',
        'created_by',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity_delta' =>
            'decimal:4',

            'balance_after' =>
            'decimal:4',

            'unit_cost' =>
            'decimal:4',

            'total_cost' =>
            'decimal:2',

            'occurred_at' =>
            'datetime',
        ];
    }

    protected static function booted(): void
    {
        /*
         * Stock ledger rows are immutable.
         *
         * If a historical stock operation is wrong,
         * create a correcting movement instead of
         * editing/deleting history.
         */
        static::updating(
            function (): void {
                throw new LogicException(
                    'Stock movements are immutable and cannot be updated.'
                );
            }
        );

        static::deleting(
            function (): void {
                throw new LogicException(
                    'Stock movements are immutable and cannot be deleted.'
                );
            }
        );
    }

    public static function movementTypes(): array
    {
        return [
            self::TYPE_OPENING_BALANCE,
            self::TYPE_PURCHASE,
            self::TYPE_SALE_CONSUMPTION,
            self::TYPE_WASTAGE,
            self::TYPE_ADJUSTMENT_IN,
            self::TYPE_ADJUSTMENT_OUT,
            self::TYPE_CANCELLATION_REVERSAL,
        ];
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(
            Ingredient::class
        );
    }

    public function businessDay(): BelongsTo
    {
        return $this->belongsTo(
            BusinessDay::class
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
