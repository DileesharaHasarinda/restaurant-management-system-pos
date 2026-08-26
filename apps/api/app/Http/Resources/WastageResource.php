<?php

namespace App\Http\Resources;

use App\Models\Wastage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Wastage
 */
class WastageResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'client_request_id' =>
            $this->client_request_id,

            'wastage_number' =>
            $this->wastage_number,

            'wastage_type' =>
            $this->wastage_type,

            'status' =>
            $this->status,

            'business_day_id' =>
            $this->business_day_id,

            'ingredient' =>
            $this->ingredient
                ? [
                    'id' =>
                    $this
                        ->ingredient
                        ->id,

                    'sku' =>
                    $this
                        ->ingredient
                        ->sku,

                    'name' =>
                    $this
                        ->ingredient
                        ->name,

                    'current_stock' =>
                    (float)
                    $this
                        ->ingredient
                        ->current_stock,

                    'base_unit' =>
                    $this
                        ->ingredient
                        ->baseUnit
                        ? [
                            'id' =>
                            $this
                                ->ingredient
                                ->baseUnit
                                ->id,

                            'name' =>
                            $this
                                ->ingredient
                                ->baseUnit
                                ->name,

                            'symbol' =>
                            $this
                                ->ingredient
                                ->baseUnit
                                ->symbol,
                        ]
                        : null,
                ]
                : null,

            'entered_quantity' => [
                'quantity' =>
                (float)
                $this->quantity,

                'unit' =>
                $this->unit
                    ? [
                        'id' =>
                        $this
                            ->unit
                            ->id,

                        'name' =>
                        $this
                            ->unit
                            ->name,

                        'symbol' =>
                        $this
                            ->unit
                            ->symbol,
                    ]
                    : null,
            ],

            'base_quantity' =>
            (float)
            $this->base_quantity,

            'reason_code' =>
            $this->reason_code,

            'reason_label' =>
            Wastage::reasonLabels()[$this->reason_code]
                ?? $this->reason_code,

            'reason' =>
            $this->reason,

            'estimated_cost' =>
            (float)
            $this->estimated_cost,

            'created_by' =>
            $this->createdBy
                ? [
                    'id' =>
                    $this
                        ->createdBy
                        ->id,

                    'name' =>
                    $this
                        ->createdBy
                        ->name,
                ]
                : null,

            'wasted_at' =>
            $this
                ->wasted_at
                ?->toISOString(),

            'created_at' =>
            $this
                ->created_at
                ?->toISOString(),
        ];
    }
}
