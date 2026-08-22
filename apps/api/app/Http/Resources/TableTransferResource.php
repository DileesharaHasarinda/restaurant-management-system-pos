<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TableTransferResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'table_session_id' =>
            $this->table_session_id,

            'from_table' => [
                'id' =>
                $this->fromTable?->id,

                'table_number' =>
                $this->fromTable
                    ?->table_number,

                'code' =>
                $this->fromTable?->code,

                'name' =>
                $this->fromTable?->name,
            ],

            'to_table' => [
                'id' =>
                $this->toTable?->id,

                'table_number' =>
                $this->toTable
                    ?->table_number,

                'code' =>
                $this->toTable?->code,

                'name' =>
                $this->toTable?->name,
            ],

            'reason' =>
            $this->reason,

            'transferred_by' =>
            $this->transferredBy
                ? [
                    'id' =>
                    $this->transferredBy->id,

                    'name' =>
                    $this->transferredBy->name,
                ]
                : null,

            'transferred_at' =>
            $this->transferred_at
                ?->toISOString(),
        ];
    }
}
