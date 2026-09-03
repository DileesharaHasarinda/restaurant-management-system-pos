<?php

namespace App\Events;

use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Events\Dispatchable;

final class MenuRealtimeUpdated implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;

    public readonly string $eventId;

    public readonly string $resource;

    public readonly string $action;

    public readonly int $entityId;

    public readonly string $occurredAt;

    /*
    |--------------------------------------------------------------------------
    | Legacy Menu Item Fields
    |--------------------------------------------------------------------------
    |
    | These remain available for MenuItem events so any existing consumer
    | reading the original payload shape continues to work.
    |
    | Public clients should still treat this event only as an invalidation
    | signal and refetch authoritative data from Laravel REST.
    |--------------------------------------------------------------------------
    */

    public readonly ?int $itemId;

    public readonly ?bool $isActive;

    public readonly ?bool $isAvailable;

    public readonly ?bool $isVisibleOnWebsite;

    public readonly ?bool $isVisibleOnQr;

    public readonly ?int $sortOrder;

    public function __construct(
        Model $entity,
        string $action = 'MENU_UPDATED'
    ) {
        $this->eventId =
            (string) str()->uuid();

        $this->resource =
            $this->resolveResource(
                $entity
            );

        $this->action =
            $action;

        $this->entityId =
            (int) $entity->getKey();

        $this->occurredAt =
            now()->toISOString();

        /*
        |--------------------------------------------------------------------------
        | Backward-compatible MenuItem Payload
        |--------------------------------------------------------------------------
        */

        if (
            $entity
            instanceof MenuItem
        ) {
            $this->itemId =
                (int) $entity->id;

            $this->isActive =
                (bool) $entity->is_active;

            $this->isAvailable =
                (bool) $entity->is_available;

            $this->isVisibleOnWebsite =
                (bool) $entity->is_visible_on_website;

            $this->isVisibleOnQr =
                (bool) $entity->is_visible_on_qr;

            $this->sortOrder =
                (int) $entity->sort_order;

            return;
        }

        $this->itemId =
            null;

        $this->isActive =
            null;

        $this->isAvailable =
            null;

        $this->isVisibleOnWebsite =
            null;

        $this->isVisibleOnQr =
            null;

        $this->sortOrder =
            null;
    }

    public function broadcastOn(): array
    {
        /*
         * Public invalidation channel.
         *
         * No recipe, stock, cost or other internal data is sent.
         *
         * Clients use this only as:
         *
         * "The menu changed. Refetch it from Laravel."
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
        $payload = [
            'event_id' =>
            $this->eventId,

            'resource' =>
            $this->resource,

            'action' =>
            $this->action,

            'entity_id' =>
            $this->entityId,

            'occurred_at' =>
            $this->occurredAt,
        ];

        /*
        |--------------------------------------------------------------------------
        | Legacy Menu Item Fields
        |--------------------------------------------------------------------------
        */

        if (
            $this->itemId
            !== null
        ) {
            $payload['item_id'] =
                $this->itemId;

            $payload['is_active'] =
                $this->isActive;

            $payload['is_available'] =
                $this->isAvailable;

            $payload['is_visible_on_website'] =
                $this->isVisibleOnWebsite;

            $payload['is_visible_on_qr'] =
                $this->isVisibleOnQr;

            $payload['sort_order'] =
                $this->sortOrder;
        }

        return $payload;
    }

    private function resolveResource(
        Model $entity
    ): string {
        return match (true) {
            $entity
                instanceof MenuItem =>
            'menu_item',

            $entity
                instanceof Category =>
            'category',

            default =>
            'menu',
        };
    }
}
