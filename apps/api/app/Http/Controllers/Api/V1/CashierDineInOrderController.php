<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\QrOrderException;
use App\Exceptions\RecipeOperationException;
use App\Exceptions\TableOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Cashier\StoreCashierDineInOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Services\CashierDineInOrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Throwable;

final class CashierDineInOrderController extends Controller
{
    public function __construct(
        private readonly CashierDineInOrderService $orderService
    ) {}

    public function store(
        StoreCashierDineInOrderRequest $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $result =
                $this
                ->orderService
                ->create(
                    actor: $user,

                    table: $table,

                    data: $request
                        ->validated()
                );
        } catch (
            QrOrderException |
            RecipeOperationException |
            TableOperationException $exception
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
                message: 'The dine-in order could not be created.',

                code: 'CASHIER_DINE_IN_ORDER_CREATION_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new OrderResource(
                    $result['order']
                )
            )
                ->resolve(
                    $request
                ),

            message: $result['created']
                ? 'Dine-in order created successfully.'
                : 'The existing dine-in submission was returned.',

            status: $result['created']
                ? 201
                : 200
        );
    }
}
