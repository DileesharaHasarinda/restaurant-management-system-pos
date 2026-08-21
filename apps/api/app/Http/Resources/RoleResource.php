<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoleResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'name' =>
            $this->name,

            'code' =>
            $this->code,

            'description' =>
            $this->description,

            'is_active' =>
            (bool) $this->is_active,

            'permissions' =>
            $this->whenLoaded(
                'permissions',
                fn() =>
                $this->permissions
                    ->pluck('code')
                    ->sort()
                    ->values()
                    ->all()
            ),
        ];
    }
}
