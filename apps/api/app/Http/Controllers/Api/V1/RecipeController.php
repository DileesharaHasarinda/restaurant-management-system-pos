<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\RecipeOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Recipes\SaveRecipeRequest;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\User;
use App\Services\RecipeCostService;
use App\Services\RecipeManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecipeController extends Controller
{
    public function __construct(
        private readonly RecipeManagementService $recipeService,
        private readonly RecipeCostService $recipeCostService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Menu Item Base Recipe
    |--------------------------------------------------------------------------
    */

    public function show(
        MenuItem $menuItem
    ): JsonResponse {
        try {
            $recipe =
                $this
                ->recipeCostService
                ->build(
                    $menuItem
                );
        } catch (
            RecipeOperationException $exception
        ) {
            return $this->error(
                $exception
            );
        }

        return ApiResponse::success(
            data: $recipe,

            message: 'Recipe retrieved successfully.'
        );
    }

    public function update(
        SaveRecipeRequest $request,
        MenuItem $menuItem
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $recipe =
                $this
                ->recipeService
                ->save(
                    actor: $user,

                    menuItem: $menuItem,

                    variant: null,

                    components: $request
                        ->validated()['components']
                );
        } catch (
            RecipeOperationException $exception
        ) {
            return $this->error(
                $exception
            );
        }

        return ApiResponse::success(
            data: $recipe,

            message: 'Recipe updated successfully.'
        );
    }

    public function destroy(
        Request $request,
        MenuItem $menuItem
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $recipe =
                $this
                ->recipeService
                ->clear(
                    actor: $user,

                    menuItem: $menuItem,

                    variant: null
                );
        } catch (
            RecipeOperationException $exception
        ) {
            return $this->error(
                $exception
            );
        }

        return ApiResponse::success(
            data: $recipe,

            message: 'Recipe cleared successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Variant Recipe
    |--------------------------------------------------------------------------
    */

    public function showVariant(
        MenuItem $menuItem,
        MenuItemVariant $variant
    ): JsonResponse {
        try {
            $recipe =
                $this
                ->recipeCostService
                ->build(
                    $menuItem,
                    $variant
                );
        } catch (
            RecipeOperationException $exception
        ) {
            return $this->error(
                $exception
            );
        }

        return ApiResponse::success(
            data: $recipe,

            message: 'Variant recipe retrieved successfully.'
        );
    }

    public function updateVariant(
        SaveRecipeRequest $request,
        MenuItem $menuItem,
        MenuItemVariant $variant
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $recipe =
                $this
                ->recipeService
                ->save(
                    actor: $user,

                    menuItem: $menuItem,

                    variant: $variant,

                    components: $request
                        ->validated()['components']
                );
        } catch (
            RecipeOperationException $exception
        ) {
            return $this->error(
                $exception
            );
        }

        return ApiResponse::success(
            data: $recipe,

            message: 'Variant recipe updated successfully.'
        );
    }

    public function destroyVariant(
        Request $request,
        MenuItem $menuItem,
        MenuItemVariant $variant
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $recipe =
                $this
                ->recipeService
                ->clear(
                    actor: $user,

                    menuItem: $menuItem,

                    variant: $variant
                );
        } catch (
            RecipeOperationException $exception
        ) {
            return $this->error(
                $exception
            );
        }

        return ApiResponse::success(
            data: $recipe,

            message: 'Variant recipe cleared successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Full Menu Item Recipe Overview
    |--------------------------------------------------------------------------
    */

    public function overview(
        MenuItem $menuItem
    ): JsonResponse {
        $menuItem->load([
            'variants' =>
            fn($query) =>
            $query
                ->where(
                    'is_active',
                    true
                )
                ->orderBy(
                    'sort_order'
                ),
        ]);

        try {
            $base =
                $this
                ->recipeCostService
                ->build(
                    $menuItem
                );

            $variants =
                $menuItem
                ->variants
                ->map(
                    fn(
                        MenuItemVariant $variant
                    ): array =>
                    $this
                        ->recipeCostService
                        ->build(
                            $menuItem,
                            $variant
                        )
                )
                ->values()
                ->all();
        } catch (
            RecipeOperationException $exception
        ) {
            return $this->error(
                $exception
            );
        }

        return ApiResponse::success(
            data: [
                'menu_item' => [
                    'id' =>
                    $menuItem->id,

                    'name' =>
                    $menuItem->name,

                    'has_variants' =>
                    (bool)
                    $menuItem
                        ->has_variants,
                ],

                'base_recipe' =>
                $base,

                'variant_recipes' =>
                $variants,
            ],

            message: 'Recipe overview retrieved successfully.'
        );
    }

    private function error(
        RecipeOperationException $exception
    ): JsonResponse {
        return ApiResponse::error(
            message: $exception->getMessage(),

            code: $exception->errorCode,

            status: $exception->status
        );
    }
}
