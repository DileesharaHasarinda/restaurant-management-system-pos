<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\OrderLifecycleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Orders\CancelOrderRequest;
use App\Http\Requests\Api\V1\Orders\ListOrdersRequest;
use App\Http\Requests\Api\V1\Orders\OrderTransitionRequest;
use App\Http\Requests\Api\V1\Orders\RejectOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderLifecycleService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Throwable;

class OrderController extends Controller
{
    public function __construct(
        private readonly OrderLifecycleService $lifecycle
    ) {}

    public function index(
        ListOrdersRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            Order::query()
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

                'statusHistories' =>
                fn($query) =>
                $query
                    ->orderBy(
                        'changed_at'
                    )
                    ->orderBy(
                        'id'
                    ),
            ]);

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
                            'order_number',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'table_name_snapshot',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'customer_name',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'customer_phone',
                            'like',
                            "%{$search}%"
                        );
                }
            );
        }

        foreach (
            [
                'status',
                'order_source',
                'order_type',
                'table_id',
                'business_day_id',
            ]
            as $field
        ) {
            if (
                array_key_exists(
                    $field,
                    $data
                )
                &&
                $data[$field]
                !== null
            ) {
                $query->where(
                    $field,
                    $data[$field]
                );
            }
        }

        $orders =
            $query
            ->latest('id')
            ->paginate(
                $data['per_page']
                    ?? 30
            );

        $items =
            collect(
                $orders->items()
            )
            ->map(
                fn(Order $order) => (
                    new OrderResource(
                        $order
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $items,

            message: 'Orders retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $orders
                        ->currentPage(),

                    'per_page' =>
                    $orders
                        ->perPage(),

                    'total' =>
                    $orders->total(),

                    'last_page' =>
                    $orders
                        ->lastPage(),
                ],
            ]
        );
    }

    public function show(
        Order $order,
        OrderTransitionRequest $request
    ): JsonResponse {
        $order->load([
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

            'statusHistories' =>
            fn($query) =>
            $query
                ->orderBy(
                    'changed_at'
                )
                ->orderBy(
                    'id'
                ),
        ]);

        return ApiResponse::success(
            data: (
                new OrderResource(
                    $order
                )
            )->resolve(
                $request
            ),

            message: 'Order retrieved successfully.'
        );
    }

    public function confirm(
        OrderTransitionRequest $request,
        Order $order
    ): JsonResponse {
        return $this->perform(
            request: $request,

            operation: fn(User $user) =>
            $this->lifecycle
                ->confirm(
                    order: $order,
                    actor: $user,
                    notes: $request
                        ->validated()['notes']
                        ?? null
                ),

            successMessage: 'Order confirmed successfully.'
        );
    }

    public function reject(
        RejectOrderRequest $request,
        Order $order
    ): JsonResponse {
        return $this->perform(
            request: $request,

            operation: fn(User $user) =>
            $this->lifecycle
                ->reject(
                    order: $order,
                    actor: $user,
                    reason: $request
                        ->validated()['reason']
                ),

            successMessage: 'Order rejected successfully.'
        );
    }

    public function sendToKitchen(
        OrderTransitionRequest $request,
        Order $order
    ): JsonResponse {
        return $this->perform(
            request: $request,

            operation: fn(User $user) =>
            $this->lifecycle
                ->sendToKitchen(
                    order: $order,
                    actor: $user,
                    notes: $request
                        ->validated()['notes']
                        ?? null
                ),

            successMessage: 'Order sent to kitchen successfully.'
        );
    }

    public function serve(
        OrderTransitionRequest $request,
        Order $order
    ): JsonResponse {
        return $this->perform(
            request: $request,

            operation: fn(User $user) =>
            $this->lifecycle
                ->serve(
                    order: $order,
                    actor: $user,
                    notes: $request
                        ->validated()['notes']
                        ?? null
                ),

            successMessage: 'Order marked as served.'
        );
    }

    public function complete(
        OrderTransitionRequest $request,
        Order $order
    ): JsonResponse {
        return $this->perform(
            request: $request,

            operation: fn(User $user) =>
            $this->lifecycle
                ->complete(
                    order: $order,
                    actor: $user,
                    notes: $request
                        ->validated()['notes']
                        ?? null
                ),

            successMessage: 'Order completed successfully.'
        );
    }

    public function cancel(
        CancelOrderRequest $request,
        Order $order
    ): JsonResponse {
        return $this->perform(
            request: $request,

            operation: fn(User $user) =>
            $this->lifecycle
                ->cancel(
                    order: $order,
                    actor: $user,
                    reason: $request
                        ->validated()['reason']
                ),

            successMessage: 'Order cancelled successfully.'
        );
    }

    private function perform(
        $request,
        callable $operation,
        string $successMessage
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $result =
                $operation(
                    $user
                );
        } catch (
            OrderLifecycleException $exception
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
                message: 'The order operation could not be completed.',

                code: 'ORDER_OPERATION_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new OrderResource(
                    $result['order']
                )
            )->resolve(
                $request
            ),

            message: $result['changed']
                ? $successMessage
                : 'The order is already in the requested state.',

            meta: [
                'changed' =>
                $result['changed'],

                'affected_item_ids' =>
                $result['affected_item_ids'],
            ]
        );
    }
}
