<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GalleryImageResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            (int)
            $this->id,

            'caption' =>
            $this->title,

            'alt_text' =>
            $this->alt_text,

            'image_url' =>
            $this->imageUrl(),

            'sort_order' =>
            (int)
            $this->sort_order,

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

    private function imageUrl(): ?string
    {
        if (
            ! $this->image_path
        ) {
            return null;
        }

        return url(
            '/storage/'
                .
                ltrim(
                    $this->image_path,
                    '/'
                )
        );
    }
}
