<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BusinessDayResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'business_date' =>
            $this
                ->business_date
                ?->toDateString(),

            'status' =>
            $this->status,

            'opened_by' =>
            $this->openedBy
                ? [
                    'id' =>
                    $this
                        ->openedBy
                        ->id,

                    'name' =>
                    $this
                        ->openedBy
                        ->name,
                ]
                : null,

            'closed_by' =>
            $this->closedBy
                ? [
                    'id' =>
                    $this
                        ->closedBy
                        ->id,

                    'name' =>
                    $this
                        ->closedBy
                        ->name,
                ]
                : null,

            'opened_at' =>
            $this
                ->opened_at
                ?->toISOString(),

            'closed_at' =>
            $this
                ->closed_at
                ?->toISOString(),

            'notes' =>
            $this->notes,
        ];
    }
}
