<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'name' =>
            $this->name,

            'phone' =>
            $this->phone,

            'email' =>
            $this->email,

            'address' =>
            $this->address,

            'notes' =>
            $this->notes,

            'current_balance' =>
            (float)
            ($this->current_balance ?? 0),

            'is_active' =>
            (bool) $this->is_active,

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
