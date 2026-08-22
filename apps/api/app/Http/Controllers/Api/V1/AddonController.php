<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Menu\StoreAddonGroupRequest;
use App\Http\Requests\Api\V1\Menu\StoreAddonRequest;
use App\Http\Resources\AddonGroupResource;
use App\Http\Resources\AddonResource;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\User;
use App\Services\MenuManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddonController extends Controller
{
    public function __construct(
        private readonly MenuManagementService $menuService
    ) {}

    public function groups(
        Request $request
    ): JsonResponse {
        $groups =
            AddonGroup::query()
            ->with('addons')
            ->orderBy(
                'sort_order'
            )
            ->orderBy(
                'name'
            )
            ->get();

        return ApiResponse::success(
            data: AddonGroupResource::collection(
                $groups
            )->resolve(
                $request
            ),

            message: 'Add-on groups retrieved successfully.'
        );
    }

    public function storeGroup(
        StoreAddonGroupRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $group =
            $this->menuService
            ->createAddonGroup(
                $user,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new AddonGroupResource(
                    $group
                )
            )->resolve(
                $request
            ),

            message: 'Add-on group created successfully.',

            status: 201
        );
    }

    public function addons(
        Request $request
    ): JsonResponse {
        $search =
            trim(
                (string)
                $request->query(
                    'search',
                    ''
                )
            );

        $query =
            Addon::query()
            ->with('group');

        if ($search !== '') {
            $query->where(
                'name',
                'like',
                "%{$search}%"
            );
        }

        $addons =
            $query
            ->orderBy(
                'sort_order'
            )
            ->orderBy(
                'name'
            )
            ->get();

        return ApiResponse::success(
            data: AddonResource::collection(
                $addons
            )->resolve(
                $request
            ),

            message: 'Add-ons retrieved successfully.'
        );
    }

    public function storeAddon(
        StoreAddonRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $addon =
            $this->menuService
            ->createAddon(
                $user,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new AddonResource(
                    $addon
                )
            )->resolve(
                $request
            ),

            message: 'Add-on created successfully.',

            status: 201
        );
    }
}
