<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    public const STATUS_ACTIVE =
    'ACTIVE';

    public const STATUS_CANCELLED =
    'CANCELLED';

    protected $fillable = [
        'order_id',

        'menu_item_id',
        'menu_item_variant_id',

        'item_name_snapshot',
        'variant_name_snapshot',

        'quantity',
        'unit_price',

        'gross_total',
        'discount_total',
        'tax_total',
        'line_total',

        'estimated_unit_cost',
        'estimated_cost_total',

        'status',
        'special_notes',

        'sent_to_kitchen_at',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' =>
            'decimal:3',

            'unit_price' =>
            'decimal:2',

            'gross_total' =>
            'decimal:2',

            'discount_total' =>
            'decimal:2',

            'tax_total' =>
            'decimal:2',

            'line_total' =>
            'decimal:2',

            'estimated_unit_cost' =>
            'decimal:4',

            'estimated_cost_total' =>
            'decimal:2',

            'sent_to_kitchen_at' =>
            'datetime',

            'cancelled_at' =>
            'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(
            Order::class,
            'order_id'
        );
    }

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(
            MenuItem::class,
            'menu_item_id'
        );
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(
            MenuItemVariant::class,
            'menu_item_variant_id'
        );
    }

    public function addons(): HasMany
    {
        return $this->hasMany(
            OrderItemAddon::class,
            'order_item_id'
        );
    }
}
