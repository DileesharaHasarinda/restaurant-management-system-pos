<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Suppliers\ListSuppliersRequest;
use App\Http\Requests\Api\V1\Suppliers\StoreSupplierRequest;
use App\Http\Requests\Api\V1\Suppliers\UpdateSupplierRequest;
use App\Http\Requests\Api\V1\Suppliers\UpdateSupplierStatusRequest;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Models\User;
use App\Services\SupplierManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class SupplierController extends Controller
{
    public function __construct(
        private readonly SupplierManagementService $supplierService
    ) {}

    public function index(
        ListSuppliersRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            Supplier::query();

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
                            'phone',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'email',
                            'like',
                            "%{$search}%"
                        );
                }
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

        $suppliers =
            $query
            ->orderBy('name')
            ->paginate(
                $data['per_page']
                    ?? 30
            );

        $records =
            collect(
                $suppliers->items()
            )
            ->map(
                fn(Supplier $supplier) => (
                    new SupplierResource(
                        $supplier
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $records,

            message: 'Suppliers retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $suppliers
                        ->currentPage(),

                    'per_page' =>
                    $suppliers
                        ->perPage(),

                    'total' =>
                    $suppliers
                        ->total(),

                    'last_page' =>
                    $suppliers
                        ->lastPage(),
                ],
            ]
        );
    }

    public function store(
        StoreSupplierRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $supplier =
            $this
            ->supplierService
            ->create(
                $user,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new SupplierResource(
                    $supplier
                )
            )->resolve($request),

            message: 'Supplier created successfully.',

            status: 201
        );
    }

    public function show(
        Supplier $supplier
    ): JsonResponse {
        return ApiResponse::success(
            data: new SupplierResource(
                $supplier
            ),

            message: 'Supplier retrieved successfully.'
        );
    }

    public function update(
        UpdateSupplierRequest $request,
        Supplier $supplier
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $supplier =
            $this
            ->supplierService
            ->update(
                $user,
                $supplier,
                $request->validated()
            );

        return ApiResponse::success(
            data: (
                new SupplierResource(
                    $supplier
                )
            )->resolve($request),

            message: 'Supplier updated successfully.'
        );
    }

    public function updateStatus(
        UpdateSupplierStatusRequest $request,
        Supplier $supplier
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $supplier =
            $this
            ->supplierService
            ->updateStatus(
                $user,
                $supplier,
                (bool)
                $request->validated()['is_active']
            );

        return ApiResponse::success(
            data: (
                new SupplierResource(
                    $supplier
                )
            )->resolve($request),

            message: 'Supplier status updated successfully.'
        );
    }
}
