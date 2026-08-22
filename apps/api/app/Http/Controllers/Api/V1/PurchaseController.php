<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Purchases\ListPurchasesRequest;
use App\Http\Requests\Api\V1\Purchases\StorePurchaseRequest;
use App\Http\Requests\Api\V1\Purchases\UpdatePurchaseRequest;
use App\Http\Resources\PurchaseResource;
use App\Models\Purchase;
use App\Models\User;
use App\Services\PurchaseManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use RuntimeException;
use Throwable;

class PurchaseController extends Controller
{
    public function __construct(
        private readonly PurchaseManagementService $purchaseService
    ) {}

    public function index(
        ListPurchasesRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            Purchase::query()
            ->with([
                'supplier',
                'items.ingredient.baseUnit',
                'items.unit',
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
                            'purchase_number',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'supplier_invoice_number',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhereHas(
                            'supplier',
                            fn($supplierQuery) =>
                            $supplierQuery->where(
                                'name',
                                'like',
                                "%{$search}%"
                            )
                        );
                }
            );
        }

        if (
            isset(
                $data['supplier_id']
            )
        ) {
            $query->where(
                'supplier_id',
                $data['supplier_id']
            );
        }

        if (
            isset(
                $data['status']
            )
        ) {
            $query->where(
                'status',
                $data['status']
            );
        }

        if (
            isset(
                $data['date_from']
            )
        ) {
            $query->whereDate(
                'purchase_date',
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
                'purchase_date',
                '<=',
                $data['date_to']
            );
        }

        $purchases =
            $query
            ->orderByDesc(
                'purchase_date'
            )
            ->orderByDesc('id')
            ->paginate(
                $data['per_page']
                    ?? 30
            );

        $records =
            collect(
                $purchases->items()
            )
            ->map(
                fn(Purchase $purchase) => (
                    new PurchaseResource(
                        $purchase
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $records,

            message: 'Purchases retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $purchases
                        ->currentPage(),

                    'per_page' =>
                    $purchases
                        ->perPage(),

                    'total' =>
                    $purchases
                        ->total(),

                    'last_page' =>
                    $purchases
                        ->lastPage(),
                ],
            ]
        );
    }

    public function store(
        StorePurchaseRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $purchase =
                $this
                ->purchaseService
                ->create(
                    $user,
                    $request->validated()
                );
        } catch (Throwable $exception) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: 'PURCHASE_CREATE_FAILED',

                status: 422
            );
        }

        return ApiResponse::success(
            data: (
                new PurchaseResource(
                    $purchase
                )
            )->resolve($request),

            message: 'Purchase created successfully.',

            status: 201
        );
    }

    public function show(
        Purchase $purchase
    ): JsonResponse {
        $purchase->load([
            'supplier',
            'items.ingredient.baseUnit',
            'items.unit',
            'createdBy',
            'completedBy',
        ]);

        return ApiResponse::success(
            data: new PurchaseResource(
                $purchase
            ),

            message: 'Purchase retrieved successfully.'
        );
    }

    public function update(
        UpdatePurchaseRequest $request,
        Purchase $purchase
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $purchase =
                $this
                ->purchaseService
                ->update(
                    $user,
                    $purchase,
                    $request->validated()
                );
        } catch (Throwable $exception) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: 'PURCHASE_UPDATE_FAILED',

                status: 422
            );
        }

        return ApiResponse::success(
            data: (
                new PurchaseResource(
                    $purchase
                )
            )->resolve($request),

            message: 'Purchase updated successfully.'
        );
    }

    public function complete(
        Purchase $purchase
    ): JsonResponse {
        /** @var User $user */
        $user =
            request()->user();

        try {
            $purchase =
                $this
                ->purchaseService
                ->complete(
                    $user,
                    $purchase
                );
        } catch (Throwable $exception) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: 'PURCHASE_COMPLETION_FAILED',

                status: 422
            );
        }

        return ApiResponse::success(
            data: new PurchaseResource(
                $purchase
            ),

            message: 'Purchase completed and inventory updated successfully.'
        );
    }

    public function cancel(
        Purchase $purchase
    ): JsonResponse {
        /** @var User $user */
        $user =
            request()->user();

        try {
            $purchase =
                $this
                ->purchaseService
                ->cancel(
                    $user,
                    $purchase
                );
        } catch (RuntimeException $exception) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: 'PURCHASE_CANCEL_FAILED',

                status: 409
            );
        }

        return ApiResponse::success(
            data: new PurchaseResource(
                $purchase
            ),

            message: 'Purchase cancelled successfully.'
        );
    }
}
