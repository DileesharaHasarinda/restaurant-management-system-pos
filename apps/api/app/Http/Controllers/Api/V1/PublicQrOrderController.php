<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\QrOrderException;
use App\Exceptions\TableOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\QrOrders\AppendQrOrderItemsRequest;
use App\Http\Requests\Api\V1\QrOrders\StoreQrOrderRequest;
use App\Http\Resources\PublicQrOrderResource;
use App\Models\Order;
use App\Services\QrOrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class PublicQrOrderController extends Controller
{
    public function __construct(
        private readonly QrOrderService $orderService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | First Customer Order
    |--------------------------------------------------------------------------
    */

    public function store(
        StoreQrOrderRequest $request,
        string $token
    ): JsonResponse {
        try {
            $result =
                $this
                ->orderService
                ->submit(
                    token: $token,

                    data: $request
                        ->validated()
                );
        } catch (
            QrOrderException $exception
        ) {
            return $this->qrError(
                $exception
            );
        } catch (
            TableOperationException $exception
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
                message: 'The order could not be submitted. Please try again.',

                code: 'QR_ORDER_SUBMISSION_FAILED',

                status: 500
            );
        }

        /** @var Order $order */
        $order =
            $result['order'];

        $created =
            (bool)
            $result['created'];

        return ApiResponse::success(
            data: (
                new PublicQrOrderResource(
                    $order
                )
            )->resolve(
                $request
            ),

            message: $created
                ? 'Your order has been sent to the cashier for approval.'
                : 'Your order was already received. The existing order has been returned.',

            status: $created
                ? 201
                : 200
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Add More Items To Existing Order
    |--------------------------------------------------------------------------
    */

    public function append(
        AppendQrOrderItemsRequest $request,
        string $statusToken
    ): JsonResponse {
        try {
            $result =
                $this
                ->orderService
                ->append(
                    statusToken: $statusToken,

                    data: $request
                        ->validated()
                );
        } catch (
            QrOrderException $exception
        ) {
            return $this->qrError(
                $exception
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'The additional items could not be submitted. Please try again.',

                code: 'QR_ADDITIONAL_ITEMS_FAILED',

                status: 500
            );
        }

        /** @var Order $order */
        $order =
            $result['order'];

        $created =
            (bool)
            $result['created'];

        return ApiResponse::success(
            data: (
                new PublicQrOrderResource(
                    $order
                )
            )->resolve(
                $request
            ),

            message: $created
                ? 'Additional items were added to your order successfully.'
                : 'These additional items were already received. Your current order has been returned.',

            status: $created
                ? 201
                : 200
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Public Order Status
    |--------------------------------------------------------------------------
    */

    public function status(
        Request $request,
        string $statusToken
    ): JsonResponse {
        /** @var Order|null $order */
        $order =
            Order::query()
            ->where(
                'public_status_token',
                $statusToken
            )
            ->where(
                'order_source',
                Order::SOURCE_QR_CUSTOMER
            )
            ->with([
                'items' =>
                fn($query) =>
                $query->orderBy(
                    'id'
                ),

                'items.addons' =>
                fn($query) =>
                $query->orderBy(
                    'id'
                ),
            ])
            ->first();

        if (! $order) {
            return ApiResponse::error(
                message: 'The order could not be found.',

                code: 'QR_ORDER_NOT_FOUND',

                status: 404
            );
        }

        return ApiResponse::success(
            data: (
                new PublicQrOrderResource(
                    $order
                )
            )->resolve(
                $request
            ),

            message: 'Order status retrieved successfully.'
        );
    }

    private function qrError(
        QrOrderException $exception
    ): JsonResponse {
        return ApiResponse::error(
            message: $exception->getMessage(),

            code: $exception->errorCode,

            status: $exception->status
        );
    }
}
