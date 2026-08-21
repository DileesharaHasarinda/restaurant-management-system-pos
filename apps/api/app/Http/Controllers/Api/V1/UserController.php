<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Users\AssignUserRoleRequest;
use App\Http\Requests\Api\V1\Users\ListUsersRequest;
use App\Http\Requests\Api\V1\Users\StoreUserRequest;
use App\Http\Requests\Api\V1\Users\UpdateUserRequest;
use App\Http\Requests\Api\V1\Users\UpdateUserStatusRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\RoleHierarchyService;
use App\Services\UserManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class UserController extends Controller
{
    public function __construct(
        private readonly UserManagementService $userManagementService,
        private readonly RoleHierarchyService $roleHierarchy
    ) {}

    public function index(
        ListUsersRequest $request
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $data =
            $request->validated();

        $visibleRoles =
            $this
            ->roleHierarchy
            ->visibleRoleCodes(
                $actor
            );

        $query = User::query()
            ->with(
                'role.permissions'
            )
            ->whereHas(
                'role',
                fn($query) =>
                $query->whereIn(
                    'code',
                    $visibleRoles
                )
            );

        if (
            filled(
                $data['search']
                    ?? null
            )
        ) {
            $search =
                $data['search'];

            $query->where(
                function ($query) use (
                    $search
                ): void {
                    $query
                        ->where(
                            'name',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'username',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'email',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'phone',
                            'like',
                            "%{$search}%"
                        );
                }
            );
        }

        if (
            filled(
                $data['role']
                    ?? null
            )
        ) {
            $query->whereHas(
                'role',
                fn($query) =>
                $query->where(
                    'code',
                    $data['role']
                )
            );
        }

        if (
            filled(
                $data['status']
                    ?? null
            )
        ) {
            $query->where(
                'status',
                $data['status']
            );
        }

        $perPage =
            $data['per_page']
            ?? 20;

        $users = $query
            ->orderBy('name')
            ->paginate($perPage);

        $items = collect(
            $users->items()
        )->map(
            fn(User $user) => (
                new UserResource(
                    $user
                )
            )->resolve(
                $request
            )
        )->values()->all();

        return ApiResponse::success(
            data: $items,

            message: 'Users retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $users
                        ->currentPage(),

                    'per_page' =>
                    $users
                        ->perPage(),

                    'total' =>
                    $users->total(),

                    'last_page' =>
                    $users
                        ->lastPage(),
                ],
            ]
        );
    }

    public function show(
        User $user,
        ListUsersRequest $request
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $this
            ->roleHierarchy
            ->assertCanView(
                $actor,
                $user
            );

        $user->load(
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

            message: 'User retrieved successfully.'
        );
    }

    public function store(
        StoreUserRequest $request
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $user =
            $this
            ->userManagementService
            ->create(
                $actor,
                $request
                    ->validated()
            );

        return ApiResponse::success(
            data: (
                new UserResource(
                    $user
                )
            )->resolve(
                $request
            ),

            message: 'User created successfully.',

            status: 201
        );
    }

    public function update(
        UpdateUserRequest $request,
        User $user
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $user =
            $this
            ->userManagementService
            ->update(
                $actor,
                $user,
                $request
                    ->validated()
            );

        return ApiResponse::success(
            data: (
                new UserResource(
                    $user
                )
            )->resolve(
                $request
            ),

            message: 'User updated successfully.'
        );
    }

    public function updateStatus(
        UpdateUserStatusRequest $request,
        User $user
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $user =
            $this
            ->userManagementService
            ->updateStatus(
                $actor,
                $user,
                $request
                    ->validated()['status']
            );

        return ApiResponse::success(
            data: (
                new UserResource(
                    $user
                )
            )->resolve(
                $request
            ),

            message: 'User status updated successfully.'
        );
    }

    public function assignRole(
        AssignUserRoleRequest $request,
        User $user
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $user =
            $this
            ->userManagementService
            ->assignRole(
                $actor,
                $user,
                (int)
                $request
                    ->validated()['role_id']
            );

        return ApiResponse::success(
            data: (
                new UserResource(
                    $user
                )
            )->resolve(
                $request
            ),

            message: 'User role updated successfully.'
        );
    }
}
