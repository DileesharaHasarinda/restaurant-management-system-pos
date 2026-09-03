import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
} from "react";

import {
    useStaffRealtimeRefresh,
} from "../realtime/realtimeBus";

import {
    getAuditLog,
    getAuditLogs,
} from "./auditService";

import type {
    AuditLog,
    AuditLogFilters,
    AuditPagination,
} from "./types";

import "./AuditLogsPage.css";

const EMPTY_FILTERS:
    AuditLogFilters = {
    search: "",
    action: "",
    entityType: "",
    dateFrom: "",
    dateTo: "",
};

const EMPTY_PAGINATION:
    AuditPagination = {
    currentPage: 1,
    perPage: 25,
    total: 0,
    lastPage: 1,
};

const IMPORTANT_ACTIONS = [
    {
        value: "AUTH_LOGIN_SUCCESS",
        label: "Login Success",
    },
    {
        value: "AUTH_LOGIN_FAILED",
        label: "Login Failed",
    },
    {
        value: "AUTH_LOGOUT",
        label: "Logout",
    },
    {
        value: "MENU_ITEM_UPDATED",
        label: "Menu Item / Price Updated",
    },
    {
        value: "ORDER_CANCELLED",
        label: "Order Cancelled",
    },
    {
        value: "ORDER_REJECTED",
        label: "Order Rejected",
    },
    {
        value: "DISCOUNT_APPLIED",
        label: "Discount Applied",
    },
    {
        value: "DISCOUNT_UPDATED",
        label: "Discount Updated",
    },
    {
        value: "DISCOUNT_REMOVED",
        label: "Discount Removed",
    },
    {
        value: "REFUND_COMPLETED",
        label: "Refund Completed",
    },
    {
        value: "PURCHASE_UPDATED",
        label: "Purchase Updated",
    },
    {
        value: "PURCHASE_CANCELLED",
        label: "Purchase Cancelled",
    },
    {
        value: "SUPPLIER_PAYMENT_RECORDED",
        label: "Supplier Payment",
    },
    {
        value: "PHYSICAL_STOCK_COUNT_RECORDED",
        label: "Stock Adjustment",
    },
    {
        value: "WASTAGE_RECORDED",
        label: "Wastage",
    },
    {
        value: "EXPENSE_CREATED",
        label: "Expense Created",
    },
    {
        value: "EXPENSE_UPDATED",
        label: "Expense Updated",
    },
    {
        value: "CASH_DRAWER_MANUAL_OPEN",
        label: "Cash Drawer Opened",
    },
    {
        value: "TABLE_TRANSFERRED",
        label: "Table Transferred",
    },
    {
        value: "TABLE_MERGED",
        label: "Tables Merged",
    },
    {
        value: "BUSINESS_DAY_CLOSED",
        label: "Business Day Closed",
    },
    {
        value: "USER_ROLE_CHANGED",
        label: "User Role Changed",
    },
    {
        value: "CASHIER_SHIFT_CLOSED",
        label: "Cashier Shift Closed",
    },
] as const;

const ENTITY_TYPES = [
    {
        value: "user",
        label: "Users",
    },
    {
        value: "menu_item",
        label: "Menu",
    },
    {
        value: "order",
        label: "Orders",
    },
    {
        value: "invoice",
        label: "Billing",
    },
    {
        value: "refund",
        label: "Refunds",
    },
    {
        value: "purchase",
        label: "Purchases",
    },
    {
        value: "supplier_payment_batch",
        label: "Supplier Payments",
    },
    {
        value: "stock_adjustment",
        label: "Stock Adjustments",
    },
    {
        value: "wastage",
        label: "Wastage",
    },
    {
        value: "expense",
        label: "Expenses",
    },
    {
        value: "cash_drawer_movement",
        label: "Cash Drawer",
    },
    {
        value: "table_session",
        label: "Tables",
    },
    {
        value: "business_day",
        label: "Business Day",
    },
] as const;

const REALTIME_DOMAINS = [
    "orders",
    "tables",
    "menu",
    "inventory",
    "recipes",
    "suppliers",
    "purchases",
    "supplier_payments",
    "wastage",
    "expenses",
    "billing",
    "cash",
    "business_day",
    "users",
    "settings",
    "website",
] as const;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object"
        &&
        value !== null
        &&
        !Array.isArray(value)
    );
}

