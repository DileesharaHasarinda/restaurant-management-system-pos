import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";

import {
    useStaffRealtimeRefresh,
} from '../realtime/realtimeBus';

import {
    useAuth,
} from "../auth/useAuth";

import {
    getCashierReport,
    getExpensesReport,
    getInventoryReport,
    getItemsReport,
    getOrdersReport,
    getOverviewReport,
    getPaymentsReport,
    getProfitReport,
    getPurchasesReport,
    getSalesReport,
} from "./reportService";

import type {
    CashierReport,
    ExpensesReport,
    InventoryReport,
    ItemsReport,
    OrdersReport,
    OverviewReport,
    PaymentsReport,
    ProfitReport,
    PurchasesReport,
    ReportFilters,
    ReportOrderSource,
    ReportOrderType,
    ReportPaymentMethod,
    ReportTab,
    SalesReport,
} from "./types";

import "./ReportsPage.css";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function localDateString(
    date: Date,
): string {
    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1,
        ).padStart(
            2,
            "0",
        );

    const day =
        String(
            date.getDate(),
        ).padStart(
            2,
            "0",
        );

    return `${year}-${month}-${day}`;
}

function currentMonthFilters():
    ReportFilters {
    const today =
        new Date();

    const first =
        new Date(
            today.getFullYear(),
            today.getMonth(),
            1,
        );

    return {
        dateFrom:
            localDateString(
                first,
            ),

        dateTo:
            localDateString(
                today,
            ),

        businessDayId:
            "",

        orderType:
            "",

        orderSource:
            "",

        paymentMethod:
            "",

        supplierId:
            "",

        ingredientId:
            "",

        cashierShiftId:
            "",

        expenseCategoryId:
            "",
    };
}

function money(
    value:
        | number
        | null
        | undefined,
): string {
    return new Intl.NumberFormat(
        "en-LK",
        {
            style:
                "currency",

            currency:
                "LKR",

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2,
        },
    ).format(
        Number(
            value ?? 0,
        ),
    );
}

function number(
    value:
        | number
        | null
        | undefined,
    maximumFractionDigits = 2,
): string {
    return new Intl.NumberFormat(
        "en-LK",
        {
            maximumFractionDigits,
        },
    ).format(
        Number(
            value ?? 0,
        ),
    );
}

function percent(
    value:
        | number
        | null
        | undefined,
): string {
    return `${number(value, 2)}%`;
}

function label(
    value: string,
): string {
    return value
        .replaceAll(
            "_",
            " ",
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            (
                character,
            ) =>
                character
                    .toUpperCase(),
        );
}

function dateTime(
    value:
        | string
        | null
        | undefined,
): string {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(
            value,
        );

    if (
        Number.isNaN(
            parsed.getTime(),
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        "en-LK",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit",

            timeZone:
                "Asia/Colombo",
        },
    ).format(
        parsed,
    );
}

function getErrorMessage(
    error: unknown,
): string {
    if (
        error instanceof Error
    ) {
        return error.message;
    }

    return "The report could not be loaded.";
}

function parseOrderType(
    value: string,
): ReportOrderType | "" {
    if (
        value === "DINE_IN"
        ||
        value === "TAKEAWAY"
    ) {
        return value;
    }

    return "";
}

function parseOrderSource(
    value: string,
): ReportOrderSource | "" {
    if (
        value === "QR_CUSTOMER"
        ||
        value === "WAITER"
        ||
        value === "CASHIER"
    ) {
        return value;
    }

    return "";
}

function parsePaymentMethod(
    value: string,
): ReportPaymentMethod | "" {
    if (
        value === "CASH"
        ||
        value === "CARD"
        ||
        value === "QR"
        ||
        value === "BANK_TRANSFER"
        ||
        value === "OTHER"
    ) {
        return value;
    }

    return "";
}

/*
|--------------------------------------------------------------------------
| Reusable UI
|--------------------------------------------------------------------------
*/

interface MetricCardProps {
    label: string;
    value: string;
    hint?: string;
    tone?:
    | "default"
    | "positive"
    | "negative"
    | "warning";
}

function MetricCard({
    label: cardLabel,
    value,
    hint,
    tone = "default",
}: MetricCardProps) {
    return (
        <article
            className={
                `report-metric ${tone}`
            }
        >
            <span>
                {cardLabel}
            </span>

            <strong>
                {value}
            </strong>

            {
                hint
                    ? (
                        <small>
                            {hint}
                        </small>
                    )
                    : null
            }
        </article>
    );
}

interface ReportSectionProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
}

function ReportSection({
    title,
    subtitle,
    children,
}: ReportSectionProps) {
    return (
        <section
            className="report-section"
        >
            <header>
                <div>
                    <h2>
                        {title}
                    </h2>

                    {
                        subtitle
                            ? (
                                <p>
                                    {
                                        subtitle
                                    }
                                </p>
                            )
                            : null
                    }
                </div>
            </header>

            {children}
        </section>
    );
}

interface BarRowProps {
    label: string;
    value: number;
    maximum: number;
    display: string;
}

