<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MenuCategoryResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'name' =>
            $this->name,

            'slug' =>
            $this->slug,

            'description' =>
            $this->description,

            'sort_order' =>
            (int) $this->sort_order,

            'is_active' =>
            (bool) $this->is_active,

            'is_visible_on_website' =>
            (bool)
            $this->is_visible_on_website,

            'is_visible_on_qr' =>
            (bool)
            $this->is_visible_on_qr,

            'menu_items_count' =>
            isset(
                $this->menu_items_count
            )
                ? (int)
                $this->menu_items_count
                : null,

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
