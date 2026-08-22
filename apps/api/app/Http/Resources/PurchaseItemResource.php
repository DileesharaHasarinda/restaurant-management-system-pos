<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseItemResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'ingredient' =>
            $this->ingredient
                ? [
                    'id' =>
                    $this->ingredient->id,

                    'sku' =>
                    $this->ingredient->sku,

                    'name' =>
                    $this->ingredient->name,

                    'base_unit' =>
                    $this->ingredient->baseUnit
                        ? [
                            'id' =>
                            $this->ingredient
                                ->baseUnit
                                ->id,

                            'symbol' =>
                            $this->ingredient
                                ->baseUnit
                                ->symbol,
                        ]
                        : null,
                ]
                : null,

            'purchase_unit' =>
            $this->unit
                ? [
                    'id' =>
                    $this->unit->id,

                    'name' =>
                    $this->unit->name,

                    'symbol' =>
                    $this->unit->symbol,
                ]
                : null,

            'quantity' =>
            (float) $this->quantity,

            'unit_cost' =>
            (float) $this->unit_cost,

            'line_total' =>
            (float) $this->line_total,

            'base_quantity' =>
            $this->base_quantity !== null
                ? (float) $this->base_quantity
                : null,

            'base_unit_cost' =>
            $this->base_unit_cost !== null
                ? (float) $this->base_unit_cost
                : null,
        ];
    }
}
