<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Reports\ReportFilterRequest;
use App\Services\ReportService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reportService
    ) {}

    public function overview(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->overview(
                    $request->validated()
                ),

            message: 'Report overview generated successfully.'
        );
    }

    public function sales(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->sales(
                    $request->validated()
                ),

            message: 'Sales report generated successfully.'
        );
    }

    public function items(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->items(
                    $request->validated()
                ),

            message: 'Item sales report generated successfully.'
        );
    }

    public function profit(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->profit(
                    $request->validated()
                ),

            message: 'Profit report generated successfully.'
        );
    }

    public function payments(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->payments(
                    $request->validated()
                ),

            message: 'Payment report generated successfully.'
        );
    }

    public function expenses(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->expenses(
                    $request->validated()
                ),

            message: 'Expense report generated successfully.'
        );
    }

    public function inventory(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->inventory(
                    $request->validated()
                ),

            message: 'Inventory report generated successfully.'
        );
    }

    public function purchases(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->purchases(
                    $request->validated()
                ),

            message: 'Purchase report generated successfully.'
        );
    }

    public function orders(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->orders(
                    $request->validated()
                ),

            message: 'Order report generated successfully.'
        );
    }

    public function cashier(
        ReportFilterRequest $request
    ): JsonResponse {
        return ApiResponse::success(
            data: $this
                ->reportService
                ->cashier(
                    $request->validated()
                ),

            message: 'Cashier report generated successfully.'
        );
    }
}
