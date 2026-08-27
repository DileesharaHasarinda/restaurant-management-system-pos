<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BusinessDay;
use App\Models\Ingredient;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RestaurantTable;
use App\Models\TableSession;
use App\Models\User;
use App\Support\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private const BUSINESS_TIME_ZONE =
    'Asia/Colombo';

    /*
    |--------------------------------------------------------------------------
    | Dashboard
    |--------------------------------------------------------------------------
    */

    public function show(
        Request $request
    ): JsonResponse {
        $user =
            $request->user();

        if (
            ! $user instanceof User
        ) {
            return ApiResponse::error(
                message: 'Unauthenticated.',

                code: 'UNAUTHENTICATED',

                status: 401
            );
        }

        /*
         * dashboard.view allows entry to the
         * dashboard itself.
         *
         * Sensitive dashboard sections have
         * their own permission checks.
         */
        $canViewTables =
            $user->hasPermission(
                'tables.view'
            );

        $canViewOrders =
            $user->hasPermission(
                'orders.view'
            );

        $canViewFinancial =
            $user->hasPermission(
                'reports.view'
            );

        $canViewInventory =
            $user->hasPermission(
                'inventory.view'
            );

        $businessNow =
            CarbonImmutable::now(
                self::BUSINESS_TIME_ZONE
            );

        $businessDay =
            $this->currentBusinessDay(
                $businessNow
                    ->toDateString()
            );

        $businessDayId =
            $businessDay
            ? (int)
            $businessDay->id
            : null;

        $tableSummary =
            $canViewTables
            ? $this->tableSummary()
            : null;

        $orderSummary =
            $canViewOrders
            ? $this->orderSummary(
                $businessDayId
            )
            : null;

        $financial =
            $canViewFinancial
            ? $this->financialSummary(
                $businessDayId
            )
            : null;

        $inventory =
            $canViewInventory
            ? $this->inventorySummary()
            : null;

        $topItems =
            $canViewFinancial
            ? $this->topSellingItems(
                $businessDayId
            )
            : [];

        $recentOrders =
            $canViewOrders
            ? $this->recentOrders(
                $businessDayId
            )
            : [];

        return ApiResponse::success(
            data: [
                'business_day' =>
                $businessDay
                    ? [
                        'id' =>
                        (int)
                        $businessDay
                            ->id,

                        'business_date' =>
                        $businessDay
                            ->business_date
                            ?->toDateString(),

                        'status' =>
                        (string)
                        $businessDay
                            ->status,

                        'opened_at' =>
                        $businessDay
                            ->opened_at
                            ?->toISOString(),

                        'closed_at' =>
                        $businessDay
                            ->closed_at
                            ?->toISOString(),
                    ]
                    : null,

                'generated_at' =>
                $businessNow
                    ->toIso8601String(),

                'visibility' => [
                    'tables' =>
                    $canViewTables,

                    'orders' =>
                    $canViewOrders,

                    'financial' =>
                    $canViewFinancial,

                    'inventory' =>
                    $canViewInventory,
                ],

                'operations' => [
                    'tables' =>
                    $tableSummary,

                    'orders' =>
                    $orderSummary,
                ],

                /*
                 * Important:
                 *
                 * Financial and inventory data are
                 * NOT returned to unauthorized users.
                 */
                'financial' =>
                $financial,

                'inventory' =>
                $inventory,

                'top_items' =>
                $topItems,

                'recent_orders' =>
                $recentOrders,
            ],

            message: 'Dashboard retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Current Business Day
    |--------------------------------------------------------------------------
    */

    private function currentBusinessDay(
        string $today
    ): ?BusinessDay {
        /*
         * An OPEN business day is authoritative,
         * even if restaurant operations continue
         * past midnight.
         */
        $openBusinessDay =
            BusinessDay::query()
            ->where(
                'status',
                BusinessDay::STATUS_OPEN
            )
            ->latest(
                'opened_at'
            )
            ->latest(
                'id'
            )
            ->first();

        if (
            $openBusinessDay
        ) {
            return $openBusinessDay;
        }

        /*
         * If today's day has already been closed,
         * still display today's final figures.
         */
        return BusinessDay::query()
            ->whereDate(
                'business_date',
                $today
            )
            ->latest(
                'id'
            )
            ->first();
    }

    /*
    |--------------------------------------------------------------------------
    | Table Operations
    |--------------------------------------------------------------------------
    */

    private function tableSummary(): array
    {
        $counts =
            RestaurantTable::query()
            ->select([
                'status',
                DB::raw(
                    'COUNT(*) AS total'
                ),
            ])
            ->groupBy(
                'status'
            )
            ->pluck(
                'total',
                'status'
            );

        $openSessions =
            TableSession::query()
            ->where(
                'status',
                TableSession::STATUS_OPEN
            )
            ->count();

        $billRequests =
            TableSession::query()
            ->where(
                'status',
                TableSession::STATUS_OPEN
            )
            ->whereNotNull(
                'bill_requested_at'
            )
            ->count();

        return [
            'total' =>
            (int)
            $counts->sum(),

            'available' =>
            (int)
            (
                $counts[RestaurantTable::STATUS_AVAILABLE]
                ?? 0
            ),

            'occupied' =>
            (int)
            (
                $counts[RestaurantTable::STATUS_OCCUPIED]
                ?? 0
            ),

            'reserved' =>
            (int)
            (
                $counts[RestaurantTable::STATUS_RESERVED]
                ?? 0
            ),

            'cleaning' =>
            (int)
            (
                $counts[RestaurantTable::STATUS_CLEANING]
                ?? 0
            ),

            'out_of_service' =>
            (int)
            (
                $counts[RestaurantTable::STATUS_OUT_OF_SERVICE]
                ?? 0
            ),

            'open_sessions' =>
            $openSessions,

            'bill_requests' =>
            $billRequests,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Order Operations
    |--------------------------------------------------------------------------
    */

    private function orderSummary(
        ?int $businessDayId
    ): array {
        $result = [
            'total' => 0,

            'pending' => 0,

            'confirmed' => 0,

            'sent_to_kitchen' => 0,

            'served' => 0,

            'completed' => 0,

            'cancelled' => 0,

            'rejected' => 0,
        ];

        if (
            ! $businessDayId
        ) {
            return $result;
        }

        $counts =
            Order::query()
            ->where(
                'business_day_id',
                $businessDayId
            )
            ->select([
                'status',

                DB::raw(
                    'COUNT(*) AS total'
                ),
            ])
            ->groupBy(
                'status'
            )
            ->pluck(
                'total',
                'status'
            );

        $result['pending'] =
            (int)
            (
                $counts[Order::STATUS_PENDING]
                ?? 0
            );

        $result['confirmed'] =
            (int)
            (
                $counts[Order::STATUS_CONFIRMED]
                ?? 0
            );

        $result['sent_to_kitchen'] =
            (int)
            (
                $counts[Order::STATUS_SENT_TO_KITCHEN]
                ?? 0
            );

        $result['served'] =
            (int)
            (
                $counts[Order::STATUS_SERVED]
                ?? 0
            );

        $result['completed'] =
            (int)
            (
                $counts[Order::STATUS_COMPLETED]
                ?? 0
            );

        $result['cancelled'] =
            (int)
            (
                $counts[Order::STATUS_CANCELLED]
                ?? 0
            );

        $result['rejected'] =
            (int)
            (
                $counts[Order::STATUS_REJECTED]
                ?? 0
            );

        $result['total'] =
            array_sum(
                array_values(
                    array_filter(
                        $result,
                        fn(
                            mixed $value,
                            string $key
                        ): bool =>
                        $key !== 'total',

                        ARRAY_FILTER_USE_BOTH
                    )
                )
            );

        return $result;
    }

    /*
    |--------------------------------------------------------------------------
    | Financial Summary
    |--------------------------------------------------------------------------
    */

    private function financialSummary(
        ?int $businessDayId
    ): array {
        if (
            ! $businessDayId
        ) {
            return $this
                ->emptyFinancialSummary();
        }

        /*
         * Completed orders are the authoritative
         * sales figures here.
         *
         * An unpaid/partially paid invoice must not
         * be counted as a completed restaurant sale.
         */
        $completedOrders =
            Order::query()
            ->where(
                'business_day_id',
                $businessDayId
            )
            ->where(
                'status',
                Order::STATUS_COMPLETED
            );

        $completedOrderCount =
            (clone $completedOrders)
            ->count();

        $revenue =
            round(
                (float)
                (clone $completedOrders)
                    ->sum(
                        'grand_total'
                    ),
                2
            );

        $cogs =
            round(
                (float)
                (clone $completedOrders)
                    ->sum(
                        'estimated_cost_total'
                    ),
                2
            );

        $grossProfit =
            round(
                $revenue
                    -
                    $cogs,
                2
            );

        /*
         * Only posted operational expenses
         * affect the dashboard.
         */
        $expenses =
            round(
                (float)
                DB::table(
                    'expenses'
                )
                    ->where(
                        'business_day_id',
                        $businessDayId
                    )
                    ->where(
                        'status',
                        'POSTED'
                    )
                    ->sum(
                        'amount'
                    ),
                2
            );

        /*
         * Only posted wastage affects cost.
         */
        $wastageCost =
            round(
                (float)
                DB::table(
                    'wastages'
                )
                    ->where(
                        'business_day_id',
                        $businessDayId
                    )
                    ->where(
                        'status',
                        'POSTED'
                    )
                    ->sum(
                        'estimated_cost'
                    ),
                2
            );

        $estimatedNetProfit =
            round(
                $grossProfit
                    -
                    $expenses
                    -
                    $wastageCost,
                2
            );

        /*
         * payments has no business_day_id.
         *
         * Scope:
         *
         * payments
         *     -> invoices
         *     -> business_day_id
         */
        $paymentRows =
            DB::table(
                'payments'
            )
            ->join(
                'invoices',
                'invoices.id',
                '=',
                'payments.invoice_id'
            )
            ->where(
                'invoices.business_day_id',
                $businessDayId
            )
            ->where(
                'invoices.status',
                '!=',
                'VOID'
            )
            ->where(
                'payments.status',
                'COMPLETED'
            )
            ->select([
                'payments.payment_method',

                DB::raw(
                    'COUNT(*) AS payment_count'
                ),

                DB::raw(
                    'COALESCE(SUM(payments.amount), 0) AS total_amount'
                ),
            ])
            ->groupBy(
                'payments.payment_method'
            )
            ->orderByDesc(
                'total_amount'
            )
            ->get();

        $paymentBreakdown =
            $paymentRows
            ->map(
                fn(
                    object $row
                ): array => [
                    'method' =>
                    (string)
                    $row
                        ->payment_method,

                    'count' =>
                    (int)
                    $row
                        ->payment_count,

                    'amount' =>
                    round(
                        (float)
                        $row
                            ->total_amount,
                        2
                    ),
                ]
            )
            ->values()
            ->all();

        $paymentTotal =
            round(
                collect(
                    $paymentBreakdown
                )
                    ->sum(
                        'amount'
                    ),
                2
            );

        $averageOrderValue =
            $completedOrderCount > 0
            ? round(
                $revenue
                    /
                    $completedOrderCount,
                2
            )
            : 0.0;

        return [
            'revenue' =>
            $revenue,

            'completed_orders' =>
            $completedOrderCount,

            'cogs' =>
            $cogs,

            'gross_profit' =>
            $grossProfit,

            'expenses' =>
            $expenses,

            'wastage_cost' =>
            $wastageCost,

            'estimated_net_profit' =>
            $estimatedNetProfit,

            'payment_total' =>
            $paymentTotal,

            'average_order_value' =>
            $averageOrderValue,

            'payment_breakdown' =>
            $paymentBreakdown,
        ];
    }

    private function emptyFinancialSummary(): array
    {
        return [
            'revenue' => 0.0,

            'completed_orders' => 0,

            'cogs' => 0.0,

            'gross_profit' => 0.0,

            'expenses' => 0.0,

            'wastage_cost' => 0.0,

            'estimated_net_profit' => 0.0,

            'payment_total' => 0.0,

            'average_order_value' => 0.0,

            'payment_breakdown' => [],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Inventory Summary
    |--------------------------------------------------------------------------
    */

    private function inventorySummary(): array
    {
        $ingredients =
            Ingredient::query()
            ->with([
                'baseUnit:id,name,symbol',
            ])
            ->where(
                'is_active',
                true
            )
            ->where(
                'track_stock',
                true
            )
            ->orderBy(
                'name'
            )
            ->get([
                'id',
                'sku',
                'name',
                'base_unit_id',
                'current_stock',
                'reorder_level',
                'average_cost_per_base_unit',
                'track_stock',
                'is_active',
            ]);

        $lowStock =
            $ingredients
            ->filter(
                fn(
                    Ingredient $ingredient
                ): bool =>
                $ingredient
                    ->isLowStock()
            )
            ->sortBy(
                fn(
                    Ingredient $ingredient
                ): float =>
                (float)
                $ingredient
                    ->current_stock
            )
            ->values();

        $outOfStock =
            $ingredients
            ->filter(
                fn(
                    Ingredient $ingredient
                ): bool =>
                $ingredient
                    ->isOutOfStock()
            )
            ->values();

        $stockValue =
            round(
                $ingredients
                    ->sum(
                        fn(
                            Ingredient $ingredient
                        ): float =>
                        $ingredient
                            ->stockValue()
                    ),
                2
            );

        return [
            'tracked_ingredients' =>
            $ingredients->count(),

            'low_stock_count' =>
            $lowStock->count(),

            'out_of_stock_count' =>
            $outOfStock->count(),

            'stock_value' =>
            $stockValue,

            'low_stock_items' =>
            $lowStock
                ->take(
                    8
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
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Top Selling Items
    |--------------------------------------------------------------------------
    */

    private function topSellingItems(
        ?int $businessDayId
    ): array {
        if (
            ! $businessDayId
        ) {
            return [];
        }

        return DB::table(
            'order_items'
        )
            ->join(
                'orders',
                'orders.id',
                '=',
                'order_items.order_id'
            )
            ->where(
                'orders.business_day_id',
                $businessDayId
            )
            ->where(
                'orders.status',
                Order::STATUS_COMPLETED
            )
            ->where(
                'order_items.status',
                OrderItem::STATUS_ACTIVE
            )
            ->select([
                'order_items.item_name_snapshot',

                'order_items.variant_name_snapshot',

                DB::raw(
                    'COALESCE(SUM(order_items.quantity), 0) AS quantity'
                ),

                DB::raw(
                    'COALESCE(SUM(order_items.line_total), 0) AS sales_total'
                ),
            ])
            ->groupBy(
                'order_items.item_name_snapshot',
                'order_items.variant_name_snapshot'
            )
            ->orderByDesc(
                'quantity'
            )
            ->limit(
                5
            )
            ->get()
            ->map(
                fn(
                    object $row
                ): array => [
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

                    'sales_total' =>
                    round(
                        (float)
                        $row
                            ->sales_total,
                        2
                    ),
                ]
            )
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Recent Orders
    |--------------------------------------------------------------------------
    */

    private function recentOrders(
        ?int $businessDayId
    ): array {
        if (
            ! $businessDayId
        ) {
            return [];
        }

        return Order::query()
            ->where(
                'business_day_id',
                $businessDayId
            )
            ->latest(
                'id'
            )
            ->limit(
                8
            )
            ->get([
                'id',
                'order_number',
                'order_type',
                'order_source',
                'table_name_snapshot',
                'takeaway_token',
                'customer_name',
                'status',
                'grand_total',
                'created_at',
            ])
            ->map(
                fn(
                    Order $order
                ): array => [
                    'id' =>
                    (int)
                    $order
                        ->id,

                    'order_number' =>
                    (string)
                    $order
                        ->order_number,

                    'order_type' =>
                    (string)
                    $order
                        ->order_type,

                    'order_source' =>
                    (string)
                    $order
                        ->order_source,

                    'table_name' =>
                    $order
                        ->table_name_snapshot,

                    'takeaway_token' =>
                    $order
                        ->takeaway_token,

                    'customer_name' =>
                    $order
                        ->customer_name,

                    'status' =>
                    (string)
                    $order
                        ->status,

                    'grand_total' =>
                    (float)
                    $order
                        ->grand_total,

                    'created_at' =>
                    $order
                        ->created_at
                        ?->toISOString(),
                ]
            )
            ->values()
            ->all();
    }
}