function BarRow({
    label: rowLabel,
    value,
    maximum,
    display,
}: BarRowProps) {
    const width =
        maximum > 0
            ? Math.max(
                3,
                Math.min(
                    100,
                    (
                        value
                        /
                        maximum
                    )
                    * 100,
                ),
            )
            : 0;

    return (
        <div
            className="report-bar-row"
        >
            <div
                className="report-bar-label"
            >
                <span>
                    {rowLabel}
                </span>

                <strong>
                    {display}
                </strong>
            </div>

            <div
                className="report-bar-track"
            >
                <span
                    style={{
                        width:
                            `${width}%`,
                    }}
                />
            </div>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Tabs
|--------------------------------------------------------------------------
*/

const REPORT_TABS: Array<{
    id: ReportTab;
    label: string;
    permission?: string;
}> = [
        {
            id:
                "overview",

            label:
                "Overview",
        },
        {
            id:
                "sales",

            label:
                "Sales",
        },
        {
            id:
                "items",

            label:
                "Items",
        },
        {
            id:
                "profit",

            label:
                "Profit",
        },
        {
            id:
                "payments",

            label:
                "Payments",
        },
        {
            id:
                "expenses",

            label:
                "Expenses",

            permission:
                "expenses.view",
        },
        {
            id:
                "inventory",

            label:
                "Inventory",

            permission:
                "inventory.view",
        },
        {
            id:
                "purchases",

            label:
                "Purchases",
        },
        {
            id:
                "orders",

            label:
                "Orders",
        },
        {
            id:
                "cashier",

            label:
                "Cashier",
        },
    ];

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function ReportsPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const initialFilters =
        useMemo(
            () =>
                currentMonthFilters(),
            [],
        );

    const [
        activeTab,
        setActiveTab,
    ] =
        useState<ReportTab>(
            "overview",
        );

    const [
        draftFilters,
        setDraftFilters,
    ] =
        useState<ReportFilters>(
            initialFilters,
        );

    const [
        filters,
        setFilters,
    ] =
        useState<ReportFilters>(
            initialFilters,
        );

    const [
        loading,
        setLoading,
    ] =
        useState(
            true,
        );

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(
            false,
        );

    const [
        error,
        setError,
    ] =
        useState<string | null>(
            null,
        );

    const [
        overview,
        setOverview,
    ] =
        useState<OverviewReport | null>(
            null,
        );

    const [
        sales,
        setSales,
    ] =
        useState<SalesReport | null>(
            null,
        );

    const [
        items,
        setItems,
    ] =
        useState<ItemsReport | null>(
            null,
        );

    const [
        profit,
        setProfit,
    ] =
        useState<ProfitReport | null>(
            null,
        );

    const [
        payments,
        setPayments,
    ] =
        useState<PaymentsReport | null>(
            null,
        );

    const [
        expenses,
        setExpenses,
    ] =
        useState<ExpensesReport | null>(
            null,
        );

    const [
        inventory,
        setInventory,
    ] =
        useState<InventoryReport | null>(
            null,
        );

    const [
        purchases,
        setPurchases,
    ] =
        useState<PurchasesReport | null>(
            null,
        );

    const [
        orders,
        setOrders,
    ] =
        useState<OrdersReport | null>(
            null,
        );

    const [
        cashier,
        setCashier,
    ] =
        useState<CashierReport | null>(
            null,
        );

    /*
    |--------------------------------------------------------------------------
    | Report Request Coordination
    |--------------------------------------------------------------------------
    |
    | Reports can be refreshed by:
    |
    | - initial page/tab loading
    | - filters
    | - manual Refresh
    | - realtime invalidation events
    |
    | A monotonically increasing request sequence prevents an older REST
    | response from overwriting a newer report snapshot.
    |--------------------------------------------------------------------------
    */

    const reportRequestSequenceRef =
        useRef(
            0,
        );

    const foregroundRequestRef =
        useRef(
            0,
        );

    const visibleTabs =
        useMemo(
            () =>
                REPORT_TABS.filter(
                    (
                        tab,
                    ) =>
                        !tab.permission
                        ||
                        hasPermission(
                            tab.permission,
                        ),
                ),
            [
                hasPermission,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Load Active Report
    |--------------------------------------------------------------------------
    |
    | showRefreshing = true
    |   Manual Refresh. The Refresh button shows its normal progress state.
    |
    | silent = true
    |   Realtime reconciliation. The existing report remains visible and no
    |   loading/refresh spinner is shown.
    |
    | Reverb is never treated as authoritative report data. Every refresh
    | retrieves a new report snapshot from Laravel REST.
    |--------------------------------------------------------------------------
    */

    const loadReport =
        useCallback(
            async (
                showRefreshing = false,
                silent = false,
            ): Promise<void> => {
                const requestId =
                    reportRequestSequenceRef.current
                    +
                    1;

                reportRequestSequenceRef.current =
                    requestId;

                if (
                    !silent
                ) {
                    foregroundRequestRef.current =
                        requestId;

                    if (
                        showRefreshing
                    ) {
                        setRefreshing(
                            true,
                        );
                    } else {
                        setLoading(
                            true,
                        );
                    }

                    setError(
                        null,
                    );
                }

                const isCurrentRequest =
                    (): boolean =>
                        reportRequestSequenceRef.current
                        ===
                        requestId;

                try {
                    switch (
                    activeTab
                    ) {
                        case "overview": {
                            const result =
                                await getOverviewReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setOverview(
                                    result,
                                );
                            }

                            break;
                        }

                        case "sales": {
                            const result =
                                await getSalesReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setSales(
                                    result,
                                );
                            }

                            break;
                        }

                        case "items": {
                            const result =
                                await getItemsReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setItems(
                                    result,
                                );
                            }

                            break;
                        }

                        case "profit": {
                            const result =
                                await getProfitReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setProfit(
                                    result,
                                );
                            }

                            break;
                        }

                        case "payments": {
                            const result =
                                await getPaymentsReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setPayments(
                                    result,
                                );
                            }

                            break;
                        }

                        case "expenses": {
                            const result =
                                await getExpensesReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setExpenses(
                                    result,
                                );
                            }

                            break;
                        }

                        case "inventory": {
                            const result =
                                await getInventoryReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setInventory(
                                    result,
                                );
                            }

                            break;
                        }

                        case "purchases": {
                            const result =
                                await getPurchasesReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setPurchases(
                                    result,
                                );
                            }

                            break;
                        }

                        case "orders": {
                            const result =
                                await getOrdersReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setOrders(
                                    result,
                                );
                            }

                            break;
                        }

                        case "cashier": {
                            const result =
                                await getCashierReport(
                                    filters,
                                );

                            if (
                                isCurrentRequest()
                            ) {
                                setCashier(
                                    result,
                                );
                            }

                            break;
                        }
                    }
                } catch (
                exception
                ) {
                    if (
                        !isCurrentRequest()
                    ) {
                        return;
                    }

                    if (
                        silent
                    ) {
                        console.error(
                            "Unable to reconcile realtime report data.",
                            exception,
                        );

                        return;
                    }

                    setError(
                        getErrorMessage(
                            exception,
                        ),
                    );
                } finally {
                    /*
                     * Only the latest foreground request may clear its own
                     * loading indicators. A silent realtime request never
                     * manipulates these UI states.
                     */
                    if (
                        !silent
                        &&
                        foregroundRequestRef.current
                        ===
                        requestId
                    ) {
                        setLoading(
                            false,
                        );

                        setRefreshing(
                            false,
                        );
                    }
                }
            },
            [
                activeTab,
                filters,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Initial / Tab / Filter Load
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const frame =
                window.requestAnimationFrame(
                    () => {
                        void loadReport();
                    },
                );

            return () => {
                window.cancelAnimationFrame(
                    frame,
                );
            };
        },
        [
            loadReport,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | Reports aggregate data from several business domains. A change in any
    | of the domains below can change the currently visible report.
    |
    | The shared realtime bus already debounces event storms. This page then
    | silently reloads only the currently active report using the current
    | applied filters.
    |
    | Realtime updates preserve:
    |
    | - active report tab
    | - draft filters
    | - applied filters
    | - date presets
    | - report scroll/page UI
    |
    | No browser reload and no manual Refresh are required.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "orders",
            "tables",
            "menu",
            "inventory",
            "purchases",
            "suppliers",
            "supplier_payments",
            "wastage",
            "expenses",
            "billing",
            "cash",
            "business_day",
        ],
        async () => {
            await loadReport(
                false,
                true,
            );
        },
    );

    function applyPreset(
        preset:
            | "today"
            | "yesterday"
            | "week"
            | "month",
    ): void {
        const now =
            new Date();

        let from =
            new Date(
                now,
            );

        let to =
            new Date(
                now,
            );

        if (
            preset === "yesterday"
        ) {
            from.setDate(
                from.getDate() - 1,
            );

            to =
                new Date(
                    from,
                );
        }

        if (
            preset === "week"
        ) {
            const weekday =
                now.getDay();

            const difference =
                weekday === 0
                    ? 6
                    : weekday - 1;

            from.setDate(
                now.getDate()
                -
                difference,
            );
        }

        if (
            preset === "month"
        ) {
            from =
                new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1,
                );
        }

        const updated: ReportFilters = {
            ...draftFilters,

            dateFrom:
                localDateString(
                    from,
                ),

            dateTo:
                localDateString(
                    to,
                ),

            businessDayId:
                "",
        };

        setDraftFilters(
            updated,
        );

        setFilters(
            updated,
        );
    }

    function submitFilters(
        event:
            FormEvent<HTMLFormElement>,
    ): void {
        event.preventDefault();

        setFilters({
            ...draftFilters,
        });
    }

    function resetFilters():
        void {
        const updated =
            currentMonthFilters();

        setDraftFilters(
            updated,
        );

        setFilters(
            updated,
        );
    }

    function activeScope(): {
        dateFrom: string;
        dateTo: string;
        generatedAt: string | null;
    } {
        const report =
            overview
            ??
            sales
            ??
            items
            ??
            profit
            ??
            payments
            ??
            expenses
            ??
            inventory
            ??
            purchases
            ??
            orders
            ??
            cashier;

        return {
            dateFrom:
                report?.date_from
                ??
                filters.dateFrom,

            dateTo:
                report?.date_to
                ??
                filters.dateTo,

            generatedAt:
                report?.generated_at
                ??
                null,
        };
    }

    const scope =
        activeScope();

    /*
    |--------------------------------------------------------------------------
    | Overview
    |--------------------------------------------------------------------------
    */

    function renderOverview():
        ReactNode {
        if (!overview) {
            return null;
        }

        const maxDailySales =
            Math.max(
                0,
                ...overview
                    .daily_sales
                    .map(
                        (
                            row,
                        ) =>
                            row.sales,
                    ),
            );

        const maxTopItem =
            Math.max(
                0,
                ...overview
                    .top_items
                    .map(
                        (
                            row,
                        ) =>
                            row.sales_total,
                    ),
            );

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Gross Sales"
                        value={
                            money(
                                overview
                                    .kpis
                                    .gross_sales,
                            )
                        }
                    />

                    <MetricCard
                        label="Net Sales"
                        value={
                            money(
                                overview
                                    .kpis
                                    .net_sales,
                            )
                        }
                        tone="positive"
                    />

                    <MetricCard
                        label="Completed Orders"
                        value={
                            number(
                                overview
                                    .kpis
                                    .completed_orders,
                                0,
                            )
                        }
                    />

                    <MetricCard
                        label="Average Order"
                        value={
                            money(
                                overview
                                    .kpis
                                    .average_order_value,
                            )
                        }
                    />

                    <MetricCard
                        label="COGS"
                        value={
                            money(
                                overview
                                    .kpis
                                    .cogs,
                            )
                        }
                    />

                    <MetricCard
                        label="Gross Profit"
                        value={
                            money(
                                overview
                                    .kpis
                                    .gross_profit,
                            )
                        }
                        tone="positive"
                    />

                    <MetricCard
                        label="Expenses"
                        value={
                            money(
                                overview
                                    .kpis
                                    .expenses,
                            )
                        }
                        tone="warning"
                    />

                    <MetricCard
                        label="Refunds"
                        value={
                            money(
                                overview
                                    .kpis
                                    .refunds,
                            )
                        }
                        tone="negative"
                    />

                    <MetricCard
                        label="Wastage"
                        value={
                            money(
                                overview
                                    .kpis
                                    .wastage_cost,
                            )
                        }
                        tone="warning"
                    />

                    <MetricCard
                        label="Estimated Net Profit"
                        value={
                            money(
                                overview
                                    .kpis
                                    .estimated_net_profit,
                            )
                        }
                        hint={
                            `Margin ${percent(
                                overview
                                    .kpis
                                    .profit_margin,
                            )}`
                        }
                        tone={
                            overview
                                .kpis
                                .estimated_net_profit
                                >= 0
                                ? "positive"
                                : "negative"
                        }
                    />
                </div>

                <div
                    className="report-two-column"
                >
                    <ReportSection
                        title="Sales Trend"
                        subtitle="Completed-order sales by business date."
                    >
                        <div
                            className="report-bars"
                        >
                            {
                                overview
                                    .daily_sales
                                    .length
                                    === 0
                                    ? (
                                        <p
                                            className="report-empty"
                                        >
                                            No completed sales
                                            in this range.
                                        </p>
                                    )
                                    : overview
                                        .daily_sales
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <BarRow
                                                    key={
                                                        row
                                                            .business_date
                                                    }
                                                    label={
                                                        row
                                                            .business_date
                                                    }
                                                    value={
                                                        row
                                                            .sales
                                                    }
                                                    maximum={
                                                        maxDailySales
                                                    }
                                                    display={
                                                        money(
                                                            row
                                                                .sales,
                                                        )
                                                    }
                                                />
                                            ),
                                        )
                            }
                        </div>
                    </ReportSection>

                    <ReportSection
                        title="Top Selling Items"
                        subtitle="Ranked by completed-order sales."
                    >
                        <div
                            className="report-bars"
                        >
                            {
                                overview
                                    .top_items
                                    .length
                                    === 0
                                    ? (
                                        <p
                                            className="report-empty"
                                        >
                                            No item sales found.
                                        </p>
                                    )
                                    : overview
                                        .top_items
                                        .map(
                                            (
                                                item,
                                            ) => (
                                                <BarRow
                                                    key={
                                                        `${item.name}-${item.variant ?? ""}`
                                                    }
                                                    label={
                                                        item.variant
                                                            ? `${item.name} — ${item.variant}`
                                                            : item.name
                                                    }
                                                    value={
                                                        item.sales_total
                                                    }
                                                    maximum={
                                                        maxTopItem
                                                    }
                                                    display={
                                                        money(
                                                            item
                                                                .sales_total,
                                                        )
                                                    }
                                                />
                                            ),
                                        )
                            }
                        </div>
                    </ReportSection>
                </div>

                <div
                    className="report-two-column"
                >
                    <ReportSection
                        title="Payment Breakdown"
                    >
                        <div
                            className="report-table-scroll"
                        >
                            <table>
                                <thead>
                                    <tr>
                                        <th>
                                            Method
                                        </th>
                                        <th>
                                            Payments
                                        </th>
                                        <th>
                                            Gross
                                        </th>
                                        <th>
                                            Refunds
                                        </th>
                                        <th>
                                            Net
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {
                                        overview
                                            .payments
                                            .by_method
                                            .map(
                                                (
                                                    row,
                                                ) => (
                                                    <tr
                                                        key={
                                                            row.method
                                                        }
                                                    >
                                                        <td>
                                                            {
                                                                label(
                                                                    row.method,
                                                                )
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                row
                                                                    .payment_count
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                money(
                                                                    row
                                                                        .gross_amount,
                                                                )
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                money(
                                                                    row
                                                                        .refund_amount,
                                                                )
                                                            }
                                                        </td>

                                                        <td>
                                                            <strong>
                                                                {
                                                                    money(
                                                                        row
                                                                            .net_amount,
                                                                    )
                                                                }
                                                            </strong>
                                                        </td>
                                                    </tr>
                                                ),
                                            )
                                    }
                                </tbody>
                            </table>
                        </div>
                    </ReportSection>

                    <ReportSection
                        title="Order Status"
                    >
                        <div
                            className="report-status-list"
                        >
                            {
                                overview
                                    .order_statuses
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row.status
                                                }
                                            >
                                                <span>
                                                    {
                                                        label(
                                                            row.status
                                                            ?? "",
                                                        )
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        row
                                                            .order_count
                                                    }
                                                </strong>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>
                </div>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Sales
    |--------------------------------------------------------------------------
    */

    function renderSales():
        ReactNode {
        if (!sales) {
            return null;
        }

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Gross Sales"
                        value={
                            money(
                                sales
                                    .summary
                                    .gross_sales,
                            )
                        }
                    />

                    <MetricCard
                        label="Net Sales"
                        value={
                            money(
                                sales
                                    .summary
                                    .net_sales,
                            )
                        }
                        tone="positive"
                    />

                    <MetricCard
                        label="Completed Orders"
                        value={
                            number(
                                sales
                                    .summary
                                    .completed_orders,
                                0,
                            )
                        }
                    />

                    <MetricCard
                        label="Average Order"
                        value={
                            money(
                                sales
                                    .summary
                                    .average_order_value,
                            )
                        }
                    />

                    <MetricCard
                        label="Discounts"
                        value={
                            money(
                                sales
                                    .summary
                                    .discounts,
                            )
                        }
                    />

                    <MetricCard
                        label="Refunds"
                        value={
                            money(
                                sales
                                    .summary
                                    .refunds,
                            )
                        }
                        tone="negative"
                    />

                    <MetricCard
                        label="Tax"
                        value={
                            money(
                                sales
                                    .summary
                                    .tax,
                            )
                        }
                    />

                    <MetricCard
                        label="Service Charge"
                        value={
                            money(
                                sales
                                    .summary
                                    .service_charge,
                            )
                        }
                    />
                </div>

                <ReportSection
                    title="Daily Sales"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Orders</th>
                                    <th>Subtotal</th>
                                    <th>Discount</th>
                                    <th>Tax</th>
                                    <th>Service</th>
                                    <th>Sales</th>
                                    <th>COGS</th>
                                    <th>Gross Profit</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    sales
                                        .daily
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <tr
                                                    key={
                                                        row
                                                            .business_date
                                                    }
                                                >
                                                    <td>
                                                        {
                                                            row
                                                                .business_date
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            row
                                                                .order_count
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .subtotal,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .discounts,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row.tax,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .service_charge,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {
                                                                money(
                                                                    row.sales,
                                                                )
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row.cogs,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {
                                                                money(
                                                                    row
                                                                        .gross_profit,
                                                                )
                                                            }
                                                        </strong>
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>

                <div
                    className="report-two-column"
                >
                    <ReportSection
                        title="Dine-in vs Takeaway"
                    >
                        <div
                            className="report-summary-list"
                        >
                            {
                                sales
                                    .by_type
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row
                                                        .order_type
                                                }
                                            >
                                                <span>
                                                    {
                                                        label(
                                                            row
                                                                .order_type
                                                            ?? "",
                                                        )
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        money(
                                                            row
                                                                .sales_total
                                                            ?? 0,
                                                        )
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        row
                                                            .order_count
                                                    } orders
                                                </small>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>

                    <ReportSection
                        title="Sales by Source"
                    >
                        <div
                            className="report-summary-list"
                        >
                            {
                                sales
                                    .by_source
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row
                                                        .order_source
                                                }
                                            >
                                                <span>
                                                    {
                                                        label(
                                                            row
                                                                .order_source
                                                            ?? "",
                                                        )
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        money(
                                                            row
                                                                .sales_total
                                                            ?? 0,
                                                        )
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        row
                                                            .order_count
                                                    } orders
                                                </small>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>
                </div>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Items
    |--------------------------------------------------------------------------
    */

    function renderItems():
        ReactNode {
        if (!items) {
            return null;
        }

        return (
            <>
                <ReportSection
                    title="Item Sales & Profitability"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Variant</th>
                                    <th>Qty Sold</th>
                                    <th>Sales</th>
                                    <th>Cost</th>
                                    <th>Gross Profit</th>
                                    <th>Margin</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    items
                                        .items
                                        .map(
                                            (
                                                item,
                                            ) => (
                                                <tr
                                                    key={
                                                        `${item.name}-${item.variant ?? ""}`
                                                    }
                                                >
                                                    <td>
                                                        <strong>
                                                            {
                                                                item.name
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {
                                                            item.variant
                                                            ?? "—"
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            number(
                                                                item.quantity,
                                                                3,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                item
                                                                    .sales_total,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                item
                                                                    .cost_total,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {
                                                                money(
                                                                    item
                                                                        .gross_profit,
                                                                )
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {
                                                            percent(
                                                                item.margin,
                                                            )
                                                        }
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>

                <ReportSection
                    title="Add-on Sales"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Add-on</th>
                                    <th>Quantity</th>
                                    <th>Sales</th>
                                    <th>Cost</th>
                                    <th>Gross Profit</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    items
                                        .addons
                                        .map(
                                            (
                                                addon,
                                            ) => (
                                                <tr
                                                    key={
                                                        addon.name
                                                    }
                                                >
                                                    <td>
                                                        {
                                                            addon.name
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            number(
                                                                addon.quantity,
                                                                3,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                addon
                                                                    .sales_total,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                addon
                                                                    .cost_total,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {
                                                                money(
                                                                    addon
                                                                        .gross_profit,
                                                                )
                                                            }
                                                        </strong>
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Profit
    |--------------------------------------------------------------------------
    */

    function renderProfit():
        ReactNode {
        if (!profit) {
            return null;
        }

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Net Sales"
                        value={
                            money(
                                profit
                                    .summary
                                    .net_sales,
                            )
                        }
                    />

                    <MetricCard
                        label="COGS"
                        value={
                            money(
                                profit
                                    .summary
                                    .cogs,
                            )
                        }
                    />

                    <MetricCard
                        label="Gross Profit"
                        value={
                            money(
                                profit
                                    .summary
                                    .gross_profit,
                            )
                        }
                        hint={
                            `Margin ${percent(
                                profit
                                    .summary
                                    .gross_margin,
                            )}`
                        }
                        tone="positive"
                    />

                    <MetricCard
                        label="Expenses"
                        value={
                            money(
                                profit
                                    .summary
                                    .expenses,
                            )
                        }
                        tone="warning"
                    />

                    <MetricCard
                        label="Wastage"
                        value={
                            money(
                                profit
                                    .summary
                                    .wastage_cost,
                            )
                        }
                        tone="warning"
                    />

                    <MetricCard
                        label="Refunds"
                        value={
                            money(
                                profit
                                    .summary
                                    .refunds,
                            )
                        }
                        tone="negative"
                    />

                    <MetricCard
                        label="Estimated Net Profit"
                        value={
                            money(
                                profit
                                    .summary
                                    .estimated_net_profit,
                            )
                        }
                        hint={
                            `Margin ${percent(
                                profit
                                    .summary
                                    .estimated_net_margin,
                            )}`
                        }
                        tone={
                            profit
                                .summary
                                .estimated_net_profit
                                >= 0
                                ? "positive"
                                : "negative"
                        }
                    />
                </div>

                <ReportSection
                    title="Daily Profit"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Sales</th>
                                    <th>Refunds</th>
                                    <th>Net Sales</th>
                                    <th>COGS</th>
                                    <th>Expenses</th>
                                    <th>Wastage</th>
                                    <th>Est. Net Profit</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    profit
                                        .daily
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <tr
                                                    key={
                                                        row
                                                            .business_date
                                                    }
                                                >
                                                    <td>
                                                        {
                                                            row
                                                                .business_date
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row.sales,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row.refunds,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .net_sales,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row.cogs,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row.expenses,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .wastage_cost,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {
                                                                money(
                                                                    row
                                                                        .estimated_net_profit,
                                                                )
                                                            }
                                                        </strong>
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Payments
    |--------------------------------------------------------------------------
    */

    function renderPayments():
        ReactNode {
        if (!payments) {
            return null;
        }

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Gross Payments"
                        value={
                            money(
                                payments
                                    .gross_total,
                            )
                        }
                    />

                    <MetricCard
                        label="Refunds"
                        value={
                            money(
                                payments
                                    .refund_total,
                            )
                        }
                        tone="negative"
                    />

                    <MetricCard
                        label="Net Payments"
                        value={
                            money(
                                payments
                                    .net_total,
                            )
                        }
                        tone="positive"
                    />
                </div>

                <ReportSection
                    title="Payment Methods"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Method</th>
                                    <th>Payments</th>
                                    <th>Refunds</th>
                                    <th>Gross</th>
                                    <th>Refund Amount</th>
                                    <th>Net</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    payments
                                        .by_method
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <tr
                                                    key={
                                                        row.method
                                                    }
                                                >
                                                    <td>
                                                        <strong>
                                                            {
                                                                label(
                                                                    row.method,
                                                                )
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {
                                                            row
                                                                .payment_count
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            row
                                                                .refund_count
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .gross_amount,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .refund_amount,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {
                                                                money(
                                                                    row
                                                                        .net_amount,
                                                                )
                                                            }
                                                        </strong>
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Expenses
    |--------------------------------------------------------------------------
    */

    function renderExpenses():
        ReactNode {
        if (!expenses) {
            return null;
        }

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Expenses"
                        value={
                            money(
                                expenses
                                    .summary
                                    .total_amount,
                            )
                        }
                        tone="warning"
                    />

                    <MetricCard
                        label="Expense Records"
                        value={
                            number(
                                expenses
                                    .summary
                                    .expense_count,
                                0,
                            )
                        }
                    />

                    <MetricCard
                        label="Average Expense"
                        value={
                            money(
                                expenses
                                    .summary
                                    .average_expense,
                            )
                        }
                    />
                </div>

                <div
                    className="report-two-column"
                >
                    <ReportSection
                        title="Expenses by Category"
                    >
                        <div
                            className="report-summary-list"
                        >
                            {
                                expenses
                                    .by_category
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row
                                                        .category_id
                                                }
                                            >
                                                <span>
                                                    {
                                                        row
                                                            .category_name
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        money(
                                                            row
                                                                .total_amount,
                                                        )
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        row
                                                            .expense_count
                                                    } records
                                                </small>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>

                    <ReportSection
                        title="Expenses by Payment Method"
                    >
                        <div
                            className="report-summary-list"
                        >
                            {
                                expenses
                                    .by_payment_method
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row
                                                        .payment_method
                                                }
                                            >
                                                <span>
                                                    {
                                                        label(
                                                            row
                                                                .payment_method,
                                                        )
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        money(
                                                            row
                                                                .total_amount,
                                                        )
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        row
                                                            .expense_count
                                                    } records
                                                </small>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>
                </div>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Inventory
    |--------------------------------------------------------------------------
    */

    function renderInventory():
        ReactNode {
        if (!inventory) {
            return null;
        }

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Tracked Ingredients"
                        value={
                            number(
                                inventory
                                    .current_stock
                                    .tracked_ingredients,
                                0,
                            )
                        }
                    />

                    <MetricCard
                        label="Stock Value"
                        value={
                            money(
                                inventory
                                    .current_stock
                                    .stock_value,
                            )
                        }
                    />

                    <MetricCard
                        label="Low Stock"
                        value={
                            number(
                                inventory
                                    .current_stock
                                    .low_stock_count,
                                0,
                            )
                        }
                        tone="warning"
                    />

                    <MetricCard
                        label="Out of Stock"
                        value={
                            number(
                                inventory
                                    .current_stock
                                    .out_of_stock_count,
                                0,
                            )
                        }
                        tone="negative"
                    />
                </div>

                <ReportSection
                    title="Stock Consumption"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Ingredient</th>
                                    <th>SKU</th>
                                    <th>Quantity Used</th>
                                    <th>Consumption Cost</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    inventory
                                        .sale_consumption
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <tr
                                                    key={
                                                        row
                                                            .ingredient_id
                                                    }
                                                >
                                                    <td>
                                                        <strong>
                                                            {
                                                                row.name
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {
                                                            row.sku
                                                            ?? "—"
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            number(
                                                                row
                                                                    .quantity_consumed,
                                                                4,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .consumption_cost,
                                                            )
                                                        }
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>

                <div
                    className="report-two-column"
                >
                    <ReportSection
                        title="Low Stock"
                    >
                        <div
                            className="report-summary-list"
                        >
                            {
                                inventory
                                    .current_stock
                                    .low_stock_items
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row.id
                                                }
                                            >
                                                <span>
                                                    {
                                                        row.name
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        number(
                                                            row
                                                                .current_stock,
                                                            4,
                                                        )
                                                    }{" "}
                                                    {
                                                        row
                                                            .unit
                                                            .symbol
                                                        ?? ""
                                                    }
                                                </strong>

                                                <small>
                                                    Reorder at{" "}
                                                    {
                                                        number(
                                                            row
                                                                .reorder_level,
                                                            4,
                                                        )
                                                    }
                                                </small>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>

                    <ReportSection
                        title="Wastage"
                    >
                        <div
                            className="report-summary-list"
                        >
                            {
                                inventory
                                    .wastage
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row
                                                        .reason_code
                                                }
                                            >
                                                <span>
                                                    {
                                                        row
                                                            .reason_label
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        money(
                                                            row
                                                                .estimated_cost,
                                                        )
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        row
                                                            .wastage_count
                                                    } records
                                                </small>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>
                </div>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Purchases
    |--------------------------------------------------------------------------
    */

    function renderPurchases():
        ReactNode {
        if (!purchases) {
            return null;
        }

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Completed Purchases"
                        value={
                            number(
                                purchases
                                    .summary
                                    .purchase_count,
                                0,
                            )
                        }
                    />

                    <MetricCard
                        label="Purchase Value"
                        value={
                            money(
                                purchases
                                    .summary
                                    .purchase_total,
                            )
                        }
                    />

                    <MetricCard
                        label="Purchase Paid"
                        value={
                            money(
                                purchases
                                    .summary
                                    .paid_amount,
                            )
                        }
                    />

                    <MetricCard
                        label="Outstanding"
                        value={
                            money(
                                purchases
                                    .summary
                                    .balance_due,
                            )
                        }
                        tone="warning"
                    />

                    <MetricCard
                        label="Supplier Payments"
                        value={
                            money(
                                purchases
                                    .summary
                                    .supplier_payments,
                            )
                        }
                    />
                </div>

                <ReportSection
                    title="Purchases by Supplier"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Supplier</th>
                                    <th>Purchases</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance Due</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    purchases
                                        .by_supplier
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <tr
                                                    key={
                                                        row
                                                            .supplier_id
                                                    }
                                                >
                                                    <td>
                                                        <strong>
                                                            {
                                                                row
                                                                    .supplier_name
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {
                                                            row
                                                                .purchase_count
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .purchase_total,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .paid_amount,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .balance_due,
                                                            )
                                                        }
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Orders
    |--------------------------------------------------------------------------
    */

    function renderOrders():
        ReactNode {
        if (!orders) {
            return null;
        }

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Total Orders"
                        value={
                            number(
                                orders
                                    .total_orders,
                                0,
                            )
                        }
                    />
                </div>

                <div
                    className="report-two-column"
                >
                    <ReportSection
                        title="Orders by Status"
                    >
                        <div
                            className="report-summary-list"
                        >
                            {
                                orders
                                    .by_status
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row.status
                                                }
                                            >
                                                <span>
                                                    {
                                                        label(
                                                            row.status,
                                                        )
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        row
                                                            .order_count
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        money(
                                                            row
                                                                .order_value,
                                                        )
                                                    }
                                                </small>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>

                    <ReportSection
                        title="Orders by Source"
                    >
                        <div
                            className="report-summary-list"
                        >
                            {
                                orders
                                    .by_source
                                    .map(
                                        (
                                            row,
                                        ) => (
                                            <div
                                                key={
                                                    row
                                                        .order_source
                                                }
                                            >
                                                <span>
                                                    {
                                                        label(
                                                            row
                                                                .order_source,
                                                        )
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        row
                                                            .order_count
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        money(
                                                            row
                                                                .order_value,
                                                        )
                                                    }
                                                </small>
                                            </div>
                                        ),
                                    )
                            }
                        </div>
                    </ReportSection>
                </div>

                <ReportSection
                    title="Orders by Table"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Table</th>
                                    <th>Orders</th>
                                    <th>Order Value</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    orders
                                        .by_table
                                        .map(
                                            (
                                                row,
                                                index,
                                            ) => (
                                                <tr
                                                    key={
                                                        `${row.table_name ?? "table"}-${index}`
                                                    }
                                                >
                                                    <td>
                                                        {
                                                            row
                                                                .table_name
                                                            ?? "Unknown"
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            row
                                                                .order_count
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                row
                                                                    .order_value,
                                                            )
                                                        }
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>

                <div
                    className="report-two-column"
                >
                    <ReportSection
                        title="Cancellation Reasons"
                    >
                        <div
                            className="report-reason-list"
                        >
                            {
                                orders
                                    .cancellation_reasons
                                    .length
                                    === 0
                                    ? (
                                        <p
                                            className="report-empty"
                                        >
                                            No cancellations.
                                        </p>
                                    )
                                    : orders
                                        .cancellation_reasons
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <div
                                                    key={
                                                        row.reason
                                                    }
                                                >
                                                    <span>
                                                        {
                                                            row.reason
                                                        }
                                                    </span>

                                                    <strong>
                                                        {
                                                            row.count
                                                        }
                                                    </strong>
                                                </div>
                                            ),
                                        )
                            }
                        </div>
                    </ReportSection>

                    <ReportSection
                        title="Rejection Reasons"
                    >
                        <div
                            className="report-reason-list"
                        >
                            {
                                orders
                                    .rejection_reasons
                                    .length
                                    === 0
                                    ? (
                                        <p
                                            className="report-empty"
                                        >
                                            No rejected orders.
                                        </p>
                                    )
                                    : orders
                                        .rejection_reasons
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <div
                                                    key={
                                                        row.reason
                                                    }
                                                >
                                                    <span>
                                                        {
                                                            row.reason
                                                        }
                                                    </span>

                                                    <strong>
                                                        {
                                                            row.count
                                                        }
                                                    </strong>
                                                </div>
                                            ),
                                        )
                            }
                        </div>
                    </ReportSection>
                </div>
            </>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cashier
    |--------------------------------------------------------------------------
    */

    function renderCashier():
        ReactNode {
        if (!cashier) {
            return null;
        }

        return (
            <>
                <div
                    className="report-metrics-grid"
                >
                    <MetricCard
                        label="Shifts"
                        value={
                            number(
                                cashier
                                    .summary
                                    .shift_count,
                                0,
                            )
                        }
                    />

                    <MetricCard
                        label="Open Shifts"
                        value={
                            number(
                                cashier
                                    .summary
                                    .open_shifts,
                                0,
                            )
                        }
                    />

                    <MetricCard
                        label="Opening Float"
                        value={
                            money(
                                cashier
                                    .summary
                                    .opening_float,
                            )
                        }
                    />

                    <MetricCard
                        label="Expected Cash"
                        value={
                            money(
                                cashier
                                    .summary
                                    .expected_cash,
                            )
                        }
                    />

                    <MetricCard
                        label="Actual Cash"
                        value={
                            money(
                                cashier
                                    .summary
                                    .actual_cash,
                            )
                        }
                    />

                    <MetricCard
                        label="Cash Difference"
                        value={
                            money(
                                cashier
                                    .summary
                                    .cash_difference,
                            )
                        }
                        tone={
                            cashier
                                .summary
                                .cash_difference
                                === 0
                                ? "positive"
                                : "warning"
                        }
                    />
                </div>

                <ReportSection
                    title="Cash Drawer Movements"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Movement</th>
                                    <th>Count</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    cashier
                                        .drawer_movements
                                        .map(
                                            (
                                                row,
                                            ) => (
                                                <tr
                                                    key={
                                                        row
                                                            .movement_type
                                                    }
                                                >
                                                    <td>
                                                        {
                                                            label(
                                                                row
                                                                    .movement_type,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            row
                                                                .movement_count
                                                        }
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {
                                                                money(
                                                                    row.amount,
                                                                )
                                                            }
                                                        </strong>
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>

                <ReportSection
                    title="Cashier Shifts"
                >
                    <div
                        className="report-table-scroll"
                    >
                        <table>
                            <thead>
                                <tr>
                                    <th>Shift</th>
                                    <th>Cashier</th>
                                    <th>Terminal</th>
                                    <th>Status</th>
                                    <th>Opening</th>
                                    <th>Expected</th>
                                    <th>Actual</th>
                                    <th>Difference</th>
                                    <th>Opened</th>
                                    <th>Closed</th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    cashier
                                        .shifts
                                        .map(
                                            (
                                                shift,
                                            ) => (
                                                <tr
                                                    key={
                                                        shift.id
                                                    }
                                                >
                                                    <td>
                                                        <strong>
                                                            {
                                                                shift
                                                                    .shift_number
                                                                ?? `#${shift.id}`
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        User #
                                                        {
                                                            shift
                                                                .cashier_id
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            shift
                                                                .terminal_name
                                                            ?? "—"
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            label(
                                                                shift.status,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                shift
                                                                    .opening_float,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money(
                                                                shift
                                                                    .expected_cash,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            shift
                                                                .actual_cash
                                                                === null
                                                                ? "—"
                                                                : money(
                                                                    shift
                                                                        .actual_cash,
                                                                )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            shift
                                                                .cash_difference
                                                                === null
                                                                ? "—"
                                                                : money(
                                                                    shift
                                                                        .cash_difference,
                                                                )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            dateTime(
                                                                shift
                                                                    .opened_at,
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            dateTime(
                                                                shift
                                                                    .closed_at,
                                                            )
                                                        }
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                }
                            </tbody>
                        </table>
                    </div>
                </ReportSection>
            </>
        );
    }

    function renderActiveReport():
        ReactNode {
        switch (
        activeTab
        ) {
            case "overview":
                return renderOverview();

            case "sales":
                return renderSales();

            case "items":
                return renderItems();

            case "profit":
                return renderProfit();

            case "payments":
                return renderPayments();

            case "expenses":
                return renderExpenses();

            case "inventory":
                return renderInventory();

            case "purchases":
                return renderPurchases();

            case "orders":
                return renderOrders();

            case "cashier":
                return renderCashier();
        }
    }

    return (
        <section
            id="reports-page"
        >
            <header
                className="reports-header"
            >
                <div>
                    <span
                        className="reports-eyebrow"
                    >
                        MANAGEMENT REPORTING
                    </span>

                    <h1>
                        Reports
                    </h1>

                    <p>
                        Financial, sales, inventory,
                        purchasing and operational
                        performance from authoritative
                        restaurant records.
                    </p>
                </div>

                <button
                    type="button"
                    className="reports-refresh"
                    disabled={
                        refreshing
                    }
                    onClick={
                        () => {
                            void loadReport(
                                true,
                            );
                        }
                    }
                >
                    ↻{" "}
                    {
                        refreshing
                            ? "Refreshing..."
                            : "Refresh"
                    }
                </button>
            </header>

            {
                error
                    ? (
                        <div
                            className="reports-alert"
                        >
                            <span>
                                {error}
                            </span>

                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setError(
                                            null,
                                        )
                                }
                            >
                                ×
                            </button>
                        </div>
                    )
                    : null
            }

            <div
                className="reports-presets"
            >
                <button
                    type="button"
                    onClick={
                        () =>
                            applyPreset(
                                "today",
                            )
                    }
                >
                    Today
                </button>

                <button
                    type="button"
                    onClick={
                        () =>
                            applyPreset(
                                "yesterday",
                            )
                    }
                >
                    Yesterday
                </button>

                <button
                    type="button"
                    onClick={
                        () =>
                            applyPreset(
                                "week",
                            )
                    }
                >
                    This Week
                </button>

                <button
                    type="button"
                    onClick={
                        () =>
                            applyPreset(
                                "month",
                            )
                    }
                >
                    This Month
                </button>
            </div>

            <form
                className="reports-filter-card"
                onSubmit={
                    submitFilters
                }
            >
                <label>
                    <span>
                        From
                    </span>

                    <input
                        type="date"
                        value={
                            draftFilters
                                .dateFrom
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setDraftFilters(
                                    (
                                        current,
                                    ) => ({
                                        ...current,
                                        dateFrom:
                                            event
                                                .target
                                                .value,
                                    }),
                                )
                        }
                    />
                </label>

                <label>
                    <span>
                        To
                    </span>

                    <input
                        type="date"
                        value={
                            draftFilters
                                .dateTo
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setDraftFilters(
                                    (
                                        current,
                                    ) => ({
                                        ...current,
                                        dateTo:
                                            event
                                                .target
                                                .value,
                                    }),
                                )
                        }
                    />
                </label>

                <label>
                    <span>
                        Business Day ID
                    </span>

                    <input
                        type="number"
                        min="1"
                        placeholder="Optional"
                        value={
                            draftFilters
                                .businessDayId
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setDraftFilters(
                                    (
                                        current,
                                    ) => ({
                                        ...current,
                                        businessDayId:
                                            event
                                                .target
                                                .value,
                                    }),
                                )
                        }
                    />
                </label>

                <label>
                    <span>
                        Order Type
                    </span>

                    <select
                        value={
                            draftFilters
                                .orderType
                        }
                        onChange={
                            (
                                event,
                            ) => {
                                const value =
                                    parseOrderType(
                                        event
                                            .target
                                            .value,
                                    );

                                setDraftFilters(
                                    (
                                        current,
                                    ) => ({
                                        ...current,
                                        orderType:
                                            value,
                                    }),
                                );
                            }
                        }
                    >
                        <option value="">
                            All Types
                        </option>

                        <option value="DINE_IN">
                            Dine In
                        </option>

                        <option value="TAKEAWAY">
                            Takeaway
                        </option>
                    </select>
                </label>

                <label>
                    <span>
                        Order Source
                    </span>

                    <select
                        value={
                            draftFilters
                                .orderSource
                        }
                        onChange={
                            (
                                event,
                            ) => {
                                const value =
                                    parseOrderSource(
                                        event
                                            .target
                                            .value,
                                    );

                                setDraftFilters(
                                    (
                                        current,
                                    ) => ({
                                        ...current,
                                        orderSource:
                                            value,
                                    }),
                                );
                            }
                        }
                    >
                        <option value="">
                            All Sources
                        </option>

                        <option value="QR_CUSTOMER">
                            QR Customer
                        </option>

                        <option value="WAITER">
                            Waiter
                        </option>

                        <option value="CASHIER">
                            Cashier
                        </option>
                    </select>
                </label>

                <label>
                    <span>
                        Payment Method
                    </span>

                    <select
                        value={
                            draftFilters
                                .paymentMethod
                        }
                        onChange={
                            (
                                event,
                            ) => {
                                const value =
                                    parsePaymentMethod(
                                        event
                                            .target
                                            .value,
                                    );

                                setDraftFilters(
                                    (
                                        current,
                                    ) => ({
                                        ...current,
                                        paymentMethod:
                                            value,
                                    }),
                                );
                            }
                        }
                    >
                        <option value="">
                            All Methods
                        </option>

                        <option value="CASH">
                            Cash
                        </option>

                        <option value="CARD">
                            Card
                        </option>

                        <option value="QR">
                            QR
                        </option>

                        <option value="BANK_TRANSFER">
                            Bank Transfer
                        </option>

                        <option value="OTHER">
                            Other
                        </option>
                    </select>
                </label>

                {
                    activeTab
                        === "purchases"
                        ? (
                            <label>
                                <span>
                                    Supplier ID
                                </span>

                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Optional"
                                    value={
                                        draftFilters
                                            .supplierId
                                    }
                                    onChange={
                                        (
                                            event,
                                        ) =>
                                            setDraftFilters(
                                                (
                                                    current,
                                                ) => ({
                                                    ...current,
                                                    supplierId:
                                                        event
                                                            .target
                                                            .value,
                                                }),
                                            )
                                    }
                                />
                            </label>
                        )
                        : null
                }

                {
                    activeTab
                        === "inventory"
                        ? (
                            <label>
                                <span>
                                    Ingredient ID
                                </span>

                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Optional"
                                    value={
                                        draftFilters
                                            .ingredientId
                                    }
                                    onChange={
                                        (
                                            event,
                                        ) =>
                                            setDraftFilters(
                                                (
                                                    current,
                                                ) => ({
                                                    ...current,
                                                    ingredientId:
                                                        event
                                                            .target
                                                            .value,
                                                }),
                                            )
                                    }
                                />
                            </label>
                        )
                        : null
                }

                {
                    activeTab
                        === "cashier"
                        ? (
                            <label>
                                <span>
                                    Cashier Shift ID
                                </span>

                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Optional"
                                    value={
                                        draftFilters
                                            .cashierShiftId
                                    }
                                    onChange={
                                        (
                                            event,
                                        ) =>
                                            setDraftFilters(
                                                (
                                                    current,
                                                ) => ({
                                                    ...current,
                                                    cashierShiftId:
                                                        event
                                                            .target
                                                            .value,
                                                }),
                                            )
                                    }
                                />
                            </label>
                        )
                        : null
                }

                {
                    activeTab
                        === "expenses"
                        ? (
                            <label>
                                <span>
                                    Expense Category ID
                                </span>

                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Optional"
                                    value={
                                        draftFilters
                                            .expenseCategoryId
                                    }
                                    onChange={
                                        (
                                            event,
                                        ) =>
                                            setDraftFilters(
                                                (
                                                    current,
                                                ) => ({
                                                    ...current,
                                                    expenseCategoryId:
                                                        event
                                                            .target
                                                            .value,
                                                }),
                                            )
                                    }
                                />
                            </label>
                        )
                        : null
                }

                <div
                    className="reports-filter-actions"
                >
                    <button
                        type="submit"
                        className="primary"
                    >
                        Apply
                    </button>

                    <button
                        type="button"
                        className="secondary"
                        onClick={
                            resetFilters
                        }
                    >
                        Reset
                    </button>
                </div>
            </form>

            <div
                className="reports-scope"
            >
                <div>
                    <span>
                        Report Period
                    </span>

                    <strong>
                        {
                            scope.dateFrom
                        }
                        {" → "}
                        {
                            scope.dateTo
                        }
                    </strong>
                </div>

                {
                    scope.generatedAt
                        ? (
                            <div>
                                <span>
                                    Generated
                                </span>

                                <strong>
                                    {
                                        dateTime(
                                            scope
                                                .generatedAt,
                                        )
                                    }
                                </strong>
                            </div>
                        )
                        : null
                }
            </div>

            <nav
                className="reports-tabs"
                aria-label="Report sections"
            >
                {
                    visibleTabs.map(
                        (
                            tab,
                        ) => (
                            <button
                                key={
                                    tab.id
                                }
                                type="button"
                                className={
                                    activeTab
                                        === tab.id
                                        ? "active"
                                        : ""
                                }
                                onClick={
                                    () =>
                                        setActiveTab(
                                            tab.id,
                                        )
                                }
                            >
                                {
                                    tab.label
                                }
                            </button>
                        ),
                    )
                }
            </nav>

            <div
                className="reports-content"
            >
                {
                    loading
                        ? (
                            <div
                                className="reports-loading"
                            >
                                <div
                                    className="reports-spinner"
                                />

                                <strong>
                                    Loading report...
                                </strong>
                            </div>
                        )
                        : renderActiveReport()
                }
            </div>
        </section>
    );
}