function valueFrom(
    source: unknown,
    ...keys: string[]
): unknown {
    if (
        !isRecord(
            source,
        )
    ) {
        return undefined;
    }

    for (
        const key
        of keys
    ) {
        if (
            Object.prototype.hasOwnProperty.call(
                source,
                key,
            )
        ) {
            return source[key];
        }
    }

    return undefined;
}

function stringValue(
    value: unknown,
): string {
    if (
        typeof value === "string"
    ) {
        return value;
    }

    if (
        typeof value === "number"
        ||
        typeof value === "boolean"
    ) {
        return String(
            value,
        );
    }

    return "";
}

function numberValue(
    value: unknown,
): number | null {
    const result =
        Number(
            value,
        );

    return Number.isFinite(
        result,
    )
        ? result
        : null;
}

function formatAction(
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

function formatEntityType(
    value:
        | string
        | null,
): string {
    if (
        !value
    ) {
        return "System";
    }

    return formatAction(
        value,
    );
}

function formatDateTime(
    value:
        | string
        | null,
): string {
    if (
        !value
    ) {
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

    return new Intl.DateTimeFormat(
        "en-LK",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Colombo",
        },
    ).format(
        date,
    );
}

function formatMoney(
    value: unknown,
): string | null {
    const amount =
        numberValue(
            value,
        );

    if (
        amount === null
    ) {
        return null;
    }

    return `Rs. ${amount.toLocaleString(
        "en-LK",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        },
    )}`;
}

function hasPriceChange(
    log: AuditLog,
): boolean {
    const oldPrice =
        numberValue(
            valueFrom(
                log.old_values,
                "price",
            ),
        );

    const newPrice =
        numberValue(
            valueFrom(
                log.new_values,
                "price",
            ),
        );

    return (
        oldPrice !== null
        &&
        newPrice !== null
        &&
        oldPrice !== newPrice
    );
}

function hasDiscountChange(
    log: AuditLog,
): boolean {
    const oldDiscount =
        numberValue(
            valueFrom(
                log.old_values,
                "discount_total",
                "discount",
                "discount_amount",
            ),
        );

    const newDiscount =
        numberValue(
            valueFrom(
                log.new_values,
                "discount_total",
                "discount",
                "discount_amount",
            ),
        );

    return (
        oldDiscount !== null
        &&
        newDiscount !== null
        &&
        oldDiscount !== newDiscount
    );
}

function actionTitle(
    log: AuditLog,
): string {
    if (
        log.action === "MENU_ITEM_UPDATED"
        &&
        hasPriceChange(
            log,
        )
    ) {
        return "Menu Price Changed";
    }

    if (
        hasDiscountChange(
            log,
        )
    ) {
        return "Discount Changed";
    }

    return formatAction(
        log.action,
    );
}

function actionTone(
    log: AuditLog,
): string {
    if (
        log.action === "AUTH_LOGIN_FAILED"
        ||
        log.action === "ORDER_CANCELLED"
        ||
        log.action === "ORDER_REJECTED"
        ||
        log.action === "PURCHASE_CANCELLED"
    ) {
        return "danger";
    }

    if (
        log.action === "CASH_DRAWER_MANUAL_OPEN"
        ||
        log.action === "REFUND_COMPLETED"
        ||
        log.action === "PHYSICAL_STOCK_COUNT_RECORDED"
        ||
        log.action === "WASTAGE_RECORDED"
        ||
        hasPriceChange(
            log,
        )
        ||
        hasDiscountChange(
            log,
        )
    ) {
        return "warning";
    }

    if (
        log.action === "AUTH_LOGIN_SUCCESS"
        ||
        log.action === "BUSINESS_DAY_CLOSED"
        ||
        log.action === "SUPPLIER_PAYMENT_RECORDED"
    ) {
        return "success";
    }

    return "neutral";
}

function actorName(
    log: AuditLog,
): string {
    return (
        log.actor?.name
        ??
        (
            log.action.startsWith(
                "AUTH_LOGIN_FAILED",
            )
                ? "Unknown Login"
                : "System"
        )
    );
}

function auditSummary(
    log: AuditLog,
): string {
    if (
        hasPriceChange(
            log,
        )
    ) {
        const oldPrice =
            formatMoney(
                valueFrom(
                    log.old_values,
                    "price",
                ),
            );

        const newPrice =
            formatMoney(
                valueFrom(
                    log.new_values,
                    "price",
                ),
            );

        if (
            oldPrice
            &&
            newPrice
        ) {
            return `${oldPrice} → ${newPrice}`;
        }
    }

    if (
        hasDiscountChange(
            log,
        )
    ) {
        const before =
            formatMoney(
                valueFrom(
                    log.old_values,
                    "discount_total",
                    "discount",
                    "discount_amount",
                ),
            );

        const after =
            formatMoney(
                valueFrom(
                    log.new_values,
                    "discount_total",
                    "discount",
                    "discount_amount",
                ),
            );

        if (
            before
            &&
            after
        ) {
            return `Discount ${before} → ${after}`;
        }
    }

    if (
        log.action === "TABLE_TRANSFERRED"
    ) {
        const from =
            stringValue(
                valueFrom(
                    log.old_values,
                    "table_name",
                    "table_id",
                ),
            );

        const to =
            stringValue(
                valueFrom(
                    log.new_values,
                    "table_name",
                    "table_id",
                ),
            );

        if (
            from
            ||
            to
        ) {
            return `${from || "Previous Table"} → ${to || "New Table"}`;
        }
    }

    if (
        log.action === "CASH_DRAWER_MANUAL_OPEN"
    ) {
        const reason =
            stringValue(
                valueFrom(
                    log.new_values,
                    "reason",
                ),
            );

        if (
            reason
        ) {
            return `Reason: ${reason}`;
        }
    }

    if (
        log.action === "AUTH_LOGIN_FAILED"
    ) {
        const login =
            stringValue(
                valueFrom(
                    log.metadata,
                    "login",
                ),
            );

        if (
            login
        ) {
            return `Login: ${login}`;
        }
    }

    const number =
        valueFrom(
            log.new_values,
            "order_number",
            "purchase_number",
            "refund_number",
            "expense_number",
            "wastage_number",
            "adjustment_number",
            "batch_number",
            "invoice_number",
            "shift_number",
        );

    if (
        number !== undefined
    ) {
        return stringValue(
            number,
        );
    }

    if (
        log.entity_type
        &&
        log.entity_id !== null
    ) {
        return `${formatEntityType(
            log.entity_type,
        )} #${log.entity_id}`;
    }

    return formatEntityType(
        log.entity_type,
    );
}

function errorMessage(
    error: unknown,
): string {
    return error instanceof Error
        ? error.message
        : "Unable to load audit history.";
}

/*
|--------------------------------------------------------------------------
| Scroll Helpers
|--------------------------------------------------------------------------
*/

function findVerticalScrollContainer(
    element: HTMLElement | null,
): HTMLElement | null {
    let current =
        element;

    while (
        current
    ) {
        const style =
            window.getComputedStyle(
                current,
            );

        const overflowY =
            style.overflowY;

        const allowsScroll =
            overflowY === "auto"
            ||
            overflowY === "scroll"
            ||
            overflowY === "overlay";

        const hasScrollableContent =
            current.scrollHeight >
            current.clientHeight;

        if (
            allowsScroll
            &&
            hasScrollableContent
        ) {
            return current;
        }

        current =
            current.parentElement;
    }

    const scrollingElement =
        document.scrollingElement;

    if (
        scrollingElement
        instanceof HTMLElement
    ) {
        return scrollingElement;
    }

    return document.documentElement;
}

function normalizedWheelDelta(
    event: WheelEvent,
    container: HTMLElement,
): number {
    if (
        event.deltaMode ===
        WheelEvent.DOM_DELTA_LINE
    ) {
        return event.deltaY * 18;
    }

    if (
        event.deltaMode ===
        WheelEvent.DOM_DELTA_PAGE
    ) {
        return (
            event.deltaY
            *
            container.clientHeight
        );
    }

    return event.deltaY;
}

/*
|--------------------------------------------------------------------------
| JSON Section
|--------------------------------------------------------------------------
*/

function JsonSection(
    {
        title,
        value,
    }: {
        title: string;
        value: unknown;
    },
) {
    const empty =
        value === null
        ||
        value === undefined
        ||
        (
            isRecord(
                value,
            )
            &&
            Object.keys(
                value,
            ).length === 0
        )
        ||
        (
            Array.isArray(
                value,
            )
            &&
            value.length === 0
        );

    if (
        empty
    ) {
        return null;
    }

    return (
        <section className="audit-json-section">
            <h3>
                {title}
            </h3>

            <pre>
                {
                    JSON.stringify(
                        value,
                        null,
                        2,
                    )
                }
            </pre>
        </section>
    );
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function AuditLogsPage() {
    const auditListCardRef =
        useRef<HTMLElement | null>(
            null,
        );

    const [
        filters,
        setFilters,
    ] =
        useState<AuditLogFilters>(
            EMPTY_FILTERS,
        );

    const [
        appliedFilters,
        setAppliedFilters,
    ] =
        useState<AuditLogFilters>(
            EMPTY_FILTERS,
        );

    const [
        logs,
        setLogs,
    ] =
        useState<AuditLog[]>(
            [],
        );

    const [
        pagination,
        setPagination,
    ] =
        useState<AuditPagination>(
            EMPTY_PAGINATION,
        );

    const [
        page,
        setPage,
    ] =
        useState(1);

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(false);

    const [
        error,
        setError,
    ] =
        useState("");

    const [
        selected,
        setSelected,
    ] =
        useState<AuditLog | null>(
            null,
        );

    const [
        detailLoading,
        setDetailLoading,
    ] =
        useState(false);

    /*
    |--------------------------------------------------------------------------
    | Load Logs
    |--------------------------------------------------------------------------
    */

    const loadLogs =
        useCallback(
            async (
                silent = false,
            ): Promise<void> => {
                if (
                    silent
                ) {
                    setRefreshing(
                        true,
                    );
                } else {
                    setLoading(
                        true,
                    );
                }

                try {
                    const result =
                        await getAuditLogs(
                            appliedFilters,
                            page,
                            25,
                        );

                    setLogs(
                        result.items,
                    );

                    setPagination(
                        result.pagination,
                    );

                    setError(
                        "",
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
                    setLoading(
                        false,
                    );

                    setRefreshing(
                        false,
                    );
                }
            },
            [
                appliedFilters,
                page,
            ],
        );

    useEffect(
        () => {
            void loadLogs();
        },
        [
            loadLogs,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Realtime Refresh
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        REALTIME_DOMAINS,
        () => {
            void loadLogs(
                true,
            );
        },
        350,
    );

    /*
    |--------------------------------------------------------------------------
    | Fallback Reconciliation
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timer =
                window.setInterval(
                    () => {
                        void loadLogs(
                            true,
                        );
                    },
                    30000,
                );

            return () => {
                window.clearInterval(
                    timer,
                );
            };
        },
        [
            loadLogs,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Table Wheel Scrolling
    |--------------------------------------------------------------------------
    |
    | Audit rows are buttons.
    |
    | On some browser / desktop layouts the wheel event over these rows
    | does not naturally move the parent Operations content container.
    |
    | Forward the wheel movement to the nearest actual vertical scroller.
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const auditListCard =
                auditListCardRef.current;

            if (
                !auditListCard
            ) {
                return;
            }

            const handleWheel = (
                event: WheelEvent,
            ): void => {
                /*
                 * Keep Ctrl + wheel / pinch zoom untouched.
                 */

                if (
                    event.ctrlKey
                ) {
                    return;
                }

                if (
                    Math.abs(
                        event.deltaY,
                    )
                    <=
                    Math.abs(
                        event.deltaX,
                    )
                ) {
                    return;
                }

                const scrollContainer =
                    findVerticalScrollContainer(
                        auditListCard,
                    );

                if (
                    !scrollContainer
                ) {
                    return;
                }

                const delta =
                    normalizedWheelDelta(
                        event,
                        scrollContainer,
                    );

                if (
                    delta === 0
                ) {
                    return;
                }

                const maxScrollTop =
                    Math.max(
                        0,
                        scrollContainer.scrollHeight
                        -
                        scrollContainer.clientHeight,
                    );

                const targetScrollTop =
                    Math.min(
                        maxScrollTop,
                        Math.max(
                            0,
                            scrollContainer.scrollTop
                            +
                            delta,
                        ),
                    );

                if (
                    targetScrollTop ===
                    scrollContainer.scrollTop
                ) {
                    return;
                }

                event.preventDefault();

                scrollContainer.scrollTop =
                    targetScrollTop;
            };

            auditListCard.addEventListener(
                "wheel",
                handleWheel,
                {
                    passive: false,
                },
            );

            return () => {
                auditListCard.removeEventListener(
                    "wheel",
                    handleWheel,
                );
            };
        },
        [],
    );

    /*
    |--------------------------------------------------------------------------
    | Metrics
    |--------------------------------------------------------------------------
    */

    const todayCount =
        useMemo(
            () => {
                const now =
                    new Date();

                const today =
                    new Intl.DateTimeFormat(
                        "en-CA",
                        {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            timeZone: "Asia/Colombo",
                        },
                    ).format(
                        now,
                    );

                return logs.filter(
                    (
                        log,
                    ) => {
                        if (
                            !log.created_at
                        ) {
                            return false;
                        }

                        const date =
                            new Date(
                                log.created_at,
                            );

                        if (
                            Number.isNaN(
                                date.getTime(),
                            )
                        ) {
                            return false;
                        }

                        return new Intl.DateTimeFormat(
                            "en-CA",
                            {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                timeZone: "Asia/Colombo",
                            },
                        ).format(
                            date,
                        ) === today;
                    },
                ).length;
            },
            [
                logs,
            ],
        );

    const criticalCount =
        useMemo(
            () =>
                logs.filter(
                    (
                        log,
                    ) =>
                        actionTone(
                            log,
                        ) === "danger"
                        ||
                        actionTone(
                            log,
                        ) === "warning",
                ).length,
            [
                logs,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

    const submitFilters = (
        event: FormEvent,
    ): void => {
        event.preventDefault();

        setPage(
            1,
        );

        setAppliedFilters({
            ...filters,
        });
    };

    const clearFilters =
        (): void => {
            setFilters({
                ...EMPTY_FILTERS,
            });

            setAppliedFilters({
                ...EMPTY_FILTERS,
            });

            setPage(
                1,
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Details
    |--------------------------------------------------------------------------
    */

    const openDetails =
        async (
            log: AuditLog,
        ): Promise<void> => {
            setSelected(
                log,
            );

            setDetailLoading(
                true,
            );

            try {
                const result =
                    await getAuditLog(
                        log.id,
                    );

                setSelected(
                    result,
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
        };

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <main className="audit-page">
            <header className="audit-header">
                <div>
                    <span className="audit-eyebrow">
                        ADMINISTRATION
                    </span>

                    <h1>
                        Audit Logs
                    </h1>

                    <p>
                        Sensitive financial, operational and administrative activity.
                    </p>
                </div>

                <button
                    type="button"
                    className="audit-refresh-button"
                    disabled={
                        loading
                        ||
                        refreshing
                    }
                    onClick={
                        () => {
                            void loadLogs(
                                true,
                            );
                        }
                    }
                >
                    {
                        refreshing
                            ? "Refreshing..."
                            : "Refresh"
                    }
                </button>
            </header>

            <section className="audit-metrics">
                <article>
                    <span>
                        Total Records
                    </span>

                    <strong>
                        {
                            pagination.total
                        }
                    </strong>
                </article>

                <article>
                    <span>
                        Current Page
                    </span>

                    <strong>
                        {
                            pagination.currentPage
                        }
                        /
                        {
                            Math.max(
                                pagination.lastPage,
                                1,
                            )
                        }
                    </strong>
                </article>

                <article>
                    <span>
                        Visible Today
                    </span>

                    <strong>
                        {
                            todayCount
                        }
                    </strong>
                </article>

                <article className="critical">
                    <span>
                        Sensitive Visible
                    </span>

                    <strong>
                        {
                            criticalCount
                        }
                    </strong>
                </article>
            </section>

            <form
                className="audit-filters"
                onSubmit={
                    submitFilters
                }
            >
                <label className="audit-search">
                    <span>
                        Search
                    </span>

                    <input
                        type="search"
                        value={
                            filters.search
                        }
                        placeholder="Action, user, order, reason..."
                        onChange={
                            (
                                event,
                            ) =>
                                setFilters(
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
                </label>

                <label>
                    <span>
                        Action
                    </span>

                    <select
                        value={
                            filters.action
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setFilters(
                                    (
                                        current,
                                    ) => ({
                                        ...current,

                                        action:
                                            event
                                                .target
                                                .value,
                                    }),
                                )
                        }
                    >
                        <option value="">
                            All Actions
                        </option>

                        {
                            IMPORTANT_ACTIONS.map(
                                (
                                    option,
                                ) => (
                                    <option
                                        key={
                                            option.value
                                        }
                                        value={
                                            option.value
                                        }
                                    >
                                        {
                                            option.label
                                        }
                                    </option>
                                ),
                            )
                        }
                    </select>
                </label>

                <label>
                    <span>
                        Area
                    </span>

                    <select
                        value={
                            filters.entityType
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setFilters(
                                    (
                                        current,
                                    ) => ({
                                        ...current,

                                        entityType:
                                            event
                                                .target
                                                .value,
                                    }),
                                )
                        }
                    >
                        <option value="">
                            All Areas
                        </option>

                        {
                            ENTITY_TYPES.map(
                                (
                                    option,
                                ) => (
                                    <option
                                        key={
                                            option.value
                                        }
                                        value={
                                            option.value
                                        }
                                    >
                                        {
                                            option.label
                                        }
                                    </option>
                                ),
                            )
                        }
                    </select>
                </label>

                <label>
                    <span>
                        From
                    </span>

                    <input
                        type="date"
                        value={
                            filters.dateFrom
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setFilters(
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
                            filters.dateTo
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setFilters(
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

                <div className="audit-filter-actions">
                    <button
                        type="submit"
                        className="primary"
                    >
                        Apply
                    </button>

                    <button
                        type="button"
                        onClick={
                            clearFilters
                        }
                    >
                        Clear
                    </button>
                </div>
            </form>

            {
                error
                    ? (
                        <div className="audit-error">
                            {
                                error
                            }
                        </div>
                    )
                    : null
            }

            <section
                ref={
                    auditListCardRef
                }
                className="audit-list-card"
            >
                {
                    loading
                        ? (
                            <div className="audit-state">
                                <div className="audit-spinner" />

                                <strong>
                                    Loading audit history...
                                </strong>
                            </div>
                        )
                        : logs.length === 0
                            ? (
                                <div className="audit-state">
                                    <strong>
                                        No audit records found
                                    </strong>

                                    <span>
                                        Try changing the current filters.
                                    </span>
                                </div>
                            )
                            : (
                                <div className="audit-list">
                                    {
                                        logs.map(
                                            (
                                                log,
                                            ) => (
                                                <button
                                                    key={
                                                        log.id
                                                    }
                                                    type="button"
                                                    className="audit-row"
                                                    onClick={
                                                        () => {
                                                            void openDetails(
                                                                log,
                                                            );
                                                        }
                                                    }
                                                >
                                                    <span
                                                        className={
                                                            `audit-action-dot ${actionTone(
                                                                log,
                                                            )}`
                                                        }
                                                    />

                                                    <div className="audit-row-main">
                                                        <div className="audit-row-title">
                                                            <strong>
                                                                {
                                                                    actionTitle(
                                                                        log,
                                                                    )
                                                                }
                                                            </strong>

                                                            <span
                                                                className={
                                                                    `audit-tone ${actionTone(
                                                                        log,
                                                                    )}`
                                                                }
                                                            >
                                                                {
                                                                    formatEntityType(
                                                                        log.entity_type,
                                                                    )
                                                                }
                                                            </span>
                                                        </div>

                                                        <span className="audit-summary">
                                                            {
                                                                auditSummary(
                                                                    log,
                                                                )
                                                            }
                                                        </span>
                                                    </div>

                                                    <div className="audit-row-actor">
                                                        <strong>
                                                            {
                                                                actorName(
                                                                    log,
                                                                )
                                                            }
                                                        </strong>

                                                        <span>
                                                            {
                                                                log.actor
                                                                    ?.role
                                                                    ?.name
                                                                ??
                                                                log.actor
                                                                    ?.role
                                                                    ?.code
                                                                ??
                                                                "—"
                                                            }
                                                        </span>
                                                    </div>

                                                    <time>
                                                        {
                                                            formatDateTime(
                                                                log.created_at,
                                                            )
                                                        }
                                                    </time>

                                                    <span className="audit-view">
                                                        View
                                                    </span>
                                                </button>
                                            ),
                                        )
                                    }
                                </div>
                            )
                }

                {
                    !loading
                        &&
                        pagination.total > 0
                        ? (
                            <footer className="audit-pagination">
                                <span>
                                    {
                                        pagination.total
                                    } audit records
                                </span>

                                <div>
                                    <button
                                        type="button"
                                        disabled={
                                            page <= 1
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

                                    <strong>
                                        Page {
                                            pagination.currentPage
                                        } of {
                                            Math.max(
                                                pagination.lastPage,
                                                1,
                                            )
                                        }
                                    </strong>

                                    <button
                                        type="button"
                                        disabled={
                                            page >=
                                            pagination.lastPage
                                        }
                                        onClick={
                                            () =>
                                                setPage(
                                                    (
                                                        current,
                                                    ) =>
                                                        Math.min(
                                                            pagination.lastPage,
                                                            current + 1,
                                                        ),
                                                )
                                        }
                                    >
                                        Next
                                    </button>
                                </div>
                            </footer>
                        )
                        : null
                }
            </section>

            {
                selected
                    ? (
                        <div
                            className="audit-drawer-backdrop"
                            role="presentation"
                            onMouseDown={
                                (
                                    event,
                                ) => {
                                    if (
                                        event.target ===
                                        event.currentTarget
                                    ) {
                                        setSelected(
                                            null,
                                        );
                                    }
                                }
                            }
                        >
                            <aside className="audit-drawer">
                                <header>
                                    <div>
                                        <span>
                                            AUDIT RECORD #{
                                                selected.id
                                            }
                                        </span>

                                        <h2>
                                            {
                                                actionTitle(
                                                    selected,
                                                )
                                            }
                                        </h2>
                                    </div>

                                    <button
                                        type="button"
                                        aria-label="Close audit details"
                                        onClick={
                                            () =>
                                                setSelected(
                                                    null,
                                                )
                                        }
                                    >
                                        ×
                                    </button>
                                </header>

                                {
                                    detailLoading
                                        ? (
                                            <div className="audit-detail-loading">
                                                Loading latest details...
                                            </div>
                                        )
                                        : null
                                }

                                <div className="audit-detail-grid">
                                    <div>
                                        <span>
                                            Actor
                                        </span>

                                        <strong>
                                            {
                                                actorName(
                                                    selected,
                                                )
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Role
                                        </span>

                                        <strong>
                                            {
                                                selected.actor
                                                    ?.role
                                                    ?.name
                                                ??
                                                "—"
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Date & Time
                                        </span>

                                        <strong>
                                            {
                                                formatDateTime(
                                                    selected.created_at,
                                                )
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Entity
                                        </span>

                                        <strong>
                                            {
                                                selected.entity_type
                                                    ? `${formatEntityType(
                                                        selected.entity_type,
                                                    )}${selected.entity_id !== null
                                                        ? ` #${selected.entity_id}`
                                                        : ""
                                                    }`
                                                    : "System"
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            IP Address
                                        </span>

                                        <strong>
                                            {
                                                selected
                                                    .request
                                                    .ip_address
                                                ??
                                                "—"
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Request
                                        </span>

                                        <strong>
                                            {
                                                selected
                                                    .request
                                                    .method
                                                ??
                                                "—"
                                            }

                                            {
                                                selected
                                                    .request
                                                    .path
                                                    ? ` ${selected.request.path}`
                                                    : ""
                                            }
                                        </strong>
                                    </div>
                                </div>

                                <JsonSection
                                    title="Before"
                                    value={
                                        selected.old_values
                                    }
                                />

                                <JsonSection
                                    title="After"
                                    value={
                                        selected.new_values
                                    }
                                />

                                <JsonSection
                                    title="Metadata"
                                    value={
                                        selected.metadata
                                    }
                                />

                                {
                                    selected
                                        .request
                                        .user_agent
                                        ? (
                                            <section className="audit-agent">
                                                <h3>
                                                    Device / Browser
                                                </h3>

                                                <p>
                                                    {
                                                        selected
                                                            .request
                                                            .user_agent
                                                    }
                                                </p>
                                            </section>
                                        )
                                        : null
                                }
                            </aside>
                        </div>
                    )
                    : null
            }
        </main>
    );
}