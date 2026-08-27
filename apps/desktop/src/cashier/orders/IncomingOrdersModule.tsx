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

import type {
    OrderTransitionAction,
} from './types';

import './IncomingOrdersModule.css';

type IncomingStatusFilter =
    | 'ALL'
    | 'PENDING'
    | 'CONFIRMED'
    | 'SENT_TO_KITCHEN'
    | 'SERVED';

interface IncomingOrdersModuleProps {
    orders:
    Order[];

    loading?:
    boolean;

    onView:
    (
        order:
            Order,
    ) => void;

    onTransition:
    (
        order:
            Order,

        action:
            OrderTransitionAction,
    ) => Promise<void>
        | void;

    onOpenPayment:
    (
        order:
            Order,
    ) => void;
}

const FILTERS:
    Array<{
        key:
        IncomingStatusFilter;

        label:
        string;
    }> = [
        {
            key:
                'ALL',

            label:
                'All Active',
        },

        {
            key:
                'PENDING',

            label:
                'Pending',
        },

        {
            key:
                'CONFIRMED',

            label:
                'Confirmed',
        },

        {
            key:
                'SENT_TO_KITCHEN',

            label:
                'Kitchen',
        },

        {
            key:
                'SERVED',

            label:
                'Served',
        },
    ];

export default function IncomingOrdersModule(
    {
        orders,
        loading = false,
        onView,
        onTransition,
        onOpenPayment,
    }: IncomingOrdersModuleProps,
) {
    const [
        statusFilter,
        setStatusFilter,
    ] =
        useState<IncomingStatusFilter>(
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
    | Status Counts
    |--------------------------------------------------------------------------
    */

    const counts =
        useMemo(
            () => ({
                ALL:
                    orders.length,

                PENDING:
                    orders.filter(
                        (
                            order,
                        ) =>
                            order.status
                            ===
                            'PENDING',
                    ).length,

                CONFIRMED:
                    orders.filter(
                        (
                            order,
                        ) =>
                            order.status
                            ===
                            'CONFIRMED',
                    ).length,

                SENT_TO_KITCHEN:
                    orders.filter(
                        (
                            order,
                        ) =>
                            order.status
                            ===
                            'SENT_TO_KITCHEN',
                    ).length,

                SERVED:
                    orders.filter(
                        (
                            order,
                        ) =>
                            order.status
                            ===
                            'SERVED',
                    ).length,
            }),
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

                            const searchable =
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

                            return searchable.includes(
                                query,
                            );
                        },
                    )
                    .sort(
                        (
                            left,
                            right,
                        ) => {
                            const leftTime =
                                new Date(
                                    left.created_at
                                    ??
                                    0,
                                ).getTime();

                            const rightTime =
                                new Date(
                                    right.created_at
                                    ??
                                    0,
                                ).getTime();

                            return rightTime
                                -
                                leftTime;
                        },
                    );
            },
            [
                orders,
                search,
                statusFilter,
            ],
        );

    return (
        <div className="incoming-orders-page">
            <header className="incoming-orders-header">
                <div>
                    <span className="incoming-orders-eyebrow">
                        LIVE OPERATIONS
                    </span>

                    <h1>
                        Incoming Orders
                    </h1>

                    <p>
                        Review and progress active customer
                        orders from confirmation through
                        payment readiness.
                    </p>
                </div>

                <div className="incoming-live-status">
                    <span />

                    LIVE
                </div>
            </header>

            <section className="incoming-summary-grid">
                <SummaryCard
                    label="Active Orders"
                    value={
                        counts.ALL
                    }
                    tone="primary"
                />

                <SummaryCard
                    label="Awaiting Confirmation"
                    value={
                        counts.PENDING
                    }
                    tone={
                        counts.PENDING > 0
                            ? 'warning'
                            : 'neutral'
                    }
                />

                <SummaryCard
                    label="Ready for Kitchen"
                    value={
                        counts.CONFIRMED
                    }
                />

                <SummaryCard
                    label="In Kitchen"
                    value={
                        counts.SENT_TO_KITCHEN
                    }
                    tone="purple"
                />

                <SummaryCard
                    label="Ready for Payment"
                    value={
                        counts.SERVED
                    }
                    tone={
                        counts.SERVED > 0
                            ? 'success'
                            : 'neutral'
                    }
                />
            </section>

            <section className="incoming-toolbar">
                <div className="incoming-search-wrap">
                    <span className="incoming-search-icon">
                        ⌕
                    </span>

                    <input
                        type="search"
                        value={
                            search
                        }
                        placeholder="Search order, table, token, customer or phone..."
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
                                    className="incoming-clear-search"
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

                <div className="incoming-filter-strip">
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
                                            ? 'incoming-filter active'
                                            : 'incoming-filter'
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
                                            counts[
                                            filter.key
                                            ]
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
                        <div className="incoming-loading">
                            Updating orders...
                        </div>
                    )
                    : null
            }

            {
                filteredOrders.length
                    ===
                    0
                    ? (
                        <section className="incoming-empty">
                            <div className="incoming-empty-icon">
                                #
                            </div>

                            <h2>
                                {
                                    orders.length
                                        ===
                                        0
                                        ? 'No Active Orders'
                                        : 'No Matching Orders'
                                }
                            </h2>

                            <p>
                                {
                                    orders.length
                                        ===
                                        0
                                        ? 'New QR, waiter and cashier orders will appear here.'
                                        : 'Change the status filter or search term to see other active orders.'
                                }
                            </p>
                        </section>
                    )
                    : (
                        <div className="incoming-orders-grid">
                            {
                                filteredOrders.map(
                                    (
                                        order,
                                    ) => (
                                        <IncomingOrderCard
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
                                            onTransition={
                                                onTransition
                                            }
                                            onOpenPayment={
                                                onOpenPayment
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
| Order Card
|--------------------------------------------------------------------------
*/

function IncomingOrderCard(
    {
        order,
        loading,
        onView,
        onTransition,
        onOpenPayment,
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

        onTransition:
        (
            order:
                Order,

            action:
                OrderTransitionAction,
        ) => Promise<void>
            | void;

        onOpenPayment:
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

    const itemQuantity =
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

    const previewItems =
        items.slice(
            0,
            4,
        );

    return (
        <article className="incoming-order-card">
            <div className="incoming-order-card-top">
                <div className="incoming-order-number-block">
                    <span className="incoming-order-source">
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

                    <span className="incoming-order-time">
                        {
                            formatOrderDateTime(
                                meta.createdAt,
                            )
                        }
                    </span>
                </div>

                <span
                    className={
                        `incoming-order-status ${orderStatusClass(
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

            <div className="incoming-order-important">
                <div>
                    <span>
                        {
                            meta.orderType
                                ===
                                'TAKEAWAY'
                                ? 'Pickup'
                                : 'Table'
                        }
                    </span>

                    <strong>
                        {
                            meta.orderType
                                ===
                                'TAKEAWAY'
                                ? 'TAKEAWAY'
                                : meta.tableName
                                ??
                                '-'
                        }
                    </strong>
                </div>

                <div>
                    <span>
                        Token
                    </span>

                    <strong className="incoming-token">
                        {
                            meta.token
                            ??
                            '-'
                        }
                    </strong>
                </div>

                <div>
                    <span>
                        Items
                    </span>

                    <strong>
                        {
                            itemQuantity
                        }
                    </strong>
                </div>

                <div>
                    <span>
                        Total
                    </span>

                    <strong className="incoming-total">
                        {
                            currentOrderMoney(
                                order.grand_total
                                ??
                                0,
                            )
                        }
                    </strong>
                </div>
            </div>

            {
                meta.customerName
                    ||
                    meta.customerPhone
                    ? (
                        <div className="incoming-customer">
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
                                        <span className="incoming-phone">
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

            <div className="incoming-items">
                <div className="incoming-items-heading">
                    <span>
                        ORDER ITEMS
                    </span>

                    <strong>
                        {
                            items.length
                        }
                        {' '}
                        lines
                    </strong>
                </div>

                {
                    previewItems.length
                        ===
                        0
                        ? (
                            <div className="incoming-item-empty">
                                Item details unavailable.
                            </div>
                        )
                        : previewItems.map(
                            (
                                item,
                            ) => (
                                <div
                                    className="incoming-item-row"
                                    key={
                                        item.id
                                    }
                                >
                                    <div className="incoming-item-qty">
                                        {
                                            item.quantity
                                        }
                                        ×
                                    </div>

                                    <div className="incoming-item-main">
                                        <strong>
                                            {
                                                item.name
                                            }
                                        </strong>

                                        {
                                            item.variant
                                                ? (
                                                    <span>
                                                        {
                                                            item.variant
                                                        }
                                                    </span>
                                                )
                                                : null
                                        }

                                        {
                                            item.notes
                                                ? (
                                                    <small>
                                                        Note:
                                                        {' '}
                                                        {
                                                            item.notes
                                                        }
                                                    </small>
                                                )
                                                : null
                                        }
                                    </div>

                                    <strong className="incoming-item-total">
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
                            <div className="incoming-more-items">
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

            <div className="incoming-order-actions">
                <button
                    type="button"
                    className="incoming-view-button"
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

                <QuickAction
                    order={
                        order
                    }
                    loading={
                        loading
                    }
                    onTransition={
                        onTransition
                    }
                    onOpenPayment={
                        onOpenPayment
                    }
                />
            </div>
        </article>
    );
}

/*
|--------------------------------------------------------------------------
| Quick Action
|--------------------------------------------------------------------------
*/

function QuickAction(
    {
        order,
        loading,
        onTransition,
        onOpenPayment,
    }: {
        order:
        Order;

        loading:
        boolean;

        onTransition:
        (
            order:
                Order,

            action:
                OrderTransitionAction,
        ) => Promise<void>
            | void;

        onOpenPayment:
        (
            order:
                Order,
        ) => void;
    },
) {
    switch (
    order.status
    ) {
        case 'PENDING':
            return (
                <button
                    type="button"
                    className="incoming-main-action confirm"
                    disabled={
                        loading
                    }
                    onClick={
                        () => {
                            void onTransition(
                                order,
                                'confirm',
                            );
                        }
                    }
                >
                    Confirm Order
                </button>
            );

        case 'CONFIRMED':
            return (
                <button
                    type="button"
                    className="incoming-main-action kitchen"
                    disabled={
                        loading
                    }
                    onClick={
                        () => {
                            void onTransition(
                                order,
                                'send-to-kitchen',
                            );
                        }
                    }
                >
                    Send to Kitchen
                </button>
            );

        case 'SENT_TO_KITCHEN':
            return (
                <button
                    type="button"
                    className="incoming-main-action serve"
                    disabled={
                        loading
                    }
                    onClick={
                        () => {
                            void onTransition(
                                order,
                                'serve',
                            );
                        }
                    }
                >
                    Mark as Served
                </button>
            );

        case 'SERVED':
            return (
                <button
                    type="button"
                    className="incoming-main-action payment"
                    disabled={
                        loading
                    }
                    onClick={
                        () =>
                            onOpenPayment(
                                order,
                            )
                    }
                >
                    Proceed to Payment
                </button>
            );

        default:
            return null;
    }
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
        number;

        tone?:
        | 'neutral'
        | 'primary'
        | 'warning'
        | 'success'
        | 'purple';
    },
) {
    return (
        <div
            className={
                `incoming-summary-card ${tone}`
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