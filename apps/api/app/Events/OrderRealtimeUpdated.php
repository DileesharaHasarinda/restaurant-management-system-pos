<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

final class OrderRealtimeUpdated implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;

    public readonly string $eventId;

    public readonly string $action;

    public readonly int $orderId;

    public readonly string $orderNumber;

    public readonly string $orderSource;

    public readonly string $orderType;

    public readonly string $status;

    public readonly ?int $tableId;

    public readonly ?string $tableName;

    public readonly string $occurredAt;

    public function __construct(
        Order $order,
        string $action
    ) {
        $this->eventId =
            (string) str()->uuid();

        $this->action =
            $action;

        $this->orderId =
            (int) $order->id;

        $this->orderNumber =
            (string) $order->order_number;

        $this->orderSource =
            (string) $order->order_source;

        $this->orderType =
            (string) $order->order_type;

        $this->status =
            (string) $order->status;

        $this->tableId =
            $order->table_id
            ? (int) $order->table_id
            : null;

        $this->tableName =
            $order->table_name_snapshot
            ? (string) $order->table_name_snapshot
            : null;

        $this->occurredAt =
            now()->toISOString();
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel(
                'restaurant.orders'
            ),
        ];
    }

    public function broadcastAs(): string
    {
        return 'order.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'event_id' =>
            $this->eventId,

            'action' =>
            $this->action,

            'order_id' =>
            $this->orderId,

            'order_number' =>
            $this->orderNumber,

            'order_source' =>
            $this->orderSource,

            'order_type' =>
            $this->orderType,

            'status' =>
            $this->status,

            'table_id' =>
            $this->tableId,

            'table_name' =>
            $this->tableName,

            'occurred_at' =>
            $this->occurredAt,
        ];
    }
}
