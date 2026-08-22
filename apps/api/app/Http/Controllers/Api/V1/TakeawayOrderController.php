<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\QrOrderException;
use App\Exceptions\TakeawayOrderException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Takeaway\StoreTakeawayOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\User;
use App\Services\TakeawayOrderService;
use App\Exceptions\RecipeOperationException;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class TakeawayOrderController extends Controller
{
    public function __construct(
        private readonly TakeawayOrderService $orderService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | List Takeaway Orders
    |--------------------------------------------------------------------------
    */

    public function index(
        Request $request
    ): JsonResponse {
        $orders =
            Order::query()
            ->where(
                'order_type',
                Order::TYPE_TAKEAWAY
            )
            ->where(
                'order_source',
                Order::SOURCE_CASHIER
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

                'statusHistories' =>
                fn($query) =>
                $query
                    ->orderBy(
                        'changed_at'
                    )
                    ->orderBy(
                        'id'
                    ),
            ])
            ->latest('id')
            ->paginate(30);

        $data =
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
            data: $data,

            message: 'Takeaway orders retrieved successfully.',

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

    /*
    |--------------------------------------------------------------------------
    | Show Takeaway Order
    |--------------------------------------------------------------------------
    */

    public function show(
        Request $request,
        Order $order
    ): JsonResponse {
        if (
            $order->order_type
            !== Order::TYPE_TAKEAWAY
        ) {
            return ApiResponse::error(
                message: 'The requested order is not a takeaway order.',

                code: 'NOT_TAKEAWAY_ORDER',

                status: 404
            );
        }

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

            message: 'Takeaway order retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Create Takeaway Order
    |--------------------------------------------------------------------------
    */

    public function store(
        StoreTakeawayOrderRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $result =
                $this->orderService
                ->create(
                    actor: $user,
                    data: $request
                        ->validated()
                );
        } catch (
            TakeawayOrderException |
            QrOrderException |
            RecipeOperationException $exception
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
                message: 'The takeaway order could not be created.',

                code: 'TAKEAWAY_ORDER_CREATION_FAILED',

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

            message: $result['created']
                ? 'Takeaway order created successfully.'
                : 'The existing takeaway submission was returned.',

            status: $result['created']
                ? 201
                : 200
        );
    }
}
