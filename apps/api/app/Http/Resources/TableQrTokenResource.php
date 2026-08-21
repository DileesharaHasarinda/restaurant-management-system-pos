<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TableQrTokenResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'token' =>
            $this->token,

            'order_url' =>
            $this->getOrderUrl(),

            'is_active' =>
            (bool) $this->is_active,

            'expires_at' =>
            $this->expires_at
                ?->toISOString(),

            'last_scanned_at' =>
            $this->last_scanned_at
                ?->toISOString(),

            'created_at' =>
            $this->created_at
                ?->toISOString(),
        ];
    }

    private function getOrderUrl(): string
    {
        return sprintf(
            '%s/%s',
            rtrim(
                (string) config(
                    'restaurant.customer_order_base_url'
                ),
                '/'
            ),
            $this->token
        );
    }
}
