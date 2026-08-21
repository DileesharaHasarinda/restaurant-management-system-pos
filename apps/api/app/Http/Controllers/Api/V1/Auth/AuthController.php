<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use App\Support\DatabaseTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function login(
        LoginRequest $request
    ): JsonResponse {
        $login = $request->string('login')
            ->toString();

        $deviceName = $request
            ->string('device_name')
            ->toString();

        $user = User::query()
            ->with('role.permissions')
            ->where(function ($query) use ($login) {
                $query
                    ->where(
                        'username',
                        $login
                    )
                    ->orWhere(
                        'email',
                        $login
                    );
            })
            ->first();

        if (
            ! $user
            || ! Hash::check(
                $request->string('password')
                    ->toString(),
                $user->password
            )
        ) {
            $this->auditLogger->record(
                action: 'AUTH_LOGIN_FAILED',
                entityType: 'user',
                entityId: $user?->id,
                metadata: [
                    'login' => $login,
                    'device_name' =>
                    $deviceName,
                ],
                userId: $user?->id
            );

            return ApiResponse::error(
                message: 'The provided credentials are incorrect.',
                code: 'INVALID_CREDENTIALS',
                status: 401
            );
        }

        if (! $user->isActive()) {
            $this->auditLogger->record(
                action: 'AUTH_LOGIN_BLOCKED_INACTIVE',
                entityType: 'user',
                entityId: $user->id,
                metadata: [
                    'device_name' =>
                    $deviceName,
                ],
                userId: $user->id
            );

            return ApiResponse::error(
                message: 'Your account is inactive.',
                code: 'ACCOUNT_INACTIVE',
                status: 403
            );
        }

        $result = DatabaseTransaction::run(
            function () use (
                $user,
                $deviceName
            ): array {
                /*
                 * Keep one active token per
                 * named device.
                 */
                $user->tokens()
                    ->where(
                        'name',
                        $deviceName
                    )
                    ->delete();

                $user->forceFill([
                    'last_login_at' => now(),
                ])->save();

                $expiresAt =
                    now()->addDays(30);

                $token = $user->createToken(
                    $deviceName,
                    ['*'],
                    $expiresAt
                );

                $this->auditLogger->record(
                    action: 'AUTH_LOGIN_SUCCESS',
                    entityType: 'user',
                    entityId: $user->id,
                    metadata: [
                        'device_name' =>
                        $deviceName,

                        'expires_at' =>
                        $expiresAt
                            ->toISOString(),
                    ],
                    userId: $user->id
                );

                return [
                    'plain_text_token' =>
                    $token->plainTextToken,

                    'expires_at' =>
                    $expiresAt,
                ];
            }
        );

        $user->refresh();
        $user->load('role.permissions');

        return ApiResponse::success(
            data: [
                'token_type' =>
                'Bearer',

                'access_token' =>
                $result['plain_text_token'],

                'expires_at' =>
                $result['expires_at'],

                'user' =>
                new UserResource($user),
            ],
            message: 'Login successful.'
        );
    }

    public function me(
        Request $request
    ): JsonResponse {
        $user = $request->user();

        $user->loadMissing(
            'role.permissions'
        );

        return ApiResponse::success(
            data: new UserResource($user),
            message: 'Authenticated user retrieved.'
        );
    }

    public function logout(
        Request $request
    ): JsonResponse {
        $user = $request->user();

        DatabaseTransaction::run(
            function () use (
                $request,
                $user
            ): void {
                $this->auditLogger->record(
                    action: 'AUTH_LOGOUT',
                    entityType: 'user',
                    entityId: $user->id,
                    userId: $user->id
                );

                $currentToken =
                    $user->currentAccessToken();

                if (
                    $currentToken
                    instanceof PersonalAccessToken
                ) {
                    $currentToken->delete();
                }

                if ($request->hasSession()) {
                    Auth::guard('web')
                        ->logout();

                    $request
                        ->session()
                        ->invalidate();

                    $request
                        ->session()
                        ->regenerateToken();
                }
            }
        );

        return ApiResponse::success(
            data: null,
            message: 'Logout successful.'
        );
    }

    public function logoutAll(
        Request $request
    ): JsonResponse {
        $user = $request->user();

        DatabaseTransaction::run(
            function () use ($user): void {
                $user->tokens()->delete();

                $this->auditLogger->record(
                    action: 'AUTH_LOGOUT_ALL_DEVICES',
                    entityType: 'user',
                    entityId: $user->id,
                    userId: $user->id
                );
            }
        );

        return ApiResponse::success(
            data: null,
            message: 'All device sessions were revoked.'
        );
    }
}
