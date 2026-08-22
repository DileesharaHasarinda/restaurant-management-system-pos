<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UnitResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'name' =>
            $this->name,

            'symbol' =>
            $this->symbol,

            'measurement_type' =>
            $this->measurement_type,

            'base_unit_id' =>
            $this->base_unit_id,

            'base_unit' =>
            $this->baseUnit
                ? [
                    'id' =>
                    $this
                        ->baseUnit
                        ->id,

                    'name' =>
                    $this
                        ->baseUnit
                        ->name,

                    'symbol' =>
                    $this
                        ->baseUnit
                        ->symbol,
                ]
                : null,

            'conversion_factor' =>
            (float)
            $this->conversion_factor,

            'is_root_unit' =>
            $this->base_unit_id
                === null,

            'is_active' =>
            (bool)
            $this->is_active,
        ];
    }
}
