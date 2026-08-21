<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicTableSessionResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'session_token' =>
            $this->public_token,

            'guest_count' =>
            (int) $this->guest_count,

            'status' =>
            $this->status,

            'opened_at' =>
            $this->opened_at
                ?->toISOString(),
        ];
    }
}
