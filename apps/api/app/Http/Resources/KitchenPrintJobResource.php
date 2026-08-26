<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class KitchenPrintJobResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'job_number' =>
            $this->job_number,

            'order_id' =>
            $this->order_id,

            'job_type' =>
            $this->job_type,

            'printer_name' =>
            $this->printer_name,

            'printer_address' =>
            $this->printer_address,

            'payload' =>
            $this->payload,

            'status' =>
            $this->status,

            'attempts' =>
            (int)
            $this->attempts,

            'last_error' =>
            $this->last_error,

            'requested_by' =>
            $this->requested_by,

            'queued_at' =>
            $this->queued_at
                ?->toISOString(),

            'printed_at' =>
            $this->printed_at
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
