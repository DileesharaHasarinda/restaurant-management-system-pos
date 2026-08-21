<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TableSessionResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'session_number' =>
            $this->session_number,

            'public_token' =>
            $this->public_token,

            'business_day_id' =>
            $this->business_day_id,

            'table_id' =>
            $this->table_id,

            'guest_count' =>
            (int) $this->guest_count,

            'opened_source' =>
            $this->opened_source,

            'status' =>
            $this->status,

            'opened_at' =>
            $this->opened_at
                ?->toISOString(),

            'closed_at' =>
            $this->closed_at
                ?->toISOString(),

            'close_reason' =>
            $this->close_reason,

            'last_activity_at' =>
            $this->last_activity_at
                ?->toISOString(),
        ];
    }
}
