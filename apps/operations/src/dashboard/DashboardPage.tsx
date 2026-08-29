import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    useStaffRealtimeRefresh,
} from '../realtime/realtimeBus';

import {
    Link,
} from 'react-router-dom';

import {
    ApiError,
} from '../lib/api';

import {
    getDashboard,
} from './dashboardService';

import type {
    DashboardData,
    DashboardOrderSummary,
    DashboardPaymentBreakdown,
    DashboardRecentOrder,
} from './types';

import './DashboardPage.css';

/*
|--------------------------------------------------------------------------
| Formatters
|--------------------------------------------------------------------------
*/

const money =
    new Intl.NumberFormat(
        'en-LK',
        {
            style:
                'currency',

            currency:
                'LKR',

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2,
        },
    );

const number =
    new Intl.NumberFormat(
        'en-LK',
        {
            maximumFractionDigits:
                3,
        },
    );

function formatDate(
    value:
        string | null,
): string {
    if (
        !value
    ) {
        return '—';
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
        'en-LK',
        {
            year:
                'numeric',

            month:
                'short',

            day:
                '2-digit',

            hour:
                '2-digit',

            minute:
                '2-digit',
        },
    ).format(
        parsed,
    );
}

function formatBusinessDate(
    value:
        string | null,
): string {
    if (
        !value
    ) {
        return 'No business day';
    }

    const parsed =
        new Date(
            `${value}T00:00:00`,
        );

    if (
        Number.isNaN(
            parsed.getTime(),
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        'en-LK',
        {
            weekday:
                'long',

            year:
                'numeric',

            month:
                'long',

            day:
                'numeric',
        },
    ).format(
        parsed,
    );
}

function humanize(
    value:
        string,
): string {
    return value
        .toLowerCase()
        .replaceAll(
            '_',
            ' ',
        )
        .replace(
            /\b\w/g,
            (
                character,
            ) =>
                character
                    .toUpperCase(),
        );
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function statusClass(
    status:
        string,
): string {
    switch (
    status
    ) {
        case 'COMPLETED':
        case 'SERVED':
            return 'success';

        case 'PENDING':
        case 'CONFIRMED':
            return 'warning';

        case 'SENT_TO_KITCHEN':
            return 'info';

        case 'CANCELLED':
        case 'REJECTED':
            return 'danger';

        default:
            return 'neutral';
    }
}

function orderLocation(
    order:
        DashboardRecentOrder,
): string {
    if (
        order.order_type
        ===
        'TAKEAWAY'
    ) {
        return order.takeaway_token
            ? `Takeaway ${order.takeaway_token}`
            : 'Takeaway';
    }

    return order.table_name
        ?? 'Dine-In';
}

/*
|--------------------------------------------------------------------------
| Metric Card
|--------------------------------------------------------------------------
*/

interface MetricCardProps {
    label:
    string;

    value:
    string;

    note?:
    string;

    tone?:
    'normal'
    | 'positive'
    | 'negative'
    | 'warning';
}

function MetricCard(
    {
        label,
        value,
        note,
        tone =
        'normal',
    }:
        MetricCardProps,
) {
    return (
        <article
            className={
                `ops-dashboard-metric ${tone}`
            }
        >
            <span className="ops-dashboard-metric-label">
                {
                    label
                }
            </span>

            <strong className="ops-dashboard-metric-value">
                {
                    value
                }
            </strong>

            {
                note
                &&
                (
                    <span className="ops-dashboard-metric-note">
                        {
                            note
                        }
                    </span>
                )
            }
        </article>
    );
}

/*
|--------------------------------------------------------------------------
| Order Status Grid
|--------------------------------------------------------------------------
*/

function OrderPipeline(
    {
        orders,
    }: {
        orders:
        DashboardOrderSummary;
    },
) {
    const statuses = [
        {
            label:
                'Pending',

            value:
                orders.pending,

            className:
                'pending',
        },

        {
            label:
                'Confirmed',

            value:
                orders.confirmed,

            className:
                'confirmed',
        },

        {
            label:
                'Kitchen',

            value:
                orders.sent_to_kitchen,

            className:
                'kitchen',
        },

        {
            label:
                'Served',

            value:
                orders.served,

            className:
                'served',
        },

        {
            label:
                'Completed',

            value:
                orders.completed,

            className:
                'completed',
        },
    ];

    return (
        <div className="ops-dashboard-pipeline">
            {
                statuses.map(
                    (
                        item,
                    ) => (
                        <article
                            key={
                                item.label
                            }
                            className={
                                `ops-dashboard-pipeline-item ${item.className}`
                            }
                        >
                            <strong>
                                {
                                    item.value
                                }
                            </strong>

                            <span>
                                {
                                    item.label
                                }
                            </span>
                        </article>
                    ),
                )
            }
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Payment Breakdown
|--------------------------------------------------------------------------
*/

function PaymentBreakdown(
    {
        payments,
        total,
    }: {
        payments:
        DashboardPaymentBreakdown[];

        total:
        number;
    },
) {
    if (
        payments.length
        ===
        0
    ) {
        return (
            <div className="ops-dashboard-empty">
                No payments have been recorded for this business day.
            </div>
        );
    }

    return (
        <div className="ops-dashboard-payment-list">
            {
                payments.map(
                    (
                        payment,
                    ) => {
                        const percentage =
                            total > 0
                                ? Math.min(
                                    100,

                                    (
                                        payment.amount
                                        /
                                        total
                                    )
                                    *
                                    100,
                                )
                                : 0;

                        return (
                            <article
                                key={
                                    payment.method
                                }
                                className="ops-dashboard-payment-row"
                            >
                                <div className="ops-dashboard-payment-heading">
                                    <div>
                                        <strong>
                                            {
                                                humanize(
                                                    payment.method,
                                                )
                                            }
                                        </strong>

                                        <span>
                                            {
                                                payment.count
                                            }
                                            {
                                                payment.count
                                                    ===
                                                    1
                                                    ? ' payment'
                                                    : ' payments'
                                            }
                                        </span>
                                    </div>

                                    <strong>
                                        {
                                            money.format(
                                                payment.amount,
                                            )
                                        }
                                    </strong>
                                </div>

                                <div className="ops-dashboard-progress">
                                    <span
                                        style={{
                                            width:
                                                `${percentage}%`,
                                        }}
                                    />
                                </div>
                            </article>
                        );
                    },
                )
            }
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

export default function DashboardPage() {
    const [
        dashboard,
        setDashboard,
    ] =
        useState<DashboardData | null>(
            null,
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
        useState(
            '',
        );

    /*
    |--------------------------------------------------------------------------
    | Load Dashboard
    |--------------------------------------------------------------------------
    |
    | refresh = true
    |   Shows the normal Refresh button state.
    |
    | silent = true
    |   Used for realtime synchronization. Existing dashboard UI remains
    |   visible while fresh authoritative data is retrieved from Laravel.
    |--------------------------------------------------------------------------
    */

    const loadDashboard =
        useCallback(
            async (
                refresh:
                    boolean = false,

                silent:
                    boolean = false,
            ): Promise<void> => {
                if (
                    !silent
                ) {
                    if (
                        refresh
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
                    '',
                );

                try {
                    const data =
                        await getDashboard();

                    setDashboard(
                        data,
                    );
                } catch (
                exception
                ) {
                    if (
                        exception
                        instanceof
                        ApiError
                    ) {
                        setError(
                            exception
                                .message,
                        );
                    } else {
                        setError(
                            'Unable to load the dashboard.',
                        );
                    }
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
            [],
        );

    /*
    |--------------------------------------------------------------------------
    | Initial Load
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const run =
                async (): Promise<void> => {
                    await loadDashboard();
                };

            void run();
        },
        [
            loadDashboard,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | Dashboard aggregates information from many restaurant domains.
    |
    | Reverb events are invalidation signals only. We always ask Laravel for
    | a fresh dashboard snapshot instead of trusting event payload data.
    |
    | Multiple events generated by a single transaction are debounced by the
    | shared realtime bus before this callback runs.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            'orders',
            'tables',
            'menu',
            'inventory',
            'recipes',
            'purchases',
            'supplier_payments',
            'wastage',
            'expenses',
            'billing',
            'cash',
            'business_day',
        ],
        async () => {
            await loadDashboard(
                false,
                true,
            );
        },
    );

    /*
    |--------------------------------------------------------------------------
    | Derived
    |--------------------------------------------------------------------------
    */

    const todayLabel =
        useMemo(
            () =>
                formatBusinessDate(
                    dashboard
                        ?.business_day
                        ?.business_date
                    ??
                    null,
                ),
            [
                dashboard,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Loading
    |--------------------------------------------------------------------------
    */

    if (
        loading
        &&
        !dashboard
    ) {
        return (
            <section className="ops-dashboard">
                <div className="ops-dashboard-loading">
                    <span className="ops-dashboard-spinner" />

                    <strong>
                        Loading Dashboard
                    </strong>

                    <p>
                        Retrieving the latest restaurant activity.
                    </p>
                </div>
            </section>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Fatal Error
    |--------------------------------------------------------------------------
    */

    if (
        !dashboard
    ) {
        return (
            <section className="ops-dashboard">
                <div className="ops-dashboard-error-card">
                    <strong>
                        Dashboard unavailable
                    </strong>

                    <p>
                        {
                            error
                            ||
                            'The dashboard could not be loaded.'
                        }
                    </p>

                    <button
                        type="button"
                        onClick={
                            () => {
                                void loadDashboard();
                            }
                        }
                    >
                        Try Again
                    </button>
                </div>
            </section>
        );
    }

    const tables =
        dashboard
            .operations
            .tables;

    const orders =
        dashboard
            .operations
            .orders;

    const financial =
        dashboard
            .financial;

    const inventory =
        dashboard
            .inventory;

    return (
        <section className="ops-dashboard">
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

            <header className="ops-dashboard-header">
                <div>
                    <span className="ops-dashboard-eyebrow">
                        Restaurant Overview
                    </span>

                    <h2>
                        Operations Dashboard
                    </h2>

                    <p>
                        {
                            todayLabel
                        }
                    </p>
                </div>

                <div className="ops-dashboard-header-actions">
                    {
                        dashboard
                            .business_day
                        &&
                        (
                            <span
                                className={
                                    `ops-dashboard-day-status ${dashboard
                                        .business_day
                                        .status
                                        .toLowerCase()
                                    }`
                                }
                            >
                                Business Day
                                {' '}
                                {
                                    humanize(
                                        dashboard
                                            .business_day
                                            .status,
                                    )
                                }
                            </span>
                        )
                    }

                    <button
                        type="button"
                        className="ops-dashboard-refresh"
                        disabled={
                            refreshing
                        }
                        onClick={
                            () => {
                                void loadDashboard(
                                    true,
                                );
                            }
                        }
                    >
                        {
                            refreshing
                                ? 'Refreshing...'
                                : 'Refresh'
                        }
                    </button>
                </div>
            </header>

            {/*
            |--------------------------------------------------------------------------
            | Inline Error
            |--------------------------------------------------------------------------
            */}

            {
                error
                &&
                (
                    <div
                        className="ops-dashboard-inline-error"
                        role="alert"
                    >
                        {
                            error
                        }
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Business Day Warning
            |--------------------------------------------------------------------------
            */}

            {
                !dashboard.business_day
                &&
                (
                    <div className="ops-dashboard-warning">
                        <div>
                            <strong>
                                No business day is currently available
                            </strong>

                            <span>
                                Operational table information is still shown,
                                but daily order and financial values remain
                                zero until a business day exists.
                            </span>
                        </div>

                        <Link
                            to="/business-day"
                        >
                            Business Day
                        </Link>
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Financial
            |--------------------------------------------------------------------------
            */}

            {
                financial
                &&
                (
                    <>
                        <div className="ops-dashboard-section-heading">
                            <div>
                                <span>
                                    Financial Performance
                                </span>

                                <h3>
                                    Today's performance
                                </h3>
                            </div>

                            <Link
                                to="/reports"
                            >
                                View Reports
                            </Link>
                        </div>

                        <div className="ops-dashboard-metrics">
                            <MetricCard
                                label="Revenue"
                                value={
                                    money.format(
                                        financial
                                            .revenue,
                                    )
                                }
                                note={
                                    `${financial.completed_orders} completed orders`
                                }
                            />

                            <MetricCard
                                label="COGS"
                                value={
                                    money.format(
                                        financial
                                            .cogs,
                                    )
                                }
                                note="Estimated food cost"
                            />

                            <MetricCard
                                label="Gross Profit"
                                value={
                                    money.format(
                                        financial
                                            .gross_profit,
                                    )
                                }
                                tone={
                                    financial
                                        .gross_profit
                                        >=
                                        0
                                        ? 'positive'
                                        : 'negative'
                                }
                            />

                            <MetricCard
                                label="Expenses"
                                value={
                                    money.format(
                                        financial
                                            .expenses,
                                    )
                                }
                                tone="negative"
                            />

                            <MetricCard
                                label="Wastage"
                                value={
                                    money.format(
                                        financial
                                            .wastage_cost,
                                    )
                                }
                                tone={
                                    financial
                                        .wastage_cost
                                        >
                                        0
                                        ? 'warning'
                                        : 'normal'
                                }
                            />

                            <MetricCard
                                label="Estimated Net Profit"
                                value={
                                    money.format(
                                        financial
                                            .estimated_net_profit,
                                    )
                                }
                                note="After COGS, expenses & wastage"
                                tone={
                                    financial
                                        .estimated_net_profit
                                        >=
                                        0
                                        ? 'positive'
                                        : 'negative'
                                }
                            />

                            <MetricCard
                                label="Payments Collected"
                                value={
                                    money.format(
                                        financial
                                            .payment_total,
                                    )
                                }
                            />

                            <MetricCard
                                label="Average Order"
                                value={
                                    money.format(
                                        financial
                                            .average_order_value,
                                    )
                                }
                            />
                        </div>
                    </>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Operations
            |--------------------------------------------------------------------------
            */}

            <div className="ops-dashboard-section-heading">
                <div>
                    <span>
                        Live Operations
                    </span>

                    <h3>
                        Restaurant activity
                    </h3>
                </div>
            </div>

            <div className="ops-dashboard-main-grid">
                {
                    tables
                    &&
                    (
                        <article className="ops-dashboard-card">
                            <header className="ops-dashboard-card-header">
                                <div>
                                    <span>
                                        Floor Status
                                    </span>

                                    <h4>
                                        Tables
                                    </h4>
                                </div>

                                <Link
                                    to="/tables"
                                >
                                    Open Tables
                                </Link>
                            </header>

                            <div className="ops-dashboard-table-summary">
                                <article className="available">
                                    <strong>
                                        {
                                            tables.available
                                        }
                                    </strong>

                                    <span>
                                        Available
                                    </span>
                                </article>

                                <article className="occupied">
                                    <strong>
                                        {
                                            tables.occupied
                                        }
                                    </strong>

                                    <span>
                                        Occupied
                                    </span>
                                </article>

                                <article className="reserved">
                                    <strong>
                                        {
                                            tables.reserved
                                        }
                                    </strong>

                                    <span>
                                        Reserved
                                    </span>
                                </article>

                                <article className="cleaning">
                                    <strong>
                                        {
                                            tables.cleaning
                                        }
                                    </strong>

                                    <span>
                                        Cleaning
                                    </span>
                                </article>
                            </div>

                            <div className="ops-dashboard-card-footer-stats">
                                <div>
                                    <span>
                                        Total Tables
                                    </span>

                                    <strong>
                                        {
                                            tables.total
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Open Sessions
                                    </span>

                                    <strong>
                                        {
                                            tables.open_sessions
                                        }
                                    </strong>
                                </div>

                                <div
                                    className={
                                        tables.bill_requests
                                            >
                                            0
                                            ? 'attention'
                                            : ''
                                    }
                                >
                                    <span>
                                        Bill Requests
                                    </span>

                                    <strong>
                                        {
                                            tables.bill_requests
                                        }
                                    </strong>
                                </div>
                            </div>
                        </article>
                    )
                }

                {
                    orders
                    &&
                    (
                        <article className="ops-dashboard-card">
                            <header className="ops-dashboard-card-header">
                                <div>
                                    <span>
                                        Today's Workflow
                                    </span>

                                    <h4>
                                        Order Pipeline
                                    </h4>
                                </div>

                                <Link
                                    to="/orders"
                                >
                                    View Orders
                                </Link>
                            </header>

                            <OrderPipeline
                                orders={
                                    orders
                                }
                            />

                            <div className="ops-dashboard-card-footer-stats">
                                <div>
                                    <span>
                                        Total
                                    </span>

                                    <strong>
                                        {
                                            orders.total
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Cancelled
                                    </span>

                                    <strong>
                                        {
                                            orders.cancelled
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Rejected
                                    </span>

                                    <strong>
                                        {
                                            orders.rejected
                                        }
                                    </strong>
                                </div>
                            </div>
                        </article>
                    )
                }
            </div>

            {/*
            |--------------------------------------------------------------------------
            | Payments + Inventory
            |--------------------------------------------------------------------------
            */}

            {
                (
                    financial
                    ||
                    inventory
                )
                &&
                (
                    <div className="ops-dashboard-secondary-grid">
                        {
                            financial
                            &&
                            (
                                <article className="ops-dashboard-card">
                                    <header className="ops-dashboard-card-header">
                                        <div>
                                            <span>
                                                Collections
                                            </span>

                                            <h4>
                                                Payment Methods
                                            </h4>
                                        </div>

                                        <strong className="ops-dashboard-card-total">
                                            {
                                                money.format(
                                                    financial
                                                        .payment_total,
                                                )
                                            }
                                        </strong>
                                    </header>

                                    <PaymentBreakdown
                                        payments={
                                            financial
                                                .payment_breakdown
                                        }
                                        total={
                                            financial
                                                .payment_total
                                        }
                                    />
                                </article>
                            )
                        }

                        {
                            inventory
                            &&
                            (
                                <article className="ops-dashboard-card">
                                    <header className="ops-dashboard-card-header">
                                        <div>
                                            <span>
                                                Inventory Health
                                            </span>

                                            <h4>
                                                Stock Alerts
                                            </h4>
                                        </div>

                                        <Link
                                            to="/inventory"
                                        >
                                            View Stock
                                        </Link>
                                    </header>

                                    <div className="ops-dashboard-inventory-summary">
                                        <article>
                                            <span>
                                                Tracked
                                            </span>

                                            <strong>
                                                {
                                                    inventory
                                                        .tracked_ingredients
                                                }
                                            </strong>
                                        </article>

                                        <article className="warning">
                                            <span>
                                                Low Stock
                                            </span>

                                            <strong>
                                                {
                                                    inventory
                                                        .low_stock_count
                                                }
                                            </strong>
                                        </article>

                                        <article
                                            className={
                                                inventory
                                                    .out_of_stock_count
                                                    >
                                                    0
                                                    ? 'danger'
                                                    : ''
                                            }
                                        >
                                            <span>
                                                Out of Stock
                                            </span>

                                            <strong>
                                                {
                                                    inventory
                                                        .out_of_stock_count
                                                }
                                            </strong>
                                        </article>
                                    </div>

                                    <div className="ops-dashboard-stock-value">
                                        <span>
                                            Current Stock Cost Value
                                        </span>

                                        <strong>
                                            {
                                                money.format(
                                                    inventory
                                                        .stock_value,
                                                )
                                            }
                                        </strong>
                                    </div>

                                    {
                                        inventory
                                            .low_stock_items
                                            .length
                                        >
                                        0
                                        &&
                                        (
                                            <div className="ops-dashboard-low-stock-list">
                                                {
                                                    inventory
                                                        .low_stock_items
                                                        .map(
                                                            (
                                                                item,
                                                            ) => (
                                                                <div
                                                                    key={
                                                                        item.id
                                                                    }
                                                                >
                                                                    <div>
                                                                        <strong>
                                                                            {
                                                                                item.name
                                                                            }
                                                                        </strong>

                                                                        <span>
                                                                            {
                                                                                item.sku
                                                                                ??
                                                                                'No SKU'
                                                                            }
                                                                        </span>
                                                                    </div>

                                                                    <div>
                                                                        <strong>
                                                                            {
                                                                                number.format(
                                                                                    item.current_stock,
                                                                                )
                                                                            }
                                                                            {' '}
                                                                            {
                                                                                item
                                                                                    .unit
                                                                                    .symbol
                                                                                ??
                                                                                ''
                                                                            }
                                                                        </strong>

                                                                        <span>
                                                                            Reorder at
                                                                            {' '}
                                                                            {
                                                                                number.format(
                                                                                    item.reorder_level,
                                                                                )
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ),
                                                        )
                                                }
                                            </div>
                                        )
                                    }
                                </article>
                            )
                        }
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Top Items
            |--------------------------------------------------------------------------
            */}

            {
                dashboard
                    .top_items
                    .length
                >
                0
                &&
                (
                    <>
                        <div className="ops-dashboard-section-heading">
                            <div>
                                <span>
                                    Menu Performance
                                </span>

                                <h3>
                                    Top-selling items
                                </h3>
                            </div>
                        </div>

                        <div className="ops-dashboard-top-items">
                            {
                                dashboard
                                    .top_items
                                    .map(
                                        (
                                            item,
                                            index,
                                        ) => (
                                            <article
                                                key={
                                                    `${item.name}-${item.variant ?? 'default'}`
                                                }
                                            >
                                                <span className="ops-dashboard-rank">
                                                    {
                                                        index
                                                        +
                                                        1
                                                    }
                                                </span>

                                                <div className="ops-dashboard-top-item-name">
                                                    <strong>
                                                        {
                                                            item.name
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            item.variant
                                                            ??
                                                            'Standard'
                                                        }
                                                    </span>
                                                </div>

                                                <div>
                                                    <strong>
                                                        {
                                                            number.format(
                                                                item.quantity,
                                                            )
                                                        }
                                                    </strong>

                                                    <span>
                                                        Qty Sold
                                                    </span>
                                                </div>

                                                <div>
                                                    <strong>
                                                        {
                                                            money.format(
                                                                item.sales_total,
                                                            )
                                                        }
                                                    </strong>

                                                    <span>
                                                        Sales
                                                    </span>
                                                </div>
                                            </article>
                                        ),
                                    )
                            }
                        </div>
                    </>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Recent Orders
            |--------------------------------------------------------------------------
            */}

            {
                dashboard
                    .recent_orders
                    .length
                >
                0
                &&
                (
                    <>
                        <div className="ops-dashboard-section-heading">
                            <div>
                                <span>
                                    Latest Activity
                                </span>

                                <h3>
                                    Recent orders
                                </h3>
                            </div>

                            <Link
                                to="/orders"
                            >
                                All Orders
                            </Link>
                        </div>

                        <article className="ops-dashboard-card">
                            <div className="ops-dashboard-orders-table-wrap">
                                <table className="ops-dashboard-orders-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                Order
                                            </th>

                                            <th>
                                                Type
                                            </th>

                                            <th>
                                                Location
                                            </th>

                                            <th>
                                                Status
                                            </th>

                                            <th>
                                                Total
                                            </th>

                                            <th>
                                                Time
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {
                                            dashboard
                                                .recent_orders
                                                .map(
                                                    (
                                                        order,
                                                    ) => (
                                                        <tr
                                                            key={
                                                                order.id
                                                            }
                                                        >
                                                            <td>
                                                                <strong>
                                                                    {
                                                                        order.order_number
                                                                    }
                                                                </strong>

                                                                {
                                                                    order.customer_name
                                                                    &&
                                                                    (
                                                                        <span>
                                                                            {
                                                                                order.customer_name
                                                                            }
                                                                        </span>
                                                                    )
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    humanize(
                                                                        order.order_type,
                                                                    )
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    orderLocation(
                                                                        order,
                                                                    )
                                                                }
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={
                                                                        `ops-dashboard-order-status ${statusClass(
                                                                            order.status,
                                                                        )}`
                                                                    }
                                                                >
                                                                    {
                                                                        humanize(
                                                                            order.status,
                                                                        )
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        money.format(
                                                                            order.grand_total,
                                                                        )
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                {
                                                                    formatDate(
                                                                        order.created_at,
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
                        </article>
                    </>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Footer
            |--------------------------------------------------------------------------
            */}

            <footer className="ops-dashboard-footer">
                Last updated:
                {' '}
                {
                    formatDate(
                        dashboard
                            .generated_at,
                    )
                }
            </footer>
        </section>
    );
}