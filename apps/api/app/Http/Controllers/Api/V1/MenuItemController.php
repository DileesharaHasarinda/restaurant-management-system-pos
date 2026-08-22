<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Menu\ListMenuItemsRequest;
use App\Http\Requests\Api\V1\Menu\StoreMenuItemRequest;
use App\Http\Requests\Api\V1\Menu\UpdateMenuItemRequest;
use App\Http\Requests\Api\V1\Menu\UpdateMenuItemStateRequest;
use App\Http\Requests\Api\V1\Menu\UploadMenuItemPhotoRequest;
use App\Http\Resources\MenuItemResource;
use App\Models\MenuItem;
use App\Models\User;
use App\Services\MenuManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuItemController extends Controller
{
    public function __construct(
        private readonly MenuManagementService $menuService
    ) {}

    public function index(
        ListMenuItemsRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            MenuItem::query()
            ->with([
                'category',
                'variants',
                'addons.group',
            ]);

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
                            'sku',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'description',
                            'like',
                            "%{$search}%"
                        );
                }
            );
        }

        if (
            isset(
                $data['category_id']
            )
        ) {
            $query->where(
                'category_id',
                $data['category_id']
            );
        }

        if (
            array_key_exists(
                'is_active',
                $data
            )
        ) {
            $query->where(
                'is_active',
                $data['is_active']
            );
        }

        if (
            array_key_exists(
                'is_available',
                $data
            )
        ) {
            $query->where(
                'is_available',
                $data['is_available']
            );
        }

        if (
            array_key_exists(
                'website_visible',
                $data
            )
        ) {
            $query->where(
                'is_visible_on_website',
                $data['website_visible']
            );
        }

        if (
            array_key_exists(
                'qr_visible',
                $data
            )
        ) {
            $query->where(
                'is_visible_on_qr',
                $data['qr_visible']
            );
        }

        $items =
            $query
            ->orderBy(
                'sort_order'
            )
            ->orderBy(
                'name'
            )
            ->paginate(
                $data['per_page']
                    ?? 30
            );

        $records =
            collect(
                $items->items()
            )
            ->map(
                fn(MenuItem $item) => (
                    new MenuItemResource(
                        $item
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $records,

            message: 'Menu items retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $items
                        ->currentPage(),

                    'per_page' =>
                    $items
                        ->perPage(),

                    'total' =>
                    $items
                        ->total(),

                    'last_page' =>
                    $items
                        ->lastPage(),
                ],
            ]
        );
    }

    public function store(
        StoreMenuItemRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $item =
            $this->menuService
            ->createMenuItem(
                $user,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new MenuItemResource(
                    $item
                )
            )->resolve(
                $request
            ),

            message: 'Menu item created successfully.',

            status: 201
        );
    }

    public function show(
        MenuItem $menuItem,
        Request $request
    ): JsonResponse {
        $menuItem->load([
            'category',
            'variants',
            'addons.group',
        ]);

        return ApiResponse::success(
            data: (
                new MenuItemResource(
                    $menuItem
                )
            )->resolve(
                $request
            ),

            message: 'Menu item retrieved successfully.'
        );
    }

    public function update(
        UpdateMenuItemRequest $request,
        MenuItem $menuItem
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $item =
            $this->menuService
            ->updateMenuItem(
                $user,
                $menuItem,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new MenuItemResource(
                    $item
                )
            )->resolve(
                $request
            ),

            message: 'Menu item updated successfully.'
        );
    }

    public function updateState(
        UpdateMenuItemStateRequest $request,
        MenuItem $menuItem
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $item =
            $this->menuService
            ->updateMenuItemState(
                $user,
                $menuItem,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new MenuItemResource(
                    $item
                )
            )->resolve(
                $request
            ),

            message: 'Menu item state updated successfully.'
        );
    }

    public function uploadPhoto(
        UploadMenuItemPhotoRequest $request,
        MenuItem $menuItem
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $item =
            $this->menuService
            ->uploadPhoto(
                $user,
                $menuItem,
                $request->file(
                    'photo'
                )
            );

        return ApiResponse::success(
            data: (
                new MenuItemResource(
                    $item
                )
            )->resolve(
                $request
            ),

            message: 'Menu item photo updated successfully.'
        );
    }

    public function removePhoto(
        Request $request,
        MenuItem $menuItem
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $item =
            $this->menuService
            ->removePhoto(
                $user,
                $menuItem
            );

        return ApiResponse::success(
            data: (
                new MenuItemResource(
                    $item
                )
            )->resolve(
                $request
            ),

            message: 'Menu item photo removed successfully.'
        );
    }
}
