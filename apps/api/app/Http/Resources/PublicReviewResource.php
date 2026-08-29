<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicReviewResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            (int)
            $this->id,

            'customer_name' =>
            (string)
            $this->customer_name,

            'rating' =>
            (int)
            $this->rating,

            'review' =>
            (string)
            $this->review,

            'is_featured' =>
            (bool)
            $this->is_featured,

            'created_at' =>
            $this->created_at
                ?->toISOString(),
        ];
    }
}
