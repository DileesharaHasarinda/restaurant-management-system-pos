<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseItem extends Model
{
    protected $fillable = [
        'purchase_id',
        'ingredient_id',
        'unit_id',
        'quantity',
        'unit_cost',
        'line_total',
        'base_quantity',
        'base_unit_cost',
    ];

    protected function casts(): array
    {
        return [
            'quantity' =>
            'decimal:4',

            'unit_cost' =>
            'decimal:4',

            'line_total' =>
            'decimal:2',

            'base_quantity' =>
            'decimal:4',

            'base_unit_cost' =>
            'decimal:4',
        ];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(
            Purchase::class
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
}
