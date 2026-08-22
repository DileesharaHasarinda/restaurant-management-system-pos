<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MenuItemVariantResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'name' => $this->name,

            'price' =>
            (float) $this->price,

            'is_default' =>
            (bool) $this->is_default,

            'is_available' =>
            (bool) $this->is_available,

            'is_active' =>
            (bool) $this->is_active,

            'sort_order' =>
            (int) $this->sort_order,
        ];
    }
}
