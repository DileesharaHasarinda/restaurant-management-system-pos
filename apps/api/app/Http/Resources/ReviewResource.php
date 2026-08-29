<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReviewResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            (int)
            $this->id,

            'customer_name' =>
            $this->customer_name,

            'rating' =>
            (int)
            $this->rating,

            'review' =>
            $this->review,

            'status' =>
            $this->status,

            'is_featured' =>
            (bool)
            $this->is_featured,

            'is_visible' =>
            (bool)
            $this->is_visible,

            'reviewed_by' =>
            $this->reviewedBy
                ? [
                    'id' =>
                    $this->reviewedBy->id,

                    'name' =>
                    $this->reviewedBy->name,
                ]
                : null,

            'reviewed_at' =>
            $this->reviewed_at
                ?->toISOString(),

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
