<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use InvalidArgumentException;

final class WebsiteRealtimeUpdated implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;

    public readonly string $eventId;

    public readonly string $resource;

    public readonly string $action;

    public readonly int $entityId;

    public readonly string $eventName;

    public readonly string $occurredAt;

    public function __construct(
        string $resource,
        string $action,
        int $entityId,
        string $eventName
    ) {
        $allowedEvents = [
            'reviews.updated',
            'gallery.updated',
        ];

        if (
            ! in_array(
                $eventName,
                $allowedEvents,
                true
            )
        ) {
            throw new InvalidArgumentException(
                'Unsupported public website realtime event.'
            );
        }

        $this->eventId =
            (string) str()->uuid();

        $this->resource =
            $resource;

        $this->action =
            $action;

        $this->entityId =
            $entityId;

        $this->eventName =
            $eventName;

        $this->occurredAt =
            now()->toISOString();
    }

    public function broadcastOn(): array
    {
        /*
        |--------------------------------------------------------------------------
        | Public Website Channel
        |--------------------------------------------------------------------------
        |
        | Public clients use this only as an invalidation signal.
        |
        | No private moderation information or customer-sensitive data is
        | included in the broadcast payload.
        |--------------------------------------------------------------------------
        */

        return [
            new Channel(
                'restaurant.website'
            ),
        ];
    }

    public function broadcastAs(): string
    {
        return $this->eventName;
    }

    public function broadcastWith(): array
    {
        return [
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
    }
}
