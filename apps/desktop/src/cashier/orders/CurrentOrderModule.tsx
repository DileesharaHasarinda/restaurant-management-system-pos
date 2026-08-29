import {
    useMemo,
} from 'react';

import type {
    Order,
} from '../../types';

import {
    currentOrderMoney,
    formatOrderDateTime,
    getOrderActions,
    getOrderDisplayItems,
    getOrderDisplayMeta,
    getPendingKitchenItemCount,
    orderStatusClass,
    orderStatusLabel,
} from './helpers';

import type {
    OrderTransitionAction,
} from './types';

import './CurrentOrderModule.css';

interface CurrentOrderModuleProps {
    order:
    Order | null;

    loading?:
    boolean;

    onTransition:
    (
        order:
            Order,

        action:
            OrderTransitionAction,
    ) =>
        Promise<void>
        | void;

    onOpenPayment:
    (
        order:
            Order,
    ) => void;

    onOpenCorrections?:
    (
        order:
            Order,
    ) => void;
}

export default function CurrentOrderModule(
    {
        order,
        loading = false,
        onTransition,
        onOpenPayment,
        onOpenCorrections,
    }: CurrentOrderModuleProps,
) {
    const items =
        useMemo(
            () =>
                order
                    ? getOrderDisplayItems(
                        order,
                    )
                    : [],
            [
                order,
            ],
        );

    const meta =
        useMemo(
            () =>
                order
                    ? getOrderDisplayMeta(
                        order,
                    )
                    : null,
            [
                order,
            ],
        );

    const actions =
        useMemo(
            () =>
                order
                    ? getOrderActions(
                        order,
                    )
                    : {
                        can_confirm:
                            false,

                        can_reject:
                            false,

                        can_send_to_kitchen:
                            false,

                        can_serve:
                            false,

                        can_complete:
                            false,

                        can_cancel:
                            false,
                    },
            [
                order,
            ],
        );

    const pendingKitchenCount =
        useMemo(
            () =>
                order
                    ? getPendingKitchenItemCount(
                        order,
                    )
                    : 0,
            [
                order,
            ],
        );

    if (
        !order
        ||
        !meta
    ) {
        return (
            <div className="current-order-page">
                <header className="current-order-header">
                    <div>
                        <span className="current-order-eyebrow">
                            ORDER MANAGEMENT
                        </span>

                        <h1>
                            Current Order
                        </h1>

                        <p>
                            Select an incoming or active
                            order to continue processing.
                        </p>
                    </div>
                </header>

                <section className="current-order-empty">
                    <div className="current-order-empty-icon">
                        #
                    </div>

                    <h2>
                        No Order Selected
                    </h2>

                    <p>
                        Open an order from Incoming Orders
                        to review items and continue the
                        restaurant workflow.
                    </p>
                </section>
            </div>
        );
    }

    const status =
        String(
            order.status
            ??
            '',
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

    const orderTotal =
        Number(
            order.grand_total
            ??
            0,
        );

    const terminal =
        status
        ===
        'COMPLETED'
        ||
        status
        ===
        'CANCELLED'
        ||
        status
        ===
        'REJECTED';

    const sentItemCount =
        items.filter(
            (
                item,
            ) =>
                item.kitchenState
                ===
                'SENT',
        ).length;

    return (
        <div className="current-order-page">
            <header className="current-order-header">
                <div>
                    <span className="current-order-eyebrow">
                        ORDER MANAGEMENT
                    </span>

                    <h1>
                        Current Order
                    </h1>

                    <p>
                        {
                            order.order_number
                                ? `Order ${order.order_number}`
                                : `Order #${order.id}`
                        }

                        {
                            meta.createdAt
                                ? ` • ${formatOrderDateTime(
                                    meta.createdAt,
                                )}`
                                : ''
                        }
                    </p>
                </div>

                <div
                    className={
                        `current-order-status ${orderStatusClass(
                            status,
                        )}`
                    }
                >
                    {
                        orderStatusLabel(
                            status,
                        )
                    }
                </div>
            </header>

            {
                pendingKitchenCount
                    >
                    0
                    ? (
                        <section className="current-order-pending-kitchen">
                            <div className="current-order-pending-kitchen-icon">
                                !
                            </div>

                            <div>
                                <strong>
                                    {
                                        pendingKitchenCount
                                    }
                                    {' '}
                                    {
                                        pendingKitchenCount
                                            ===
                                            1
                                            ? 'item is'
                                            : 'items are'
                                    }
                                    {' '}
                                    waiting for the kitchen
                                </strong>

                                <span>
                                    These are newly added items
                                    that have not yet been included
                                    in a kitchen ticket.
                                </span>
                            </div>
                        </section>
                    )
                    : null
            }

            <section className="current-order-summary">
                <SummaryItem
                    label="Order Type"
                    value={
                        meta.orderType
                            ?.replace(
                                /_/g,
                                ' ',
                            )
                        ??
                        '-'
                    }
                />

                <SummaryItem
                    label="Table"
                    value={
                        meta.tableName
                        ??
                        (
                            meta.orderType
                                ===
                                'TAKEAWAY'
                                ? 'TAKEAWAY'
                                : '-'
                        )
                    }
                />

                <SummaryItem
                    label="Token"
                    value={
                        meta.token
                        ??
                        '-'
                    }
                />

                <SummaryItem
                    label="Items"
                    value={
                        String(
                            quantity,
                        )
                    }
                />

                <SummaryItem
                    label="Kitchen"
                    value={
                        pendingKitchenCount
                            >
                            0
                            ? `${pendingKitchenCount} waiting`
                            : (
                                sentItemCount
                                    >
                                    0
                                    ? 'All sent'
                                    : 'Not sent'
                            )
                    }
                />

                <SummaryItem
                    label="Grand Total"
                    value={
                        currentOrderMoney(
                            orderTotal,
                        )
                    }
                    primary
                />
            </section>

            <div className="current-order-layout">
                <section className="current-order-card">
                    <div className="current-order-card-header">
                        <div>
                            <span className="current-order-card-kicker">
                                ORDER ITEMS
                            </span>

                            <h2>
                                Customer Order
                            </h2>
                        </div>

                        <span className="current-order-item-count">
                            {
                                items.length
                            }
                            {' '}
                            {
                                items.length
                                    ===
                                    1
                                    ? 'line'
                                    : 'lines'
                            }
                        </span>
                    </div>

                    {
                        items.length
                            ===
                            0
                            ? (
                                <div className="current-order-no-items">
                                    No item details are
                                    available for this order.
                                </div>
                            )
                            : (
                                <div className="current-order-items">
                                    {
                                        items.map(
                                            (
                                                item,
                                            ) => (
                                                <article
                                                    className={
                                                        item.kitchenState
                                                            ===
                                                            'CANCELLED'
                                                            ? 'current-order-item is-cancelled'
                                                            : 'current-order-item'
                                                    }
                                                    key={
                                                        item.id
                                                    }
                                                >
                                                    <div className="current-order-qty">
                                                        {
                                                            item.quantity
                                                        }
                                                        ×
                                                    </div>

                                                    <div className="current-order-item-main">
                                                        <div className="current-order-item-title-row">
                                                            <strong>
                                                                {
                                                                    item.name
                                                                }
                                                            </strong>

                                                            <KitchenBadge
                                                                state={
                                                                    item.kitchenState
                                                                }
                                                            />
                                                        </div>

                                                        {
                                                            item.variant
                                                                ? (
                                                                    <span className="current-order-variant">
                                                                        {
                                                                            item.variant
                                                                        }
                                                                    </span>
                                                                )
                                                                : null
                                                        }

                                                        {
                                                            item.addons.length
                                                                >
                                                                0
                                                                ? (
                                                                    <div className="current-order-addons">
                                                                        {
                                                                            item.addons.map(
                                                                                (
                                                                                    addon,
                                                                                    index,
                                                                                ) => (
                                                                                    <span
                                                                                        key={
                                                                                            addon.id
                                                                                            ??
                                                                                            `${item.id}-${index}`
                                                                                        }
                                                                                    >
                                                                                        + {addon.name}

                                                                                        {
                                                                                            addon.quantity
                                                                                                !==
                                                                                                1
                                                                                                ? ` × ${addon.quantity}`
                                                                                                : ''
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
                                                            item.notes
                                                                ? (
                                                                    <div className="current-order-note">
                                                                        <strong>
                                                                            Note:
                                                                        </strong>

                                                                        {' '}

                                                                        {
                                                                            item.notes
                                                                        }
                                                                    </div>
                                                                )
                                                                : null
                                                        }

                                                        {
                                                            item.sentToKitchenAt
                                                                ? (
                                                                    <span className="current-order-kitchen-time">
                                                                        Kitchen:
                                                                        {' '}
                                                                        {
                                                                            formatOrderDateTime(
                                                                                item.sentToKitchenAt,
                                                                            )
                                                                        }
                                                                    </span>
                                                                )
                                                                : null
                                                        }
                                                    </div>

                                                    <div className="current-order-line-total">
                                                        {
                                                            currentOrderMoney(
                                                                item.lineTotal,
                                                            )
                                                        }
                                                    </div>
                                                </article>
                                            ),
                                        )
                                    }
                                </div>
                            )
                    }

                    <div className="current-order-total">
                        <span>
                            Grand Total
                        </span>

                        <strong>
                            {
                                currentOrderMoney(
                                    orderTotal,
                                )
                            }
                        </strong>
                    </div>
                </section>

                <aside className="current-order-side">
                    <section className="current-order-card">
                        <span className="current-order-card-kicker">
                            ORDER PROGRESS
                        </span>

                        <h2 className="current-order-progress-title">
                            Lifecycle
                        </h2>

                        <OrderProgress
                            status={
                                status
                            }
                        />
                    </section>

                    {
                        meta.customerName
                            ||
                            meta.customerPhone
                            ? (
                                <section className="current-order-card">
                                    <span className="current-order-card-kicker">
                                        CUSTOMER
                                    </span>

                                    <h2 className="current-order-progress-title">
                                        Customer Details
                                    </h2>

                                    <div className="current-order-customer-row">
                                        <span>
                                            Name
                                        </span>

                                        <strong>
                                            {
                                                meta.customerName
                                                ??
                                                '-'
                                            }
                                        </strong>
                                    </div>

                                    <div className="current-order-customer-row">
                                        <span>
                                            Phone
                                        </span>

                                        <strong>
                                            {
                                                meta.customerPhone
                                                ??
                                                '-'
                                            }
                                        </strong>
                                    </div>
                                </section>
                            )
                            : null
                    }
                </aside>
            </div>

            {
                !terminal
                    ? (
                        <section className="current-order-action-bar">
                            <div>
                                <span>
                                    Next Action
                                </span>

                                <strong>
                                    {
                                        nextActionDescription(
                                            status,
                                            pendingKitchenCount,
                                        )
                                    }
                                </strong>
                            </div>

                            <div className="current-order-actions">
                                {
                                    actions.can_confirm
                                        ? (
                                            <button
                                                type="button"
                                                className="current-order-primary"
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
                                                {
                                                    loading
                                                        ? 'Processing...'
                                                        : 'Confirm Order'
                                                }
                                            </button>
                                        )
                                        : null
                                }

                                {
                                    actions.can_send_to_kitchen
                                        ? (
                                            <button
                                                type="button"
                                                className="current-order-primary"
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
                                                {
                                                    loading
                                                        ? 'Sending...'
                                                        : (
                                                            pendingKitchenCount
                                                                >
                                                                0
                                                                &&
                                                                status
                                                                ===
                                                                'SENT_TO_KITCHEN'
                                                                ? `Send ${pendingKitchenCount} New ${pendingKitchenCount
                                                                    ===
                                                                    1
                                                                    ? 'Item'
                                                                    : 'Items'
                                                                }`
                                                                : 'Send to Kitchen'
                                                        )
                                                }
                                            </button>
                                        )
                                        : null
                                }

                                {
                                    actions.can_serve
                                        ? (
                                            <button
                                                type="button"
                                                className="current-order-primary served"
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
                                                {
                                                    loading
                                                        ? 'Processing...'
                                                        : 'Mark as Served'
                                                }
                                            </button>
                                        )
                                        : null
                                }

                                {
                                    status
                                        ===
                                        'SERVED'
                                        ? (
                                            <button
                                                type="button"
                                                className="current-order-payment"
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
                                        )
                                        : null
                                }

                                {
                                    actions.can_cancel
                                        &&
                                        onOpenCorrections
                                        ? (
                                            <button
                                                type="button"
                                                className="current-order-danger"
                                                disabled={
                                                    loading
                                                }
                                                onClick={
                                                    () =>
                                                        onOpenCorrections(
                                                            order,
                                                        )
                                                }
                                            >
                                                Cancel / Correct
                                            </button>
                                        )
                                        : null
                                }
                            </div>
                        </section>
                    )
                    : (
                        <section
                            className={
                                status
                                    ===
                                    'COMPLETED'
                                    ? 'current-order-terminal completed'
                                    : 'current-order-terminal cancelled'
                            }
                        >
                            <strong>
                                {
                                    status
                                        ===
                                        'COMPLETED'
                                        ? 'Order Completed'
                                        : `Order ${orderStatusLabel(
                                            status,
                                        )}`
                                }
                            </strong>

                            <span>
                                {
                                    status
                                        ===
                                        'COMPLETED'
                                        ? 'This order has finished its operational lifecycle.'
                                        : 'No further lifecycle processing is available for this order.'
                                }
                            </span>
                        </section>
                    )
            }

            {
                status
                    ===
                    'SERVED'
                    ? (
                        <div className="current-order-billing-note">
                            <strong>
                                Billing required
                            </strong>

                            <span>
                                The order is served. Complete
                                customer billing in the Payment
                                module before final order
                                completion.
                            </span>
                        </div>
                    )
                    : null
            }
        </div>
    );
}

function KitchenBadge(
    {
        state,
    }: {
        state:
        'WAITING'
        | 'SENT'
        | 'CANCELLED';
    },
) {
    if (
        state
        ===
        'CANCELLED'
    ) {
        return (
            <span className="current-order-kitchen-badge cancelled">
                Cancelled
            </span>
        );
    }

    if (
        state
        ===
        'SENT'
    ) {
        return (
            <span className="current-order-kitchen-badge sent">
                ✓ Sent to Kitchen
            </span>
        );
    }

    return (
        <span className="current-order-kitchen-badge waiting">
            Waiting for Kitchen
        </span>
    );
}

function SummaryItem(
    {
        label,
        value,
        primary = false,
    }: {
        label:
        string;

        value:
        string;

        primary?:
        boolean;
    },
) {
    return (
        <div
            className={
                primary
                    ? 'current-order-summary-item primary'
                    : 'current-order-summary-item'
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

function OrderProgress(
    {
        status,
    }: {
        status:
        string;
    },
) {
    const normalFlow =
        [
            'PENDING',
            'CONFIRMED',
            'SENT_TO_KITCHEN',
            'SERVED',
            'COMPLETED',
        ];

    const currentIndex =
        normalFlow.indexOf(
            status,
        );

    const terminalFailure =
        status
        ===
        'CANCELLED'
        ||
        status
        ===
        'REJECTED';

    return (
        <div className="current-order-progress">
            {
                normalFlow.map(
                    (
                        stage,
                        index,
                    ) => {
                        const complete =
                            !terminalFailure
                            &&
                            currentIndex
                            >=
                            index;

                        const active =
                            status
                            ===
                            stage;

                        return (
                            <div
                                className={
                                    [
                                        'current-order-progress-row',

                                        complete
                                            ? 'complete'
                                            : '',

                                        active
                                            ? 'active'
                                            : '',
                                    ]
                                        .filter(
                                            Boolean,
                                        )
                                        .join(
                                            ' ',
                                        )
                                }
                                key={
                                    stage
                                }
                            >
                                <span className="current-order-progress-dot">
                                    {
                                        complete
                                            ? '✓'
                                            : ''
                                    }
                                </span>

                                <strong>
                                    {
                                        orderStatusLabel(
                                            stage,
                                        )
                                    }
                                </strong>
                            </div>
                        );
                    },
                )
            }

            {
                terminalFailure
                    ? (
                        <div className="current-order-progress-failure">
                            {
                                orderStatusLabel(
                                    status,
                                )
                            }
                        </div>
                    )
                    : null
            }
        </div>
    );
}

const nextActionDescription =
    (
        status:
            string,

        pendingKitchenCount:
            number,
    ): string => {
        switch (
        status
        ) {
            case 'PENDING':
                return 'Review and confirm the customer order.';

            case 'CONFIRMED':
                return pendingKitchenCount
                    >
                    0
                    ? `${pendingKitchenCount} ${pendingKitchenCount
                        ===
                        1
                        ? 'item is'
                        : 'items are'
                    } ready to send to the kitchen.`
                    : 'The confirmed order is ready for kitchen processing.';

            case 'SENT_TO_KITCHEN':
                return pendingKitchenCount
                    >
                    0
                    ? `Send the ${pendingKitchenCount} newly added ${pendingKitchenCount
                        ===
                        1
                        ? 'item'
                        : 'items'
                    } to the kitchen.`
                    : 'Mark the order served when all food has been delivered.';

            case 'SERVED':
                return 'Generate the final invoice and collect customer payment.';

            default:
                return 'No operational action is currently required.';
        }
    };