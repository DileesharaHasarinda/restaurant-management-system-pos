<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\TableOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Tables\ListTablesRequest;
use App\Http\Requests\Api\V1\Tables\StoreTableRequest;
use App\Http\Requests\Api\V1\Tables\UpdateQrOrderingRequest;
use App\Http\Requests\Api\V1\Tables\UpdateTableRequest;
use App\Http\Requests\Api\V1\Tables\UpdateTableStatusRequest;
use App\Http\Resources\TableResource;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Services\TableManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class TableController extends Controller
{
    public function __construct(
        private readonly TableManagementService $tableService
    ) {}

    public function index(
        ListTablesRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            RestaurantTable::query()
            ->with([
                'activeQrToken',
                'openSession',
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
                            'name',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'code',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'table_number',
                            $search
                        );
                }
            );
        }

        if (
            filled(
                $data['status']
                    ?? null
            )
        ) {
            $query->where(
                'status',
                $data['status']
            );
        }

        if (
            filled(
                $data['area']
                    ?? null
            )
        ) {
            $query->where(
                'area',
                $data['area']
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
            array_key_exists(
                'qr_ordering_enabled',
                $data
            )
        ) {
            $query->where(
                'qr_ordering_enabled',
                $data['qr_ordering_enabled']
            );
        }

        $tables =
            $query
            ->orderBy(
                'sort_order'
            )
            ->orderBy(
                'table_number'
            )
            ->paginate(
                $data['per_page']
                    ?? 50
            );

        $items =
            collect(
                $tables->items()
            )
            ->map(
                fn(
                    RestaurantTable $table
                ) => (
                    new TableResource(
                        $table
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $items,

            message: 'Tables retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $tables
                        ->currentPage(),

                    'per_page' =>
                    $tables
                        ->perPage(),

                    'total' =>
                    $tables->total(),

                    'last_page' =>
                    $tables
                        ->lastPage(),
                ],
            ]
        );
    }

    public function store(
        StoreTableRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $table =
            $this->tableService
            ->create(
                $user,
                $request
                    ->validated()
            );

        return ApiResponse::success(
            data: (
                new TableResource(
                    $table
                )
            )->resolve(
                $request
            ),

            message: 'Table created successfully.',

            status: 201
        );
    }

    public function show(
        RestaurantTable $table
    ): JsonResponse {
        $table->load([
            'activeQrToken',
            'openSession',
        ]);

        return ApiResponse::success(
            data: new TableResource(
                $table
            ),

            message: 'Table retrieved successfully.'
        );
    }

    public function update(
        UpdateTableRequest $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $table =
                $this->tableService
                ->update(
                    $user,
                    $table,
                    $request
                        ->validated()
                );
        } catch (
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
        }

        return ApiResponse::success(
            data: (
                new TableResource(
                    $table
                )
            )->resolve(
                $request
            ),

            message: 'Table updated successfully.'
        );
    }

    public function updateStatus(
        UpdateTableStatusRequest $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $table =
                $this->tableService
                ->updateStatus(
                    $user,
                    $table,
                    $request
                        ->validated()['status']
                );
        } catch (
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
        }

        return ApiResponse::success(
            data: (
                new TableResource(
                    $table
                )
            )->resolve(
                $request
            ),

            message: 'Table status updated successfully.'
        );
    }

    public function updateQrOrdering(
        UpdateQrOrderingRequest $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $table =
                $this->tableService
                ->setQrOrdering(
                    $user,
                    $table,
                    (bool)
                    $request
                        ->validated()['enabled']
                );
        } catch (
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
        }

        return ApiResponse::success(
            data: (
                new TableResource(
                    $table
                )
            )->resolve(
                $request
            ),

            message: 'QR ordering status updated successfully.'
        );
    }
}
