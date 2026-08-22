<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AddonResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $basePrice =
            (float) $this->price;

        $pivotPrice =
            $this->pivot?->price_override;

        return [
            'id' =>
            $this->id,

            'consumes_inventory' =>
            (bool)
            $this->consumes_inventory,

            'addon_group_id' =>
            $this->addon_group_id,

            'sku' =>
            $this->sku,

            'name' =>
            $this->name,

            'base_price' =>
            $basePrice,

            'price' =>
            $pivotPrice !== null
                ? (float) $pivotPrice
                : $basePrice,

            'is_available' =>
            (bool) $this->is_available,

            'is_active' =>
            (bool) $this->is_active,

            'is_default' =>
            isset($this->pivot)
                ? (bool)
                $this->pivot->is_default
                : false,

            'sort_order' =>
            isset($this->pivot)
                ? (int)
                $this->pivot->sort_order
                : (int)
                $this->sort_order,
        ];
    }
}
