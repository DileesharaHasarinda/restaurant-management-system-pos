<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $this->resource
            ->loadMissing(
                'role.permissions'
            );

        return [
            'id' =>
            $this->id,

            'name' =>
            $this->name,

            'username' =>
            $this->username,

            'email' =>
            $this->email,

            'phone' =>
            $this->phone,

            'status' =>
            $this->status,

            'last_login_at' =>
            $this->last_login_at
                ?->toISOString(),

            'role' =>
            $this->role
                ? [
                    'id' =>
                    $this->role->id,

                    'name' =>
                    $this->role->name,

                    'code' =>
                    $this->role->code,
                ]
                : null,

            'permissions' =>
            $this->role
                ? $this->role
                ->permissions
                ->pluck('code')
                ->sort()
                ->values()
                ->all()
                : [],

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
