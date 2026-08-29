import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import {
    useStaffRealtimeRefresh,
} from '../realtime/realtimeBus';

import {
    cancelOrder,
    completeOrder,
    confirmOrder,
    getOrder,
    getOrders,
    rejectOrder,
    sendOrderToKitchen,
    serveOrder,
} from "./orderService";

import type {
    Order,
    OrderActions,
    OrderSource,
    OrderStatus,
    OrderType,
} from "./types";

import "./OrdersPage.css";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const ORDER_STATUSES: Array<{
    value: OrderStatus | "";
    label: string;
}> = [
        {
            value: "",
            label: "All Orders",
        },
        {
            value: "PENDING",
            label: "Pending",
        },
        {
            value: "CONFIRMED",
            label: "Confirmed",
        },
        {
            value: "SENT_TO_KITCHEN",
            label: "Sent to Kitchen",
        },
        {
            value: "SERVED",
            label: "Served",
        },
        {
            value: "COMPLETED",
            label: "Completed",
        },
        {
            value: "CANCELLED",
            label: "Cancelled",
        },
        {
            value: "REJECTED",
            label: "Rejected",
        },
    ];

interface FilterState {
    search: string;
    orderType: OrderType | "";
    orderSource: OrderSource | "";
    tableId: string;
}

const EMPTY_FILTERS: FilterState = {
    search: "",
    orderType: "",
    orderSource: "",
    tableId: "",
};

type ActionType =
    | "CONFIRM"
    | "REJECT"
    | "SEND_TO_KITCHEN"
    | "SERVE"
    | "COMPLETE"
    | "CANCEL";

interface PendingAction {
    type: ActionType;
    order: Order;
}

/*
|--------------------------------------------------------------------------
| Formatters
|--------------------------------------------------------------------------
*/

const moneyFormatter =
    new Intl.NumberFormat(
        "en-LK",
        {
            style: "currency",
            currency: "LKR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        },
    );

const dateTimeFormatter =
    new Intl.DateTimeFormat(
        "en-LK",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Colombo",
        },
    );

function formatMoney(
    value: number,
): string {
    return moneyFormatter.format(
        value,
    );
}

function formatDateTime(
    value: string | null,
): string {
    if (!value) {
        return "—";
    }

    const date =
        new Date(
            value,
        );

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return value;
    }

    return dateTimeFormatter.format(
        date,
    );
}

function statusLabel(
    status: string,
): string {
    return status
        .replaceAll(
            "_",
            " ",
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            (value) =>
                value.toUpperCase(),
        );
}

function sourceLabel(
    source: OrderSource,
): string {
    switch (source) {
        case "QR_CUSTOMER":
            return "QR Customer";

        case "WAITER":
            return "Waiter";

        case "CASHIER":
            return "Cashier";

        default:
            return source;
    }
}

function typeLabel(
    type: OrderType,
): string {
    return type === "DINE_IN"
        ? "Dine In"
        : "Takeaway";
}

function actorLabel(
    userId: number | null,
): string {
    if (userId === null) {
        return "System / Customer";
    }

    return `User #${userId}`;
}

function errorMessage(
    error: unknown,
): string {
    if (
        error instanceof Error
        &&
        error.message
    ) {
        return error.message;
    }

    return "The order operation could not be completed.";
}

function statusClass(
    status: string,
): string {
    const normalized =
        status
            .toLowerCase()
            .replaceAll(
                "_",
                "-",
            );

    return `orders-status orders-status-${normalized}`;
}

function itemCount(
    order: Order,
): number {
    return order.items.reduce(
        (
            total,
            item,
        ) =>
            total
            +
            Number(
                item.quantity,
            ),
        0,
    );
}

function kitchenStatus(
    order: Order,
): string {
    if (
        order.status === "PENDING"
        ||
        order.status === "CONFIRMED"
    ) {
        return "Not Sent";
    }

    if (
        order.pending_kitchen_item_count
        > 0
    ) {
        return `${order.pending_kitchen_item_count} Pending`;
    }

    if (
        order.sent_to_kitchen_at
    ) {
        return "Sent";
    }

    return "—";
}

function hasActions(
    actions: OrderActions,
): boolean {
    return (
        actions.can_confirm
        ||
        actions.can_reject
        ||
        actions.can_send_to_kitchen
        ||
        actions.can_serve
        ||
        actions.can_complete
        ||
        actions.can_cancel
    );
}

function actionTitle(
    type: ActionType,
): string {
    switch (type) {
        case "CONFIRM":
            return "Confirm Order";

        case "REJECT":
            return "Reject Order";

        case "SEND_TO_KITCHEN":
            return "Send to Kitchen";

        case "SERVE":
            return "Mark as Served";

        case "COMPLETE":
            return "Complete Order";

        case "CANCEL":
            return "Cancel Order";
    }
}

/*
|--------------------------------------------------------------------------
| Safe Select Parsers
|--------------------------------------------------------------------------
|
| These functions avoid TypeScript `as` expressions inside JSX handlers.
| This also ensures only valid backend enum values enter filter state.
|
*/

