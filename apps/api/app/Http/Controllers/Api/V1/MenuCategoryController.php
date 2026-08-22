<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Menu\StoreCategoryRequest;
use App\Http\Requests\Api\V1\Menu\UpdateCategoryRequest;
use App\Http\Requests\Api\V1\Menu\UpdateCategoryStateRequest;
use App\Http\Resources\MenuCategoryResource;
use App\Models\Category;
use App\Models\User;
use App\Services\MenuManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuCategoryController extends Controller
{
    public function __construct(
        private readonly MenuManagementService $menuService
    ) {}

    public function index(
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
            Category::query()
            ->withCount(
                'menuItems'
            );

        if ($search !== '') {
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
                            'description',
                            'like',
                            "%{$search}%"
                        );
                }
            );
        }

        $categories =
            $query
            ->orderBy(
                'sort_order'
            )
            ->orderBy(
                'name'
            )
            ->get();

        return ApiResponse::success(
            data: MenuCategoryResource::collection(
                $categories
            )->resolve(
                $request
            ),

            message: 'Menu categories retrieved successfully.'
        );
    }

    public function store(
        StoreCategoryRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $category =
            $this->menuService
            ->createCategory(
                $user,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new MenuCategoryResource(
                    $category
                )
            )->resolve(
                $request
            ),

            message: 'Menu category created successfully.',

            status: 201
        );
    }

    public function show(
        Category $category,
        Request $request
    ): JsonResponse {
        $category->loadCount(
            'menuItems'
        );

        return ApiResponse::success(
            data: (
                new MenuCategoryResource(
                    $category
                )
            )->resolve(
                $request
            ),

            message: 'Menu category retrieved successfully.'
        );
    }

    public function update(
        UpdateCategoryRequest $request,
        Category $category
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $category =
            $this->menuService
            ->updateCategory(
                $user,
                $category,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new MenuCategoryResource(
                    $category
                )
            )->resolve(
                $request
            ),

            message: 'Menu category updated successfully.'
        );
    }

    public function updateState(
        UpdateCategoryStateRequest $request,
        Category $category
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $category =
            $this->menuService
            ->updateCategoryState(
                $user,
                $category,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new MenuCategoryResource(
                    $category
                )
            )->resolve(
                $request
            ),

            message: 'Menu category state updated successfully.'
        );
    }
}
