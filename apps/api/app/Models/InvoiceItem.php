<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    protected $fillable = [
        'invoice_id',

        'order_item_id',

        'item_name_snapshot',
        'variant_name_snapshot',

        'quantity',
        'unit_price',

        'gross_total',
        'discount_total',
        'tax_total',
        'line_total',

        'unit_cost_snapshot',
        'cost_total_snapshot',

        'addons_snapshot',
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

            'unit_cost_snapshot' =>
            'decimal:4',

            'cost_total_snapshot' =>
            'decimal:2',

            'addons_snapshot' =>
            'array',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(
            Invoice::class,
            'invoice_id'
        );
    }

    /*
     * This relationship exists only for traceability.
     *
     * Financial invoice rendering MUST NOT use the current
     * OrderItem values. Invoice snapshots are authoritative.
     */
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(
            OrderItem::class,
            'order_item_id'
        );
    }
}
