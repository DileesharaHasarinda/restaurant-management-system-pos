<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TableResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $this->resource->loadMissing([
            'activeQrToken',
            'openSession',
        ]);

        return [
            'id' =>
            $this->id,

            'table_number' =>
            (int) $this->table_number,

            'code' =>
            $this->code,

            'name' =>
            $this->name,

            'area' =>
            $this->area,

            'capacity' =>
            (int) $this->capacity,

            'status' =>
            $this->status,

            'qr_ordering_enabled' =>
            (bool)
            $this->qr_ordering_enabled,

            'is_active' =>
            (bool) $this->is_active,

            'sort_order' =>
            (int) $this->sort_order,

            'notes' =>
            $this->notes,

            'qr' =>
            $this->activeQrToken
                ? (
                    new TableQrTokenResource(
                        $this->activeQrToken
                    )
                )->resolve($request)
                : null,

            'current_session' =>
            $this->openSession
                ? (
                    new TableSessionResource(
                        $this->openSession
                    )
                )->resolve($request)
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