function parseOrderType(
    value: string,
): OrderType | "" {
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
): OrderSource | "" {
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

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function OrdersPage() {
    /*
    |--------------------------------------------------------------------------
    | Orders
    |--------------------------------------------------------------------------
    */

    const [
        orders,
        setOrders,
    ] =
        useState<Order[]>(
            [],
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
        message,
        setMessage,
    ] =
        useState<string | null>(
            null,
        );

    /*
    |--------------------------------------------------------------------------
    | Status / Filters
    |--------------------------------------------------------------------------
    */

    const [
        status,
        setStatus,
    ] =
        useState<OrderStatus | "">(
            "",
        );

    const [
        filterDraft,
        setFilterDraft,
    ] =
        useState<FilterState>({
            ...EMPTY_FILTERS,
        });

    const [
        filters,
        setFilters,
    ] =
        useState<FilterState>({
            ...EMPTY_FILTERS,
        });

    const [
        page,
        setPage,
    ] =
        useState(
            1,
        );

    const [
        perPage,
        setPerPage,
    ] =
        useState(
            30,
        );

    const [
        pagination,
        setPagination,
    ] =
        useState({
            current_page: 1,
            per_page: 30,
            total: 0,
            last_page: 1,
        });

    /*
    |--------------------------------------------------------------------------
    | Details
    |--------------------------------------------------------------------------
    */

    const [
        selectedOrder,
        setSelectedOrder,
    ] =
        useState<Order | null>(
            null,
        );

    const [
        detailLoading,
        setDetailLoading,
    ] =
        useState(
            false,
        );

    /*
    |--------------------------------------------------------------------------
    | Lifecycle Action
    |--------------------------------------------------------------------------
    */

    const [
        pendingAction,
        setPendingAction,
    ] =
        useState<PendingAction | null>(
            null,
        );

    const [
        actionText,
        setActionText,
    ] =
        useState(
            "",
        );

    const [
        managerLogin,
        setManagerLogin,
    ] =
        useState(
            "",
        );

    const [
        managerPassword,
        setManagerPassword,
    ] =
        useState(
            "",
        );

    const [
        actionLoading,
        setActionLoading,
    ] =
        useState(
            false,
        );

    /*
    |--------------------------------------------------------------------------
    | Load Orders
    |--------------------------------------------------------------------------
    */

    const loadOrders =
        useCallback(
            async (
                showRefreshing = false,
                silent = false,
            ): Promise<void> => {
                /*
                 * Initial and manual refreshes may show UI feedback.
                 *
                 * Realtime reconciliation uses silent=true so the
                 * current table remains visible while Laravel is
                 * queried for the authoritative state.
                 */
                if (
                    !silent
                ) {
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
                }

                setError(
                    null,
                );

                try {
                    const rawTableId =
                        filters.tableId.trim();

                    const parsedTableId =
                        rawTableId !== ""
                            ? Number(
                                rawTableId,
                            )
                            : null;

                    const result =
                        await getOrders({
                            page,
                            perPage,

                            search:
                                filters.search,

                            status,

                            orderType:
                                filters.orderType,

                            orderSource:
                                filters.orderSource,

                            tableId:
                                parsedTableId !== null
                                    &&
                                    Number.isFinite(
                                        parsedTableId,
                                    )
                                    ? parsedTableId
                                    : null,
                        });

                    setOrders(
                        result.orders,
                    );

                    setPagination(
                        result.pagination,
                    );
                } catch (
                exception
                ) {
                    setError(
                        errorMessage(
                            exception,
                        ),
                    );
                } finally {
                    if (
                        !silent
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
                filters,
                page,
                perPage,
                status,
            ],
        );

    useEffect(
        () => {
            const frameId =
                window.requestAnimationFrame(
                    () => {
                        void loadOrders();
                    },
                );

            return () => {
                window.cancelAnimationFrame(
                    frameId,
                );
            };
        },
        [
            loadOrders,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Page Total
    |--------------------------------------------------------------------------
    */

    const totalOnPage =
        useMemo(
            () =>
                orders.reduce(
                    (
                        total,
                        order,
                    ) =>
                        total
                        +
                        order
                            .totals
                            .grand_total,
                    0,
                ),
            [
                orders,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

    function submitFilters(
        event: FormEvent<HTMLFormElement>,
    ): void {
        event.preventDefault();

        setPage(
            1,
        );

        setFilters({
            ...filterDraft,
        });
    }

    function clearFilters():
        void {
        setFilterDraft({
            ...EMPTY_FILTERS,
        });

        setFilters({
            ...EMPTY_FILTERS,
        });

        setStatus(
            "",
        );

        setPage(
            1,
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Open Order
    |--------------------------------------------------------------------------
    */

    async function openOrder(
        orderId: number,
    ): Promise<void> {
        setDetailLoading(
            true,
        );

        setError(
            null,
        );

        try {
            const order =
                await getOrder(
                    orderId,
                );

            setSelectedOrder(
                order,
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setDetailLoading(
                false,
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Open Action
    |--------------------------------------------------------------------------
    */

    function openAction(
        order: Order,
        type: ActionType,
    ): void {
        setPendingAction({
            order,
            type,
        });

        setActionText(
            "",
        );

        setManagerLogin(
            "",
        );

        setManagerPassword(
            "",
        );

        setError(
            null,
        );

        setMessage(
            null,
        );
    }

    function closeAction():
        void {
        if (actionLoading) {
            return;
        }

        setPendingAction(
            null,
        );

        setActionText(
            "",
        );

        setManagerLogin(
            "",
        );

        setManagerPassword(
            "",
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Submit Lifecycle Action
    |--------------------------------------------------------------------------
    */

    async function submitAction(
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        if (
            !pendingAction
            ||
            actionLoading
        ) {
            return;
        }

        const text =
            actionText.trim();

        if (
            pendingAction.type === "REJECT"
            &&
            text === ""
        ) {
            setError(
                "Enter a rejection reason.",
            );

            return;
        }

        if (
            pendingAction.type === "CANCEL"
            &&
            text === ""
        ) {
            setError(
                "Enter a cancellation reason.",
            );

            return;
        }

        setActionLoading(
            true,
        );

        setError(
            null,
        );

        setMessage(
            null,
        );

        try {
            let updated: Order;

            switch (
            pendingAction.type
            ) {
                case "CONFIRM":
                    updated =
                        await confirmOrder(
                            pendingAction
                                .order
                                .id,
                            {
                                notes:
                                    text
                                    || null,
                            },
                        );

                    break;

                case "REJECT":
                    updated =
                        await rejectOrder(
                            pendingAction
                                .order
                                .id,
                            {
                                reason:
                                    text,
                            },
                        );

                    break;

                case "SEND_TO_KITCHEN":
                    updated =
                        await sendOrderToKitchen(
                            pendingAction
                                .order
                                .id,
                            {
                                notes:
                                    text
                                    || null,
                            },
                        );

                    break;

                case "SERVE":
                    updated =
                        await serveOrder(
                            pendingAction
                                .order
                                .id,
                            {
                                notes:
                                    text
                                    || null,
                            },
                        );

                    break;

                case "COMPLETE":
                    updated =
                        await completeOrder(
                            pendingAction
                                .order
                                .id,
                            {
                                notes:
                                    text
                                    || null,
                            },
                        );

                    break;

                case "CANCEL":
                    updated =
                        await cancelOrder(
                            pendingAction
                                .order
                                .id,
                            {
                                reason:
                                    text,

                                ...(
                                    managerLogin
                                        .trim()
                                        !== ""
                                        ? {
                                            manager_login:
                                                managerLogin
                                                    .trim(),
                                        }
                                        : {}
                                ),

                                ...(
                                    managerPassword
                                        !== ""
                                        ? {
                                            manager_password:
                                                managerPassword,
                                        }
                                        : {}
                                ),
                            },
                        );

                    break;
            }

            setSelectedOrder(
                updated,
            );

            setPendingAction(
                null,
            );

            setActionText(
                "",
            );

            setManagerLogin(
                "",
            );

            setManagerPassword(
                "",
            );

            setMessage(
                `${updated.order_number} updated successfully.`,
            );

            await loadOrders(
                true,
            );

            const refreshedOrder =
                await getOrder(
                    updated.id,
                );

            setSelectedOrder(
                refreshedOrder,
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setActionLoading(
                false,
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | Reverb is an invalidation signal only.
    |
    | Laravel REST remains authoritative.
    |
    | Realtime changes silently reload:
    |
    | - the currently filtered order list
    | - pagination totals
    | - an open order-details modal
    | - an open lifecycle-action modal
    |
    | No manual refresh is required.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            'orders',
            'tables',
            'billing',
        ],
        async () => {
            /*
            |--------------------------------------------------------------------------
            | Refresh Current Order List
            |--------------------------------------------------------------------------
            |
            | Preserve the current filters, status tab, page and rows-per-page.
            | The refresh is silent so the table does not flash a loading state.
            |--------------------------------------------------------------------------
            */

            await loadOrders(
                false,
                true,
            );

            /*
            |--------------------------------------------------------------------------
            | Refresh Open Order Detail
            |--------------------------------------------------------------------------
            */

            if (
                !selectedOrder
            ) {
                return;
            }

            try {
                const refreshedOrder =
                    await getOrder(
                        selectedOrder.id,
                    );

                /*
                 * Race protection:
                 *
                 * - do not reopen a modal the user already closed
                 * - do not overwrite another order opened while this
                 *   REST request was still running
                 */
                setSelectedOrder(
                    (
                        current,
                    ) => {
                        if (
                            !current
                            ||
                            current.id
                            !==
                            refreshedOrder.id
                        ) {
                            return current;
                        }

                        return refreshedOrder;
                    },
                );

                /*
                 * If an action dialog is open for this order, keep its
                 * order snapshot synchronized as well.
                 */
                setPendingAction(
                    (
                        current,
                    ) => {
                        if (
                            !current
                            ||
                            current.order.id
                            !==
                            refreshedOrder.id
                        ) {
                            return current;
                        }

                        return {
                            ...current,

                            order:
                                refreshedOrder,
                        };
                    },
                );
            } catch (
            exception
            ) {
                /*
                 * A realtime reconciliation problem must not break the
                 * Operations page. The next event, reconnect, or manual
                 * refresh can reconcile the state again.
                 */
                console.error(
                    'Unable to reconcile realtime order details.',
                    exception,
                );
            }
        },
    );

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <section
            id="orders-page"
        >
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

            <header
                className="orders-page-header"
            >
                <div>
                    <span
                        className="orders-eyebrow"
                    >
                        RESTAURANT OPERATIONS
                    </span>

                    <h1>
                        Orders Management
                    </h1>

                    <p>
                        Review dine-in and takeaway
                        orders, monitor kitchen progress
                        and inspect complete order
                        histories.
                    </p>
                </div>

                <button
                    type="button"
                    className="orders-refresh-button"
                    disabled={
                        refreshing
                    }
                    onClick={
                        () => {
                            void loadOrders(
                                true,
                            );
                        }
                    }
                >
                    <span>
                        ↻
                    </span>

                    {
                        refreshing
                            ? "Refreshing..."
                            : "Refresh"
                    }
                </button>
            </header>

            {/*
            |--------------------------------------------------------------------------
            | Error
            |--------------------------------------------------------------------------
            */}

            {
                error
                    ? (
                        <div
                            className="orders-alert error"
                        >
                            <strong>
                                !
                            </strong>

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
                                aria-label="Close error"
                            >
                                ×
                            </button>
                        </div>
                    )
                    : null
            }

            {/*
            |--------------------------------------------------------------------------
            | Success
            |--------------------------------------------------------------------------
            */}

            {
                message
                    ? (
                        <div
                            className="orders-alert success"
                        >
                            <strong>
                                ✓
                            </strong>

                            <span>
                                {message}
                            </span>

                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setMessage(
                                            null,
                                        )
                                }
                                aria-label="Close message"
                            >
                                ×
                            </button>
                        </div>
                    )
                    : null
            }

            {/*
            |--------------------------------------------------------------------------
            | Status Tabs
            |--------------------------------------------------------------------------
            */}

            <div
                className="orders-status-tabs"
            >
                {
                    ORDER_STATUSES.map(
                        (
                            option,
                        ) => (
                            <button
                                type="button"
                                key={
                                    option.value
                                    || "ALL"
                                }
                                className={
                                    status
                                        === option.value
                                        ? "active"
                                        : ""
                                }
                                onClick={
                                    () => {
                                        setStatus(
                                            option.value,
                                        );

                                        setPage(
                                            1,
                                        );
                                    }
                                }
                            >
                                {
                                    option.label
                                }
                            </button>
                        ),
                    )
                }
            </div>

            {/*
            |--------------------------------------------------------------------------
            | Filters
            |--------------------------------------------------------------------------
            */}

            <form
                className="orders-filter-card"
                onSubmit={
                    submitFilters
                }
            >
                <div
                    className="orders-search-field"
                >
                    <label
                        htmlFor="orders-search"
                    >
                        Search
                    </label>

                    <input
                        id="orders-search"
                        type="search"
                        value={
                            filterDraft.search
                        }
                        placeholder="Order number, table, customer or phone..."
                        onChange={
                            (
                                event,
                            ) =>
                                setFilterDraft(
                                    (
                                        current,
                                    ) => ({
                                        ...current,

                                        search:
                                            event
                                                .target
                                                .value,
                                    }),
                                )
                        }
                    />
                </div>

                {/*
                |--------------------------------------------------------------------------
                | Order Type
                |--------------------------------------------------------------------------
                */}

                <label>
                    <span>
                        Order Type
                    </span>

                    <select
                        value={
                            filterDraft
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

                                setFilterDraft(
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

                {/*
                |--------------------------------------------------------------------------
                | Source
                |--------------------------------------------------------------------------
                */}

                <label>
                    <span>
                        Source
                    </span>

                    <select
                        value={
                            filterDraft
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

                                setFilterDraft(
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

                {/*
                |--------------------------------------------------------------------------
                | Table
                |--------------------------------------------------------------------------
                */}

                <label>
                    <span>
                        Table ID
                    </span>

                    <input
                        type="number"
                        min="1"
                        value={
                            filterDraft
                                .tableId
                        }
                        placeholder="All"
                        onChange={
                            (
                                event,
                            ) =>
                                setFilterDraft(
                                    (
                                        current,
                                    ) => ({
                                        ...current,

                                        tableId:
                                            event
                                                .target
                                                .value,
                                    }),
                                )
                        }
                    />
                </label>

                <div
                    className="orders-filter-actions"
                >
                    <button
                        type="submit"
                        className="primary"
                    >
                        Apply Filters
                    </button>

                    <button
                        type="button"
                        className="secondary"
                        onClick={
                            clearFilters
                        }
                    >
                        Clear
                    </button>
                </div>
            </form>

            {/*
            |--------------------------------------------------------------------------
            | Summary
            |--------------------------------------------------------------------------
            */}

            <div
                className="orders-result-summary"
            >
                <div>
                    <strong>
                        {
                            pagination.total
                        }
                    </strong>

                    <span>
                        Matching Orders
                    </span>
                </div>

                <div>
                    <strong>
                        {
                            orders.length
                        }
                    </strong>

                    <span>
                        On This Page
                    </span>
                </div>

                <div>
                    <strong>
                        {
                            formatMoney(
                                totalOnPage,
                            )
                        }
                    </strong>

                    <span>
                        Page Order Value
                    </span>
                </div>
            </div>

            {/*
            |--------------------------------------------------------------------------
            | Orders Table
            |--------------------------------------------------------------------------
            */}

            <div
                className="orders-table-card"
            >
                {
                    loading
                        ? (
                            <div
                                className="orders-loading"
                            >
                                <div
                                    className="orders-spinner"
                                />

                                <strong>
                                    Loading orders...
                                </strong>
                            </div>
                        )
                        : orders.length
                            === 0
                            ? (
                                <div
                                    className="orders-empty"
                                >
                                    <div>
                                        O
                                    </div>

                                    <h2>
                                        No orders found
                                    </h2>

                                    <p>
                                        Try changing the
                                        selected status or
                                        filters.
                                    </p>
                                </div>
                            )
                            : (
                                <div
                                    className="orders-table-scroll"
                                >
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>
                                                    Order
                                                </th>

                                                <th>
                                                    Date / Time
                                                </th>

                                                <th>
                                                    Type
                                                </th>

                                                <th>
                                                    Table / Token
                                                </th>

                                                <th>
                                                    Customer
                                                </th>

                                                <th>
                                                    Source
                                                </th>

                                                <th>
                                                    Items
                                                </th>

                                                <th>
                                                    Kitchen
                                                </th>

                                                <th>
                                                    Status
                                                </th>

                                                <th>
                                                    Total
                                                </th>

                                                <th>
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {
                                                orders.map(
                                                    (
                                                        order,
                                                    ) => (
                                                        <tr
                                                            key={
                                                                order.id
                                                            }
                                                        >
                                                            <td>
                                                                <strong
                                                                    className="orders-number"
                                                                >
                                                                    {
                                                                        order
                                                                            .order_number
                                                                    }
                                                                </strong>

                                                                {
                                                                    order
                                                                        .session_sequence
                                                                        !== null
                                                                        ? (
                                                                            <small>
                                                                                Session #
                                                                                {
                                                                                    order
                                                                                        .session_sequence
                                                                                }
                                                                            </small>
                                                                        )
                                                                        : null
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    formatDateTime(
                                                                        order
                                                                            .created_at,
                                                                    )
                                                                }
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={
                                                                        order
                                                                            .order_type
                                                                            === "DINE_IN"
                                                                            ? "orders-type dine-in"
                                                                            : "orders-type takeaway"
                                                                    }
                                                                >
                                                                    {
                                                                        typeLabel(
                                                                            order
                                                                                .order_type,
                                                                        )
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                {
                                                                    order
                                                                        .order_type
                                                                        === "DINE_IN"
                                                                        ? (
                                                                            <>
                                                                                <strong>
                                                                                    {
                                                                                        order
                                                                                            .table_name
                                                                                        ?? "Table"
                                                                                    }
                                                                                </strong>

                                                                                {
                                                                                    order
                                                                                        .table_id
                                                                                        !== null
                                                                                        ? (
                                                                                            <small>
                                                                                                ID #
                                                                                                {
                                                                                                    order
                                                                                                        .table_id
                                                                                                }
                                                                                            </small>
                                                                                        )
                                                                                        : null
                                                                                }
                                                                            </>
                                                                        )
                                                                        : (
                                                                            <>
                                                                                <strong>
                                                                                    Takeaway
                                                                                </strong>

                                                                                {
                                                                                    order
                                                                                        .takeaway_token
                                                                                        ? (
                                                                                            <small>
                                                                                                Token{" "}
                                                                                                {
                                                                                                    order
                                                                                                        .takeaway_token
                                                                                                }
                                                                                            </small>
                                                                                        )
                                                                                        : null
                                                                                }
                                                                            </>
                                                                        )
                                                                }
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        order
                                                                            .customer
                                                                            .name
                                                                        ?? "Guest"
                                                                    }
                                                                </strong>

                                                                {
                                                                    order
                                                                        .customer
                                                                        .phone
                                                                        ? (
                                                                            <small>
                                                                                {
                                                                                    order
                                                                                        .customer
                                                                                        .phone
                                                                                }
                                                                            </small>
                                                                        )
                                                                        : null
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    sourceLabel(
                                                                        order
                                                                            .order_source,
                                                                    )
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    itemCount(
                                                                        order,
                                                                    )
                                                                }
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className="orders-kitchen-status"
                                                                >
                                                                    {
                                                                        kitchenStatus(
                                                                            order,
                                                                        )
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={
                                                                        statusClass(
                                                                            order
                                                                                .status,
                                                                        )
                                                                    }
                                                                >
                                                                    {
                                                                        statusLabel(
                                                                            order
                                                                                .status,
                                                                        )
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        formatMoney(
                                                                            order
                                                                                .totals
                                                                                .grand_total,
                                                                        )
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className="orders-view-button"
                                                                    disabled={
                                                                        detailLoading
                                                                    }
                                                                    onClick={
                                                                        () => {
                                                                            void openOrder(
                                                                                order.id,
                                                                            );
                                                                        }
                                                                    }
                                                                >
                                                                    View
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ),
                                                )
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            )
                }
            </div>

            {/*
            |--------------------------------------------------------------------------
            | Pagination
            |--------------------------------------------------------------------------
            */}

            <footer
                className="orders-pagination"
            >
                <div>
                    Page{" "}
                    <strong>
                        {
                            pagination
                                .current_page
                        }
                    </strong>
                    {" "}of{" "}
                    <strong>
                        {
                            pagination
                                .last_page
                        }
                    </strong>
                </div>

                <div
                    className="orders-pagination-controls"
                >
                    <label>
                        Rows

                        <select
                            value={
                                perPage
                            }
                            onChange={
                                (
                                    event,
                                ) => {
                                    setPerPage(
                                        Number(
                                            event
                                                .target
                                                .value,
                                        ),
                                    );

                                    setPage(
                                        1,
                                    );
                                }
                            }
                        >
                            <option value="10">
                                10
                            </option>

                            <option value="30">
                                30
                            </option>

                            <option value="50">
                                50
                            </option>

                            <option value="100">
                                100
                            </option>
                        </select>
                    </label>

                    <button
                        type="button"
                        disabled={
                            page <= 1
                            ||
                            loading
                        }
                        onClick={
                            () =>
                                setPage(
                                    (
                                        current,
                                    ) =>
                                        Math.max(
                                            1,
                                            current - 1,
                                        ),
                                )
                        }
                    >
                        Previous
                    </button>

                    <button
                        type="button"
                        disabled={
                            page
                            >=
                            pagination
                                .last_page
                            ||
                            loading
                        }
                        onClick={
                            () =>
                                setPage(
                                    (
                                        current,
                                    ) =>
                                        Math.min(
                                            pagination
                                                .last_page,
                                            current + 1,
                                        ),
                                )
                        }
                    >
                        Next
                    </button>
                </div>
            </footer>

            {/*
            |--------------------------------------------------------------------------
            | Order Details Modal
            |--------------------------------------------------------------------------
            */}

            {
                selectedOrder
                    ? (
                        <div
                            className="orders-modal-backdrop"
                            role="presentation"
                            onMouseDown={
                                (
                                    event,
                                ) => {
                                    if (
                                        event.target
                                        ===
                                        event.currentTarget
                                    ) {
                                        setSelectedOrder(
                                            null,
                                        );
                                    }
                                }
                            }
                        >
                            <section
                                className="orders-details-modal"
                                role="dialog"
                                aria-modal="true"
                                aria-label={
                                    `Order ${selectedOrder.order_number}`
                                }
                            >
                                <header
                                    className="orders-modal-header"
                                >
                                    <div>
                                        <span>
                                            ORDER DETAILS
                                        </span>

                                        <h2>
                                            {
                                                selectedOrder
                                                    .order_number
                                            }
                                        </h2>

                                        <p>
                                            {
                                                formatDateTime(
                                                    selectedOrder
                                                        .created_at,
                                                )
                                            }
                                        </p>
                                    </div>

                                    <div
                                        className="orders-modal-header-actions"
                                    >
                                        <span
                                            className={
                                                statusClass(
                                                    selectedOrder
                                                        .status,
                                                )
                                            }
                                        >
                                            {
                                                statusLabel(
                                                    selectedOrder
                                                        .status,
                                                )
                                            }
                                        </span>

                                        <button
                                            type="button"
                                            className="orders-modal-close"
                                            onClick={
                                                () =>
                                                    setSelectedOrder(
                                                        null,
                                                    )
                                            }
                                            aria-label="Close order details"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </header>

                                <div
                                    className="orders-modal-body"
                                >
                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Order Information
                                    |--------------------------------------------------------------------------
                                    */}

                                    <section
                                        className="orders-detail-section"
                                    >
                                        <h3>
                                            Order Information
                                        </h3>

                                        <div
                                            className="orders-info-grid"
                                        >
                                            <div>
                                                <span>
                                                    Type
                                                </span>

                                                <strong>
                                                    {
                                                        typeLabel(
                                                            selectedOrder
                                                                .order_type,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Source
                                                </span>

                                                <strong>
                                                    {
                                                        sourceLabel(
                                                            selectedOrder
                                                                .order_source,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Table / Takeaway
                                                </span>

                                                <strong>
                                                    {
                                                        selectedOrder
                                                            .order_type
                                                            === "DINE_IN"
                                                            ? (
                                                                selectedOrder
                                                                    .table_name
                                                                ?? "Table"
                                                            )
                                                            : (
                                                                selectedOrder
                                                                    .takeaway_token
                                                                    ? `Takeaway ${selectedOrder.takeaway_token}`
                                                                    : "Takeaway"
                                                            )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Table Session
                                                </span>

                                                <strong>
                                                    {
                                                        selectedOrder
                                                            .table_session_id
                                                            !== null
                                                            ? `#${selectedOrder.table_session_id}`
                                                            : "—"
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Business Day
                                                </span>

                                                <strong>
                                                    {
                                                        selectedOrder
                                                            .business_day_id
                                                            !== null
                                                            ? `#${selectedOrder.business_day_id}`
                                                            : "—"
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Kitchen
                                                </span>

                                                <strong>
                                                    {
                                                        kitchenStatus(
                                                            selectedOrder,
                                                        )
                                                    }
                                                </strong>
                                            </div>
                                        </div>
                                    </section>

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Customer
                                    |--------------------------------------------------------------------------
                                    */}

                                    <section
                                        className="orders-detail-section"
                                    >
                                        <h3>
                                            Customer
                                        </h3>

                                        <div
                                            className="orders-info-grid"
                                        >
                                            <div>
                                                <span>
                                                    Name
                                                </span>

                                                <strong>
                                                    {
                                                        selectedOrder
                                                            .customer
                                                            .name
                                                        ?? "Guest"
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Phone
                                                </span>

                                                <strong>
                                                    {
                                                        selectedOrder
                                                            .customer
                                                            .phone
                                                        ?? "—"
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Created By
                                                </span>

                                                <strong>
                                                    {
                                                        actorLabel(
                                                            selectedOrder
                                                                .created_by,
                                                        )
                                                    }
                                                </strong>
                                            </div>
                                        </div>

                                        {
                                            selectedOrder
                                                .customer_notes
                                                ? (
                                                    <div
                                                        className="orders-note-box"
                                                    >
                                                        <strong>
                                                            Customer Notes
                                                        </strong>

                                                        <p>
                                                            {
                                                                selectedOrder
                                                                    .customer_notes
                                                            }
                                                        </p>
                                                    </div>
                                                )
                                                : null
                                        }

                                        {
                                            selectedOrder
                                                .internal_notes
                                                ? (
                                                    <div
                                                        className="orders-note-box internal"
                                                    >
                                                        <strong>
                                                            Internal Notes
                                                        </strong>

                                                        <p>
                                                            {
                                                                selectedOrder
                                                                    .internal_notes
                                                            }
                                                        </p>
                                                    </div>
                                                )
                                                : null
                                        }

                                        {
                                            selectedOrder
                                                .pickup_notes
                                                ? (
                                                    <div
                                                        className="orders-note-box"
                                                    >
                                                        <strong>
                                                            Pickup Notes
                                                        </strong>

                                                        <p>
                                                            {
                                                                selectedOrder
                                                                    .pickup_notes
                                                            }
                                                        </p>
                                                    </div>
                                                )
                                                : null
                                        }
                                    </section>

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Items
                                    |--------------------------------------------------------------------------
                                    */}

                                    <section
                                        className="orders-detail-section"
                                    >
                                        <div
                                            className="orders-section-heading"
                                        >
                                            <h3>
                                                Items
                                            </h3>

                                            <span>
                                                {
                                                    selectedOrder
                                                        .items
                                                        .length
                                                } lines
                                            </span>
                                        </div>

                                        <div
                                            className="orders-item-list"
                                        >
                                            {
                                                selectedOrder
                                                    .items
                                                    .map(
                                                        (
                                                            item,
                                                        ) => (
                                                            <article
                                                                key={
                                                                    item.id
                                                                }
                                                                className="orders-item-card"
                                                            >
                                                                <div
                                                                    className="orders-item-main"
                                                                >
                                                                    <div>
                                                                        <div
                                                                            className="orders-item-title"
                                                                        >
                                                                            <strong>
                                                                                {
                                                                                    item.quantity
                                                                                }
                                                                                {" × "}
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </strong>

                                                                            <span>
                                                                                {
                                                                                    item.status
                                                                                }
                                                                            </span>
                                                                        </div>

                                                                        {
                                                                            item.variant
                                                                                ? (
                                                                                    <p>
                                                                                        Variant:{" "}
                                                                                        <strong>
                                                                                            {
                                                                                                item.variant
                                                                                            }
                                                                                        </strong>
                                                                                    </p>
                                                                                )
                                                                                : null
                                                                        }

                                                                        {
                                                                            item
                                                                                .addons
                                                                                .length
                                                                                > 0
                                                                                ? (
                                                                                    <div
                                                                                        className="orders-addon-list"
                                                                                    >
                                                                                        {
                                                                                            item
                                                                                                .addons
                                                                                                .map(
                                                                                                    (
                                                                                                        addon,
                                                                                                    ) => (
                                                                                                        <span
                                                                                                            key={
                                                                                                                addon.id
                                                                                                            }
                                                                                                        >
                                                                                                            +{" "}
                                                                                                            {
                                                                                                                addon.name
                                                                                                            }

                                                                                                            {
                                                                                                                addon.quantity
                                                                                                                    > 1
                                                                                                                    ? ` ×${addon.quantity}`
                                                                                                                    : ""
                                                                                                            }

                                                                                                            {" — "}

                                                                                                            {
                                                                                                                formatMoney(
                                                                                                                    addon.line_total,
                                                                                                                )
                                                                                                            }
                                                                                                        </span>
                                                                                                    ),
                                                                                                )
                                                                                        }
                                                                                    </div>
                                                                                )
                                                                                : null
                                                                        }

                                                                        {
                                                                            item
                                                                                .special_notes
                                                                                ? (
                                                                                    <p
                                                                                        className="orders-item-note"
                                                                                    >
                                                                                        Note:{" "}
                                                                                        {
                                                                                            item
                                                                                                .special_notes
                                                                                        }
                                                                                    </p>
                                                                                )
                                                                                : null
                                                                        }

                                                                        <div
                                                                            className="orders-kitchen-line"
                                                                        >
                                                                            <span>
                                                                                Kitchen:
                                                                            </span>

                                                                            <strong>
                                                                                {
                                                                                    item
                                                                                        .sent_to_kitchen_at
                                                                                        ? `Sent ${formatDateTime(item.sent_to_kitchen_at)}`
                                                                                        : "Not sent"
                                                                                }
                                                                            </strong>
                                                                        </div>

                                                                        {
                                                                            item
                                                                                .cancelled_at
                                                                                ? (
                                                                                    <div
                                                                                        className="orders-cancelled-line"
                                                                                    >
                                                                                        Cancelled{" "}
                                                                                        {
                                                                                            formatDateTime(
                                                                                                item
                                                                                                    .cancelled_at,
                                                                                            )
                                                                                        }
                                                                                    </div>
                                                                                )
                                                                                : null
                                                                        }
                                                                    </div>

                                                                    <div
                                                                        className="orders-item-price"
                                                                    >
                                                                        <small>
                                                                            {
                                                                                formatMoney(
                                                                                    item
                                                                                        .unit_price,
                                                                                )
                                                                            } each
                                                                        </small>

                                                                        <strong>
                                                                            {
                                                                                formatMoney(
                                                                                    item
                                                                                        .line_total,
                                                                                )
                                                                            }
                                                                        </strong>
                                                                    </div>
                                                                </div>
                                                            </article>
                                                        ),
                                                    )
                                            }
                                        </div>
                                    </section>

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Cancellation
                                    |--------------------------------------------------------------------------
                                    */}

                                    {
                                        selectedOrder.status
                                            === "CANCELLED"
                                            ? (
                                                <section
                                                    className="orders-detail-section danger"
                                                >
                                                    <h3>
                                                        Cancellation
                                                    </h3>

                                                    <div
                                                        className="orders-info-grid"
                                                    >
                                                        <div>
                                                            <span>
                                                                Reason
                                                            </span>

                                                            <strong>
                                                                {
                                                                    selectedOrder
                                                                        .cancellation_reason
                                                                    ?? "—"
                                                                }
                                                            </strong>
                                                        </div>

                                                        <div>
                                                            <span>
                                                                Cancelled By
                                                            </span>

                                                            <strong>
                                                                {
                                                                    actorLabel(
                                                                        selectedOrder
                                                                            .cancelled_by,
                                                                    )
                                                                }
                                                            </strong>
                                                        </div>

                                                        <div>
                                                            <span>
                                                                Cancelled At
                                                            </span>

                                                            <strong>
                                                                {
                                                                    formatDateTime(
                                                                        selectedOrder
                                                                            .cancelled_at,
                                                                    )
                                                                }
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </section>
                                            )
                                            : null
                                    }

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Rejection
                                    |--------------------------------------------------------------------------
                                    */}

                                    {
                                        selectedOrder.status
                                            === "REJECTED"
                                            ? (
                                                <section
                                                    className="orders-detail-section danger"
                                                >
                                                    <h3>
                                                        Rejection
                                                    </h3>

                                                    <div
                                                        className="orders-info-grid"
                                                    >
                                                        <div>
                                                            <span>
                                                                Reason
                                                            </span>

                                                            <strong>
                                                                {
                                                                    selectedOrder
                                                                        .rejection_reason
                                                                    ?? "—"
                                                                }
                                                            </strong>
                                                        </div>

                                                        <div>
                                                            <span>
                                                                Rejected By
                                                            </span>

                                                            <strong>
                                                                {
                                                                    actorLabel(
                                                                        selectedOrder
                                                                            .rejected_by,
                                                                    )
                                                                }
                                                            </strong>
                                                        </div>

                                                        <div>
                                                            <span>
                                                                Rejected At
                                                            </span>

                                                            <strong>
                                                                {
                                                                    formatDateTime(
                                                                        selectedOrder
                                                                            .rejected_at,
                                                                    )
                                                                }
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </section>
                                            )
                                            : null
                                    }

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Lifecycle Times
                                    |--------------------------------------------------------------------------
                                    */}

                                    <section
                                        className="orders-detail-section"
                                    >
                                        <h3>
                                            Lifecycle Times
                                        </h3>

                                        <div
                                            className="orders-info-grid"
                                        >
                                            <div>
                                                <span>
                                                    Confirmed
                                                </span>

                                                <strong>
                                                    {
                                                        formatDateTime(
                                                            selectedOrder
                                                                .confirmed_at,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Sent to Kitchen
                                                </span>

                                                <strong>
                                                    {
                                                        formatDateTime(
                                                            selectedOrder
                                                                .sent_to_kitchen_at,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Served
                                                </span>

                                                <strong>
                                                    {
                                                        formatDateTime(
                                                            selectedOrder
                                                                .served_at,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Completed
                                                </span>

                                                <strong>
                                                    {
                                                        formatDateTime(
                                                            selectedOrder
                                                                .completed_at,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Confirmed By
                                                </span>

                                                <strong>
                                                    {
                                                        actorLabel(
                                                            selectedOrder
                                                                .confirmed_by,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Pending Kitchen Items
                                                </span>

                                                <strong>
                                                    {
                                                        selectedOrder
                                                            .pending_kitchen_item_count
                                                    }
                                                </strong>
                                            </div>
                                        </div>
                                    </section>

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Totals
                                    |--------------------------------------------------------------------------
                                    */}

                                    <section
                                        className="orders-detail-section"
                                    >
                                        <h3>
                                            Order Totals
                                        </h3>

                                        <div
                                            className="orders-total-card"
                                        >
                                            <div>
                                                <span>
                                                    Subtotal
                                                </span>

                                                <strong>
                                                    {
                                                        formatMoney(
                                                            selectedOrder
                                                                .totals
                                                                .subtotal,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Discount
                                                </span>

                                                <strong>
                                                    {
                                                        formatMoney(
                                                            selectedOrder
                                                                .totals
                                                                .discount,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Service Charge
                                                </span>

                                                <strong>
                                                    {
                                                        formatMoney(
                                                            selectedOrder
                                                                .totals
                                                                .service_charge,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Tax
                                                </span>

                                                <strong>
                                                    {
                                                        formatMoney(
                                                            selectedOrder
                                                                .totals
                                                                .tax,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            <div
                                                className="grand-total"
                                            >
                                                <span>
                                                    Grand Total
                                                </span>

                                                <strong>
                                                    {
                                                        formatMoney(
                                                            selectedOrder
                                                                .totals
                                                                .grand_total,
                                                        )
                                                    }
                                                </strong>
                                            </div>
                                        </div>
                                    </section>

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Status Timeline
                                    |--------------------------------------------------------------------------
                                    */}

                                    <section
                                        className="orders-detail-section"
                                    >
                                        <h3>
                                            Status Timeline
                                        </h3>

                                        {
                                            selectedOrder
                                                .status_history
                                                .length
                                                === 0
                                                ? (
                                                    <p
                                                        className="orders-empty-text"
                                                    >
                                                        No status history has
                                                        been recorded.
                                                    </p>
                                                )
                                                : (
                                                    <div
                                                        className="orders-timeline"
                                                    >
                                                        {
                                                            selectedOrder
                                                                .status_history
                                                                .map(
                                                                    (
                                                                        history,
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                history.id
                                                                            }
                                                                            className="orders-timeline-entry"
                                                                        >
                                                                            <span
                                                                                className="orders-timeline-dot"
                                                                            />

                                                                            <div>
                                                                                <div
                                                                                    className="orders-timeline-heading"
                                                                                >
                                                                                    <strong>
                                                                                        {
                                                                                            statusLabel(
                                                                                                history
                                                                                                    .to_status,
                                                                                            )
                                                                                        }
                                                                                    </strong>

                                                                                    <time>
                                                                                        {
                                                                                            formatDateTime(
                                                                                                history
                                                                                                    .changed_at,
                                                                                            )
                                                                                        }
                                                                                    </time>
                                                                                </div>

                                                                                <p>
                                                                                    {
                                                                                        history
                                                                                            .from_status
                                                                                            ? `${statusLabel(history.from_status)} → ${statusLabel(history.to_status)}`
                                                                                            : "Order created"
                                                                                    }
                                                                                </p>

                                                                                <small>
                                                                                    {
                                                                                        actorLabel(
                                                                                            history
                                                                                                .changed_by,
                                                                                        )
                                                                                    }
                                                                                </small>

                                                                                {
                                                                                    history
                                                                                        .notes
                                                                                        ? (
                                                                                            <blockquote>
                                                                                                {
                                                                                                    history
                                                                                                        .notes
                                                                                                }
                                                                                            </blockquote>
                                                                                        )
                                                                                        : null
                                                                                }
                                                                            </div>
                                                                        </div>
                                                                    ),
                                                                )
                                                        }
                                                    </div>
                                                )
                                        }
                                    </section>
                                </div>

                                {/*
                                |--------------------------------------------------------------------------
                                | Lifecycle Actions
                                |--------------------------------------------------------------------------
                                */}

                                {
                                    hasActions(
                                        selectedOrder.actions,
                                    )
                                        ? (
                                            <footer
                                                className="orders-modal-footer"
                                            >
                                                {
                                                    selectedOrder
                                                        .actions
                                                        .can_confirm
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="action-confirm"
                                                                onClick={
                                                                    () =>
                                                                        openAction(
                                                                            selectedOrder,
                                                                            "CONFIRM",
                                                                        )
                                                                }
                                                            >
                                                                Confirm
                                                            </button>
                                                        )
                                                        : null
                                                }

                                                {
                                                    selectedOrder
                                                        .actions
                                                        .can_reject
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="action-reject"
                                                                onClick={
                                                                    () =>
                                                                        openAction(
                                                                            selectedOrder,
                                                                            "REJECT",
                                                                        )
                                                                }
                                                            >
                                                                Reject
                                                            </button>
                                                        )
                                                        : null
                                                }

                                                {
                                                    selectedOrder
                                                        .actions
                                                        .can_send_to_kitchen
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="action-kitchen"
                                                                onClick={
                                                                    () =>
                                                                        openAction(
                                                                            selectedOrder,
                                                                            "SEND_TO_KITCHEN",
                                                                        )
                                                                }
                                                            >
                                                                Send to Kitchen
                                                            </button>
                                                        )
                                                        : null
                                                }

                                                {
                                                    selectedOrder
                                                        .actions
                                                        .can_serve
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="action-serve"
                                                                onClick={
                                                                    () =>
                                                                        openAction(
                                                                            selectedOrder,
                                                                            "SERVE",
                                                                        )
                                                                }
                                                            >
                                                                Mark Served
                                                            </button>
                                                        )
                                                        : null
                                                }

                                                {
                                                    selectedOrder
                                                        .actions
                                                        .can_complete
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="action-complete"
                                                                onClick={
                                                                    () =>
                                                                        openAction(
                                                                            selectedOrder,
                                                                            "COMPLETE",
                                                                        )
                                                                }
                                                            >
                                                                Complete
                                                            </button>
                                                        )
                                                        : null
                                                }

                                                {
                                                    selectedOrder
                                                        .actions
                                                        .can_cancel
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="action-cancel"
                                                                onClick={
                                                                    () =>
                                                                        openAction(
                                                                            selectedOrder,
                                                                            "CANCEL",
                                                                        )
                                                                }
                                                            >
                                                                Cancel Order
                                                            </button>
                                                        )
                                                        : null
                                                }
                                            </footer>
                                        )
                                        : null
                                }
                            </section>
                        </div>
                    )
                    : null
            }

            {/*
            |--------------------------------------------------------------------------
            | Action Modal
            |--------------------------------------------------------------------------
            */}

            {
                pendingAction
                    ? (
                        <div
                            className="orders-action-backdrop"
                            role="presentation"
                        >
                            <form
                                className="orders-action-modal"
                                onSubmit={
                                    (
                                        event,
                                    ) => {
                                        void submitAction(
                                            event,
                                        );
                                    }
                                }
                            >
                                <header>
                                    <div>
                                        <span>
                                            ORDER ACTION
                                        </span>

                                        <h2>
                                            {
                                                actionTitle(
                                                    pendingAction
                                                        .type,
                                                )
                                            }
                                        </h2>

                                        <p>
                                            {
                                                pendingAction
                                                    .order
                                                    .order_number
                                            }
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={
                                            actionLoading
                                        }
                                        onClick={
                                            closeAction
                                        }
                                        aria-label="Close action"
                                    >
                                        ×
                                    </button>
                                </header>

                                <div
                                    className="orders-action-body"
                                >
                                    {
                                        pendingAction.type
                                            === "CANCEL"
                                            ? (
                                                <div
                                                    className="orders-action-warning"
                                                >
                                                    Cancelling an order does
                                                    not automatically create
                                                    a financial refund or
                                                    restore consumed stock.
                                                </div>
                                            )
                                            : null
                                    }

                                    {
                                        pendingAction.type
                                            === "SEND_TO_KITCHEN"
                                            ? (
                                                <div
                                                    className="orders-action-info"
                                                >
                                                    The backend will apply
                                                    kitchen printing,
                                                    inventory consumption and
                                                    lifecycle rules.
                                                </div>
                                            )
                                            : null
                                    }

                                    {
                                        pendingAction.type
                                            === "COMPLETE"
                                            ? (
                                                <div
                                                    className="orders-action-info"
                                                >
                                                    The backend will only
                                                    complete the order when
                                                    its billing requirements
                                                    have been satisfied.
                                                </div>
                                            )
                                            : null
                                    }

                                    <label>
                                        <span>
                                            {
                                                pendingAction.type
                                                    === "REJECT"
                                                    ? "Rejection Reason"
                                                    : pendingAction.type
                                                        === "CANCEL"
                                                        ? "Cancellation Reason"
                                                        : "Notes"
                                            }

                                            {
                                                (
                                                    pendingAction.type
                                                    === "REJECT"
                                                    ||
                                                    pendingAction.type
                                                    === "CANCEL"
                                                )
                                                    ? " *"
                                                    : ""
                                            }
                                        </span>

                                        <textarea
                                            value={
                                                actionText
                                            }
                                            maxLength={
                                                2000
                                            }
                                            placeholder={
                                                pendingAction.type
                                                    === "REJECT"
                                                    ? "Why is this order being rejected?"
                                                    : pendingAction.type
                                                        === "CANCEL"
                                                        ? "Why is this order being cancelled?"
                                                        : "Optional notes..."
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    setActionText(
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                            }
                                        />
                                    </label>

                                    {
                                        pendingAction.type
                                            === "CANCEL"
                                            ? (
                                                <div
                                                    className="orders-manager-auth"
                                                >
                                                    <h3>
                                                        Manager Authorization
                                                    </h3>

                                                    <p>
                                                        Leave these fields
                                                        empty if the currently
                                                        signed-in user is
                                                        already authorized.
                                                        Otherwise provide
                                                        manager credentials if
                                                        required by the
                                                        backend.
                                                    </p>

                                                    <label>
                                                        <span>
                                                            Manager Login
                                                        </span>

                                                        <input
                                                            type="text"
                                                            autoComplete="username"
                                                            value={
                                                                managerLogin
                                                            }
                                                            onChange={
                                                                (
                                                                    event,
                                                                ) =>
                                                                    setManagerLogin(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                            }
                                                        />
                                                    </label>

                                                    <label>
                                                        <span>
                                                            Manager Password
                                                        </span>

                                                        <input
                                                            type="password"
                                                            autoComplete="current-password"
                                                            value={
                                                                managerPassword
                                                            }
                                                            onChange={
                                                                (
                                                                    event,
                                                                ) =>
                                                                    setManagerPassword(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                            }
                                                        />
                                                    </label>
                                                </div>
                                            )
                                            : null
                                    }
                                </div>

                                <footer>
                                    <button
                                        type="button"
                                        className="secondary"
                                        disabled={
                                            actionLoading
                                        }
                                        onClick={
                                            closeAction
                                        }
                                    >
                                        Back
                                    </button>

                                    <button
                                        type="submit"
                                        className={
                                            pendingAction.type
                                                === "CANCEL"
                                                ||
                                                pendingAction.type
                                                === "REJECT"
                                                ? "danger"
                                                : "primary"
                                        }
                                        disabled={
                                            actionLoading
                                        }
                                    >
                                        {
                                            actionLoading
                                                ? "Processing..."
                                                : actionTitle(
                                                    pendingAction
                                                        .type,
                                                )
                                        }
                                    </button>
                                </footer>
                            </form>
                        </div>
                    )
                    : null
            }
        </section>
    );
}