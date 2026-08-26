<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InventoryOperationException;
use App\Exceptions\StockAdjustmentOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Inventory\PhysicalStockCountRequest;
use App\Http\Resources\StockAdjustmentResource;
use App\Models\Ingredient;
use App\Models\StockAdjustment;
use App\Services\StockAdjustmentService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class StockAdjustmentController extends Controller
{
    public function __construct(
        private readonly StockAdjustmentService $stockAdjustmentService
    ) {}

    public function index(
        Request $request
    ): JsonResponse {
        $data =
            $request->validate([
                'ingredient_id' => [
                    'nullable',
                    'integer',
                    'exists:ingredients,id',
                ],

                'direction' => [
                    'nullable',
                    'string',
                    'in:IN,OUT,NONE',
                ],

                'date_from' => [
                    'nullable',
                    'date',
                ],

                'date_to' => [
                    'nullable',
                    'date',
                ],

                'search' => [
                    'nullable',
                    'string',
                    'max:150',
                ],

                'per_page' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:100',
                ],
            ]);

        $query =
            StockAdjustment::query()
            ->with([
                'businessDay',
                'ingredient.baseUnit',
                'unit',
                'createdBy',
                'approvedBy',
                'stockMovement',
            ]);

        if (
            isset(
                $data['ingredient_id']
            )
        ) {
            $query->where(
                'ingredient_id',
                (int)
                $data['ingredient_id']
            );
        }

        if (
            isset(
                $data['direction']
            )
        ) {
            $query->where(
                'direction',
                $data['direction']
            );
        }

        if (
            isset(
                $data['date_from']
            )
        ) {
            $query->whereDate(
                'posted_at',
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
                'posted_at',
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
                    Builder $builder
                ) use (
                    $search
                ): void {
                    $builder
                        ->where(
                            'adjustment_number',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'reason',
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

        $adjustments =
            $query
            ->orderByDesc(
                'posted_at'
            )
            ->orderByDesc(
                'id'
            )
            ->paginate(
                $data['per_page']
                    ?? 30
            );

        $records =
            collect(
                $adjustments->items()
            )
            ->map(
                fn(
                    StockAdjustment $adjustment
                ) => (
                    new StockAdjustmentResource(
                        $adjustment
                    )
                )
                    ->resolve(
                        $request
                    )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $records,

            message: 'Stock adjustments retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $adjustments
                        ->currentPage(),

                    'per_page' =>
                    $adjustments
                        ->perPage(),

                    'total' =>
                    $adjustments
                        ->total(),

                    'last_page' =>
                    $adjustments
                        ->lastPage(),
                ],
            ]
        );
    }

    public function show(
        Request $request,
        StockAdjustment $stockAdjustment
    ): JsonResponse {
        $stockAdjustment
            ->load([
                'businessDay',
                'ingredient.baseUnit',
                'unit',
                'createdBy',
                'approvedBy',
                'stockMovement',
            ]);

        return ApiResponse::success(
            data: (
                new StockAdjustmentResource(
                    $stockAdjustment
                )
            )
                ->resolve(
                    $request
                ),

            message: 'Stock adjustment retrieved successfully.'
        );
    }

    public function physicalCount(
        PhysicalStockCountRequest $request,
        Ingredient $ingredient
    ): JsonResponse {
        $data =
            $request->validated();

        try {
            $result =
                $this
                ->stockAdjustmentService
                ->recordPhysicalCount(
                    actor: $request->user(),

                    ingredient: $ingredient,

                    clientRequestId: $data['client_request_id'],

                    unitId: (int)
                    $data['unit_id'],

                    actualQuantity: (float)
                    $data['actual_quantity'],

                    reason: $data['reason']
                );

            $created =
                (bool)
                $result['created'];

            return ApiResponse::success(
                data: (
                    new StockAdjustmentResource(
                        $result['adjustment']
                    )
                )
                    ->resolve(
                        $request
                    ),

                message: $created
                    ? 'Physical stock count recorded successfully.'
                    : 'This physical stock count was already recorded.',

                status: $created
                    ? 201
                    : 200,

                meta: [
                    'created' =>
                    $created,
                ]
            );
        } catch (
            StockAdjustmentOperationException |
            InventoryOperationException
            $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                status: $exception
                    ->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'Unable to record the physical stock count.',

                code: 'PHYSICAL_STOCK_COUNT_FAILED',

                status: 500
            );
        }
    }
}
