<?php

namespace App\Services;

use App\Models\Expense;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

final class ExpenseReportService
{
    /*
    |--------------------------------------------------------------------------
    | Expense Report Summary
    |--------------------------------------------------------------------------
    |
    | Generates:
    |
    | - Total expense count
    | - Total expense amount
    | - Average expense
    | - Category breakdown
    | - Payment-method breakdown
    | - Daily totals
    |
    | Only POSTED expenses are included.
    |
    */

    public function summary(
        array $filters
    ): array {
        /*
        |--------------------------------------------------------------------------
        | Resolve Date Range
        |--------------------------------------------------------------------------
        |
        | Default:
        |
        | date_from = first day of current month
        | date_to   = today
        |
        */

        $dateFrom =
            isset(
                $filters['date_from']
            )
            ? Carbon::parse(
                $filters['date_from']
            )->toDateString()
            : now()
            ->startOfMonth()
            ->toDateString();

        $dateTo =
            isset(
                $filters['date_to']
            )
            ? Carbon::parse(
                $filters['date_to']
            )->toDateString()
            : now()
            ->toDateString();

        /*
        |--------------------------------------------------------------------------
        | Base Query
        |--------------------------------------------------------------------------
        |
        | IMPORTANT:
        |
        | Use whereDate() instead of whereBetween().
        |
        | This keeps the report compatible with:
        |
        | - Production MySQL / MariaDB DATE columns
        | - SQLite test database
        |
        | SQLite may internally return/store the date value differently,
        | so date-aware comparisons are safer for our automated tests.
        |
        */

        $query =
            Expense::query()
            ->where(
                'expenses.status',
                Expense::STATUS_POSTED
            )
            ->whereDate(
                'expenses.expense_date',
                '>=',
                $dateFrom
            )
            ->whereDate(
                'expenses.expense_date',
                '<=',
                $dateTo
            );

        /*
        |--------------------------------------------------------------------------
        | Additional Filters
        |--------------------------------------------------------------------------
        */

        $this->applyFilters(
            query: $query,

            filters: $filters
        );

        /*
        |--------------------------------------------------------------------------
        | Overall Totals
        |--------------------------------------------------------------------------
        */

        $expenseCount =
            (clone $query)
            ->count();

        $totalAmount =
            round(
                (float)
                (clone $query)
                    ->sum(
                        'expenses.amount'
                    ),
                2
            );

        $averageExpense =
            $expenseCount > 0
            ? round(
                $totalAmount
                    /
                    $expenseCount,
                2
            )
            : 0.0;

        /*
        |--------------------------------------------------------------------------
        | Category Breakdown
        |--------------------------------------------------------------------------
        */

        $categoryBreakdown =
            (clone $query)
            ->join(
                'expense_categories',
                'expense_categories.id',
                '=',
                'expenses.expense_category_id'
            )
            ->selectRaw(
                '
                expense_categories.id AS category_id,
                expense_categories.name AS category_name,
                expense_categories.code AS category_code,
                COUNT(expenses.id) AS expense_count,
                SUM(expenses.amount) AS total_amount
                '
            )
            ->groupBy(
                'expense_categories.id',
                'expense_categories.name',
                'expense_categories.code'
            )
            ->orderByDesc(
                'total_amount'
            )
            ->get()
            ->map(
                function (
                    mixed $row
                ): array {
                    return [
                        'category_id' =>
                        (int)
                        $row
                            ->category_id,

                        'category_name' =>
                        (string)
                        $row
                            ->category_name,

                        'category_code' =>
                        (string)
                        $row
                            ->category_code,

                        'expense_count' =>
                        (int)
                        $row
                            ->expense_count,

                        'total_amount' =>
                        round(
                            (float)
                            $row
                                ->total_amount,
                            2
                        ),
                    ];
                }
            )
            ->values()
            ->all();

        /*
        |--------------------------------------------------------------------------
        | Payment Method Breakdown
        |--------------------------------------------------------------------------
        */

        $paymentBreakdown =
            (clone $query)
            ->selectRaw(
                '
                expenses.payment_method,
                COUNT(expenses.id) AS expense_count,
                SUM(expenses.amount) AS total_amount
                '
            )
            ->groupBy(
                'expenses.payment_method'
            )
            ->orderByDesc(
                'total_amount'
            )
            ->get()
            ->map(
                function (
                    mixed $row
                ): array {
                    $paymentMethod =
                        (string)
                        $row
                            ->payment_method;

                    return [
                        'payment_method' =>
                        $paymentMethod,

                        'payment_method_label' =>
                        Expense::paymentMethodLabels()[$paymentMethod]
                            ??
                            $paymentMethod,

                        'expense_count' =>
                        (int)
                        $row
                            ->expense_count,

                        'total_amount' =>
                        round(
                            (float)
                            $row
                                ->total_amount,
                            2
                        ),
                    ];
                }
            )
            ->values()
            ->all();

        /*
        |--------------------------------------------------------------------------
        | Daily Totals
        |--------------------------------------------------------------------------
        |
        | Carbon::parse() ensures the API always returns:
        |
        | 2026-08-22
        |
        | instead of a Carbon object or a datetime string.
        |
        */

        $dailyTotals =
            (clone $query)
            ->selectRaw(
                '
                expenses.expense_date,
                COUNT(expenses.id) AS expense_count,
                SUM(expenses.amount) AS total_amount
                '
            )
            ->groupBy(
                'expenses.expense_date'
            )
            ->orderBy(
                'expenses.expense_date'
            )
            ->get()
            ->map(
                function (
                    mixed $row
                ): array {
                    return [
                        'expense_date' =>
                        Carbon::parse(
                            $row
                                ->expense_date
                        )
                            ->toDateString(),

                        'expense_count' =>
                        (int)
                        $row
                            ->expense_count,

                        'total_amount' =>
                        round(
                            (float)
                            $row
                                ->total_amount,
                            2
                        ),
                    ];
                }
            )
            ->values()
            ->all();

        /*
        |--------------------------------------------------------------------------
        | Response
        |--------------------------------------------------------------------------
        */

        return [
            'date_from' =>
            $dateFrom,

            'date_to' =>
            $dateTo,

            'expense_count' =>
            $expenseCount,

            'total_amount' =>
            $totalAmount,

            'average_expense' =>
            $averageExpense,

            'by_category' =>
            $categoryBreakdown,

            'by_payment_method' =>
            $paymentBreakdown,

            'daily_totals' =>
            $dailyTotals,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Apply Optional Filters
    |--------------------------------------------------------------------------
    */

    private function applyFilters(
        Builder $query,
        array $filters
    ): void {
        /*
        |--------------------------------------------------------------------------
        | Expense Category
        |--------------------------------------------------------------------------
        */

        if (
            isset(
                $filters['expense_category_id']
            )
        ) {
            $query->where(
                'expenses.expense_category_id',
                (int)
                $filters['expense_category_id']
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Payment Method
        |--------------------------------------------------------------------------
        */

        if (
            isset(
                $filters['payment_method']
            )
        ) {
            $query->where(
                'expenses.payment_method',
                strtoupper(
                    trim(
                        (string)
                        $filters['payment_method']
                    )
                )
            );
        }
    }
}
