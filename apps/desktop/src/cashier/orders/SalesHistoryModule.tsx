import {
    useMemo,
    useState,
} from 'react';

import type {
    Order,
} from '../../types';

import {
    currentOrderMoney,
    formatOrderDateTime,
    getOrderDisplayItems,
    getOrderDisplayMeta,
    orderStatusClass,
    orderStatusLabel,
} from './helpers';

import './SalesHistoryModule.css';

type SalesHistoryFilter =
    | 'ALL'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REJECTED';

interface SalesHistoryModuleProps {
    orders:
    Order[];

    loading?:
    boolean;

    onView:
    (
        order:
            Order,
    ) => void;

    onOpenBilling:
    (
        order:
            Order,
    ) => void;
}

const FILTERS:
    Array<{
        key:
        SalesHistoryFilter;

        label:
        string;
    }> = [
        {
            key:
                'ALL',

            label:
                'All Records',
        },

        {
            key:
                'COMPLETED',

            label:
                'Completed',
        },

        {
            key:
                'CANCELLED',

            label:
                'Cancelled',
        },

        {
            key:
                'REJECTED',

            label:
                'Rejected',
        },
    ];

export default function SalesHistoryModule(
    {
        orders,
        loading = false,
        onView,
        onOpenBilling,
    }: SalesHistoryModuleProps,
) {
    const [
        statusFilter,
        setStatusFilter,
    ] =
        useState<SalesHistoryFilter>(
            'ALL',
        );

    const [
        search,
        setSearch,
    ] =
        useState(
            '',
        );

    /*
    |--------------------------------------------------------------------------
    | Summary
    |--------------------------------------------------------------------------
    */

    const summary =
        useMemo(
            () => {
                const completed =
                    orders.filter(
                        (
                            order,
                        ) =>
                            order.status
                            ===
                            'COMPLETED',
                    );

                const cancelled =
                    orders.filter(
                        (
                            order,
                        ) =>
                            order.status
                            ===
                            'CANCELLED',
                    );

                const rejected =
                    orders.filter(
                        (
                            order,
                        ) =>
                            order.status
                            ===
                            'REJECTED',
                    );

                const completedOrderValue =
                    completed.reduce(
                        (
                            total,
                            order,
                        ) =>
                            total
                            +
                            Number(
                                order.grand_total
                                ??
                                0,
                            ),

                        0,
                    );

                return {
                    all:
                        orders.length,

                    completed:
                        completed.length,

                    cancelled:
                        cancelled.length,

                    rejected:
                        rejected.length,

                    completedOrderValue,
                };
            },
            [
                orders,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Search + Filter
    |--------------------------------------------------------------------------
    */

    const filteredOrders =
        useMemo(
            () => {
                const query =
                    search
                        .trim()
                        .toLowerCase();

                return orders
                    .filter(
                        (
                            order,
                        ) =>
                            statusFilter
                            ===
                            'ALL'
                            ||
                            order.status
                            ===
                            statusFilter,
                    )
                    .filter(
                        (
                            order,
                        ) => {
                            if (
                                !query
                            ) {
                                return true;
                            }

                            const meta =
                                getOrderDisplayMeta(
                                    order,
                                );

                            const values =
                                [
                                    order.order_number
                                    ??
                                    '',

                                    String(
                                        order.id,
                                    ),

                                    order.order_type
                                    ??
                                    '',

                                    order.order_source
                                    ??
                                    '',

                                    order.status
                                    ??
                                    '',

                                    meta.tableName
                                    ??
                                    '',

                                    meta.token
                                    ??
                                    '',

                                    meta.customerName
                                    ??
                                    '',

                                    meta.customerPhone
                                    ??
                                    '',
                                ]
                                    .join(
                                        ' ',
                                    )
                                    .toLowerCase();

                            return values.includes(
                                query,
                            );
                        },
                    )
                    .sort(
                        (
                            left,
                            right,
                        ) => {
                            const leftDate =
                                new Date(
                                    left.completed_at
                                    ??
                                    left.created_at
                                    ??
                                    0,
                                ).getTime();

                            const rightDate =
                                new Date(
                                    right.completed_at
                                    ??
                                    right.created_at
                                    ??
                                    0,
                                ).getTime();

                            return rightDate
                                -
                                leftDate;
                        },
                    );
            },
            [
                orders,
                search,
                statusFilter,
            ],
        );

    const filterCount =
        (
            filter:
                SalesHistoryFilter,
        ): number => {
            switch (
            filter
            ) {
                case 'COMPLETED':
                    return summary.completed;

                case 'CANCELLED':
                    return summary.cancelled;

                case 'REJECTED':
                    return summary.rejected;

                default:
                    return summary.all;
            }
        };

    return (
        <div className="sales-history-page">
            <header className="sales-history-header">
                <div>
                    <span className="sales-history-eyebrow">
                        SALES RECORDS
                    </span>

                    <h1>
                        Sales History
                    </h1>

                    <p>
                        Review completed, cancelled and
                        rejected restaurant orders.
                    </p>
                </div>

                <div className="sales-history-record-count">
                    <strong>
                        {
                            summary.all
                        }
                    </strong>

                    <span>
                        records
                    </span>
                </div>
            </header>

            <section className="sales-history-summary-grid">
                <SummaryCard
                    label="Completed"
                    value={
                        String(
                            summary.completed,
                        )
                    }
                    tone="success"
                />

                <SummaryCard
                    label="Completed Order Value"
                    value={
                        currentOrderMoney(
                            summary.completedOrderValue,
                        )
                    }
                    tone="primary"
                />

                <SummaryCard
                    label="Cancelled"
                    value={
                        String(
                            summary.cancelled,
                        )
                    }
                    tone={
                        summary.cancelled > 0
                            ? 'danger'
                            : 'neutral'
                    }
                />

                <SummaryCard
                    label="Rejected"
                    value={
                        String(
                            summary.rejected,
                        )
                    }
                    tone={
                        summary.rejected > 0
                            ? 'warning'
                            : 'neutral'
                    }
                />
            </section>

            <section className="sales-history-toolbar">
                <div className="sales-history-search">
                    <span className="sales-history-search-icon">
                        ⌕
                    </span>

                    <input
                        type="search"
                        value={
                            search
                        }
                        placeholder="Search order, customer, table, token or phone..."
                        onChange={
                            (
                                event,
                            ) =>
                                setSearch(
                                    event.target.value,
                                )
                        }
                    />

                    {
                        search
                            ? (
                                <button
                                    type="button"
                                    className="sales-history-clear-search"
                                    onClick={
                                        () =>
                                            setSearch(
                                                '',
                                            )
                                    }
                                >
                                    ×
                                </button>
                            )
                            : null
                    }
                </div>

                <div className="sales-history-filters">
                    {
                        FILTERS.map(
                            (
                                filter,
                            ) => (
                                <button
                                    key={
                                        filter.key
                                    }
                                    type="button"
                                    className={
                                        statusFilter
                                            ===
                                            filter.key
                                            ? 'sales-history-filter active'
                                            : 'sales-history-filter'
                                    }
                                    onClick={
                                        () =>
                                            setStatusFilter(
                                                filter.key,
                                            )
                                    }
                                >
                                    <span>
                                        {
                                            filter.label
                                        }
                                    </span>

                                    <strong>
                                        {
                                            filterCount(
                                                filter.key,
                                            )
                                        }
                                    </strong>
                                </button>
                            ),
                        )
                    }
                </div>
            </section>

            {
                loading
                    ? (
                        <div className="sales-history-loading">
                            Updating sales history...
                        </div>
                    )
                    : null
            }

            {
                filteredOrders.length
                    ===
                    0
                    ? (
                        <section className="sales-history-empty">
                            <div className="sales-history-empty-icon">
                                SH
                            </div>

                            <h2>
                                {
                                    orders.length
                                        ===
                                        0
                                        ? 'No Sales History Yet'
                                        : 'No Matching Records'
                                }
                            </h2>

                            <p>
                                {
                                    orders.length
                                        ===
                                        0
                                        ? 'Completed, cancelled and rejected orders will appear here.'
                                        : 'Try another search term or status filter.'
                                }
                            </p>
                        </section>
                    )
                    : (
                        <div className="sales-history-list">
                            {
                                filteredOrders.map(
                                    (
                                        order,
                                    ) => (
                                        <SalesHistoryCard
                                            key={
                                                order.id
                                            }
                                            order={
                                                order
                                            }
                                            loading={
                                                loading
                                            }
                                            onView={
                                                onView
                                            }
                                            onOpenBilling={
                                                onOpenBilling
                                            }
                                        />
                                    ),
                                )
                            }
                        </div>
                    )
            }
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| History Card
|--------------------------------------------------------------------------
*/

function SalesHistoryCard(
    {
        order,
        loading,
        onView,
        onOpenBilling,
    }: {
        order:
        Order;

        loading:
        boolean;

        onView:
        (
            order:
                Order,
        ) => void;

        onOpenBilling:
        (
            order:
                Order,
        ) => void;
    },
) {
    const meta =
        getOrderDisplayMeta(
            order,
        );

    const items =
        getOrderDisplayItems(
            order,
        );

    const previewItems =
        items.slice(
            0,
            3,
        );

    const quantity =
        items.reduce(
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

    const status =
        String(
            order.status
            ??
            '',
        );

    const displayDate =
        order.completed_at
        ??
        order.created_at
        ??
        null;

    return (
        <article className="sales-history-card">
            <div className="sales-history-card-main">
                <div className="sales-history-card-top">
                    <div>
                        <span className="sales-history-source">
                            {
                                (
                                    meta.orderSource
                                    ??
                                    'ORDER'
                                ).replace(
                                    /_/g,
                                    ' ',
                                )
                            }
                        </span>

                        <h2>
                            {
                                order.order_number
                                ||
                                `Order #${order.id}`
                            }
                        </h2>

                        <span className="sales-history-date">
                            {
                                formatOrderDateTime(
                                    displayDate,
                                )
                            }
                        </span>
                    </div>

                    <span
                        className={
                            `sales-history-status ${orderStatusClass(
                                status,
                            )
                            }`
                        }
                    >
                        {
                            orderStatusLabel(
                                status,
                            )
                        }
                    </span>
                </div>

                <div className="sales-history-meta-grid">
                    <MetaBlock
                        label="Type"
                        value={
                            (
                                meta.orderType
                                ??
                                '-'
                            ).replace(
                                /_/g,
                                ' ',
                            )
                        }
                    />

                    <MetaBlock
                        label={
                            meta.orderType
                                ===
                                'TAKEAWAY'
                                ? 'Pickup'
                                : 'Table'
                        }
                        value={
                            meta.orderType
                                ===
                                'TAKEAWAY'
                                ? 'TAKEAWAY'
                                : meta.tableName
                                ??
                                '-'
                        }
                    />

                    <MetaBlock
                        label="Token"
                        value={
                            meta.token
                            ??
                            '-'
                        }
                    />

                    <MetaBlock
                        label="Items"
                        value={
                            String(
                                quantity,
                            )
                        }
                    />
                </div>

                {
                    meta.customerName
                        ||
                        meta.customerPhone
                        ? (
                            <div className="sales-history-customer">
                                <div>
                                    <span>
                                        Customer
                                    </span>

                                    <strong>
                                        {
                                            meta.customerName
                                            ??
                                            'Walk-in Customer'
                                        }
                                    </strong>
                                </div>

                                {
                                    meta.customerPhone
                                        ? (
                                            <span className="sales-history-phone">
                                                {
                                                    meta.customerPhone
                                                }
                                            </span>
                                        )
                                        : null
                                }
                            </div>
                        )
                        : null
                }

                {
                    previewItems.length > 0
                        ? (
                            <div className="sales-history-items">
                                {
                                    previewItems.map(
                                        (
                                            item,
                                        ) => (
                                            <div
                                                className="sales-history-item"
                                                key={
                                                    item.id
                                                }
                                            >
                                                <span className="sales-history-item-quantity">
                                                    {
                                                        item.quantity
                                                    }
                                                    ×
                                                </span>

                                                <div>
                                                    <strong>
                                                        {
                                                            item.name
                                                        }
                                                    </strong>

                                                    {
                                                        item.variant
                                                            ? (
                                                                <small>
                                                                    {
                                                                        item.variant
                                                                    }
                                                                </small>
                                                            )
                                                            : null
                                                    }
                                                </div>

                                                <strong className="sales-history-item-price">
                                                    {
                                                        currentOrderMoney(
                                                            item.lineTotal,
                                                        )
                                                    }
                                                </strong>
                                            </div>
                                        ),
                                    )
                                }

                                {
                                    items.length
                                        >
                                        previewItems.length
                                        ? (
                                            <div className="sales-history-more-items">
                                                +
                                                {
                                                    items.length
                                                    -
                                                    previewItems.length
                                                }
                                                {' '}
                                                more item
                                                {
                                                    items.length
                                                        -
                                                        previewItems.length
                                                        ===
                                                        1
                                                        ? ''
                                                        : 's'
                                                }
                                            </div>
                                        )
                                        : null
                                }
                            </div>
                        )
                        : null
                }
            </div>

            <aside className="sales-history-card-side">
                <div className="sales-history-total">
                    <span>
                        Order Total
                    </span>

                    <strong>
                        {
                            currentOrderMoney(
                                order.grand_total
                                ??
                                0,
                            )
                        }
                    </strong>
                </div>

                <div className="sales-history-actions">
                    <button
                        type="button"
                        className="sales-history-view-button"
                        disabled={
                            loading
                        }
                        onClick={
                            () =>
                                onView(
                                    order,
                                )
                        }
                    >
                        View Order
                    </button>

                    {
                        status
                            ===
                            'COMPLETED'
                            ? (
                                <button
                                    type="button"
                                    className="sales-history-billing-button"
                                    disabled={
                                        loading
                                    }
                                    onClick={
                                        () =>
                                            onOpenBilling(
                                                order,
                                            )
                                    }
                                >
                                    Billing / Receipt
                                </button>
                            )
                            : null
                    }
                </div>
            </aside>
        </article>
    );
}

/*
|--------------------------------------------------------------------------
| Meta Block
|--------------------------------------------------------------------------
*/

function MetaBlock(
    {
        label,
        value,
    }: {
        label:
        string;

        value:
        string;
    },
) {
    return (
        <div className="sales-history-meta-block">
            <span>
                {
                    label
                }
            </span>

            <strong>
                {
                    value
                }
            </strong>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Summary Card
|--------------------------------------------------------------------------
*/

function SummaryCard(
    {
        label,
        value,
        tone = 'neutral',
    }: {
        label:
        string;

        value:
        string;

        tone?:
        | 'neutral'
        | 'primary'
        | 'success'
        | 'danger'
        | 'warning';
    },
) {
    return (
        <div
            className={
                `sales-history-summary-card ${tone}`
            }
        >
            <span>
                {
                    label
                }
            </span>

            <strong>
                {
                    value
                }
            </strong>
        </div>
    );
}