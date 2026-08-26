<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Wastage extends Model
{
    /*
    |--------------------------------------------------------------------------
    | Types
    |--------------------------------------------------------------------------
    */

    public const TYPE_INGREDIENT =
    'INGREDIENT';

    public const TYPE_PREPARED_ITEM =
    'PREPARED_ITEM';

    /*
    |--------------------------------------------------------------------------
    | Reasons
    |--------------------------------------------------------------------------
    */

    public const REASON_EXPIRED =
    'EXPIRED';

    public const REASON_SPOILED =
    'SPOILED';

    public const REASON_DAMAGED =
    'DAMAGED';

    public const REASON_COOKING_ERROR =
    'COOKING_ERROR';

    public const REASON_DROPPED =
    'DROPPED';

    public const REASON_OVERPRODUCTION =
    'OVERPRODUCTION';

    public const REASON_STAFF_MEAL =
    'STAFF_MEAL';

    public const REASON_OTHER =
    'OTHER';

    /*
    |--------------------------------------------------------------------------
    | Status
    |--------------------------------------------------------------------------
    */

    public const STATUS_POSTED =
    'POSTED';

    protected $fillable = [
        'client_request_id',
        'wastage_number',
        'business_day_id',
        'wastage_type',
        'ingredient_id',
        'menu_item_id',
        'unit_id',
        'quantity',
        'base_quantity',
        'reason_code',
        'reason',
        'estimated_cost',
        'status',
        'created_by',
        'wasted_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' =>
            'decimal:4',

            'base_quantity' =>
            'decimal:4',

            'estimated_cost' =>
            'decimal:2',

            'wasted_at' =>
            'datetime',
        ];
    }

    public static function reasonCodes(): array
    {
        return [
            self::REASON_EXPIRED,
            self::REASON_SPOILED,
            self::REASON_DAMAGED,
            self::REASON_COOKING_ERROR,
            self::REASON_DROPPED,
            self::REASON_OVERPRODUCTION,
            self::REASON_STAFF_MEAL,
            self::REASON_OTHER,
        ];
    }

    public static function reasonLabels(): array
    {
        return [
            self::REASON_EXPIRED =>
            'Expired',

            self::REASON_SPOILED =>
            'Spoiled',

            self::REASON_DAMAGED =>
            'Damaged',

            self::REASON_COOKING_ERROR =>
            'Cooking Error',

            self::REASON_DROPPED =>
            'Dropped',

            self::REASON_OVERPRODUCTION =>
            'Overproduction',

            self::REASON_STAFF_MEAL =>
            'Staff Meal',

            self::REASON_OTHER =>
            'Other',
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

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(
            MenuItem::class
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
}
