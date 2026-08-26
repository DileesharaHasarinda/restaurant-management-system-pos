<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Expenses\ExpenseReportRequest;
use App\Services\ExpenseReportService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class ExpenseReportController extends Controller
{
    public function __construct(
        private readonly ExpenseReportService $expenseReportService
    ) {}

    public function summary(
        ExpenseReportRequest $request
    ): JsonResponse {
        $summary =
            $this
            ->expenseReportService
            ->summary(
                $request->validated()
            );

        return ApiResponse::success(
            data: $summary,

            message: 'Expense report generated successfully.'
        );
    }
}
