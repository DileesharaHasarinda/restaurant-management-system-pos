<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AddonRecipeComponent extends Model
{
    protected $fillable = [
        'addon_id',
        'ingredient_id',
        'quantity',
        'unit_id',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
        ];
    }

    public function addon(): BelongsTo
    {
        return $this->belongsTo(
            Addon::class,
            'addon_id'
        );
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(
            Ingredient::class,
            'ingredient_id'
        );
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(
            Unit::class,
            'unit_id'
        );
    }
}
