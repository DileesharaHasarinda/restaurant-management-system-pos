<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $user = $request->user();

        if (! $user instanceof User) {
            return ApiResponse::error(
                message: 'Authentication is required.',
                code: 'UNAUTHENTICATED',
                status: 401
            );
        }

        if (! $user->isActive()) {
            return ApiResponse::error(
                message: 'Your user account is inactive.',
                code: 'ACCOUNT_INACTIVE',
                status: 403
            );
        }

        return $next($request);
    }
}
