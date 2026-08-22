<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockMovementResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'movement_key' =>
            $this->movement_key,

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

            'movement_type' =>
            $this->movement_type,

            'quantity_delta' =>
            (float)
            $this->quantity_delta,

            'balance_after' =>
            (float)
            $this->balance_after,

            'unit_cost' =>
            (float)
            $this->unit_cost,

            'total_cost' =>
            (float)
            $this->total_cost,

            'reference' =>
            $this->reference,

            'notes' =>
            $this->notes,

            'source' => [
                'type' =>
                $this->source_type,

                'id' =>
                $this->source_id,
            ],

            'business_day_id' =>
            $this->business_day_id,

            'created_by' =>
            $this->createdBy
                ? [
                    'id' =>
                    $this->createdBy->id,

                    'name' =>
                    $this->createdBy->name,
                ]
                : null,

            'occurred_at' =>
            $this->occurred_at
                ?->toISOString(),
        ];
    }
}
