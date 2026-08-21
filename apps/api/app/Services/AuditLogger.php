<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

class AuditLogger
{
    private const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'token',
        'access_token',
        'authorization',
        'secret',
        'app_key',
    ];

    public function record(
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        array $oldValues = [],
        array $newValues = [],
        array $metadata = [],
        ?int $userId = null
    ): AuditLog {
        $request = app()->bound('request')
            ? request()
            : null;

        return AuditLog::query()->create([
            'user_id' =>
            $userId ?? Auth::id(),

            'action' =>
            $action,

            'entity_type' =>
            $entityType,

            'entity_id' =>
            $entityId,

            'old_values' =>
            $this->sanitize($oldValues),

            'new_values' =>
            $this->sanitize($newValues),

            'ip_address' =>
            $request?->ip(),

            'user_agent' =>
            $request?->userAgent(),

            'request_method' =>
            $request?->method(),

            'request_path' =>
            $request?->path(),

            'metadata' =>
            $this->sanitize($metadata),

            'created_at' =>
            now(),
        ]);
    }

    private function sanitize(
        array $values
    ): array {
        $clean = [];

        foreach ($values as $key => $value) {
            if (
                is_string($key)
                && in_array(
                    strtolower($key),
                    self::SENSITIVE_KEYS,
                    true
                )
            ) {
                $clean[$key] = '[REDACTED]';

                continue;
            }

            $clean[$key] = is_array($value)
                ? $this->sanitize($value)
                : $value;
        }

        return $clean;
    }
}
