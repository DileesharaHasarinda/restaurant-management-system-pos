<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class StaffRealtimeUpdated implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /**
     * Broadcast only after the surrounding database transaction commits.
     */
    public bool $afterCommit = true;

    public function __construct(
        public readonly string $eventId,
        public readonly string $domain,
        public readonly string $resource,
        public readonly string $action,
        public readonly int|string|null $entityId,
        public readonly string $occurredAt,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('restaurant.staff'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'staff.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'event_id' => $this->eventId,
            'domain' => $this->domain,
            'resource' => $this->resource,
            'action' => $this->action,
            'entity_id' => $this->entityId,
            'occurred_at' => $this->occurredAt,
        ];
    }
}
