<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemAddon extends Model
{
    protected $fillable = [
        'order_item_id',
        'addon_id',

        'addon_name_snapshot',

        /*
         * Quantity PER ordered menu item.
         *
         * Example:
         *
         * 2 Fried Rice
         * Extra Egg x1 each
         *
         * quantity = 1
         *
         * line_total will still include:
         * 1 × 2 × addon price
         */
        'quantity',

        'unit_price',
        'line_total',
        'estimated_cost_total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' =>
            'decimal:3',

            'unit_price' =>
            'decimal:2',

            'line_total' =>
            'decimal:2',

            'estimated_cost_total' =>
            'decimal:2',
        ];
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(
            OrderItem::class,
            'order_item_id'
        );
    }

    public function addon(): BelongsTo
    {
        return $this->belongsTo(
            Addon::class,
            'addon_id'
        );
    }
}
