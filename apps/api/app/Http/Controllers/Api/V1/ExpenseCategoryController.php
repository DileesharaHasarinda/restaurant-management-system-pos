<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class ExpenseCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories =
            ExpenseCategory::query()
            ->where(
                'is_active',
                true
            )
            ->orderBy(
                'name'
            )
            ->get()
            ->map(
                fn(
                    ExpenseCategory $category
                ): array => [
                    'id' =>
                    $category->id,

                    'name' =>
                    $category->name,

                    'code' =>
                    $category->code,

                    'is_active' =>
                    $category
                        ->is_active,
                ]
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $categories,

            message: 'Expense categories retrieved successfully.'
        );
    }
}
