<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ingredient extends Model
{
    protected $fillable = [
        'sku',
        'name',
        'base_unit_id',
        'current_stock',
        'reorder_level',

        /*
         * Database canonical field.
         */
        'average_cost_per_base_unit',

        /*
         * Backward-compatible application alias.
         *
         * Existing inventory, purchase, recipe and resource
         * services use $ingredient->average_cost.
         *
         * The accessor/mutator below transparently maps it to:
         *
         * average_cost_per_base_unit
         */
        'average_cost',

        'track_stock',
        'is_active',
        'storage_location',
    ];

    protected function casts(): array
    {
        return [
            'current_stock' =>
            'decimal:4',

            'reorder_level' =>
            'decimal:4',

            'average_cost_per_base_unit' =>
            'decimal:6',

            'track_stock' =>
            'boolean',

            'is_active' =>
            'boolean',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Average Cost Compatibility Alias
    |--------------------------------------------------------------------------
    |
    | Database:
    |
    | average_cost_per_base_unit
    |
    | Existing application code:
    |
    | $ingredient->average_cost
    |
    | This keeps the database schema authoritative while allowing all
    | existing services to continue using average_cost safely.
    |
    | Reading:
    |
    | $ingredient->average_cost
    |       ↓
    | average_cost_per_base_unit
    |
    | Writing:
    |
    | $ingredient->average_cost = 1.25
    |       ↓
    | average_cost_per_base_unit = 1.250000
    |
    */

    protected function averageCost(): Attribute
    {
        return Attribute::make(
            get: fn(
                mixed $value,
                array $attributes
            ): float =>
            (float)
            (
                $attributes['average_cost_per_base_unit']
                ?? 0
            ),

            set: fn(
                mixed $value
            ): array => [
                'average_cost_per_base_unit' =>
                round(
                    (float)
                    $value,
                    6
                ),
            ]
        );
    }

    public function baseUnit(): BelongsTo
    {
        return $this->belongsTo(
            Unit::class,
            'base_unit_id'
        );
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(
            StockMovement::class,
            'ingredient_id'
        );
    }

    public function recipeComponents(): HasMany
    {
        return $this->hasMany(
            RecipeComponent::class,
            'ingredient_id'
        );
    }

    public function isLowStock(): bool
    {
        if (
            ! $this->track_stock
        ) {
            return false;
        }

        $currentStock =
            (float)
            $this->current_stock;

        $minimumStock =
            (float)
            $this->reorder_level;

        if (
            $currentStock <= 0
        ) {
            return false;
        }

        if (
            $minimumStock <= 0
        ) {
            return false;
        }

        return $currentStock
            <=
            $minimumStock;
    }

    public function isOutOfStock(): bool
    {
        if (
            ! $this->track_stock
        ) {
            return false;
        }

        return (float)
        $this->current_stock
            <= 0;
    }

    /*
    |--------------------------------------------------------------------------
    | Current Stock Valuation
    |--------------------------------------------------------------------------
    */

    public function stockValue(): float
    {
        return round(
            (float)
            $this->current_stock
                *
                (float)
                $this->average_cost,
            2
        );
    }
}
