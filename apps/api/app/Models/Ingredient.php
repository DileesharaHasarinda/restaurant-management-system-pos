<?php

namespace App\Models;

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
        'average_cost',
        'track_stock',
        'is_active',
        'storage_location',
    ];

    protected function casts(): array
    {
        return [
            'current_stock' => 'decimal:4',
            'reorder_level' => 'decimal:4',
            'average_cost' => 'decimal:4',
            'track_stock' => 'boolean',
            'is_active' => 'boolean',
        ];
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
        if (! $this->track_stock) {
            return false;
        }

        $currentStock =
            (float) $this->current_stock;

        $minimumStock =
            (float) $this->reorder_level;

        if ($currentStock <= 0) {
            return false;
        }

        if ($minimumStock <= 0) {
            return false;
        }

        return $currentStock
            <= $minimumStock;
    }

    public function isOutOfStock(): bool
    {
        if (! $this->track_stock) {
            return false;
        }

        return (float)
        $this->current_stock <= 0;
    }

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
