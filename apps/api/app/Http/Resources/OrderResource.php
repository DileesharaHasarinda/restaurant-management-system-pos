<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $this->resource->loadMissing([
            'items.addons',
            'statusHistories',
        ]);

        /** @var User|null $user */
        $user =
            $request->user();

        $hasUnsentItems =
            $this->items
            ->contains(
                fn($item): bool =>
                $item->status
                    === OrderItem::STATUS_ACTIVE
                    &&
                    $item->sent_to_kitchen_at
                    === null
            );

        $canCancelStatus =
            in_array(
                $this->status,
                [
                    Order::STATUS_PENDING,
                    Order::STATUS_CONFIRMED,
                    Order::STATUS_SENT_TO_KITCHEN,
                    Order::STATUS_SERVED,
                ],
                true
            );

        return [
            'id' =>
            $this->id,

            'order_number' =>
            $this->order_number,

            'business_day_id' =>
            $this->business_day_id,

            'table_session_id' =>
            $this->table_session_id,

            'table_id' =>
            $this->table_id,

            'table_name' =>
            $this->table_name_snapshot,

            'takeaway_token' =>
            $this->takeaway_token,

            'pickup_notes' =>
            $this->order_type
                === Order::TYPE_TAKEAWAY
                ? $this->customer_notes
                : null,

            'order_type' =>
            $this->order_type,

            'order_source' =>
            $this->order_source,

            'session_sequence' =>
            $this->session_sequence,

            'status' =>
            $this->status,

            'customer' => [
                'name' =>
                $this->customer_name,

                'phone' =>
                $this->customer_phone,
            ],

            'totals' => [
                'subtotal' =>
                (float) $this->subtotal,

                'discount' =>
                (float)
                $this->discount_total,

                'tax' =>
                (float) $this->tax_total,

                'service_charge' =>
                (float)
                $this->service_charge_total,

                'grand_total' =>
                (float) $this->grand_total,
            ],

            'customer_notes' =>
            $this->customer_notes,

            'internal_notes' =>
            $this->internal_notes,

            'created_by' =>
            $this->created_by,

            'confirmed_by' =>
            $this->confirmed_by,

            'cancelled_by' =>
            $this->cancelled_by,

            'rejected_by' =>
            $this->rejected_by,

            'confirmed_at' =>
            $this->confirmed_at
                ?->toISOString(),

            'sent_to_kitchen_at' =>
            $this->sent_to_kitchen_at
                ?->toISOString(),

            'served_at' =>
            $this->served_at
                ?->toISOString(),

            'completed_at' =>
            $this->completed_at
                ?->toISOString(),

            'cancelled_at' =>
            $this->cancelled_at
                ?->toISOString(),

            'rejected_at' =>
            $this->rejected_at
                ?->toISOString(),

            'cancellation_reason' =>
            $this->cancellation_reason,

            'rejection_reason' =>
            $this->rejection_reason,

            'pending_kitchen_item_count' =>
            $this->items
                ->filter(
                    fn($item): bool =>
                    $item->status
                        === OrderItem::STATUS_ACTIVE
                        &&
                        $item->sent_to_kitchen_at
                        === null
                )
                ->count(),

            'actions' => [
                'can_confirm' =>
                $this->status
                    === Order::STATUS_PENDING
                    &&
                    $user?->hasPermission(
                        'orders.confirm'
                    ),

                /*
                 * REJECT uses orders.confirm.
                 * We don't need another permission
                 * just for the opposite decision.
                 */
                'can_reject' =>
                $this->status
                    === Order::STATUS_PENDING
                    &&
                    $user?->hasPermission(
                        'orders.confirm'
                    ),

                'can_send_to_kitchen' => (
                    $this->status
                    === Order::STATUS_CONFIRMED
                    ||
                    (
                        $this->status
                        === Order::STATUS_SENT_TO_KITCHEN
                        &&
                        $hasUnsentItems
                    )
                )
                    &&
                    $user?->hasPermission(
                        'orders.send_kitchen'
                    ),

                'can_serve' =>
                $this->status
                    === Order::STATUS_SENT_TO_KITCHEN
                    &&
                    ! $hasUnsentItems
                    &&
                    $user?->hasPermission(
                        'orders.serve'
                    ),

                'can_complete' =>
                $this->status
                    === Order::STATUS_SERVED
                    &&
                    $user?->hasPermission(
                        'orders.complete'
                    ),

                'can_cancel' =>
                $canCancelStatus
                    &&
                    $user?->hasPermission(
                        'orders.cancel'
                    ),
            ],

            'items' =>
            $this->items
                ->map(
                    fn($item): array => [
                        'id' =>
                        $item->id,

                        'menu_item_id' =>
                        $item->menu_item_id,

                        'variant_id' =>
                        $item
                            ->menu_item_variant_id,

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

                        'special_notes' =>
                        $item->special_notes,

                        'sent_to_kitchen_at' =>
                        $item
                            ->sent_to_kitchen_at
                            ?->toISOString(),

                        'cancelled_at' =>
                        $item
                            ->cancelled_at
                            ?->toISOString(),

                        'addons' =>
                        $item->addons
                            ->map(
                                fn($addon): array => [
                                    'id' =>
                                    $addon->id,

                                    'addon_id' =>
                                    $addon->addon_id,

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

            'status_history' =>
            $this->statusHistories
                ->map(
                    fn($history): array => [
                        'id' =>
                        $history->id,

                        'from_status' =>
                        $history->from_status,

                        'to_status' =>
                        $history->to_status,

                        'changed_by' =>
                        $history->changed_by,

                        'notes' =>
                        $history->notes,

                        'changed_at' =>
                        $history
                            ->changed_at
                            ?->toISOString(),
                    ]
                )
                ->values()
                ->all(),

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
