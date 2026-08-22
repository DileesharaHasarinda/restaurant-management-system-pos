<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MenuItemResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'category_id' =>
            $this->category_id,

            'sku' =>
            $this->sku,

            'name' =>
            $this->name,

            'slug' =>
            $this->slug,

            'description' =>
            $this->description,

            'photo_url' =>
            $this->photoUrl(),

            'price' =>
            (float) $this->price,

            'tax_rate' =>
            (float) $this->tax_rate,

            'is_available' =>
            (bool) $this->is_available,

            'is_active' =>
            (bool) $this->is_active,

            'is_visible_on_website' =>
            (bool)
            $this->is_visible_on_website,

            'is_visible_on_qr' =>
            (bool)
            $this->is_visible_on_qr,

            'has_variants' =>
            (bool)
            $this->has_variants,

            'sort_order' =>
            (int) $this->sort_order,

            'category' =>
            $this->category
                ? [
                    'id' =>
                    $this->category->id,

                    'name' =>
                    $this->category->name,

                    'slug' =>
                    $this->category->slug,
                ]
                : null,

            'variants' =>
            MenuItemVariantResource::collection(
                $this->whenLoaded(
                    'variants'
                )
            )->resolve(
                $request
            ),

            'addons' =>
            AddonResource::collection(
                $this->whenLoaded(
                    'addons'
                )
            )->resolve(
                $request
            ),

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }

    private function photoUrl(): ?string
    {
        $path =
            $this->getAttribute(
                'image_path'
            )
            ?? $this->getAttribute(
                'image'
            );

        if (! $path) {
            return null;
        }

        return url(
            '/storage/' .
                ltrim(
                    (string) $path,
                    '/'
                )
        );
    }
}
