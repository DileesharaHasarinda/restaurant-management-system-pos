<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicQrOrderResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'order_number' =>
            $this->order_number,

            'status_token' =>
            $this->public_status_token,

            'status' =>
            $this->status,

            'customer_status' =>
            $this->customerStatus(
                $this->status
            ),

            'table' => [
                'id' =>
                $this->table_id,

                'name' =>
                $this
                    ->table_name_snapshot,
            ],

            'order_type' =>
            $this->order_type,

            'subtotal' =>
            (float)
            $this->subtotal,

            'discount_total' =>
            (float)
            $this->discount_total,

            'tax_total' =>
            (float)
            $this->tax_total,

            'service_charge_total' =>
            (float)
            $this
                ->service_charge_total,

            'grand_total' =>
            (float)
            $this->grand_total,

            'customer_notes' =>
            $this->customer_notes,

            /*
            |--------------------------------------------------------------------------
            | Cumulative order items
            |--------------------------------------------------------------------------
            |
            | This returns every item currently attached
            | to the SAME order.
            |
            | First order + additional orders all appear here.
            |
            */

            'items' =>
            $this
                ->whenLoaded(
                    'items'
                )
                ->map(
                    function ($item): array {
                        return [
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

                            /*
                                 * Existing item-level status.
                                 */
                            'status' =>
                            $item->status,

                            /*
                                 * Useful later for additional KOTs.
                                 *
                                 * A newly added item has:
                                 *
                                 * sent_to_kitchen_at = NULL
                                 *
                                 * Existing prepared items can already
                                 * be SENT_TO_KITCHEN.
                                 */
                            'kitchen_status' =>
                            $item
                                ->sent_to_kitchen_at
                                ? 'SENT_TO_KITCHEN'
                                : 'NOT_SENT_TO_KITCHEN',

                            'sent_to_kitchen_at' =>
                            $item
                                ->sent_to_kitchen_at
                                ?->toISOString(),

                            'special_notes' =>
                            $item
                                ->special_notes,

                            'addons' =>
                            $item
                                ->addons
                                ->map(
                                    fn($addon): array => [
                                        'name' =>
                                        $addon
                                            ->addon_name_snapshot,

                                        'quantity' =>
                                        (float)
                                        $addon
                                            ->quantity,

                                        'unit_price' =>
                                        (float)
                                        $addon
                                            ->unit_price,

                                        'line_total' =>
                                        (float)
                                        $addon
                                            ->line_total,
                                    ]
                                )
                                ->values()
                                ->all(),
                        ];
                    }
                )
                ->values()
                ->all(),

            'submitted_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }

    private function customerStatus(
        string $status
    ): string {
        return match ($status) {
            Order::STATUS_PENDING =>
            'AWAITING_APPROVAL',

            Order::STATUS_CONFIRMED =>
            'ACCEPTED',

            Order::STATUS_SENT_TO_KITCHEN =>
            'PREPARING',

            Order::STATUS_SERVED =>
            'SERVED',

            Order::STATUS_COMPLETED =>
            'COMPLETED',

            Order::STATUS_REJECTED =>
            'REJECTED',

            Order::STATUS_CANCELLED =>
            'CANCELLED',

            default =>
            $status,
        };
    }
}
