<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InventoryOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Inventory\ListStockMovementsRequest;
use App\Http\Requests\Api\V1\Inventory\OpeningStockRequest;
use App\Http\Requests\Api\V1\Inventory\StockAdjustmentRequest;
use App\Http\Resources\IngredientResource;
use App\Http\Resources\StockMovementResource;
use App\Models\Ingredient;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\InventoryStockService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryStockController extends Controller
{
    public function __construct(
        private readonly InventoryStockService $stockService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Current Stock
    |--------------------------------------------------------------------------
    */

    public function current(
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
            Ingredient::query()
            ->with('baseUnit')
            ->where(
                'track_stock',
                true
            );

        if ($search !== '') {
            $query->where(
                function (
                    Builder $query
                ) use (
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
                        );
                }
            );
        }

        $ingredients =
            $query
            ->orderBy('name')
            ->get();

        return ApiResponse::success(
            data: IngredientResource::collection(
                $ingredients
            )->resolve(
                $request
            ),

            message: 'Current inventory retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Low Stock
    |--------------------------------------------------------------------------
    */

    public function lowStock(
        Request $request
    ): JsonResponse {
        $ingredients =
            Ingredient::query()
            ->with('baseUnit')
            ->where(
                'is_active',
                true
            )
            ->where(
                'track_stock',
                true
            )
            ->where(
                'current_stock',
                '>',
                0
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
            )
            ->orderBy(
                'current_stock'
            )
            ->get();

        return ApiResponse::success(
            data: IngredientResource::collection(
                $ingredients
            )->resolve(
                $request
            ),

            message: 'Low-stock ingredients retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Out of Stock
    |--------------------------------------------------------------------------
    */

    public function outOfStock(
        Request $request
    ): JsonResponse {
        $ingredients =
            Ingredient::query()
            ->with('baseUnit')
            ->where(
                'is_active',
                true
            )
            ->where(
                'track_stock',
                true
            )
            ->where(
                'current_stock',
                '<=',
                0
            )
            ->orderBy('name')
            ->get();

        return ApiResponse::success(
            data: IngredientResource::collection(
                $ingredients
            )->resolve(
                $request
            ),

            message: 'Out-of-stock ingredients retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Stock Valuation
    |--------------------------------------------------------------------------
    */

    public function valuation(
        Request $request
    ): JsonResponse {
        $ingredients =
            Ingredient::query()
            ->with('baseUnit')
            ->where(
                'is_active',
                true
            )
            ->where(
                'track_stock',
                true
            )
            ->orderBy('name')
            ->get();

        $totalValue =
            round(
                $ingredients->sum(
                    fn(
                        Ingredient $ingredient
                    ): float =>
                    $ingredient->stockValue()
                ),
                2
            );

        return ApiResponse::success(
            data: [
                'total_stock_value' =>
                $totalValue,

                'ingredient_count' =>
                $ingredients->count(),

                'items' =>
                IngredientResource::collection(
                    $ingredients
                )->resolve(
                    $request
                ),
            ],

            message: 'Stock valuation retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Global Stock History
    |--------------------------------------------------------------------------
    */

    public function movements(
        ListStockMovementsRequest $request
    ): JsonResponse {
        return $this->movementHistory(
            request: $request
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Ingredient Stock History
    |--------------------------------------------------------------------------
    */

    public function ingredientHistory(
        ListStockMovementsRequest $request,
        Ingredient $ingredient
    ): JsonResponse {
        return $this->movementHistory(
            request: $request,

            ingredientId: $ingredient->id
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Opening Balance
    |--------------------------------------------------------------------------
    */

    public function openingBalance(
        OpeningStockRequest $request,
        Ingredient $ingredient
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $data =
            $request->validated();

        try {
            $movement =
                $this
                ->stockService
                ->openingBalance(
                    actor: $user,

                    ingredient: $ingredient,

                    quantity: (float)
                    $data['quantity'],

                    unitCost: (float)
                    $data['unit_cost'],

                    idempotencyKey: $data['idempotency_key'],

                    reference: $data['reference']
                        ?? null,

                    notes: $data['notes']
                        ?? null
                );
        } catch (
            InventoryOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        }

        $movement->load([
            'ingredient.baseUnit',
            'createdBy',
        ]);

        return ApiResponse::success(
            data: (
                new StockMovementResource(
                    $movement
                )
            )->resolve(
                $request
            ),

            message: 'Opening stock recorded successfully.',

            status: 201
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Adjustment IN
    |--------------------------------------------------------------------------
    */

    public function adjustmentIn(
        StockAdjustmentRequest $request,
        Ingredient $ingredient
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $data =
            $request->validated();

        try {
            $movement =
                $this
                ->stockService
                ->adjustmentIn(
                    actor: $user,

                    ingredient: $ingredient,

                    quantity: (float)
                    $data['quantity'],

                    unitCost: isset(
                        $data['unit_cost']
                    )
                        ? (float)
                        $data['unit_cost']
                        : null,

                    idempotencyKey: $data['idempotency_key'],

                    reason: $data['reason'],

                    reference: $data['reference']
                        ?? null
                );
        } catch (
            InventoryOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        }

        $movement->load([
            'ingredient.baseUnit',
            'createdBy',
        ]);

        return ApiResponse::success(
            data: (
                new StockMovementResource(
                    $movement
                )
            )->resolve(
                $request
            ),

            message: 'Stock adjustment-in recorded successfully.',

            status: 201
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Adjustment OUT
    |--------------------------------------------------------------------------
    */

    public function adjustmentOut(
        StockAdjustmentRequest $request,
        Ingredient $ingredient
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $data =
            $request->validated();

        try {
            $movement =
                $this
                ->stockService
                ->adjustmentOut(
                    actor: $user,

                    ingredient: $ingredient,

                    quantity: (float)
                    $data['quantity'],

                    idempotencyKey: $data['idempotency_key'],

                    reason: $data['reason'],

                    reference: $data['reference']
                        ?? null
                );
        } catch (
            InventoryOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        }

        $movement->load([
            'ingredient.baseUnit',
            'createdBy',
        ]);

        return ApiResponse::success(
            data: (
                new StockMovementResource(
                    $movement
                )
            )->resolve(
                $request
            ),

            message: 'Stock adjustment-out recorded successfully.',

            status: 201
        );
    }

    private function movementHistory(
        ListStockMovementsRequest $request,
        ?int $ingredientId = null
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            StockMovement::query()
            ->with([
                'ingredient.baseUnit',
                'createdBy',
            ]);

        $ingredientId ??=
            isset(
                $data['ingredient_id']
            )
            ? (int)
            $data['ingredient_id']
            : null;

        if ($ingredientId !== null) {
            $query->where(
                'ingredient_id',
                $ingredientId
            );
        }

        if (
            isset(
                $data['movement_type']
            )
        ) {
            $query->where(
                'movement_type',
                $data['movement_type']
            );
        }

        if (
            isset(
                $data['date_from']
            )
        ) {
            $query->whereDate(
                'occurred_at',
                '>=',
                $data['date_from']
            );
        }

        if (
            isset(
                $data['date_to']
            )
        ) {
            $query->whereDate(
                'occurred_at',
                '<=',
                $data['date_to']
            );
        }

        if (
            filled(
                $data['search']
                    ?? null
            )
        ) {
            $search =
                $data['search'];

            $query->where(
                function (
                    Builder $query
                ) use (
                    $search
                ): void {
                    $query
                        ->where(
                            'reference',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'notes',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhereHas(
                            'ingredient',
                            function (
                                Builder $ingredientQuery
                            ) use (
                                $search
                            ): void {
                                $ingredientQuery
                                    ->where(
                                        'name',
                                        'like',
                                        "%{$search}%"
                                    )
                                    ->orWhere(
                                        'sku',
                                        'like',
                                        "%{$search}%"
                                    );
                            }
                        );
                }
            );
        }

        $movements =
            $query
            ->orderByDesc(
                'occurred_at'
            )
            ->orderByDesc('id')
            ->paginate(
                $data['per_page']
                    ?? 30
            );

        $records =
            collect(
                $movements->items()
            )
            ->map(
                fn(
                    StockMovement $movement
                ) => (
                    new StockMovementResource(
                        $movement
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $records,

            message: 'Stock movement history retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $movements
                        ->currentPage(),

                    'per_page' =>
                    $movements
                        ->perPage(),

                    'total' =>
                    $movements
                        ->total(),

                    'last_page' =>
                    $movements
                        ->lastPage(),
                ],
            ]
        );
    }
}
