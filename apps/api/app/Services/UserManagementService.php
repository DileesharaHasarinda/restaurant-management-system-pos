<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Facades\Hash;

final class UserManagementService
{
    public function __construct(
        private readonly RoleHierarchyService $roleHierarchy,
        private readonly TokenSessionService $tokenSessionService,
        private readonly AuditLogger $auditLogger
    ) {}

    public function create(
        User $actor,
        array $data
    ): User {
        $role = Role::query()
            ->whereKey($data['role_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $this->roleHierarchy
            ->assertCanAssignRole(
                $actor,
                $role
            );

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data,
                $role
            ): User {
                $user = User::query()
                    ->create([
                        'role_id' =>
                        $role->id,

                        'name' =>
                        $data['name'],

                        'username' =>
                        $data['username'],

                        'email' =>
                        $data['email'] ?? null,

                        'phone' =>
                        $data['phone'] ?? null,

                        'password' =>
                        Hash::make(
                            $data['password']
                        ),

                        'status' =>
                        'ACTIVE',
                    ]);

                $this->auditLogger->record(
                    action: 'USER_CREATED',
                    entityType: 'user',
                    entityId: $user->id,
                    newValues: [
                        'name' =>
                        $user->name,

                        'username' =>
                        $user->username,

                        'email' =>
                        $user->email,

                        'phone' =>
                        $user->phone,

                        'status' =>
                        $user->status,

                        'role' =>
                        $role->code,
                    ],
                    metadata: [
                        'created_by' =>
                        $actor->id,
                    ],
                    userId: $actor->id
                );

                return $user
                    ->load(
                        'role.permissions'
                    );
            }
        );
    }

    public function update(
        User $actor,
        User $target,
        array $data
    ): User {
        $this->roleHierarchy
            ->assertCanEdit(
                $actor,
                $target
            );

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $target,
                $data
            ): User {
                $oldValues = [
                    'name' =>
                    $target->name,

                    'username' =>
                    $target->username,

                    'email' =>
                    $target->email,

                    'phone' =>
                    $target->phone,
                ];

                $target->fill([
                    'name' =>
                    $data['name'],

                    'username' =>
                    $data['username'],

                    'email' =>
                    $data['email'] ?? null,

                    'phone' =>
                    $data['phone'] ?? null,
                ]);

                $target->save();

                $this->auditLogger->record(
                    action: 'USER_UPDATED',
                    entityType: 'user',
                    entityId: $target->id,
                    oldValues: $oldValues,
                    newValues: [
                        'name' =>
                        $target->name,

                        'username' =>
                        $target->username,

                        'email' =>
                        $target->email,

                        'phone' =>
                        $target->phone,
                    ],
                    userId: $actor->id
                );

                return $target
                    ->refresh()
                    ->load(
                        'role.permissions'
                    );
            }
        );
    }

    public function updateStatus(
        User $actor,
        User $target,
        string $status
    ): User {
        $this->roleHierarchy
            ->assertCanPerformSensitiveAction(
                $actor,
                $target
            );

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $target,
                $status
            ): User {
                $oldStatus =
                    $target->status;

                if ($oldStatus === $status) {
                    return $target
                        ->load(
                            'role.permissions'
                        );
                }

                $target->status =
                    $status;

                $target->save();

                $revocation = null;

                /*
                 * Deactivated users are
                 * immediately logged out
                 * from every device.
                 */
                if ($status === 'INACTIVE') {
                    $revocation =
                        $this
                        ->tokenSessionService
                        ->revokeAll(
                            $target
                        );
                }

                $this->auditLogger->record(
                    action: $status === 'ACTIVE'
                        ? 'USER_ACTIVATED'
                        : 'USER_DEACTIVATED',

                    entityType: 'user',

                    entityId: $target->id,

                    oldValues: [
                        'status' =>
                        $oldStatus,
                    ],

                    newValues: [
                        'status' =>
                        $status,
                    ],

                    metadata: [
                        'session_revocation' =>
                        $revocation,
                    ],

                    userId: $actor->id
                );

                return $target
                    ->refresh()
                    ->load(
                        'role.permissions'
                    );
            }
        );
    }

    public function assignRole(
        User $actor,
        User $target,
        int $roleId
    ): User {
        $this->roleHierarchy
            ->assertCanPerformSensitiveAction(
                $actor,
                $target
            );

        $newRole = Role::query()
            ->whereKey($roleId)
            ->where('is_active', true)
            ->firstOrFail();

        $this->roleHierarchy
            ->assertCanAssignRole(
                $actor,
                $newRole
            );

        $target->loadMissing('role');

        if (
            $target->role_id
            === $newRole->id
        ) {
            return $target
                ->load(
                    'role.permissions'
                );
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $target,
                $newRole
            ): User {
                $oldRole =
                    $target->role?->code;

                $target->role_id =
                    $newRole->id;

                $target->save();

                /*
                 * Revoke all sessions after
                 * role changes so stale
                 * authorization cannot remain.
                 */
                $revocation =
                    $this
                    ->tokenSessionService
                    ->revokeAll(
                        $target
                    );

                $this->auditLogger->record(
                    action: 'USER_ROLE_CHANGED',

                    entityType: 'user',

                    entityId: $target->id,

                    oldValues: [
                        'role' =>
                        $oldRole,
                    ],

                    newValues: [
                        'role' =>
                        $newRole->code,
                    ],

                    metadata: [
                        'session_revocation' =>
                        $revocation,
                    ],

                    userId: $actor->id
                );

                return $target
                    ->refresh()
                    ->load(
                        'role.permissions'
                    );
            }
        );
    }
}
