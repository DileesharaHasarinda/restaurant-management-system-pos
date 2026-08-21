<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserSessionResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\RoleHierarchyService;
use App\Services\TokenSessionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSessionController extends Controller
{
    public function __construct(
        private readonly RoleHierarchyService $roleHierarchy,
        private readonly TokenSessionService $tokenSessionService,
        private readonly AuditLogger $auditLogger
    ) {}

    public function index(
        Request $request,
        User $user
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $this
            ->roleHierarchy
            ->assertCanEdit(
                $actor,
                $user
            );

        $tokens =
            $user->tokens()
            ->latest(
                'created_at'
            )
            ->get();

        $data = $tokens
            ->map(
                fn($token) => (
                    new UserSessionResource(
                        $token
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $data,
            message: 'User sessions retrieved successfully.'
        );
    }

    public function destroy(
        Request $request,
        User $user,
        int $tokenId
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $this
            ->roleHierarchy
            ->assertCanEdit(
                $actor,
                $user
            );

        $token =
            $user->tokens()
            ->where(
                'id',
                $tokenId
            )
            ->first();

        if (! $token) {
            return ApiResponse::error(
                message: 'Session not found.',
                code: 'SESSION_NOT_FOUND',
                status: 404
            );
        }

        $deviceName =
            $token->name;

        $token->delete();

        $this->auditLogger->record(
            action: 'USER_SESSION_REVOKED',

            entityType: 'user',

            entityId: $user->id,

            metadata: [
                'token_id' =>
                $tokenId,

                'device_name' =>
                $deviceName,
            ],

            userId: $actor->id
        );

        return ApiResponse::success(
            data: null,
            message: 'User session revoked successfully.'
        );
    }

    public function destroyAll(
        Request $request,
        User $user
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $this
            ->roleHierarchy
            ->assertCanEdit(
                $actor,
                $user
            );

        $result =
            $this
            ->tokenSessionService
            ->revokeAll(
                $user
            );

        $this->auditLogger->record(
            action: 'USER_ALL_SESSIONS_REVOKED',

            entityType: 'user',

            entityId: $user->id,

            metadata: $result,

            userId: $actor->id
        );

        return ApiResponse::success(
            data: $result,
            message: 'All user sessions revoked successfully.'
        );
    }
}
