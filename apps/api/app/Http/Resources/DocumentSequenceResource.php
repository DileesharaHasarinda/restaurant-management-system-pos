<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentSequenceResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'type' =>
            strtolower(
                $this->sequence_type
            ),

            'prefix' =>
            $this->prefix,

            'current_number' =>
            (int)
            $this->current_number,

            'padding' =>
            (int)
            $this->padding,

            'reset_period' =>
            $this->reset_period,

            'is_active' =>
            (bool)
            $this->is_active,
        ];
    }
}
