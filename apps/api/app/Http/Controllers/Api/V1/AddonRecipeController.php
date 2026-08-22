<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\RecipeOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Recipes\SaveAddonRecipeRequest;
use App\Models\Addon;
use App\Models\User;
use App\Services\AddonRecipeCostService;
use App\Services\AddonRecipeManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddonRecipeController extends Controller
{
    public function __construct(
        private readonly AddonRecipeManagementService $recipeService,
        private readonly AddonRecipeCostService $costService
    ) {}

    public function show(
        Addon $addon
    ): JsonResponse {
        try {
            $recipe =
                $this
                ->costService
                ->build(
                    $addon
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

            message: 'Add-on recipe retrieved successfully.'
        );
    }

    public function update(
        SaveAddonRecipeRequest $request,
        Addon $addon
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

                    addon: $addon,

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

            message: 'Add-on inventory recipe updated successfully.'
        );
    }

    public function destroy(
        Request $request,
        Addon $addon
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

                    addon: $addon
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

            message: 'Add-on inventory recipe cleared successfully.'
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
