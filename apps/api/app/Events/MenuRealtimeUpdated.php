<?php

namespace App\Events;

use App\Models\MenuItem;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

final class MenuRealtimeUpdated implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;

    public readonly string $eventId;

    public readonly string $action;

    public readonly int $itemId;

    public readonly bool $isActive;

    public readonly bool $isAvailable;

    public readonly bool $isVisibleOnWebsite;

    public readonly bool $isVisibleOnQr;

    public readonly int $sortOrder;

    public readonly string $occurredAt;

    public function __construct(
        MenuItem $item,
        string $action =
        'ITEM_STATE_UPDATED'
    ) {
        $this->eventId =
            (string) str()->uuid();

        $this->action =
            $action;

        $this->itemId =
            (int) $item->id;

        $this->isActive =
            (bool) $item->is_active;

        $this->isAvailable =
            (bool) $item->is_available;

        $this->isVisibleOnWebsite =
            (bool) $item->is_visible_on_website;

        $this->isVisibleOnQr =
            (bool) $item->is_visible_on_qr;

        $this->sortOrder =
            (int) $item->sort_order;

        $this->occurredAt =
            now()->toISOString();
    }

    public function broadcastOn(): array
    {
        /*
         * Public channel.
         *
         * No internal pricing, recipe,
         * inventory or cost data is sent.
         *
         * Clients use this only as an
         * invalidation notification and
         * refetch the Laravel public menu.
         */
        return [
            new Channel(
                'restaurant.menu'
            ),
        ];
    }

    public function broadcastAs(): string
    {
        return 'menu.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'event_id' =>
            $this->eventId,

            'action' =>
            $this->action,

            'item_id' =>
            $this->itemId,

            'is_active' =>
            $this->isActive,

            'is_available' =>
            $this->isAvailable,

            'is_visible_on_website' =>
            $this->isVisibleOnWebsite,

            'is_visible_on_qr' =>
            $this->isVisibleOnQr,

            'sort_order' =>
            $this->sortOrder,

            'occurred_at' =>
            $this->occurredAt,
        ];
    }
}
