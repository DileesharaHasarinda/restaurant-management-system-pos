<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WaiterTableResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $this->resource->loadMissing(
            'openSession.orders'
        );

        $session =
            $this->openSession;

        $orders =
            $session
            ? $session->orders
            : collect();

        $liveOrders =
            $orders
            ->filter(
                fn(Order $order): bool =>
                ! in_array(
                    $order->status,
                    [
                        Order::STATUS_CANCELLED,
                        Order::STATUS_REJECTED,
                    ],
                    true
                )
            );

        $activeWaiterOrder =
            $liveOrders
            ->filter(
                fn(Order $order): bool =>
                $order->order_source
                    === Order::SOURCE_WAITER
                    &&
                    ! in_array(
                        $order->status,
                        [
                            Order::STATUS_COMPLETED,
                            Order::STATUS_CANCELLED,
                            Order::STATUS_REJECTED,
                        ],
                        true
                    )
            )
            ->sortByDesc('id')
            ->first();

        return [
            'id' =>
            $this->id,

            'table_number' =>
            (int) $this->table_number,

            'code' =>
            $this->code,

            'name' =>
            $this->name,

            'area' =>
            $this->area,

            'capacity' =>
            (int) $this->capacity,

            'status' =>
            $this->status,

            'is_active' =>
            (bool) $this->is_active,

            'current_session' =>
            $session
                ? [
                    'id' =>
                    $session->id,

                    'session_number' =>
                    $session->session_number,

                    'guest_count' =>
                    (int)
                    $session->guest_count,

                    'status' =>
                    $session->status,

                    'bill_requested' =>
                    $session
                        ->bill_requested_at
                        !== null,

                    'bill_requested_at' =>
                    $session
                        ->bill_requested_at
                        ?->toISOString(),

                    'bill_requested_by' =>
                    $session
                        ->bill_requested_by,

                    'current_total' =>
                    round(
                        (float)
                        $liveOrders
                            ->sum(
                                fn(
                                    Order $order
                                ): float =>
                                (float)
                                $order
                                    ->grand_total
                            ),
                        2
                    ),

                    'order_count' =>
                    $liveOrders
                        ->count(),

                    'active_waiter_order_id' =>
                    $activeWaiterOrder
                        ?->id,
                ]
                : null,
        ];
    }
}
