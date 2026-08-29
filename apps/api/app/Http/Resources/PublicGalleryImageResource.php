<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicGalleryImageResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            (int)
            $this->id,

            'title' =>
            $this->title,

            'alt_text' =>
            $this->alt_text,

            'image_url' =>
            $this->imageUrl(),

            'sort_order' =>
            (int)
            $this->sort_order,
        ];
    }

    private function imageUrl(): ?string
    {
        if (
            ! $this->image_path
        ) {
            return null;
        }

        $path =
            ltrim(
                (string)
                $this->image_path,
                '/'
            );

        return url(
            '/storage/' . $path
        );
    }
}
