<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\QrOrderException;
use App\Exceptions\TableOperationException;
use App\Exceptions\WaiterOrderException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Waiter\AppendWaiterOrderItemsRequest;
use App\Http\Requests\Api\V1\Waiter\StoreWaiterOrderRequest;
use App\Http\Resources\WaiterOrderResource;
use App\Models\Order;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Services\WaiterOrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Throwable;

class WaiterOrderController extends Controller
{
    public function __construct(
        private readonly WaiterOrderService $orderService
    ) {}

    public function store(
        StoreWaiterOrderRequest $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $result =
                $this->orderService
                ->create(
                    actor: $user,
                    table: $table,
                    data: $request->validated()
                );
        } catch (
            WaiterOrderException |
            TableOperationException |
            QrOrderException $exception
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
                message: 'The waiter order could not be created.',

                code: 'WAITER_ORDER_CREATION_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new WaiterOrderResource(
                    $result['order']
                )
            )->resolve(
                $request
            ),

            message: $result['created']
                ? 'Order created successfully.'
                : 'The existing order submission was returned.',

            status: $result['created']
                ? 201
                : 200
        );
    }

    public function append(
        AppendWaiterOrderItemsRequest $request,
        Order $order
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $result =
                $this->orderService
                ->append(
                    actor: $user,
                    order: $order,
                    data: $request->validated()
                );
        } catch (
            WaiterOrderException |
            QrOrderException $exception
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
                message: 'The additional items could not be added.',

                code: 'WAITER_ADDITIONAL_ITEMS_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new WaiterOrderResource(
                    $result['order']
                )
            )->resolve(
                $request
            ),

            message: $result['created']
                ? 'Additional items added successfully.'
                : 'The existing additional-item submission was returned.',

            status: $result['created']
                ? 201
                : 200
        );
    }
}
