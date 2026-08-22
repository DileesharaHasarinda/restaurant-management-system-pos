<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WaiterOrderResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $this->resource->loadMissing(
            'items.addons'
        );

        return [
            'id' =>
            $this->id,

            'order_number' =>
            $this->order_number,

            'table_id' =>
            $this->table_id,

            'table_session_id' =>
            $this->table_session_id,

            'table_name' =>
            $this->table_name_snapshot,

            'order_type' =>
            $this->order_type,

            'order_source' =>
            $this->order_source,

            'status' =>
            $this->status,

            'subtotal' =>
            (float) $this->subtotal,

            'discount_total' =>
            (float) $this->discount_total,

            'tax_total' =>
            (float) $this->tax_total,

            'service_charge_total' =>
            (float)
            $this->service_charge_total,

            'grand_total' =>
            (float) $this->grand_total,

            'can_add_items' =>
            ! in_array(
                $this->status,
                [
                    Order::STATUS_COMPLETED,
                    Order::STATUS_CANCELLED,
                    Order::STATUS_REJECTED,
                ],
                true
            ),

            'items' =>
            $this->items
                ->map(
                    fn($item): array => [
                        'id' =>
                        $item->id,

                        'name' =>
                        $item
                            ->item_name_snapshot,

                        'variant' =>
                        $item
                            ->variant_name_snapshot,

                        'quantity' =>
                        (float)
                        $item->quantity,

                        'unit_price' =>
                        (float)
                        $item->unit_price,

                        'line_total' =>
                        (float)
                        $item->line_total,

                        'status' =>
                        $item->status,

                        'kitchen_status' =>
                        $item->sent_to_kitchen_at
                            ? 'SENT_TO_KITCHEN'
                            : 'NOT_SENT_TO_KITCHEN',

                        'sent_to_kitchen_at' =>
                        $item
                            ->sent_to_kitchen_at
                            ?->toISOString(),

                        'special_notes' =>
                        $item->special_notes,

                        'addons' =>
                        $item->addons
                            ->map(
                                fn($addon): array => [
                                    'id' =>
                                    $addon->id,

                                    'name' =>
                                    $addon
                                        ->addon_name_snapshot,

                                    'quantity' =>
                                    (float)
                                    $addon->quantity,

                                    'unit_price' =>
                                    (float)
                                    $addon->unit_price,

                                    'line_total' =>
                                    (float)
                                    $addon->line_total,
                                ]
                            )
                            ->values()
                            ->all(),
                    ]
                )
                ->values()
                ->all(),

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'confirmed_at' =>
            $this->confirmed_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
