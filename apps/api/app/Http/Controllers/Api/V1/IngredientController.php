<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InventoryOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Inventory\ListIngredientsRequest;
use App\Http\Requests\Api\V1\Inventory\StoreIngredientRequest;
use App\Http\Requests\Api\V1\Inventory\UpdateIngredientRequest;
use App\Http\Requests\Api\V1\Inventory\UpdateIngredientStatusRequest;
use App\Http\Resources\IngredientResource;
use App\Models\Ingredient;
use App\Models\User;
use App\Services\IngredientManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class IngredientController extends Controller
{
    public function __construct(
        private readonly IngredientManagementService $ingredientService
    ) {}

    public function index(
        ListIngredientsRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            Ingredient::query()
            ->with(
                'baseUnit'
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
                            'sku',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'storage_location',
                            'like',
                            "%{$search}%"
                        );
                }
            );
        }

        if (
            isset(
                $data['base_unit_id']
            )
        ) {
            $query->where(
                'base_unit_id',
                $data['base_unit_id']
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
            ($data['low_stock'] ?? false)
        ) {
            $query
                ->where(
                    'track_stock',
                    true
                )
                ->where(
                    'reorder_level',
                    '>',
                    0
                )
                ->whereColumn(
                    'current_stock',
                    '<=',
                    'reorder_level'
                );
        }

        $ingredients =
            $query
            ->orderBy('name')
            ->paginate(
                $data['per_page']
                    ?? 30
            );

        $records =
            collect(
                $ingredients
                    ->items()
            )
            ->map(
                fn(
                    Ingredient $ingredient
                ) => (
                    new IngredientResource(
                        $ingredient
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $records,

            message: 'Ingredients retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $ingredients
                        ->currentPage(),

                    'per_page' =>
                    $ingredients
                        ->perPage(),

                    'total' =>
                    $ingredients
                        ->total(),

                    'last_page' =>
                    $ingredients
                        ->lastPage(),
                ],
            ]
        );
    }

    public function store(
        StoreIngredientRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $ingredient =
                $this
                ->ingredientService
                ->create(
                    $user,
                    $request
                        ->validated()
                );
        } catch (
            InventoryOperationException $exception
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
            data: (
                new IngredientResource(
                    $ingredient
                )
            )->resolve(
                $request
            ),

            message: 'Ingredient created successfully.',

            status: 201
        );
    }

    public function show(
        Ingredient $ingredient
    ): JsonResponse {
        $ingredient->load(
            'baseUnit'
        );

        return ApiResponse::success(
            data: new IngredientResource(
                $ingredient
            ),

            message: 'Ingredient retrieved successfully.'
        );
    }

    public function update(
        UpdateIngredientRequest $request,
        Ingredient $ingredient
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $ingredient =
                $this
                ->ingredientService
                ->update(
                    $user,
                    $ingredient,
                    $request
                        ->validated()
                );
        } catch (
            InventoryOperationException $exception
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
            data: (
                new IngredientResource(
                    $ingredient
                )
            )->resolve(
                $request
            ),

            message: 'Ingredient updated successfully.'
        );
    }

    public function updateStatus(
        UpdateIngredientStatusRequest $request,
        Ingredient $ingredient
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $ingredient =
            $this
            ->ingredientService
            ->updateStatus(
                $user,
                $ingredient,
                (bool)
                $request
                    ->validated()['is_active']
            );

        return ApiResponse::success(
            data: (
                new IngredientResource(
                    $ingredient
                )
            )->resolve(
                $request
            ),

            message: 'Ingredient status updated successfully.'
        );
    }
}
