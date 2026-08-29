<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserSessionResource extends JsonResource
{
    /*
    |--------------------------------------------------------------------------
    | User Session Resource
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | Do not return parent::toArray().
    |
    | Personal access token records contain internal authentication
    | information that should never be exposed through the administration
    | API.
    |
    | Only safe session metadata is returned.
    |
    */

    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            (int)
            $this->id,

            'name' =>
            (string)
            $this->name,

            'abilities' =>
            is_array(
                $this->abilities
            )
                ? array_values(
                    $this->abilities
                )
                : [],

            'last_used_at' =>
            $this->last_used_at
                ?->toISOString(),

            'expires_at' =>
            $this->expires_at
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
