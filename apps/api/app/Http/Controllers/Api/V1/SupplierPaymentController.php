<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\SupplierPaymentException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SupplierPayments\ListSupplierPaymentsRequest;
use App\Http\Requests\Api\V1\SupplierPayments\StoreSupplierPaymentRequest;
use App\Http\Resources\SupplierPaymentBatchResource;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\SupplierPaymentBatch;
use App\Models\User;
use App\Services\SupplierPaymentService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Throwable;

class SupplierPaymentController extends Controller
{
    public function __construct(
        private readonly SupplierPaymentService $paymentService
    ) {}

    public function index(
        ListSupplierPaymentsRequest $request
    ): JsonResponse {
        return $this->history(
            request: $request
        );
    }

    public function supplierHistory(
        ListSupplierPaymentsRequest $request,
        Supplier $supplier
    ): JsonResponse {
        return $this->history(
            request: $request,

            supplierId: $supplier->id
        );
    }

    public function purchaseHistory(
        ListSupplierPaymentsRequest $request,
        Purchase $purchase
    ): JsonResponse {
        return $this->history(
            request: $request,

            purchaseId: $purchase->id
        );
    }

    public function show(
        SupplierPaymentBatch $paymentBatch
    ): JsonResponse {
        $paymentBatch->load([
            'supplier',
            'purchase',
            'payments.createdBy',
            'createdBy',
        ]);

        return ApiResponse::success(
            data: new SupplierPaymentBatchResource(
                $paymentBatch
            ),

            message: 'Supplier payment retrieved successfully.'
        );
    }

    public function store(
        StoreSupplierPaymentRequest $request,
        Purchase $purchase
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $batch =
                $this
                ->paymentService
                ->payPurchase(
                    actor: $user,

                    purchase: $purchase,

                    data: $request
                        ->validated()
                );
        } catch (
            SupplierPaymentException $exception
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
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: 'SUPPLIER_PAYMENT_FAILED',

                status: 422
            );
        }

        return ApiResponse::success(
            data: (
                new SupplierPaymentBatchResource(
                    $batch
                )
            )->resolve(
                $request
            ),

            message: 'Supplier payment recorded successfully.',

            status: 201
        );
    }

    private function history(
        ListSupplierPaymentsRequest $request,
        ?int $supplierId = null,
        ?int $purchaseId = null
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            SupplierPaymentBatch::query()
            ->with([
                'supplier',
                'purchase',
                'payments.createdBy',
                'createdBy',
            ]);

        $supplierId ??=
            isset(
                $data['supplier_id']
            )
            ? (int)
            $data['supplier_id']
            : null;

        $purchaseId ??=
            isset(
                $data['purchase_id']
            )
            ? (int)
            $data['purchase_id']
            : null;

        if ($supplierId !== null) {
            $query->where(
                'supplier_id',
                $supplierId
            );
        }

        if ($purchaseId !== null) {
            $query->where(
                'purchase_id',
                $purchaseId
            );
        }

        if (
            isset(
                $data['payment_method']
            )
        ) {
            $method =
                $data['payment_method'];

            $query->whereHas(
                'payments',
                fn(
                    Builder $paymentQuery
                ) =>
                $paymentQuery->where(
                    'payment_method',
                    $method
                )
            );
        }

        if (
            isset(
                $data['date_from']
            )
        ) {
            $query->whereDate(
                'payment_date',
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
                'payment_date',
                '<=',
                $data['date_to']
            );
        }

        if (
            filled(
                $data['search']
                    ?? null
            )
        ) {
            $search =
                $data['search'];

            $query->where(
                function (
                    Builder $query
                ) use (
                    $search
                ): void {
                    $query
                        ->where(
                            'batch_number',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhereHas(
                            'supplier',
                            fn(
                                Builder $supplierQuery
                            ) =>
                            $supplierQuery
                                ->where(
                                    'name',
                                    'like',
                                    "%{$search}%"
                                )
                        )
                        ->orWhereHas(
                            'purchase',
                            fn(
                                Builder $purchaseQuery
                            ) =>
                            $purchaseQuery
                                ->where(
                                    'purchase_number',
                                    'like',
                                    "%{$search}%"
                                )
                        )
                        ->orWhereHas(
                            'payments',
                            fn(
                                Builder $paymentQuery
                            ) =>
                            $paymentQuery
                                ->where(
                                    'reference',
                                    'like',
                                    "%{$search}%"
                                )
                        );
                }
            );
        }

        $batches =
            $query
            ->orderByDesc(
                'payment_date'
            )
            ->orderByDesc(
                'id'
            )
            ->paginate(
                $data['per_page']
                    ?? 30
            );

        $records =
            collect(
                $batches->items()
            )
            ->map(
                fn(
                    SupplierPaymentBatch $batch
                ) => (
                    new SupplierPaymentBatchResource(
                        $batch
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $records,

            message: 'Supplier payment history retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $batches
                        ->currentPage(),

                    'per_page' =>
                    $batches
                        ->perPage(),

                    'total' =>
                    $batches
                        ->total(),

                    'last_page' =>
                    $batches
                        ->lastPage(),
                ],
            ]
        );
    }
}
