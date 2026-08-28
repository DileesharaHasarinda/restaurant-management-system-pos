<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InventoryOperationException;
use App\Exceptions\ManagerAuthorizationException;
use App\Exceptions\StockReversalOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Inventory\StockCancellationReversalRequest;
use App\Models\StockMovement;
use App\Services\StockCancellationReversalService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Throwable;

final class StockCancellationReversalController extends Controller
{
    public function __construct(
        private readonly StockCancellationReversalService $service
    ) {}

    public function store(
        StockCancellationReversalRequest $request,
        StockMovement $stockMovement
    ): JsonResponse {
        try {
            $result =
                $this
                ->service
                ->reverse(
                    movement: $stockMovement,

                    initiator: $request->user(),

                    data: $request->validated()
                );

            $movement =
                $result['movement'];

            return ApiResponse::success(
                data: [
                    'id' =>
                    $movement->id,

                    'movement_key' =>
                    $movement->movement_key,

                    'ingredient_id' =>
                    $movement->ingredient_id,

                    'business_day_id' =>
                    $movement->business_day_id,

                    'movement_type' =>
                    $movement->movement_type,

                    'quantity_delta' =>
                    (float)
                    $movement->quantity_delta,

                    'balance_after' =>
                    (float)
                    $movement->balance_after,

                    'unit_cost' =>
                    (float)
                    $movement->unit_cost,

                    'total_cost' =>
                    (float)
                    $movement->total_cost,

                    'source_type' =>
                    $movement->source_type,

                    'source_id' =>
                    $movement->source_id,

                    'reference' =>
                    $movement->reference,

                    'occurred_at' =>
                    $movement
                        ->occurred_at
                        ?->toISOString(),

                    'created' =>
                    $result['created'],
                ],

                message: $result['created']
                    ? 'Cancellation stock reversal completed successfully.'
                    : 'Existing stock reversal request returned successfully.'
            );
        } catch (
            StockReversalOperationException |
            ManagerAuthorizationException |
            InventoryOperationException
            $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'Unable to process the stock reversal.',

                code: 'CANCELLATION_STOCK_REVERSAL_FAILED',

                status: 500
            );
        }
    }
}
