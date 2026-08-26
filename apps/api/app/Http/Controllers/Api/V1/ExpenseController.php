<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ExpenseOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Expenses\ExpenseReceiptRequest;
use App\Http\Requests\Api\V1\Expenses\ListExpensesRequest;
use App\Http\Requests\Api\V1\Expenses\StoreExpenseRequest;
use App\Http\Requests\Api\V1\Expenses\UpdateExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use App\Services\ExpenseService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Throwable;

class ExpenseController extends Controller
{
    public function __construct(
        private readonly ExpenseService $expenseService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Payment Methods
    |--------------------------------------------------------------------------
    */

    public function paymentMethods(): JsonResponse
    {
        $methods =
            collect(
                Expense::paymentMethods()
            )
            ->map(
                fn(
                    string $method
                ): array => [
                    'code' =>
                    $method,

                    'label' =>
                    Expense::paymentMethodLabels()[$method]
                        ?? $method,
                ]
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $methods,

            message: 'Expense payment methods retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | History
    |--------------------------------------------------------------------------
    */

    public function index(
        ListExpensesRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            Expense::query()
            ->with([
                'category',
                'businessDay',
                'cashierShift.cashier',
                'createdBy',
                'approvedBy',
            ]);

        if (
            isset(
                $data['expense_category_id']
            )
        ) {
            $query->where(
                'expense_category_id',
                (int)
                $data['expense_category_id']
            );
        }

        if (
            isset(
                $data['payment_method']
            )
        ) {
            $query->where(
                'payment_method',
                $data['payment_method']
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
                'expense_date',
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
                'expense_date',
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
                trim(
                    $data['search']
                );

            $query->where(
                function (
                    Builder $builder
                ) use (
                    $search
                ): void {
                    $builder
                        ->where(
                            'expense_number',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'description',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'notes',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'reference_number',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhereHas(
                            'category',
                            function (
                                Builder $categoryQuery
                            ) use (
                                $search
                            ): void {
                                $categoryQuery
                                    ->where(
                                        'name',
                                        'like',
                                        "%{$search}%"
                                    )
                                    ->orWhere(
                                        'code',
                                        'like',
                                        "%{$search}%"
                                    );
                            }
                        );
                }
            );
        }

        $expenses =
            $query
            ->orderByDesc(
                'expense_date'
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
                $expenses->items()
            )
            ->map(
                fn(
                    Expense $expense
                ): array => (
                    new ExpenseResource(
                        $expense
                    )
                )
                    ->resolve(
                        $request
                    )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $records,

            message: 'Expenses retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $expenses
                        ->currentPage(),

                    'per_page' =>
                    $expenses
                        ->perPage(),

                    'total' =>
                    $expenses
                        ->total(),

                    'last_page' =>
                    $expenses
                        ->lastPage(),
                ],
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Store
    |--------------------------------------------------------------------------
    */

    public function store(
        StoreExpenseRequest $request
    ): JsonResponse {
        try {
            $result =
                $this
                ->expenseService
                ->create(
                    actor: $request->user(),

                    data: $request->validated()
                );

            $created =
                (bool)
                $result['created'];

            return ApiResponse::success(
                data: (
                    new ExpenseResource(
                        $result['expense']
                    )
                )
                    ->resolve(
                        $request
                    ),

                message: $created
                    ? 'Expense recorded successfully.'
                    : 'This expense was already recorded.',

                status: $created
                    ? 201
                    : 200,

                meta: [
                    'created' =>
                    $created,
                ]
            );
        } catch (
            ExpenseOperationException $exception
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
                message: 'Unable to record the expense.',

                code: 'EXPENSE_CREATE_FAILED',

                status: 500
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Show
    |--------------------------------------------------------------------------
    */

    public function show(
        Request $request,
        Expense $expense
    ): JsonResponse {
        $expense->load([
            'category',
            'businessDay',
            'cashierShift.cashier',
            'createdBy',
            'approvedBy',
        ]);

        return ApiResponse::success(
            data: (
                new ExpenseResource(
                    $expense
                )
            )
                ->resolve(
                    $request
                ),

            message: 'Expense retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Update
    |--------------------------------------------------------------------------
    */

    public function update(
        UpdateExpenseRequest $request,
        Expense $expense
    ): JsonResponse {
        try {
            $updated =
                $this
                ->expenseService
                ->update(
                    actor: $request->user(),

                    expense: $expense,

                    data: $request->validated()
                );

            return ApiResponse::success(
                data: (
                    new ExpenseResource(
                        $updated
                    )
                )
                    ->resolve(
                        $request
                    ),

                message: 'Expense updated successfully.'
            );
        } catch (
            ExpenseOperationException $exception
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
                message: 'Unable to update the expense.',

                code: 'EXPENSE_UPDATE_FAILED',

                status: 500
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Receipt
    |--------------------------------------------------------------------------
    */

    public function uploadReceipt(
        ExpenseReceiptRequest $request,
        Expense $expense
    ): JsonResponse {
        try {
            $updated =
                $this
                ->expenseService
                ->uploadReceipt(
                    actor: $request->user(),

                    expense: $expense,

                    receipt: $request->file(
                        'receipt'
                    )
                );

            return ApiResponse::success(
                data: (
                    new ExpenseResource(
                        $updated
                    )
                )
                    ->resolve(
                        $request
                    ),

                message: 'Expense receipt uploaded successfully.'
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'Unable to upload the expense receipt.',

                code: 'EXPENSE_RECEIPT_UPLOAD_FAILED',

                status: 500
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Download Private Receipt
    |--------------------------------------------------------------------------
    |
    | We intentionally do NOT call:
    |
    | Storage::disk('local')->download(...)
    |
    | because some Intelephense/Laravel stub combinations incorrectly report
    | that method as undefined even though Laravel supports it at runtime.
    |
    | Instead we resolve the private absolute path and return Symfony's
    | BinaryFileResponse directly.
    |
    */

    public function downloadReceipt(
        Expense $expense
    ): BinaryFileResponse|JsonResponse {
        if (
            ! $expense
                ->receipt_path
        ) {
            return ApiResponse::error(
                message: 'This expense does not have a receipt.',

                code: 'EXPENSE_RECEIPT_NOT_FOUND',

                status: 404
            );
        }

        $disk =
            Storage::disk(
                'local'
            );

        if (
            ! $disk->exists(
                $expense
                    ->receipt_path
            )
        ) {
            return ApiResponse::error(
                message: 'The stored receipt file could not be found.',

                code: 'EXPENSE_RECEIPT_FILE_NOT_FOUND',

                status: 404
            );
        }

        $absolutePath =
            $disk->path(
                $expense
                    ->receipt_path
            );

        $downloadName =
            $expense
            ->receipt_original_name
            ?? basename(
                $expense
                    ->receipt_path
            );

        $response =
            new BinaryFileResponse(
                $absolutePath
            );

        $response
            ->setContentDisposition(
                ResponseHeaderBag::DISPOSITION_ATTACHMENT,
                $downloadName
            );

        if (
            filled(
                $expense
                    ->receipt_mime_type
            )
        ) {
            $response
                ->headers
                ->set(
                    'Content-Type',
                    $expense
                        ->receipt_mime_type
                );
        }

        /*
         * Private financial files should not be cached
         * by shared proxies/browsers.
         */
        $response
            ->headers
            ->set(
                'Cache-Control',
                'private, no-store, no-cache, must-revalidate'
            );

        return $response;
    }

    /*
    |--------------------------------------------------------------------------
    | Remove Receipt
    |--------------------------------------------------------------------------
    */

    public function removeReceipt(
        Request $request,
        Expense $expense
    ): JsonResponse {
        try {
            $updated =
                $this
                ->expenseService
                ->removeReceipt(
                    actor: $request->user(),

                    expense: $expense
                );

            return ApiResponse::success(
                data: (
                    new ExpenseResource(
                        $updated
                    )
                )
                    ->resolve(
                        $request
                    ),

                message: 'Expense receipt removed successfully.'
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'Unable to remove the expense receipt.',

                code: 'EXPENSE_RECEIPT_REMOVE_FAILED',

                status: 500
            );
        }
    }
}
