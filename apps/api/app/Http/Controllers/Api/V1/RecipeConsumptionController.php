<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\RecipeOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Recipes\PreviewRecipeConsumptionRequest;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Services\RecipeRequirementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class RecipeConsumptionController extends Controller
{
    public function __construct(
        private readonly RecipeRequirementService $requirementService
    ) {}

    public function preview(
        PreviewRecipeConsumptionRequest $request,
        MenuItem $menuItem
    ): JsonResponse {
        $data =
            $request->validated();

        $variant =
            isset(
                $data['variant_id']
            )
            ? MenuItemVariant::query()
            ->findOrFail(
                $data['variant_id']
            )
            : null;

        try {
            $result =
                $this
                ->requirementService
                ->build(
                    menuItem: $menuItem,

                    variant: $variant,

                    selectedAddons: $data['addons']
                        ?? [],

                    itemQuantity: (int)
                    (
                        $data['item_quantity']
                        ?? 1
                    )
                );
        } catch (
            RecipeOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                status: $exception
                    ->status
            );
        }

        return ApiResponse::success(
            data: $result,

            message: 'Recipe consumption preview calculated successfully.'
        );
    }
}
