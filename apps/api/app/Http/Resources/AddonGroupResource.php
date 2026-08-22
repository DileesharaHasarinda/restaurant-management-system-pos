<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AddonGroupResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'name' =>
            $this->name,

            'description' =>
            $this->description,

            'is_required' =>
            (bool) $this->is_required,

            'is_active' =>
            (bool) $this->is_active,

            'sort_order' =>
            (int) $this->sort_order,

            'addons' =>
            AddonResource::collection(
                $this->whenLoaded(
                    'addons'
                )
            )->resolve(
                $request
            ),
        ];
    }
}
