<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MenuItem extends Model
{
    protected $fillable = [
        'category_id',
        'sku',
        'name',
        'slug',
        'description',
        'image',
        'image_path',
        'price',
        'tax_rate',
        'is_available',
        'is_active',
        'is_visible_on_website',
        'is_visible_on_qr',
        'has_variants',
        'sort_order',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'tax_rate' => 'decimal:4',

            'is_available' => 'boolean',
            'is_active' => 'boolean',

            'is_visible_on_website' =>
            'boolean',

            'is_visible_on_qr' =>
            'boolean',

            'has_variants' =>
            'boolean',

            'sort_order' =>
            'integer',

            'metadata' =>
            'array',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(
            Category::class
        );
    }

    public function variants(): HasMany
    {
        return $this
            ->hasMany(
                MenuItemVariant::class
            )
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function addons(): BelongsToMany
    {
        return $this
            ->belongsToMany(
                Addon::class,
                'menu_item_addons',
                'menu_item_id',
                'addon_id'
            )
            ->withPivot([
                'price_override',
                'is_default',
                'sort_order',
            ])
            ->withTimestamps()
            ->orderByPivot(
                'sort_order'
            );
    }
}
