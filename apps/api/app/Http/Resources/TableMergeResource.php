<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TableMergeResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'source_session_id' =>
            $this->source_session_id,

            'target_session_id' =>
            $this->target_session_id,

            'source_table' => [
                'id' =>
                $this->sourceTable?->id,

                'table_number' =>
                $this->sourceTable
                    ?->table_number,

                'code' =>
                $this->sourceTable?->code,

                'name' =>
                $this->sourceTable?->name,
            ],

            'target_table' => [
                'id' =>
                $this->targetTable?->id,

                'table_number' =>
                $this->targetTable
                    ?->table_number,

                'code' =>
                $this->targetTable?->code,

                'name' =>
                $this->targetTable?->name,
            ],

            'reason' =>
            $this->reason,

            'merged_by' =>
            $this->mergedBy
                ? [
                    'id' =>
                    $this->mergedBy->id,

                    'name' =>
                    $this->mergedBy->name,
                ]
                : null,

            'merged_at' =>
            $this->merged_at
                ?->toISOString(),
        ];
    }
}
