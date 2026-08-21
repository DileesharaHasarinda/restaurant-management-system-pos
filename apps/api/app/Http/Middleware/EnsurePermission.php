<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function handle(
        Request $request,
        Closure $next,
        string ...$permissions
    ): Response {
        $user = $request->user();

        if (! $user instanceof User) {
            return ApiResponse::error(
                message: 'Authentication is required.',
                code: 'UNAUTHENTICATED',
                status: 401
            );
        }

        if (
            $permissions === []
            || ! $user->hasAnyPermission($permissions)
        ) {
            $this->auditLogger->record(
                action: 'AUTHORIZATION_DENIED',
                entityType: 'user',
                entityId: $user->id,
                metadata: [
                    'required_permissions' =>
                    $permissions,
                ],
                userId: $user->id
            );

            return ApiResponse::error(
                message: 'You do not have permission to perform this action.',
                code: 'FORBIDDEN',
                status: 403
            );
        }

        return $next($request);
    }
}
