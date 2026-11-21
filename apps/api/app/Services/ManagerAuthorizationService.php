<?php

namespace App\Services;

use App\Exceptions\ManagerAuthorizationException;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

final class ManagerAuthorizationService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function authorize(
        User $initiator,
        string $permission,
        ?string $login,
        ?string $password,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null
    ): User {
        /*
        |--------------------------------------------------------------------------
        | Self Authorization
        |--------------------------------------------------------------------------
        |
        | OWNER / ADMIN / MANAGER who already possesses the sensitive
        | permission can authorize their own action.
        |
        */

        if (
            $initiator->isActive()
            &&
            $initiator->hasPermission(
                $permission
            )
        ) {
            $this->recordSuccess(
                initiator: $initiator,
                authorizer: $initiator,
                permission: $permission,
                action: $action,
                entityType: $entityType,
                entityId: $entityId,
                selfAuthorization: true
            );

            return $initiator;
        }

        /*
        |--------------------------------------------------------------------------
        | Manager Credentials Required
        |--------------------------------------------------------------------------
        */

        $throttleKey = 'manager-auth:' . $initiator->id;

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            throw new ManagerAuthorizationException(
                message: 'Too many manager authorization attempts. Try again later.',

                errorCode: 'MANAGER_AUTHORIZATION_THROTTLED',

                status: 429
            );
        }

        $normalizedLogin =
            Str::lower(
                trim(
                    (string)
                    $login
                )
            );

        if (
            $normalizedLogin === ''
            ||
            ! is_string(
                $password
            )
            ||
            $password === ''
        ) {
            throw new ManagerAuthorizationException(
                message: 'Manager authorization is required for this action.',

                errorCode: 'MANAGER_AUTHORIZATION_REQUIRED',

                status: 403,

                errors: [
                    'manager_authorization' => [
                        'Enter an authorized manager username/email and password.',
                    ],
                ]
            );
        }

        $manager =
            User::query()
            ->with(
                'role.permissions'
            )
            ->where(
                function ($query) use (
                    $normalizedLogin
                ): void {
                    $query
                        ->whereRaw(
                            'LOWER(username) = ?',
                            [
                                $normalizedLogin,
                            ]
                        )
                        ->orWhereRaw(
                            'LOWER(email) = ?',
                            [
                                $normalizedLogin,
                            ]
                        );
                }
            )
            ->first();

        if (
            ! $manager
            ||
            ! Hash::check(
                $password,
                $manager->password
            )
            ||
            ! $manager->isActive()
            ||
            ! $manager->hasPermission(
                $permission
            )
        ) {
            $this->auditLogger->record(
                action: 'MANAGER_AUTHORIZATION_FAILED',

                entityType: $entityType,

                entityId: $entityId,

                metadata: [
                    'requested_action' =>
                    $action,

                    'required_permission' =>
                    $permission,

                    'initiated_by' =>
                    $initiator->id,

                    /*
                     * Never record the password.
                     */
                    'manager_login' =>
                    $normalizedLogin,
                ],

                userId: $initiator->id
            );

            RateLimiter::hit($throttleKey, 300);

            throw new ManagerAuthorizationException(
                message: 'Manager authorization failed.',

                errorCode: 'MANAGER_AUTHORIZATION_FAILED',

                status: 403
            );
        }

        RateLimiter::clear($throttleKey);

        $this->recordSuccess(
            initiator: $initiator,
            authorizer: $manager,
            permission: $permission,
            action: $action,
            entityType: $entityType,
            entityId: $entityId,
            selfAuthorization: false
        );

        return $manager;
    }

    private function recordSuccess(
        User $initiator,
        User $authorizer,
        string $permission,
        string $action,
        ?string $entityType,
        ?int $entityId,
        bool $selfAuthorization
    ): void {
        $this->auditLogger->record(
            action: 'MANAGER_AUTHORIZATION_SUCCESS',

            entityType: $entityType,

            entityId: $entityId,

            metadata: [
                'requested_action' =>
                $action,

                'required_permission' =>
                $permission,

                'initiated_by' =>
                $initiator->id,

                'authorized_by' =>
                $authorizer->id,

                'self_authorization' =>
                $selfAuthorization,
            ],

            userId: $authorizer->id
        );
    }
}
