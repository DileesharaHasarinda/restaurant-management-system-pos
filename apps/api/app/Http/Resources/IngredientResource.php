<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IngredientResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'sku' =>
            $this->sku,

            'name' =>
            $this->name,

            'base_unit' =>
            $this->baseUnit
                ? [
                    'id' =>
                    $this->baseUnit->id,

                    'name' =>
                    $this->baseUnit->name,

                    'symbol' =>
                    $this->baseUnit->symbol,

                    'measurement_type' =>
                    $this->baseUnit
                        ->measurement_type,
                ]
                : null,

            'current_stock' =>
            (float)
            $this->current_stock,

            'minimum_stock' =>
            (float)
            $this->reorder_level,

            'average_cost' =>
            (float)
            $this->average_cost,

            'stock_value' =>
            $this->stockValue(),

            'is_low_stock' =>
            $this->isLowStock(),

            'is_out_of_stock' =>
            $this->isOutOfStock(),

            'stock_status' =>
            $this->isOutOfStock()
                ? 'OUT_OF_STOCK'
                : (
                    $this->isLowStock()
                    ? 'LOW_STOCK'
                    : 'IN_STOCK'
                ),

            'track_stock' =>
            (bool)
            $this->track_stock,

            'storage_location' =>
            $this->storage_location,

            'is_active' =>
            (bool)
            $this->is_active,

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
