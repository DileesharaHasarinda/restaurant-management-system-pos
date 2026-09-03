<?php

namespace App\Http\Resources;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AuditLog
 */
class AuditLogResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'action' =>
            $this->action,

            'entity_type' =>
            $this->entity_type,

            'entity_id' =>
            $this->entity_id,

            'actor' =>
            $this->user
                ? [
                    'id' =>
                    $this->user->id,

                    'name' =>
                    $this->user->name,

                    'username' =>
                    $this->user->username,

                    'role' =>
                    $this->user->role
                        ? [
                            'code' =>
                            $this->user
                                ->role
                                ->code,

                            'name' =>
                            $this->user
                                ->role
                                ->name,
                        ]
                        : null,
                ]
                : null,

            'old_values' =>
            $this->old_values
                ?? [],

            'new_values' =>
            $this->new_values
                ?? [],

            'metadata' =>
            $this->metadata
                ?? [],

            'request' => [
                'ip_address' =>
                $this->ip_address,

                'user_agent' =>
                $this->user_agent,

                'method' =>
                $this->request_method,

                'path' =>
                $this->request_path,
            ],

            'created_at' =>
            $this->created_at
                ?->toIso8601String(),
        ];
    }
}
