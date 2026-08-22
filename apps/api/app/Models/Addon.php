<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Addon extends Model
{
    protected $fillable = [
        'addon_group_id',
        'name',
        'sku',
        'price',
        'is_available',
        'consumes_inventory',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',

            'is_available' =>
            'boolean',

            'consumes_inventory' =>
            'boolean',

            'is_active' =>
            'boolean',

            'sort_order' =>
            'integer',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(
            AddonGroup::class,
            'addon_group_id'
        );
    }

    public function menuItems(): BelongsToMany
    {
        return $this
            ->belongsToMany(
                MenuItem::class,
                'menu_item_addons',
                'addon_id',
                'menu_item_id'
            )
            ->withPivot([
                'price_override',
                'is_default',
                'sort_order',
            ])
            ->withTimestamps();
    }

    public function recipeComponents(): HasMany
    {
        return $this->hasMany(
            AddonRecipeComponent::class,
            'addon_id'
        );
    }
}
