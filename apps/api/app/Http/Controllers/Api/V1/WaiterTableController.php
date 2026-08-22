<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\WaiterOrderException;
use App\Http\Controllers\Controller;
use App\Http\Resources\TableSessionResource;
use App\Http\Resources\WaiterOrderResource;
use App\Http\Resources\WaiterTableResource;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Services\WaiterOrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class WaiterTableController extends Controller
{
    public function __construct(
        private readonly WaiterOrderService $orderService
    ) {}

    public function index(
        Request $request
    ): JsonResponse {
        $tables =
            RestaurantTable::query()
            ->where(
                'is_active',
                true
            )
            ->with([
                'openSession.orders',
            ])
            ->orderBy(
                'sort_order'
            )
            ->orderBy(
                'table_number'
            )
            ->get();

        return ApiResponse::success(
            data: WaiterTableResource::collection(
                $tables
            )->resolve(
                $request
            ),

            message: 'Waiter tables retrieved successfully.'
        );
    }

    public function show(
        Request $request,
        RestaurantTable $table
    ): JsonResponse {
        $table->load([
            'openSession.orders' =>
            fn($query) =>
            $query
                ->orderBy(
                    'session_sequence'
                )
                ->orderBy(
                    'id'
                ),

            'openSession.orders.items' =>
            fn($query) =>
            $query->orderBy(
                'id'
            ),

            'openSession.orders.items.addons' =>
            fn($query) =>
            $query->orderBy(
                'id'
            ),
        ]);

        $session =
            $table->openSession;

        return ApiResponse::success(
            data: [
                'table' => (
                    new WaiterTableResource(
                        $table
                    )
                )->resolve(
                    $request
                ),

                'orders' =>
                $session
                    ? WaiterOrderResource::collection(
                        $session->orders
                    )->resolve(
                        $request
                    )
                    : [],
            ],

            message: 'Table ordering information retrieved successfully.'
        );
    }

    public function requestBill(
        Request $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $result =
                $this->orderService
                ->requestBill(
                    actor: $user,
                    table: $table
                );
        } catch (
            WaiterOrderException $exception
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
                message: 'The bill request could not be completed.',

                code: 'BILL_REQUEST_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new TableSessionResource(
                    $result['session']
                )
            )->resolve(
                $request
            ),

            message: $result['created']
                ? 'Bill requested successfully.'
                : 'The bill has already been requested.'
        );
    }
}
