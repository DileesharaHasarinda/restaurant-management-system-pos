<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\ChangePasswordRequest;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Http\Resources\UserSessionResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\TokenSessionService;
use App\Support\ApiResponse;
use App\Support\DatabaseTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
        private readonly TokenSessionService $tokenSessionService
    ) {}

    public function login(
        LoginRequest $request
    ): JsonResponse {
        $login = Str::lower(
            trim(
                $request
                    ->string('login')
                    ->toString()
            )
        );

        $deviceName = trim(
            $request
                ->string('device_name')
                ->toString()
        );

        /*
         * Prefer username first.
         */
        $user = User::query()
            ->with('role.permissions')
            ->where(
                'username',
                $login
            )
            ->first();

        /*
         * Fall back to email.
         */
        if (! $user) {
            $user = User::query()
                ->with('role.permissions')
                ->where(
                    'email',
                    $login
                )
                ->first();
        }

        if (
            ! $user
            || ! Hash::check(
                $request
                    ->string('password')
                    ->toString(),
                $user->password
            )
        ) {
            $this->auditLogger->record(
                action: 'AUTH_LOGIN_FAILED',

                entityType: 'user',

                entityId: $user?->id,

                metadata: [
                    'login' =>
                    $login,

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
                 * Only one active token with
                 * the same device name.
                 */
                $user->tokens()
                    ->where(
                        'name',
                        $deviceName
                    )
                    ->delete();

                $user->forceFill([
                    'last_login_at' =>
                    now(),
                ])->save();

                $expiresAt =
                    now()->addDays(30);

                $token =
                    $user->createToken(
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
                    'token' =>
                    $token
                        ->plainTextToken,

                    'expires_at' =>
                    $expiresAt,
                ];
            }
        );

        $user->refresh();
        $user->load(
            'role.permissions'
        );

        return ApiResponse::success(
            data: [
                'token_type' =>
                'Bearer',

                'access_token' =>
                $result['token'],

                'expires_at' =>
                $result['expires_at'],

                'user' => (
                    new UserResource(
                        $user
                    )
                )->resolve(
                    $request
                ),
            ],
            message: 'Login successful.'
        );
    }

    public function me(
        Request $request
    ): JsonResponse {
        $user =
            $request->user();

        $user->loadMissing(
            'role.permissions'
        );

        return ApiResponse::success(
            data: (
                new UserResource(
                    $user
                )
            )->resolve(
                $request
            ),

            message: 'Authenticated user retrieved.'
        );
    }

    public function changePassword(
        ChangePasswordRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $data =
            $request->validated();

        if (
            ! Hash::check(
                $data['current_password'],
                $user->password
            )
        ) {
            return ApiResponse::error(
                message: 'The current password is incorrect.',

                code: 'CURRENT_PASSWORD_INCORRECT',

                errors: [
                    'current_password' => [
                        'The current password is incorrect.',
                    ],
                ],

                status: 422
            );
        }

        if (
            Hash::check(
                $data['password'],
                $user->password
            )
        ) {
            return ApiResponse::error(
                message: 'The new password must be different from the current password.',

                code: 'PASSWORD_NOT_CHANGED',

                errors: [
                    'password' => [
                        'Use a different password.',
                    ],
                ],

                status: 422
            );
        }

        $currentToken =
            $user->currentAccessToken();

        $currentTokenId =
            $currentToken
            instanceof PersonalAccessToken
            ? $currentToken->id
            : null;

        $currentSessionId =
            $request->hasSession()
            ? $request
            ->session()
            ->getId()
            : null;

        DatabaseTransaction::run(
            function () use (
                $user,
                $data,
                $currentTokenId,
                $currentSessionId
            ): void {
                $user->password =
                    Hash::make(
                        $data['password']
                    );

                $user->save();

                $revocation =
                    $this
                    ->tokenSessionService
                    ->revokeAll(
                        $user,
                        $currentTokenId,
                        $currentSessionId
                    );

                $this->auditLogger->record(
                    action: 'AUTH_PASSWORD_CHANGED',

                    entityType: 'user',

                    entityId: $user->id,

                    metadata: [
                        'other_sessions_revoked' =>
                        $revocation,
                    ],

                    userId: $user->id
                );
            }
        );

        return ApiResponse::success(
            data: null,
            message: 'Password changed successfully. Other sessions were revoked.'
        );
    }

    public function sessions(
        Request $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $currentAccessToken =
            $user->currentAccessToken();

        $currentTokenId =
            $currentAccessToken
            instanceof PersonalAccessToken
            ? $currentAccessToken->id
            : null;

        $tokens = $user
            ->tokens()
            ->latest('created_at')
            ->get();

        $data = $tokens
            ->map(
                fn($token) => (
                    new UserSessionResource(
                        $token,
                        $token->id
                            === $currentTokenId
                    )
                )->resolve($request)
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $data,
            message: 'Active sessions retrieved.'
        );
    }

    public function revokeSession(
        Request $request,
        int $tokenId
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $token =
            $user->tokens()
            ->where(
                'id',
                $tokenId
            )
            ->first();

        if (! $token) {
            return ApiResponse::error(
                message: 'The requested session was not found.',
                code: 'SESSION_NOT_FOUND',
                status: 404
            );
        }

        $this->auditLogger->record(
            action: 'AUTH_SESSION_REVOKED',

            entityType: 'personal_access_token',

            entityId: $token->id,

            metadata: [
                'device_name' =>
                $token->name,
            ],

            userId: $user->id
        );

        $token->delete();

        return ApiResponse::success(
            data: null,
            message: 'Session revoked successfully.'
        );
    }

    public function revokeOtherSessions(
        Request $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $currentAccessToken =
            $user->currentAccessToken();

        $currentTokenId =
            $currentAccessToken
            instanceof PersonalAccessToken
            ? $currentAccessToken->id
            : null;

        $currentSessionId =
            $request->hasSession()
            ? $request
            ->session()
            ->getId()
            : null;

        $result =
            $this
            ->tokenSessionService
            ->revokeAll(
                $user,
                $currentTokenId,
                $currentSessionId
            );

        $this->auditLogger->record(
            action: 'AUTH_OTHER_SESSIONS_REVOKED',

            entityType: 'user',

            entityId: $user->id,

            metadata: $result,

            userId: $user->id
        );

        return ApiResponse::success(
            data: $result,
            message: 'Other sessions revoked successfully.'
        );
    }

    public function logout(
        Request $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

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

                $token =
                    $user
                    ->currentAccessToken();

                if (
                    $token
                    instanceof PersonalAccessToken
                ) {
                    $token->delete();
                }

                if (
                    $request->hasSession()
                ) {
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
        /** @var User $user */
        $user =
            $request->user();

        $result =
            DatabaseTransaction::run(
                function () use (
                    $request,
                    $user
                ): array {
                    $result =
                        $this
                        ->tokenSessionService
                        ->revokeAll(
                            $user
                        );

                    $this->auditLogger->record(
                        action: 'AUTH_LOGOUT_ALL_DEVICES',

                        entityType: 'user',

                        entityId: $user->id,

                        metadata: $result,

                        userId: $user->id
                    );

                    if (
                        $request->hasSession()
                    ) {
                        Auth::guard('web')
                            ->logout();

                        $request
                            ->session()
                            ->invalidate();

                        $request
                            ->session()
                            ->regenerateToken();
                    }

                    return $result;
                }
            );

        return ApiResponse::success(
            data: $result,
            message: 'All sessions were revoked.'
        );
    }
}
