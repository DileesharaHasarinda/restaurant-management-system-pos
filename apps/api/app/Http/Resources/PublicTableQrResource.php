<?php

namespace App\Http\Resources;

use App\Models\RestaurantTable;
use App\Models\TableSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\TableQrToken
 */
class PublicTableQrResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $this->resource->loadMissing(
            'restaurantTable.openSession'
        );

        /** @var RestaurantTable|null $restaurantTable */
        $restaurantTable =
            $this->resource->restaurantTable;

        if (! $restaurantTable) {
            return [
                'table' => null,
                'qr_ordering_enabled' => false,
                'can_order' => false,
                'session' => null,
            ];
        }

        /** @var TableSession|null $openSession */
        $openSession =
            $restaurantTable->openSession;

        return [
            'table' => [
                'id' =>
                $restaurantTable->id,

                'number' =>
                (int)
                $restaurantTable->table_number,

                'code' =>
                $restaurantTable->code,

                'name' =>
                $restaurantTable->name,

                'area' =>
                $restaurantTable->area,

                'capacity' =>
                (int)
                $restaurantTable->capacity,

                'status' =>
                $restaurantTable->status,
            ],

            'qr_ordering_enabled' =>
            (bool)
            $restaurantTable
                ->qr_ordering_enabled,

            'can_order' =>
            $restaurantTable->is_active
                && $restaurantTable
                ->qr_ordering_enabled,

            'session' =>
            $openSession
                ? (
                    new PublicTableSessionResource(
                        $openSession
                    )
                )->resolve(
                    $request
                )
                : null,
        ];
    }
}
