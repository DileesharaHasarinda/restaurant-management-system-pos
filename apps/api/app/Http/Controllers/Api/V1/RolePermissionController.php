<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PermissionResource;
use App\Http\Resources\RoleResource;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\RoleHierarchyService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RolePermissionController extends Controller
{
    public function __construct(
        private readonly RoleHierarchyService $roleHierarchy
    ) {}

    public function roles(
        Request $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $allowedCodes =
            $this
            ->roleHierarchy
            ->assignableRoleCodes(
                $user
            );

        $roles = Role::query()
            ->with('permissions')
            ->where('is_active', true)
            ->whereIn(
                'code',
                $allowedCodes
            )
            ->orderBy('name')
            ->get();

        $data = $roles
            ->map(
                fn(Role $role) => (
                    new RoleResource(
                        $role
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $data,
            message: 'Assignable roles retrieved successfully.'
        );
    }

    public function permissions(
        Request $request
    ): JsonResponse {
        $permissions =
            Permission::query()
            ->orderBy('group')
            ->orderBy('name')
            ->get();

        $data = $permissions
            ->map(
                fn(
                    Permission $permission
                ) => (
                    new PermissionResource(
                        $permission
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $data,
            message: 'Permissions retrieved successfully.'
        );
    }
}
