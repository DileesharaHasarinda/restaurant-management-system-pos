<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

final class RoleHierarchyService
{
    private const ROLE_RANKS = [
        'OWNER' => 100,
        'ADMIN' => 80,
        'MANAGER' => 60,
        'CASHIER' => 40,
        'WAITER' => 20,
    ];

    public function canView(
        User $actor,
        User $target
    ): bool {
        if ($actor->id === $target->id) {
            return true;
        }

        return $this->rankOfUser($actor)
            >= $this->rankOfUser($target);
    }

    public function canEdit(
        User $actor,
        User $target
    ): bool {
        if ($actor->id === $target->id) {
            return true;
        }

        return $this->rankOfUser($actor)
            > $this->rankOfUser($target);
    }

    public function canPerformSensitiveAction(
        User $actor,
        User $target
    ): bool {
        if ($actor->id === $target->id) {
            return false;
        }

        return $this->rankOfUser($actor)
            > $this->rankOfUser($target);
    }

    public function canAssignRole(
        User $actor,
        Role $role
    ): bool {
        if (! $role->is_active) {
            return false;
        }

        /*
         * OWNER is created only through the
         * secure CLI command.
         *
         * Nobody can promote an account to
         * OWNER through the normal API.
         */
        if ($role->code === 'OWNER') {
            return false;
        }

        return $this->rankOfUser($actor)
            > $this->rankOfRole($role);
    }

    public function assertCanView(
        User $actor,
        User $target
    ): void {
        if (! $this->canView($actor, $target)) {
            throw new AuthorizationException(
                'You are not authorized to view this user.'
            );
        }
    }

    public function assertCanEdit(
        User $actor,
        User $target
    ): void {
        if (! $this->canEdit($actor, $target)) {
            throw new AuthorizationException(
                'You are not authorized to edit this user.'
            );
        }
    }

    public function assertCanPerformSensitiveAction(
        User $actor,
        User $target
    ): void {
        if (
            ! $this->canPerformSensitiveAction(
                $actor,
                $target
            )
        ) {
            throw new AuthorizationException(
                'You are not authorized to perform this action on this user.'
            );
        }
    }

    public function assertCanAssignRole(
        User $actor,
        Role $role
    ): void {
        if (! $this->canAssignRole($actor, $role)) {
            throw new AuthorizationException(
                'You are not authorized to assign this role.'
            );
        }
    }

    public function visibleRoleCodes(
        User $actor
    ): array {
        $actorRank =
            $this->rankOfUser($actor);

        return array_keys(
            array_filter(
                self::ROLE_RANKS,
                fn(int $rank): bool =>
                $rank <= $actorRank
            )
        );
    }

    public function assignableRoleCodes(
        User $actor
    ): array {
        $actorRank =
            $this->rankOfUser($actor);

        $roles = [];

        foreach (
            self::ROLE_RANKS
            as $code => $rank
        ) {
            if (
                $code !== 'OWNER'
                && $rank < $actorRank
            ) {
                $roles[] = $code;
            }
        }

        return $roles;
    }

    private function rankOfUser(
        User $user
    ): int {
        $user->loadMissing('role');

        return self::ROLE_RANKS[$user->role?->code ?? ''] ?? 0;
    }

    private function rankOfRole(
        Role $role
    ): int {
        return self::ROLE_RANKS[$role->code] ?? 0;
    }
}
