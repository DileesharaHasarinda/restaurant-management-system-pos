<?php

namespace App\Services;

use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Expense;
use App\Models\Ingredient;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\Refund;
use App\Models\StockMovement;
use App\Models\SupplierPayment;
use App\Models\Wastage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ReportService
{
    /*
    |--------------------------------------------------------------------------
    | Overview
    |--------------------------------------------------------------------------
    */

    public function overview(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $completedOrders =
            $this->orderQuery(
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            )
            ->where(
                'status',
                Order::STATUS_COMPLETED
            );

        $completedOrderCount =
            (clone $completedOrders)
            ->count();

        $sales =
            $this->money(
                (clone $completedOrders)
                    ->sum(
                        'grand_total'
                    )
            );

        $discounts =
            $this->money(
                (clone $completedOrders)
                    ->sum(
                        'discount_total'
                    )
            );

        $cogs =
            $this->money(
                (clone $completedOrders)
                    ->sum(
                        'estimated_cost_total'
                    )
            );

        $refunds =
            $this->refundTotal(
                $scope['business_day_ids']
            );

        $netSales =
            $this->money(
                $sales
                    -
                    $refunds
            );

        $grossProfit =
            $this->money(
                $sales
                    -
                    $cogs
            );

        $expenses =
            $this->expenseTotal(
                filters: $filters,
                scope: $scope
            );

        $wastage =
            $this->wastageTotal(
                $scope['business_day_ids']
            );

        $estimatedNetProfit =
            $this->money(
                $netSales
                    -
                    $cogs
                    -
                    $expenses
                    -
                    $wastage
            );

        $averageOrderValue =
            $completedOrderCount > 0
            ? $this->money(
                $sales
                    /
                    $completedOrderCount
            )
            : 0.0;

        $profitMargin =
            $netSales > 0
            ? round(
                (
                    $estimatedNetProfit
                    /
                    $netSales
                )
                    * 100,
                2
            )
            : 0.0;

        $paymentData =
            $this->paymentSummary(
                businessDayIds: $scope['business_day_ids'],

                filters: $filters
            );

        return [
            ...$this->scopeResponse(
                $scope
            ),

            'kpis' => [
                'gross_sales' =>
                $sales,

                'refunds' =>
                $refunds,

                'net_sales' =>
                $netSales,

                'discounts' =>
                $discounts,

                'completed_orders' =>
                $completedOrderCount,

                'average_order_value' =>
                $averageOrderValue,

                'cogs' =>
                $cogs,

                'gross_profit' =>
                $grossProfit,

                'expenses' =>
                $expenses,

                'wastage_cost' =>
                $wastage,

                'estimated_net_profit' =>
                $estimatedNetProfit,

                'profit_margin' =>
                $profitMargin,

                'gross_payments' =>
                $paymentData['gross_total'],

                'net_payments' =>
                $paymentData['net_total'],
            ],

            'sales_by_type' =>
            $this->completedOrderBreakdown(
                field: 'order_type',
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            ),

            'sales_by_source' =>
            $this->completedOrderBreakdown(
                field: 'order_source',
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            ),

            'payments' =>
            $paymentData,

            'order_statuses' =>
            $this->orderStatusBreakdown(
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            ),

            'daily_sales' =>
            $this->dailySales(
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            ),

            'top_items' =>
            $this->topItems(
                filters: $filters,
                businessDayIds: $scope['business_day_ids'],
                limit: 10
            ),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Sales
    |--------------------------------------------------------------------------
    */

    public function sales(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $completed =
            $this->orderQuery(
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            )
            ->where(
                'status',
                Order::STATUS_COMPLETED
            );

        $orderCount =
            (clone $completed)
            ->count();

        $subtotal =
            $this->money(
                (clone $completed)
                    ->sum(
                        'subtotal'
                    )
            );

        $discounts =
            $this->money(
                (clone $completed)
                    ->sum(
                        'discount_total'
                    )
            );

        $tax =
            $this->money(
                (clone $completed)
                    ->sum(
                        'tax_total'
                    )
            );

        $serviceCharge =
            $this->money(
                (clone $completed)
                    ->sum(
                        'service_charge_total'
                    )
            );

        $sales =
            $this->money(
                (clone $completed)
                    ->sum(
                        'grand_total'
                    )
            );

        $refunds =
            $this->refundTotal(
                $scope['business_day_ids']
            );

        return [
            ...$this->scopeResponse(
                $scope
            ),

            'summary' => [
                'completed_orders' =>
                $orderCount,

                'subtotal' =>
                $subtotal,

                'discounts' =>
                $discounts,

                'tax' =>
                $tax,

                'service_charge' =>
                $serviceCharge,

                'gross_sales' =>
                $sales,

                'refunds' =>
                $refunds,

                'net_sales' =>
                $this->money(
                    $sales
                        -
                        $refunds
                ),

                'average_order_value' =>
                $orderCount > 0
                    ? $this->money(
                        $sales
                            /
                            $orderCount
                    )
                    : 0.0,
            ],

            'daily' =>
            $this->dailySales(
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            ),

            'by_type' =>
            $this->completedOrderBreakdown(
                field: 'order_type',
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            ),

            'by_source' =>
            $this->completedOrderBreakdown(
                field: 'order_source',
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            ),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Item Sales
    |--------------------------------------------------------------------------
    */

    public function items(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $limit =
            (int)
            (
                $filters['limit']
                ?? 50
            );

        $items =
            $this->topItems(
                filters: $filters,
                businessDayIds: $scope['business_day_ids'],
                limit: $limit
            );

        $addonQuery =
            DB::table(
                'order_item_addons'
            )
            ->join(
                'order_items',
                'order_items.id',
                '=',
                'order_item_addons.order_item_id'
            )
            ->join(
                'orders',
                'orders.id',
                '=',
                'order_items.order_id'
            )
            ->whereIn(
                'orders.business_day_id',
                $scope['business_day_ids']
            )
            ->where(
                'orders.status',
                Order::STATUS_COMPLETED
            )
            ->where(
                'order_items.status',
                OrderItem::STATUS_ACTIVE
            );

        $this->applyOrderFiltersToQueryBuilder(
            query: $addonQuery,
            filters: $filters
        );

        $addons =
            $addonQuery
            ->select([
                'order_item_addons.addon_name_snapshot',

                DB::raw(
                    'COALESCE(SUM(order_item_addons.quantity * order_items.quantity), 0) AS quantity'
                ),

                DB::raw(
                    'COALESCE(SUM(order_item_addons.line_total), 0) AS sales_total'
                ),

                DB::raw(
                    'COALESCE(SUM(order_item_addons.estimated_cost_total), 0) AS cost_total'
                ),
            ])
            ->groupBy(
                'order_item_addons.addon_name_snapshot'
            )
            ->orderByDesc(
                'sales_total'
            )
            ->limit(
                $limit
            )
            ->get()
            ->map(
                fn(
                    object $row
                ): array => [
                    'name' =>
                    (string)
                    $row
                        ->addon_name_snapshot,

                    'quantity' =>
                    (float)
                    $row
                        ->quantity,

                    'sales_total' =>
                    $this->money(
                        $row
                            ->sales_total
                    ),

                    'cost_total' =>
                    $this->money(
                        $row
                            ->cost_total
                    ),

                    'gross_profit' =>
                    $this->money(
                        (float)
                        $row
                            ->sales_total
                            -
                            (float)
                            $row
                                ->cost_total
                    ),
                ]
            )
            ->values()
            ->all();

        return [
            ...$this->scopeResponse(
                $scope
            ),

            /*
             * Historical grouping uses order snapshots.
             *
             * This avoids changing old reports when
             * menu item/variant names are edited later.
             */
            'items' =>
            $items,

            'addons' =>
            $addons,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Profit
    |--------------------------------------------------------------------------
    */

    public function profit(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $completed =
            $this->orderQuery(
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            )
            ->where(
                'status',
                Order::STATUS_COMPLETED
            );

        $sales =
            $this->money(
                (clone $completed)
                    ->sum(
                        'grand_total'
                    )
            );

        $cogs =
            $this->money(
                (clone $completed)
                    ->sum(
                        'estimated_cost_total'
                    )
            );

        $refunds =
            $this->refundTotal(
                $scope['business_day_ids']
            );

        $expenses =
            $this->expenseTotal(
                filters: $filters,
                scope: $scope
            );

        $wastage =
            $this->wastageTotal(
                $scope['business_day_ids']
            );

        $netSales =
            $this->money(
                $sales
                    -
                    $refunds
            );

        $grossProfit =
            $this->money(
                $sales
                    -
                    $cogs
            );

        $estimatedNetProfit =
            $this->money(
                $netSales
                    -
                    $cogs
                    -
                    $expenses
                    -
                    $wastage
            );

        return [
            ...$this->scopeResponse(
                $scope
            ),

            'summary' => [
                'gross_sales' =>
                $sales,

                'refunds' =>
                $refunds,

                'net_sales' =>
                $netSales,

                'cogs' =>
                $cogs,

                'gross_profit' =>
                $grossProfit,

                'expenses' =>
                $expenses,

                'wastage_cost' =>
                $wastage,

                'estimated_net_profit' =>
                $estimatedNetProfit,

                'gross_margin' =>
                $sales > 0
                    ? round(
                        (
                            $grossProfit
                            /
                            $sales
                        )
                            * 100,
                        2
                    )
                    : 0.0,

                'estimated_net_margin' =>
                $netSales > 0
                    ? round(
                        (
                            $estimatedNetProfit
                            /
                            $netSales
                        )
                            * 100,
                        2
                    )
                    : 0.0,
            ],

            'daily' =>
            $this->dailyProfit(
                filters: $filters,
                scope: $scope
            ),

            'items' =>
            $this->topItems(
                filters: $filters,
                businessDayIds: $scope['business_day_ids'],
                limit: (int)
                (
                    $filters['limit']
                    ?? 25
                )
            ),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Payments
    |--------------------------------------------------------------------------
    */

    public function payments(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        return [
            ...$this->scopeResponse(
                $scope
            ),

            ...$this->paymentSummary(
                businessDayIds: $scope['business_day_ids'],

                filters: $filters
            ),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Expenses
    |--------------------------------------------------------------------------
    */

    public function expenses(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $query =
            Expense::query()
            ->where(
                'status',
                Expense::STATUS_POSTED
            );

        if (
            isset(
                $filters['business_day_id']
            )
        ) {
            $query->where(
                'business_day_id',
                (int)
                $filters['business_day_id']
            );
        } else {
            $query
                ->whereDate(
                    'expense_date',
                    '>=',
                    $scope['date_from']
                )
                ->whereDate(
                    'expense_date',
                    '<=',
                    $scope['date_to']
                );
        }

        if (
            isset(
                $filters['expense_category_id']
            )
        ) {
            $query->where(
                'expense_category_id',
                (int)
                $filters['expense_category_id']
            );
        }

        if (
            isset(
                $filters['payment_method']
            )
        ) {
            $query->where(
                'payment_method',
                $filters['payment_method']
            );
        }

        $count =
            (clone $query)
            ->count();

        $total =
            $this->money(
                (clone $query)
                    ->sum(
                        'amount'
                    )
            );

        $byCategory =
            (clone $query)
            ->join(
                'expense_categories',
                'expense_categories.id',
                '=',
                'expenses.expense_category_id'
            )
            ->select([
                'expense_categories.id',
                'expense_categories.name',
                'expense_categories.code',

                DB::raw(
                    'COUNT(expenses.id) AS expense_count'
                ),

                DB::raw(
                    'COALESCE(SUM(expenses.amount), 0) AS total_amount'
                ),
            ])
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
                fn(
                    object $row
                ): array => [
                    'category_id' =>
                    (int)
                    $row->id,

                    'category_name' =>
                    (string)
                    $row->name,

                    'category_code' =>
                    (string)
                    $row->code,

                    'expense_count' =>
                    (int)
                    $row
                        ->expense_count,

                    'total_amount' =>
                    $this->money(
                        $row
                            ->total_amount
                    ),
                ]
            )
            ->values()
            ->all();

        $byPaymentMethod =
            (clone $query)
            ->select([
                'payment_method',

                DB::raw(
                    'COUNT(*) AS expense_count'
                ),

                DB::raw(
                    'COALESCE(SUM(amount), 0) AS total_amount'
                ),
            ])
            ->groupBy(
                'payment_method'
            )
            ->orderByDesc(
                'total_amount'
            )
            ->get()
            ->map(
                fn(
                    object $row
                ): array => [
                    'payment_method' =>
                    (string)
                    $row
                        ->payment_method,

                    'expense_count' =>
                    (int)
                    $row
                        ->expense_count,

                    'total_amount' =>
                    $this->money(
                        $row
                            ->total_amount
                    ),
                ]
            )
            ->values()
            ->all();

        return [
            ...$this->scopeResponse(
                $scope
            ),

            'summary' => [
                'expense_count' =>
                $count,

                'total_amount' =>
                $total,

                'average_expense' =>
                $count > 0
                    ? $this->money(
                        $total
                            /
                            $count
                    )
                    : 0.0,
            ],

            'by_category' =>
            $byCategory,

            'by_payment_method' =>
            $byPaymentMethod,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Inventory
    |--------------------------------------------------------------------------
    */

    public function inventory(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $ingredientQuery =
            Ingredient::query()
            ->with(
                'baseUnit:id,name,symbol'
            )
            ->where(
                'track_stock',
                true
            )
            ->where(
                'is_active',
                true
            );

        if (
            isset(
                $filters['ingredient_id']
            )
        ) {
            $ingredientQuery->where(
                'id',
                (int)
                $filters['ingredient_id']
            );
        }

        $ingredients =
            $ingredientQuery
            ->orderBy(
                'name'
            )
            ->get();

        $stockValue =
            $this->money(
                $ingredients->sum(
                    fn(
                        Ingredient $ingredient
                    ): float =>
                    $ingredient
                        ->stockValue()
                )
            );

        $lowStock =
            $ingredients
            ->filter(
                fn(
                    Ingredient $ingredient
                ): bool =>
                $ingredient
                    ->isLowStock()
            );

        $outOfStock =
            $ingredients
            ->filter(
                fn(
                    Ingredient $ingredient
                ): bool =>
                $ingredient
                    ->isOutOfStock()
            );

        $movementQuery =
            StockMovement::query()
            ->whereIn(
                'business_day_id',
                $scope['business_day_ids']
            );

        if (
            isset(
                $filters['ingredient_id']
            )
        ) {
            $movementQuery->where(
                'ingredient_id',
                (int)
                $filters['ingredient_id']
            );
        }

        $byMovementType =
            (clone $movementQuery)
            ->select([
                'movement_type',

                DB::raw(
                    'COUNT(*) AS movement_count'
                ),

                DB::raw(
                    'COALESCE(SUM(quantity_delta), 0) AS quantity_delta'
                ),

                DB::raw(
                    'COALESCE(SUM(total_cost), 0) AS total_cost'
                ),
            ])
            ->groupBy(
                'movement_type'
            )
            ->orderBy(
                'movement_type'
            )
            ->get()
            ->map(
                fn(
                    StockMovement $row
                ): array => [
                    'movement_type' =>
                    (string)
                    $row
                        ->movement_type,

                    'movement_count' =>
                    (int)
                    $row
                        ->movement_count,

                    'quantity_delta' =>
                    round(
                        (float)
                        $row
                            ->quantity_delta,
                        4
                    ),

                    'total_cost' =>
                    $this->money(
                        $row
                            ->total_cost
                    ),
                ]
            )
            ->values()
            ->all();

        $consumption =
            StockMovement::query()
            ->join(
                'ingredients',
                'ingredients.id',
                '=',
                'stock_movements.ingredient_id'
            )
            ->whereIn(
                'stock_movements.business_day_id',
                $scope['business_day_ids']
            )
            ->where(
                'stock_movements.movement_type',
                StockMovement::TYPE_SALE_CONSUMPTION
            )
            ->when(
                isset(
                    $filters['ingredient_id']
                ),

                fn(
                    $query
                ) =>
                $query->where(
                    'stock_movements.ingredient_id',
                    (int)
                    $filters['ingredient_id']
                )
            )
            ->select([
                'ingredients.id',
                'ingredients.sku',
                'ingredients.name',

                DB::raw(
                    'COALESCE(SUM(stock_movements.quantity_delta), 0) AS quantity_delta'
                ),

                DB::raw(
                    'COALESCE(SUM(stock_movements.total_cost), 0) AS total_cost'
                ),
            ])
            ->groupBy(
                'ingredients.id',
                'ingredients.sku',
                'ingredients.name'
            )
            ->orderByRaw(
                'ABS(SUM(stock_movements.total_cost)) DESC'
            )
            ->limit(
                (int)
                (
                    $filters['limit']
                    ?? 50
                )
            )
            ->get()
            ->map(
                fn(
                    object $row
                ): array => [
                    'ingredient_id' =>
                    (int)
                    $row->id,

                    'sku' =>
                    $row->sku,

                    'name' =>
                    (string)
                    $row->name,

                    /*
                         * SALE_CONSUMPTION is negative
                         * in the immutable ledger.
                         *
                         * Report consumption as positive.
                         */
                    'quantity_consumed' =>
                    round(
                        abs(
                            (float)
                            $row
                                ->quantity_delta
                        ),
                        4
                    ),

                    'consumption_cost' =>
                    $this->money(
                        abs(
                            (float)
                            $row
                                ->total_cost
                        )
                    ),
                ]
            )
            ->values()
            ->all();

        $wastage =
            Wastage::query()
            ->whereIn(
                'business_day_id',
                $scope['business_day_ids']
            )
            ->where(
                'status',
                Wastage::STATUS_POSTED
            )
            ->select([
                'reason_code',

                DB::raw(
                    'COUNT(*) AS wastage_count'
                ),

                DB::raw(
                    'COALESCE(SUM(estimated_cost), 0) AS estimated_cost'
                ),
            ])
            ->groupBy(
                'reason_code'
            )
            ->orderByDesc(
                'estimated_cost'
            )
            ->get()
            ->map(
                fn(
                    Wastage $row
                ): array => [
                    'reason_code' =>
                    (string)
                    $row
                        ->reason_code,

                    'reason_label' =>
                    Wastage::reasonLabels()[$row
                        ->reason_code]
                        ??
                        $row
                        ->reason_code,

                    'wastage_count' =>
                    (int)
                    $row
                        ->wastage_count,

                    'estimated_cost' =>
                    $this->money(
                        $row
                            ->estimated_cost
                    ),
                ]
            )
            ->values()
            ->all();

        return [
            ...$this->scopeResponse(
                $scope
            ),

            'current_stock' => [
                'tracked_ingredients' =>
                $ingredients
                    ->count(),

                'low_stock_count' =>
                $lowStock
                    ->count(),

                'out_of_stock_count' =>
                $outOfStock
                    ->count(),

                'stock_value' =>
                $stockValue,

                'low_stock_items' =>
                $lowStock
                    ->take(
                        25
                    )
                    ->map(
                        fn(
                            Ingredient $ingredient
                        ): array => [
                            'id' =>
                            (int)
                            $ingredient
                                ->id,

                            'sku' =>
                            $ingredient
                                ->sku,

                            'name' =>
                            (string)
                            $ingredient
                                ->name,

                            'current_stock' =>
                            (float)
                            $ingredient
                                ->current_stock,

                            'reorder_level' =>
                            (float)
                            $ingredient
                                ->reorder_level,

                            'stock_value' =>
                            $ingredient
                                ->stockValue(),

                            'unit' => [
                                'name' =>
                                $ingredient
                                    ->baseUnit
                                    ?->name,

                                'symbol' =>
                                $ingredient
                                    ->baseUnit
                                    ?->symbol,
                            ],
                        ]
                    )
                    ->values()
                    ->all(),
            ],

            'movements' =>
            $byMovementType,

            'sale_consumption' =>
            $consumption,

            'wastage' =>
            $wastage,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Purchases
    |--------------------------------------------------------------------------
    */

    public function purchases(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $query =
            Purchase::query()
            ->whereIn(
                'business_day_id',
                $scope['business_day_ids']
            )
            ->where(
                'status',
                Purchase::STATUS_COMPLETED
            );

        if (
            isset(
                $filters['supplier_id']
            )
        ) {
            $query->where(
                'supplier_id',
                (int)
                $filters['supplier_id']
            );
        }

        $count =
            (clone $query)
            ->count();

        $purchaseTotal =
            $this->money(
                (clone $query)
                    ->sum(
                        'grand_total'
                    )
            );

        $paidAmount =
            $this->money(
                (clone $query)
                    ->sum(
                        'paid_amount'
                    )
            );

        $balanceDue =
            $this->money(
                (clone $query)
                    ->sum(
                        'balance_due'
                    )
            );

        $supplierBreakdown =
            (clone $query)
            ->join(
                'suppliers',
                'suppliers.id',
                '=',
                'purchases.supplier_id'
            )
            ->select([
                'suppliers.id',
                'suppliers.name',

                DB::raw(
                    'COUNT(purchases.id) AS purchase_count'
                ),

                DB::raw(
                    'COALESCE(SUM(purchases.grand_total), 0) AS purchase_total'
                ),

                DB::raw(
                    'COALESCE(SUM(purchases.paid_amount), 0) AS paid_amount'
                ),

                DB::raw(
                    'COALESCE(SUM(purchases.balance_due), 0) AS balance_due'
                ),
            ])
            ->groupBy(
                'suppliers.id',
                'suppliers.name'
            )
            ->orderByDesc(
                'purchase_total'
            )
            ->get()
            ->map(
                fn(
                    object $row
                ): array => [
                    'supplier_id' =>
                    (int)
                    $row->id,

                    'supplier_name' =>
                    (string)
                    $row->name,

                    'purchase_count' =>
                    (int)
                    $row
                        ->purchase_count,

                    'purchase_total' =>
                    $this->money(
                        $row
                            ->purchase_total
                    ),

                    'paid_amount' =>
                    $this->money(
                        $row
                            ->paid_amount
                    ),

                    'balance_due' =>
                    $this->money(
                        $row
                            ->balance_due
                    ),
                ]
            )
            ->values()
            ->all();

        $supplierPaymentQuery =
            SupplierPayment::query()
            ->whereIn(
                'business_day_id',
                $scope['business_day_ids']
            );

        if (
            isset(
                $filters['supplier_id']
            )
        ) {
            $supplierPaymentQuery
                ->where(
                    'supplier_id',
                    (int)
                    $filters['supplier_id']
                );
        }

        $supplierPayments =
            $this->money(
                $supplierPaymentQuery
                    ->sum(
                        'amount'
                    )
            );

        return [
            ...$this->scopeResponse(
                $scope
            ),

            'summary' => [
                'purchase_count' =>
                $count,

                'purchase_total' =>
                $purchaseTotal,

                'paid_amount' =>
                $paidAmount,

                'balance_due' =>
                $balanceDue,

                'supplier_payments' =>
                $supplierPayments,
            ],

            'by_supplier' =>
            $supplierBreakdown,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Orders
    |--------------------------------------------------------------------------
    */

    public function orders(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $query =
            $this->orderQuery(
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            );

        $total =
            (clone $query)
            ->count();

        $statusBreakdown =
            $this->orderStatusBreakdown(
                filters: $filters,
                businessDayIds: $scope['business_day_ids']
            );

        $byType =
            (clone $query)
            ->select([
                'order_type',

                DB::raw(
                    'COUNT(*) AS order_count'
                ),

                DB::raw(
                    'COALESCE(SUM(grand_total), 0) AS order_value'
                ),
            ])
            ->groupBy(
                'order_type'
            )
            ->orderByDesc(
                'order_count'
            )
            ->get()
            ->map(
                fn(
                    Order $row
                ): array => [
                    'order_type' =>
                    (string)
                    $row
                        ->order_type,

                    'order_count' =>
                    (int)
                    $row
                        ->order_count,

                    'order_value' =>
                    $this->money(
                        $row
                            ->order_value
                    ),
                ]
            )
            ->values()
            ->all();

        $bySource =
            (clone $query)
            ->select([
                'order_source',

                DB::raw(
                    'COUNT(*) AS order_count'
                ),

                DB::raw(
                    'COALESCE(SUM(grand_total), 0) AS order_value'
                ),
            ])
            ->groupBy(
                'order_source'
            )
            ->orderByDesc(
                'order_count'
            )
            ->get()
            ->map(
                fn(
                    Order $row
                ): array => [
                    'order_source' =>
                    (string)
                    $row
                        ->order_source,

                    'order_count' =>
                    (int)
                    $row
                        ->order_count,

                    'order_value' =>
                    $this->money(
                        $row
                            ->order_value
                    ),
                ]
            )
            ->values()
            ->all();

        $tables =
            (clone $query)
            ->where(
                'order_type',
                Order::TYPE_DINE_IN
            )
            ->select([
                'table_name_snapshot',

                DB::raw(
                    'COUNT(*) AS order_count'
                ),

                DB::raw(
                    'COALESCE(SUM(grand_total), 0) AS order_value'
                ),
            ])
            ->groupBy(
                'table_name_snapshot'
            )
            ->orderByDesc(
                'order_count'
            )
            ->limit(
                50
            )
            ->get()
            ->map(
                fn(
                    Order $row
                ): array => [
                    'table_name' =>
                    $row
                        ->table_name_snapshot,

                    'order_count' =>
                    (int)
                    $row
                        ->order_count,

                    'order_value' =>
                    $this->money(
                        $row
                            ->order_value
                    ),
                ]
            )
            ->values()
            ->all();

        $cancellations =
            (clone $query)
            ->where(
                'status',
                Order::STATUS_CANCELLED
            )
            ->whereNotNull(
                'cancellation_reason'
            )
            ->select([
                'cancellation_reason',

                DB::raw(
                    'COUNT(*) AS total'
                ),
            ])
            ->groupBy(
                'cancellation_reason'
            )
            ->orderByDesc(
                'total'
            )
            ->limit(
                20
            )
            ->get()
            ->map(
                fn(
                    Order $row
                ): array => [
                    'reason' =>
                    (string)
                    $row
                        ->cancellation_reason,

                    'count' =>
                    (int)
                    $row
                        ->total,
                ]
            )
            ->values()
            ->all();

        $rejections =
            (clone $query)
            ->where(
                'status',
                Order::STATUS_REJECTED
            )
            ->whereNotNull(
                'rejection_reason'
            )
            ->select([
                'rejection_reason',

                DB::raw(
                    'COUNT(*) AS total'
                ),
            ])
            ->groupBy(
                'rejection_reason'
            )
            ->orderByDesc(
                'total'
            )
            ->limit(
                20
            )
            ->get()
            ->map(
                fn(
                    Order $row
                ): array => [
                    'reason' =>
                    (string)
                    $row
                        ->rejection_reason,

                    'count' =>
                    (int)
                    $row
                        ->total,
                ]
            )
            ->values()
            ->all();

        return [
            ...$this->scopeResponse(
                $scope
            ),

            'total_orders' =>
            $total,

            'by_status' =>
            $statusBreakdown,

            'by_type' =>
            $byType,

            'by_source' =>
            $bySource,

            'by_table' =>
            $tables,

            'cancellation_reasons' =>
            $cancellations,

            'rejection_reasons' =>
            $rejections,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Cashier
    |--------------------------------------------------------------------------
    */

    public function cashier(
        array $filters
    ): array {
        $scope =
            $this->scope(
                $filters
            );

        $shiftQuery =
            CashierShift::query()
            ->whereIn(
                'business_day_id',
                $scope['business_day_ids']
            );

        if (
            isset(
                $filters['cashier_shift_id']
            )
        ) {
            $shiftQuery->where(
                'id',
                (int)
                $filters['cashier_shift_id']
            );
        }

        $shiftCount =
            (clone $shiftQuery)
            ->count();

        $openShiftCount =
            (clone $shiftQuery)
            ->where(
                'status',
                CashierShift::STATUS_OPEN
            )
            ->count();

        $closedShiftCount =
            (clone $shiftQuery)
            ->where(
                'status',
                CashierShift::STATUS_CLOSED
            )
            ->count();

        $openingFloat =
            $this->money(
                (clone $shiftQuery)
                    ->sum(
                        'opening_float'
                    )
            );

        $expectedCash =
            $this->money(
                (clone $shiftQuery)
                    ->sum(
                        'expected_cash'
                    )
            );

        $actualCash =
            $this->money(
                (clone $shiftQuery)
                    ->where(
                        'status',
                        CashierShift::STATUS_CLOSED
                    )
                    ->sum(
                        'actual_cash'
                    )
            );

        $cashDifference =
            $this->money(
                (clone $shiftQuery)
                    ->where(
                        'status',
                        CashierShift::STATUS_CLOSED
                    )
                    ->sum(
                        'cash_difference'
                    )
            );

        $movementQuery =
            DB::table(
                'cash_drawer_movements'
            )
            ->join(
                'cashier_shifts',
                'cashier_shifts.id',
                '=',
                'cash_drawer_movements.cashier_shift_id'
            )
            ->whereIn(
                'cashier_shifts.business_day_id',
                $scope['business_day_ids']
            );

        if (
            isset(
                $filters['cashier_shift_id']
            )
        ) {
            $movementQuery
                ->where(
                    'cashier_shifts.id',
                    (int)
                    $filters['cashier_shift_id']
                );
        }

        $movements =
            $movementQuery
            ->select([
                'cash_drawer_movements.movement_type',

                DB::raw(
                    'COUNT(*) AS movement_count'
                ),

                DB::raw(
                    'COALESCE(SUM(cash_drawer_movements.amount), 0) AS amount'
                ),
            ])
            ->groupBy(
                'cash_drawer_movements.movement_type'
            )
            ->orderBy(
                'cash_drawer_movements.movement_type'
            )
            ->get()
            ->map(
                fn(
                    object $row
                ): array => [
                    'movement_type' =>
                    (string)
                    $row
                        ->movement_type,

                    'movement_count' =>
                    (int)
                    $row
                        ->movement_count,

                    'amount' =>
                    $this->money(
                        $row
                            ->amount
                    ),
                ]
            )
            ->values()
            ->all();

        $shifts =
            (clone $shiftQuery)
            ->latest(
                'id'
            )
            ->limit(
                (int)
                (
                    $filters['limit']
                    ?? 50
                )
            )
            ->get([
                'id',
                'shift_number',
                'business_day_id',
                'cashier_id',
                'terminal_name',
                'opening_float',
                'expected_cash',
                'actual_cash',
                'cash_difference',
                'status',
                'opened_at',
                'closed_at',
            ])
            ->map(
                fn(
                    CashierShift $shift
                ): array => [
                    'id' =>
                    (int)
                    $shift->id,

                    'shift_number' =>
                    $shift
                        ->shift_number,

                    'business_day_id' =>
                    (int)
                    $shift
                        ->business_day_id,

                    'cashier_id' =>
                    (int)
                    $shift
                        ->cashier_id,

                    'terminal_name' =>
                    $shift
                        ->terminal_name,

                    'status' =>
                    (string)
                    $shift
                        ->status,

                    'opening_float' =>
                    (float)
                    $shift
                        ->opening_float,

                    'expected_cash' =>
                    (float)
                    $shift
                        ->expected_cash,

                    'actual_cash' =>
                    $shift
                        ->actual_cash
                        !== null
                        ? (float)
                        $shift
                            ->actual_cash
                        : null,

                    'cash_difference' =>
                    $shift
                        ->cash_difference
                        !== null
                        ? (float)
                        $shift
                            ->cash_difference
                        : null,

                    'opened_at' =>
                    $shift
                        ->opened_at
                        ?->toISOString(),

                    'closed_at' =>
                    $shift
                        ->closed_at
                        ?->toISOString(),
                ]
            )
            ->values()
            ->all();

        return [
            ...$this->scopeResponse(
                $scope
            ),

            'summary' => [
                'shift_count' =>
                $shiftCount,

                'open_shifts' =>
                $openShiftCount,

                'closed_shifts' =>
                $closedShiftCount,

                'opening_float' =>
                $openingFloat,

                'expected_cash' =>
                $expectedCash,

                'actual_cash' =>
                $actualCash,

                'cash_difference' =>
                $cashDifference,
            ],

            'drawer_movements' =>
            $movements,

            'shifts' =>
            $shifts,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Common Report Scope
    |--------------------------------------------------------------------------
    */

    private function scope(
        array $filters
    ): array {
        if (
            isset(
                $filters['business_day_id']
            )
        ) {
            $businessDay =
                BusinessDay::query()
                ->findOrFail(
                    (int)
                    $filters['business_day_id']
                );

            $date =
                $businessDay
                ->business_date
                ->toDateString();

            return [
                'date_from' =>
                $date,

                'date_to' =>
                $date,

                'business_day_id' =>
                (int)
                $businessDay->id,

                'business_day_ids' => [
                    (int)
                    $businessDay->id,
                ],
            ];
        }

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

        $businessDayIds =
            BusinessDay::query()
            ->whereDate(
                'business_date',
                '>=',
                $dateFrom
            )
            ->whereDate(
                'business_date',
                '<=',
                $dateTo
            )
            ->pluck(
                'id'
            )
            ->map(
                fn(
                    mixed $id
                ): int =>
                (int)
                $id
            )
            ->values()
            ->all();

        return [
            'date_from' =>
            $dateFrom,

            'date_to' =>
            $dateTo,

            'business_day_id' =>
            null,

            'business_day_ids' =>
            $businessDayIds,
        ];
    }

    private function scopeResponse(
        array $scope
    ): array {
        return [
            'date_from' =>
            $scope['date_from'],

            'date_to' =>
            $scope['date_to'],

            'business_day_id' =>
            $scope['business_day_id'],

            'generated_at' =>
            now()
                ->toISOString(),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Order Base Query
    |--------------------------------------------------------------------------
    */

    private function orderQuery(
        array $filters,
        array $businessDayIds
    ): Builder {
        $query =
            Order::query()
            ->whereIn(
                'business_day_id',
                $businessDayIds
            );

        if (
            isset(
                $filters['order_type']
            )
        ) {
            $query->where(
                'order_type',
                $filters['order_type']
            );
        }

        if (
            isset(
                $filters['order_source']
            )
        ) {
            $query->where(
                'order_source',
                $filters['order_source']
            );
        }

        return $query;
    }

    private function applyOrderFiltersToQueryBuilder(
        mixed $query,
        array $filters
    ): void {
        if (
            isset(
                $filters['order_type']
            )
        ) {
            $query->where(
                'orders.order_type',
                $filters['order_type']
            );
        }

        if (
            isset(
                $filters['order_source']
            )
        ) {
            $query->where(
                'orders.order_source',
                $filters['order_source']
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Daily Sales
    |--------------------------------------------------------------------------
    */

    private function dailySales(
        array $filters,
        array $businessDayIds
    ): array {
        $query =
            DB::table(
                'orders'
            )
            ->join(
                'business_days',
                'business_days.id',
                '=',
                'orders.business_day_id'
            )
            ->whereIn(
                'orders.business_day_id',
                $businessDayIds
            )
            ->where(
                'orders.status',
                Order::STATUS_COMPLETED
            );

        $this->applyOrderFiltersToQueryBuilder(
            query: $query,
            filters: $filters
        );

        return $query
            ->select([
                'business_days.business_date',

                DB::raw(
                    'COUNT(orders.id) AS order_count'
                ),

                DB::raw(
                    'COALESCE(SUM(orders.subtotal), 0) AS subtotal'
                ),

                DB::raw(
                    'COALESCE(SUM(orders.discount_total), 0) AS discounts'
                ),

                DB::raw(
                    'COALESCE(SUM(orders.tax_total), 0) AS tax'
                ),

                DB::raw(
                    'COALESCE(SUM(orders.service_charge_total), 0) AS service_charge'
                ),

                DB::raw(
                    'COALESCE(SUM(orders.grand_total), 0) AS sales'
                ),

                DB::raw(
                    'COALESCE(SUM(orders.estimated_cost_total), 0) AS cogs'
                ),
            ])
            ->groupBy(
                'business_days.business_date'
            )
            ->orderBy(
                'business_days.business_date'
            )
            ->get()
            ->map(
                function (
                    object $row
                ): array {
                    $sales =
                        $this->money(
                            $row
                                ->sales
                        );

                    $cogs =
                        $this->money(
                            $row
                                ->cogs
                        );

                    return [
                        'business_date' =>
                        Carbon::parse(
                            $row
                                ->business_date
                        )
                            ->toDateString(),

                        'order_count' =>
                        (int)
                        $row
                            ->order_count,

                        'subtotal' =>
                        $this->money(
                            $row
                                ->subtotal
                        ),

                        'discounts' =>
                        $this->money(
                            $row
                                ->discounts
                        ),

                        'tax' =>
                        $this->money(
                            $row
                                ->tax
                        ),

                        'service_charge' =>
                        $this->money(
                            $row
                                ->service_charge
                        ),

                        'sales' =>
                        $sales,

                        'cogs' =>
                        $cogs,

                        'gross_profit' =>
                        $this->money(
                            $sales
                                -
                                $cogs
                        ),
                    ];
                }
            )
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Daily Profit
    |--------------------------------------------------------------------------
    */

    private function dailyProfit(
        array $filters,
        array $scope
    ): array {
        $salesRows =
            collect(
                $this->dailySales(
                    filters: $filters,
                    businessDayIds: $scope['business_day_ids']
                )
            )
            ->keyBy(
                'business_date'
            );

        $days =
            BusinessDay::query()
            ->whereIn(
                'id',
                $scope['business_day_ids']
            )
            ->get([
                'id',
                'business_date',
            ]);

        $expenses =
            Expense::query()
            ->whereIn(
                'business_day_id',
                $scope['business_day_ids']
            )
            ->where(
                'status',
                Expense::STATUS_POSTED
            )
            ->select([
                'business_day_id',

                DB::raw(
                    'COALESCE(SUM(amount), 0) AS total'
                ),
            ])
            ->groupBy(
                'business_day_id'
            )
            ->pluck(
                'total',
                'business_day_id'
            );

        $wastage =
            Wastage::query()
            ->whereIn(
                'business_day_id',
                $scope['business_day_ids']
            )
            ->where(
                'status',
                Wastage::STATUS_POSTED
            )
            ->select([
                'business_day_id',

                DB::raw(
                    'COALESCE(SUM(estimated_cost), 0) AS total'
                ),
            ])
            ->groupBy(
                'business_day_id'
            )
            ->pluck(
                'total',
                'business_day_id'
            );

        $refunds =
            Refund::query()
            ->whereIn(
                'business_day_id',
                $scope['business_day_ids']
            )
            ->where(
                'status',
                Refund::STATUS_COMPLETED
            )
            ->select([
                'business_day_id',

                DB::raw(
                    'COALESCE(SUM(amount), 0) AS total'
                ),
            ])
            ->groupBy(
                'business_day_id'
            )
            ->pluck(
                'total',
                'business_day_id'
            );

        return $days
            ->sortBy(
                'business_date'
            )
            ->map(
                function (
                    BusinessDay $day
                ) use (
                    $salesRows,
                    $expenses,
                    $wastage,
                    $refunds
                ): array {
                    $date =
                        $day
                        ->business_date
                        ->toDateString();

                    $salesRow =
                        $salesRows->get(
                            $date
                        );

                    $sales =
                        $this->money(
                            $salesRow['sales']
                                ?? 0
                        );

                    $cogs =
                        $this->money(
                            $salesRow['cogs']
                                ?? 0
                        );

                    $refund =
                        $this->money(
                            $refunds[$day->id]
                                ?? 0
                        );

                    $expense =
                        $this->money(
                            $expenses[$day->id]
                                ?? 0
                        );

                    $wastageCost =
                        $this->money(
                            $wastage[$day->id]
                                ?? 0
                        );

                    $netSales =
                        $this->money(
                            $sales
                                -
                                $refund
                        );

                    return [
                        'business_date' =>
                        $date,

                        'sales' =>
                        $sales,

                        'refunds' =>
                        $refund,

                        'net_sales' =>
                        $netSales,

                        'cogs' =>
                        $cogs,

                        'expenses' =>
                        $expense,

                        'wastage_cost' =>
                        $wastageCost,

                        'estimated_net_profit' =>
                        $this->money(
                            $netSales
                                -
                                $cogs
                                -
                                $expense
                                -
                                $wastageCost
                        ),
                    ];
                }
            )
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Completed Order Breakdown
    |--------------------------------------------------------------------------
    */

    private function completedOrderBreakdown(
        string $field,
        array $filters,
        array $businessDayIds
    ): array {
        return $this->orderQuery(
            filters: $filters,
            businessDayIds: $businessDayIds
        )
            ->where(
                'status',
                Order::STATUS_COMPLETED
            )
            ->select([
                $field,

                DB::raw(
                    'COUNT(*) AS order_count'
                ),

                DB::raw(
                    'COALESCE(SUM(grand_total), 0) AS sales_total'
                ),
            ])
            ->groupBy(
                $field
            )
            ->orderByDesc(
                'sales_total'
            )
            ->get()
            ->map(
                fn(
                    Order $row
                ): array => [
                    $field =>
                    $row->{$field},

                    'order_count' =>
                    (int)
                    $row
                        ->order_count,

                    'sales_total' =>
                    $this->money(
                        $row
                            ->sales_total
                    ),
                ]
            )
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Order Status Breakdown
    |--------------------------------------------------------------------------
    */

    private function orderStatusBreakdown(
        array $filters,
        array $businessDayIds
    ): array {
        return $this->orderQuery(
            filters: $filters,
            businessDayIds: $businessDayIds
        )
            ->select([
                'status',

                DB::raw(
                    'COUNT(*) AS order_count'
                ),

                DB::raw(
                    'COALESCE(SUM(grand_total), 0) AS order_value'
                ),
            ])
            ->groupBy(
                'status'
            )
            ->orderBy(
                'status'
            )
            ->get()
            ->map(
                fn(
                    Order $row
                ): array => [
                    'status' =>
                    (string)
                    $row->status,

                    'order_count' =>
                    (int)
                    $row
                        ->order_count,

                    'order_value' =>
                    $this->money(
                        $row
                            ->order_value
                    ),
                ]
            )
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Top Items
    |--------------------------------------------------------------------------
    */

    private function topItems(
        array $filters,
        array $businessDayIds,
        int $limit
    ): array {
        $query =
            DB::table(
                'order_items'
            )
            ->join(
                'orders',
                'orders.id',
                '=',
                'order_items.order_id'
            )
            ->whereIn(
                'orders.business_day_id',
                $businessDayIds
            )
            ->where(
                'orders.status',
                Order::STATUS_COMPLETED
            )
            ->where(
                'order_items.status',
                OrderItem::STATUS_ACTIVE
            );

        $this->applyOrderFiltersToQueryBuilder(
            query: $query,
            filters: $filters
        );

        return $query
            ->select([
                'order_items.item_name_snapshot',

                'order_items.variant_name_snapshot',

                DB::raw(
                    'COALESCE(SUM(order_items.quantity), 0) AS quantity'
                ),

                /*
                 * gross_total excludes add-on selling value.
                 */
                DB::raw(
                    'COALESCE(SUM(order_items.gross_total), 0) AS base_sales'
                ),

                /*
                 * line_total includes the complete
                 * historical line selling value.
                 */
                DB::raw(
                    'COALESCE(SUM(order_items.line_total), 0) AS sales_total'
                ),

                DB::raw(
                    'COALESCE(SUM(order_items.estimated_cost_total), 0) AS cost_total'
                ),
            ])
            ->groupBy(
                'order_items.item_name_snapshot',
                'order_items.variant_name_snapshot'
            )
            ->orderByDesc(
                'sales_total'
            )
            ->limit(
                $limit
            )
            ->get()
            ->map(
                function (
                    object $row
                ): array {
                    $sales =
                        $this->money(
                            $row
                                ->sales_total
                        );

                    $cost =
                        $this->money(
                            $row
                                ->cost_total
                        );

                    return [
                        'name' =>
                        (string)
                        $row
                            ->item_name_snapshot,

                        'variant' =>
                        $row
                            ->variant_name_snapshot
                            ? (string)
                            $row
                                ->variant_name_snapshot
                            : null,

                        'quantity' =>
                        (float)
                        $row
                            ->quantity,

                        'base_sales' =>
                        $this->money(
                            $row
                                ->base_sales
                        ),

                        'sales_total' =>
                        $sales,

                        'cost_total' =>
                        $cost,

                        'gross_profit' =>
                        $this->money(
                            $sales
                                -
                                $cost
                        ),

                        'margin' =>
                        $sales > 0
                            ? round(
                                (
                                    (
                                        $sales
                                        -
                                        $cost
                                    )
                                    /
                                    $sales
                                )
                                    * 100,
                                2
                            )
                            : 0.0,
                    ];
                }
            )
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Payments
    |--------------------------------------------------------------------------
    */

    private function paymentSummary(
        array $businessDayIds,
        array $filters
    ): array {
        $paymentQuery =
            DB::table(
                'payments'
            )
            ->join(
                'invoices',
                'invoices.id',
                '=',
                'payments.invoice_id'
            )
            ->whereIn(
                'invoices.business_day_id',
                $businessDayIds
            )
            ->where(
                'invoices.status',
                '!=',
                Invoice::STATUS_VOID
            )
            ->where(
                'payments.status',
                Payment::STATUS_COMPLETED
            );

        if (
            isset(
                $filters['payment_method']
            )
        ) {
            $paymentQuery->where(
                'payments.payment_method',
                $filters['payment_method']
            );
        }

        $grossRows =
            $paymentQuery
            ->select([
                'payments.payment_method',

                DB::raw(
                    'COUNT(payments.id) AS payment_count'
                ),

                DB::raw(
                    'COALESCE(SUM(payments.amount), 0) AS amount'
                ),
            ])
            ->groupBy(
                'payments.payment_method'
            )
            ->get();

        $refundQuery =
            Refund::query()
            ->whereIn(
                'business_day_id',
                $businessDayIds
            )
            ->where(
                'status',
                Refund::STATUS_COMPLETED
            );

        if (
            isset(
                $filters['payment_method']
            )
        ) {
            $refundQuery->where(
                'refund_method',
                $filters['payment_method']
            );
        }

        $refundRows =
            $refundQuery
            ->select([
                'refund_method',

                DB::raw(
                    'COUNT(*) AS refund_count'
                ),

                DB::raw(
                    'COALESCE(SUM(amount), 0) AS amount'
                ),
            ])
            ->groupBy(
                'refund_method'
            )
            ->get();

        $gross =
            $grossRows
            ->keyBy(
                'payment_method'
            );

        $refunds =
            $refundRows
            ->keyBy(
                'refund_method'
            );

        $methods =
            collect(
                $gross->keys()
            )
            ->merge(
                $refunds->keys()
            )
            ->unique()
            ->sort()
            ->values();

        $breakdown =
            $methods
            ->map(
                function (
                    mixed $method
                ) use (
                    $gross,
                    $refunds
                ): array {
                    $grossRow =
                        $gross->get(
                            $method
                        );

                    $refundRow =
                        $refunds->get(
                            $method
                        );

                    $grossAmount =
                        $this->money(
                            $grossRow
                                ?->amount
                                ?? 0
                        );

                    $refundAmount =
                        $this->money(
                            $refundRow
                                ?->amount
                                ?? 0
                        );

                    return [
                        'method' =>
                        (string)
                        $method,

                        'payment_count' =>
                        (int)
                        (
                            $grossRow
                            ?->payment_count
                            ?? 0
                        ),

                        'refund_count' =>
                        (int)
                        (
                            $refundRow
                            ?->refund_count
                            ?? 0
                        ),

                        'gross_amount' =>
                        $grossAmount,

                        'refund_amount' =>
                        $refundAmount,

                        'net_amount' =>
                        $this->money(
                            $grossAmount
                                -
                                $refundAmount
                        ),
                    ];
                }
            )
            ->values()
            ->all();

        return [
            'gross_total' =>
            $this->money(
                collect(
                    $breakdown
                )
                    ->sum(
                        'gross_amount'
                    )
            ),

            'refund_total' =>
            $this->money(
                collect(
                    $breakdown
                )
                    ->sum(
                        'refund_amount'
                    )
            ),

            'net_total' =>
            $this->money(
                collect(
                    $breakdown
                )
                    ->sum(
                        'net_amount'
                    )
            ),

            'by_method' =>
            $breakdown,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Expenses / Wastage / Refund Helpers
    |--------------------------------------------------------------------------
    */

    private function expenseTotal(
        array $filters,
        array $scope
    ): float {
        $query =
            Expense::query()
            ->where(
                'status',
                Expense::STATUS_POSTED
            );

        if (
            isset(
                $filters['business_day_id']
            )
        ) {
            $query->where(
                'business_day_id',
                (int)
                $filters['business_day_id']
            );
        } else {
            $query
                ->whereDate(
                    'expense_date',
                    '>=',
                    $scope['date_from']
                )
                ->whereDate(
                    'expense_date',
                    '<=',
                    $scope['date_to']
                );
        }

        return $this->money(
            $query->sum(
                'amount'
            )
        );
    }

    private function wastageTotal(
        array $businessDayIds
    ): float {
        return $this->money(
            Wastage::query()
                ->whereIn(
                    'business_day_id',
                    $businessDayIds
                )
                ->where(
                    'status',
                    Wastage::STATUS_POSTED
                )
                ->sum(
                    'estimated_cost'
                )
        );
    }

    private function refundTotal(
        array $businessDayIds
    ): float {
        return $this->money(
            Refund::query()
                ->whereIn(
                    'business_day_id',
                    $businessDayIds
                )
                ->where(
                    'status',
                    Refund::STATUS_COMPLETED
                )
                ->sum(
                    'amount'
                )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Money
    |--------------------------------------------------------------------------
    */

    private function money(
        mixed $value
    ): float {
        return round(
            (float)
            $value,
            2
        );
    }
}
