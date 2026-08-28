import CashierShiftModule
    from './cashier/shifts/CashierShiftModule';

import BusinessDayModule
    from './cashier/businessDay/BusinessDayModule';

import CashDrawerModule
    from './cashier/drawer/CashDrawerModule';

import PaymentModule
    from './cashier/payments/PaymentModule';

import type {
    CashierInvoice,
} from './cashier/payments/types';

import CurrentOrderModule
    from './cashier/orders/CurrentOrderModule';

import IncomingOrdersModule
    from './cashier/orders/IncomingOrdersModule';

import SalesHistoryModule
    from './cashier/orders/SalesHistoryModule';

import TakeawayModule
    from './cashier/takeaway/TakeawayModule';

import TablesModule
    from './cashier/tables/TablesModule';

import PosModule
    from './cashier/pos/PosModule';

import SettingsModule
    from './cashier/settings/SettingsModule';

import type {
    ProductSelection,
} from './cashier/pos/types';

import {
    cartLineTotal,
} from './cashier/pos/helpers';

import type {
    TakeawaySubmissionData,
} from './cashier/takeaway/types';

import type {
    CashierTable,
} from './cashier/tables/types';

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import {
    ApiError,
    api,
    extractList,
} from './api';

import type {
    CartLine,
    MenuCategory,
    MenuItem,
    Order,
    PosUser,
} from './types';

/*
|--------------------------------------------------------------------------
| Cashier Modules
|--------------------------------------------------------------------------
*/

type PosModule =
    | 'tables'
    | 'incoming'
    | 'pos'
    | 'takeaway'
    | 'current-order'
    | 'payment'
    | 'history'
    | 'drawer'
    | 'shift'
    | 'business-day'
    | 'settings';

/*
|--------------------------------------------------------------------------
| Props
|--------------------------------------------------------------------------
*/

interface CashierWorkspaceProps {
    user:
    PosUser;

    onLogout:
    () => Promise<void>;

    onSessionExpired:
    () => void;
}

/*
|--------------------------------------------------------------------------
| Laravel Order Response Types
|--------------------------------------------------------------------------
*/

interface ApiOrderCustomer {
    name?:
    string | null;

    phone?:
    string | null;
}

interface ApiOrderTotals {
    subtotal?:
    number;

    discount?:
    number;

    tax?:
    number;

    service_charge?:
    number;

    grand_total?:
    number;
}

interface ApiOrderAddon {
    id?:
    number;

    addon_id?:
    number | null;

    name?:
    string | null;

    quantity?:
    number;

    unit_price?:
    number;

    line_total?:
    number;
}

interface ApiOrderItem {
    id?:
    number;

    menu_item_id?:
    number | null;

    variant_id?:
    number | null;

    name?:
    string | null;

    variant?:
    string | null;

    quantity?:
    number;

    unit_price?:
    number;

    line_total?:
    number;

    status?:
    string;

    special_notes?:
    string | null;

    sent_to_kitchen_at?:
    string | null;

    cancelled_at?:
    string | null;

    addons?:
    ApiOrderAddon[];
}

interface ApiOrderResponse {
    id?:
    number;

    order_number?:
    string;

    business_day_id?:
    number;

    table_session_id?:
    number | null;

    table_id?:
    number | null;

    table_name?:
    string | null;

    takeaway_token?:
    string | null;

    pickup_notes?:
    string | null;

    order_type?:
    string;

    order_source?:
    string;

    session_sequence?:
    number | null;

    status?:
    string;

    customer?:
    ApiOrderCustomer | null;

    totals?:
    ApiOrderTotals | null;

    customer_notes?:
    string | null;

    internal_notes?:
    string | null;

    created_by?:
    number | null;

    confirmed_by?:
    number | null;

    cancelled_by?:
    number | null;

    rejected_by?:
    number | null;

    confirmed_at?:
    string | null;

    sent_to_kitchen_at?:
    string | null;

    served_at?:
    string | null;

    completed_at?:
    string | null;

    cancelled_at?:
    string | null;

    rejected_at?:
    string | null;

    cancellation_reason?:
    string | null;

    rejection_reason?:
    string | null;

    pending_kitchen_item_count?:
    number;

    items?:
    ApiOrderItem[];

    status_history?:
    unknown[];

    created_at?:
    string | null;

    updated_at?:
    string | null;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const makeLocalId =
    (): string =>
        `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

/*
|--------------------------------------------------------------------------
| Order Normalizer
|--------------------------------------------------------------------------
*/

const normalizeOrder =
    (
        raw:
            ApiOrderResponse,
    ): Order => {
        const totals =
            raw.totals
            ??
            {};

        const customer =
            raw.customer
            ??
            {};

        const items =
            (
                raw.items
                ??
                []
            ).map(
                (
                    item,
                ) => ({
                    id:
                        Number(
                            item.id
                            ??
                            0,
                        ),

                    menu_item_id:
                        item.menu_item_id
                        ??
                        null,

                    item_name_snapshot:
                        item.name
                        ??
                        'Item',

                    item_name:
                        item.name
                        ??
                        'Item',

                    variant_name_snapshot:
                        item.variant
                        ??
                        null,

                    variant_name:
                        item.variant
                        ??
                        null,

                    quantity:
                        Number(
                            item.quantity
                            ??
                            0,
                        ),

                    unit_price:
                        Number(
                            item.unit_price
                            ??
                            0,
                        ),

                    line_total:
                        Number(
                            item.line_total
                            ??
                            0,
                        ),

                    status:
                        item.status
                        ??
                        'ACTIVE',

                    special_notes:
                        item.special_notes
                        ??
                        null,

                    sent_to_kitchen_at:
                        item.sent_to_kitchen_at
                        ??
                        null,

                    addons:
                        (
                            item.addons
                            ??
                            []
                        ).map(
                            (
                                addon,
                            ) => ({
                                id:
                                    addon.id,

                                addon_id:
                                    addon.addon_id
                                    ??
                                    undefined,

                                addon_name_snapshot:
                                    addon.name
                                    ??
                                    undefined,

                                name:
                                    addon.name
                                    ??
                                    undefined,

                                quantity:
                                    Number(
                                        addon.quantity
                                        ??
                                        0,
                                    ),

                                unit_price:
                                    Number(
                                        addon.unit_price
                                        ??
                                        0,
                                    ),

                                line_total:
                                    Number(
                                        addon.line_total
                                        ??
                                        0,
                                    ),
                            }),
                        ),
                }),
            );

        return {
            id:
                Number(
                    raw.id
                    ??
                    0,
                ),

            order_number:
                raw.order_number
                ??
                '',

            order_type:
                raw.order_type
                ??
                '',

            order_source:
                raw.order_source
                ??
                '',

            status:
                raw.status
                ??
                '',

            table_session_id:
                raw.table_session_id
                ??
                null,

            table_id:
                raw.table_id
                ??
                null,

            table_name_snapshot:
                raw.table_name
                ??
                null,

            table_name:
                raw.table_name
                ??
                null,

            takeaway_token:
                raw.takeaway_token
                ??
                null,

            customer_name:
                customer.name
                ??
                null,

            customer_phone:
                customer.phone
                ??
                null,

            customer_notes:
                raw.customer_notes
                ??
                null,

            pickup_notes:
                raw.pickup_notes
                ??
                null,

            subtotal:
                Number(
                    totals.subtotal
                    ??
                    0,
                ),

            discount_total:
                Number(
                    totals.discount
                    ??
                    0,
                ),

            tax_total:
                Number(
                    totals.tax
                    ??
                    0,
                ),

            service_charge_total:
                Number(
                    totals.service_charge
                    ??
                    0,
                ),

            grand_total:
                Number(
                    totals.grand_total
                    ??
                    0,
                ),

            created_at:
                raw.created_at
                ??
                null,

            confirmed_at:
                raw.confirmed_at
                ??
                null,

            sent_to_kitchen_at:
                raw.sent_to_kitchen_at
                ??
                null,

            served_at:
                raw.served_at
                ??
                null,

            completed_at:
                raw.completed_at
                ??
                null,

            items,
        };
    };

const normalizeOrders =
    (
        values:
            ApiOrderResponse[],
    ): Order[] =>
        values.map(
            (
                order,
            ) =>
                normalizeOrder(
                    order,
                ),
        );

/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

const moduleItems:
    Array<{
        key:
        PosModule;

        label:
        string;

        short:
        string;
    }> = [
        {
            key:
                'tables',

            label:
                'Tables',

            short:
                'TB',
        },

        {
            key:
                'incoming',

            label:
                'Incoming Orders',

            short:
                'IN',
        },

        {
            key:
                'pos',

            label:
                'POS',

            short:
                'PO',
        },

        {
            key:
                'takeaway',

            label:
                'Takeaway',

            short:
                'TA',
        },

        {
            key:
                'current-order',

            label:
                'Current Order',

            short:
                'CO',
        },

        {
            key:
                'payment',

            label:
                'Payment',

            short:
                'PY',
        },

        {
            key:
                'history',

            label:
                'Sales History',

            short:
                'SH',
        },

        {
            key:
                'drawer',

            label:
                'Cash Drawer',

            short:
                'CD',
        },

        {
            key:
                'shift',

            label:
                'Shift',

            short:
                'SF',
        },

        {
            key:
                'business-day',

            label:
                'Business Day',

            short:
                'BD',
        },

        {
            key:
                'settings',

            label:
                'Settings',

            short:
                'ST',
        },
    ];

/*
|--------------------------------------------------------------------------
| Workspace
|--------------------------------------------------------------------------
*/

export default function CashierWorkspace(
    {
        user,
        onLogout,
        onSessionExpired,
    }: CashierWorkspaceProps,
) {
    /*
    |--------------------------------------------------------------------------
    | Navigation
    |--------------------------------------------------------------------------
    */

    const [
        activeModule,
        setActiveModule,
    ] =
        useState<PosModule>(
            'tables',
        );

    /*
    |--------------------------------------------------------------------------
    | Clock
    |--------------------------------------------------------------------------
    */

    const [
        now,
        setNow,
    ] =
        useState(
            new Date(),
        );

    /*
    |--------------------------------------------------------------------------
    | Main API State
    |--------------------------------------------------------------------------
    */

    const [
        tables,
        setTables,
    ] =
        useState<CashierTable[]>(
            [],
        );

    const [
        orders,
        setOrders,
    ] =
        useState<Order[]>(
            [],
        );

    const [
        categories,
        setCategories,
    ] =
        useState<MenuCategory[]>(
            [],
        );

    const [
        menuItems,
        setMenuItems,
    ] =
        useState<MenuItem[]>(
            [],
        );

    /*
    |--------------------------------------------------------------------------
    | Application State
    |--------------------------------------------------------------------------
    */

    const [
        loading,
        setLoading,
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
        online,
        setOnline,
    ] =
        useState(
            false,
        );

    const [
        selectedOrder,
        setSelectedOrder,
    ] =
        useState<Order | null>(
            null,
        );

    /*
    |--------------------------------------------------------------------------
    | Shared POS / Takeaway Cart
    |--------------------------------------------------------------------------
    |
    | The cart remains at workspace level intentionally.
    |
    | This means navigation does NOT destroy the cart:
    |
    | POS
    | → Tables
    | → Incoming Orders
    | → Current Order
    | → POS
    |
    | Cart still exists.
    |--------------------------------------------------------------------------
    */

    const [
        cart,
        setCart,
    ] =
        useState<CartLine[]>(
            [],
        );

    /*
    |--------------------------------------------------------------------------
    | API Error Handler
    |--------------------------------------------------------------------------
    */

    const handleError =
        useCallback(
            (
                exception:
                    unknown,
            ): void => {
                if (
                    exception instanceof ApiError
                    &&
                    exception.status
                    ===
                    401
                ) {
                    onSessionExpired();

                    return;
                }

                setError(
                    exception
                        instanceof Error
                        ? exception.message
                        : 'An unexpected error occurred.',
                );
            },
            [
                onSessionExpired,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Load Tables
    |--------------------------------------------------------------------------
    */

    const loadTables =
        useCallback(
            async (): Promise<void> => {
                try {
                    const response =
                        await api.get<unknown>(
                            '/tables',
                        );

                    setTables(
                        extractList<CashierTable>(
                            response.data,
                        ),
                    );

                    setOnline(
                        true,
                    );
                } catch (
                exception
                ) {
                    setOnline(
                        false,
                    );

                    handleError(
                        exception,
                    );
                }
            },
            [
                handleError,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Load Orders
    |--------------------------------------------------------------------------
    */

    const loadOrders =
        useCallback(
            async (): Promise<void> => {
                try {
                    const response =
                        await api.get<unknown>(
                            '/orders',
                        );

                    const rawOrders =
                        extractList<ApiOrderResponse>(
                            response.data,
                        );

                    setOrders(
                        normalizeOrders(
                            rawOrders,
                        ),
                    );

                    setOnline(
                        true,
                    );
                } catch (
                exception
                ) {
                    setOnline(
                        false,
                    );

                    handleError(
                        exception,
                    );
                }
            },
            [
                handleError,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Load Menu
    |--------------------------------------------------------------------------
    */

    const loadMenu =
        useCallback(
            async (): Promise<void> => {
                try {
                    const [
                        categoryResponse,
                        itemResponse,
                    ] =
                        await Promise.all([
                            api.get<unknown>(
                                '/menu/categories',
                            ),

                            api.get<unknown>(
                                '/menu/items',
                            ),
                        ]);

                    const loadedCategories =
                        extractList<MenuCategory>(
                            categoryResponse.data,
                        ).filter(
                            (
                                category,
                            ) =>
                                category.is_active
                                !==
                                false,
                        );

                    const loadedItems =
                        extractList<MenuItem>(
                            itemResponse.data,
                        ).filter(
                            (
                                item,
                            ) =>
                                item.is_active
                                !==
                                false
                                &&
                                item.is_available
                                !==
                                false,
                        );

                    setCategories(
                        loadedCategories,
                    );

                    setMenuItems(
                        loadedItems,
                    );

                    setOnline(
                        true,
                    );
                } catch (
                exception
                ) {
                    setOnline(
                        false,
                    );

                    handleError(
                        exception,
                    );
                }
            },
            [
                handleError,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Refresh Workspace
    |--------------------------------------------------------------------------
    */

    const refreshAll =
        useCallback(
            async (): Promise<void> => {
                setLoading(
                    true,
                );

                setError(
                    null,
                );

                try {
                    await Promise.all([
                        loadTables(),
                        loadOrders(),
                        loadMenu(),
                    ]);
                } finally {
                    setLoading(
                        false,
                    );
                }
            },
            [
                loadMenu,
                loadOrders,
                loadTables,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Initial Load
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            void refreshAll();
        },
        [
            refreshAll,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Clock
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timer =
                window.setInterval(
                    () => {
                        setNow(
                            new Date(),
                        );
                    },
                    1000,
                );

            return () => {
                window.clearInterval(
                    timer,
                );
            };
        },
        [],
    );

    /*
    |--------------------------------------------------------------------------
    | Incoming Orders
    |--------------------------------------------------------------------------
    */

    const incomingOrders =
        useMemo(
            () =>
                orders.filter(
                    (
                        order,
                    ) =>
                        [
                            'PENDING',
                            'CONFIRMED',
                            'SENT_TO_KITCHEN',
                            'SERVED',
                        ].includes(
                            order.status,
                        ),
                ),
            [
                orders,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Sales History
    |--------------------------------------------------------------------------
    */

    const salesHistory =
        useMemo(
            () =>
                orders.filter(
                    (
                        order,
                    ) =>
                        [
                            'COMPLETED',
                            'CANCELLED',
                            'REJECTED',
                        ].includes(
                            order.status,
                        ),
                ),
            [
                orders,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Permission-Aware Navigation
    |--------------------------------------------------------------------------
    */

    const visibleModuleItems =
        useMemo(
            () =>
                moduleItems.filter(
                    (
                        item,
                    ) =>
                        item.key
                        !==
                        'business-day'
                        ||
                        user.permissions.includes(
                            'business_day.view',
                        ),
                ),
            [
                user.permissions,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Cart Total
    |--------------------------------------------------------------------------
    */

    const cartTotal =
        useMemo(
            () =>
                cart.reduce(
                    (
                        total,
                        line,
                    ) =>
                        total
                        +
                        cartLineTotal(
                            line,
                        ),

                    0,
                ),
            [
                cart,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Add Product to Cart
    |--------------------------------------------------------------------------
    */

    const addSelectionToCart =
        (
            selection:
                ProductSelection,
        ): void => {
            const addonSignature =
                selection.addons
                    .map(
                        (
                            selected,
                        ) =>
                            `${selected.addon.id}:${selected.quantity}`,
                    )
                    .sort()
                    .join(
                        '|',
                    );

            const signature =
                [
                    selection.item.id,

                    selection.variant
                        ?.id
                    ??
                    'base',

                    addonSignature,

                    selection.notes.trim(),
                ].join(
                    '::',
                );

            setCart(
                (
                    current,
                ) => {
                    const existing =
                        current.find(
                            (
                                line,
                            ) =>
                                line.id.startsWith(
                                    `${signature}--`,
                                ),
                        );

                    if (
                        existing
                    ) {
                        return current.map(
                            (
                                line,
                            ) =>
                                line.id
                                    ===
                                    existing.id
                                    ? {
                                        ...line,

                                        quantity:
                                            line.quantity
                                            +
                                            selection.quantity,
                                    }
                                    : line,
                        );
                    }

                    return [
                        ...current,

                        {
                            id:
                                `${signature}--${makeLocalId()}`,

                            item:
                                selection.item,

                            variant:
                                selection.variant,

                            addons:
                                selection.addons,

                            quantity:
                                selection.quantity,

                            notes:
                                selection.notes.trim(),
                        },
                    ];
                },
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Change Cart Quantity
    |--------------------------------------------------------------------------
    */

    const changeCartQuantity =
        (
            id:
                string,

            difference:
                number,
        ): void => {
            setCart(
                (
                    current,
                ) =>
                    current
                        .map(
                            (
                                line,
                            ) =>
                                line.id
                                    ===
                                    id
                                    ? {
                                        ...line,

                                        quantity:
                                            Math.max(
                                                0,

                                                line.quantity
                                                +
                                                difference,
                                            ),
                                    }
                                    : line,
                        )
                        .filter(
                            (
                                line,
                            ) =>
                                line.quantity
                                >
                                0,
                        ),
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Remove Cart Item
    |--------------------------------------------------------------------------
    */

    const removeCartLine =
        (
            id:
                string,
        ): void => {
            setCart(
                (
                    current,
                ) =>
                    current.filter(
                        (
                            line,
                        ) =>
                            line.id
                            !==
                            id,
                    ),
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Load Full Order
    |--------------------------------------------------------------------------
    */

    const loadOrderDetail =
        async (
            order:
                Order,
        ): Promise<void> => {
            setError(
                null,
            );

            try {
                const response =
                    await api.get<ApiOrderResponse>(
                        `/orders/${order.id}`,
                    );

                setSelectedOrder(
                    normalizeOrder(
                        response.data,
                    ),
                );
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );

                /*
                 * Fall back to the order data already available
                 * from the list.
                 */
                setSelectedOrder(
                    order,
                );
            }

            setActiveModule(
                'current-order',
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Order Lifecycle
    |--------------------------------------------------------------------------
    */

    const transitionOrder =
        async (
            order:
                Order,

            action:
                | 'confirm'
                | 'send-to-kitchen'
                | 'serve'
                | 'complete',
        ): Promise<void> => {
            setLoading(
                true,
            );

            setError(
                null,
            );

            try {
                const response =
                    await api.post<ApiOrderResponse>(
                        `/orders/${order.id}/${action}`,
                        {},
                    );

                if (
                    response.data
                ) {
                    setSelectedOrder(
                        normalizeOrder(
                            response.data,
                        ),
                    );
                }

                /*
                 * Refresh active order data after every transition.
                 */
                await loadOrders();

                /*
                 * Table/session state may change when an order
                 * progresses through restaurant operations.
                 */
                if (
                    action
                    ===
                    'confirm'
                    ||
                    action
                    ===
                    'send-to-kitchen'
                    ||
                    action
                    ===
                    'serve'
                    ||
                    action
                    ===
                    'complete'
                ) {
                    await loadTables();
                }
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );
            } finally {
                setLoading(
                    false,
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Finalize Orders After Full Payment
    |--------------------------------------------------------------------------
    |
    | PaymentModule calls this only after Laravel confirms that the invoice
    | is fully PAID.
    |
    | Single-order invoice:
    |     complete invoice.order_id
    |
    | Table-session invoice:
    |     complete every SERVED order belonging to that billed session
    |
    | The financial payment has already been committed at this point. If an
    | order completion request fails, the error is allowed to propagate back
    | to PaymentModule so it can clearly tell the cashier that the payment
    | itself was saved and only lifecycle finalization needs recovery.
    |--------------------------------------------------------------------------
    */

    const finalizePaidInvoiceOrders =
        useCallback(
            async (
                invoice:
                    CashierInvoice,
            ): Promise<void> => {
                const candidateIds =
                    new Set<number>();

                /*
                |--------------------------------------------------------------------------
                | Direct Order Invoice
                |--------------------------------------------------------------------------
                */

                if (
                    invoice.order_id
                    !==
                    null
                ) {
                    candidateIds.add(
                        invoice.order_id,
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Table Session Invoice
                |--------------------------------------------------------------------------
                |
                | A final dine-in invoice can represent several SERVED orders
                | in the same table session.
                |--------------------------------------------------------------------------
                */

                if (
                    invoice.table_session_id
                    !==
                    null
                ) {
                    orders
                        .filter(
                            (
                                item,
                            ) =>
                                item.status
                                ===
                                'SERVED'
                                &&
                                item.table_session_id
                                ===
                                invoice.table_session_id,
                        )
                        .forEach(
                            (
                                item,
                            ) => {
                                candidateIds.add(
                                    item.id,
                                );
                            },
                        );

                    if (
                        selectedOrder
                        &&
                        selectedOrder.status
                        ===
                        'SERVED'
                        &&
                        selectedOrder.table_session_id
                        ===
                        invoice.table_session_id
                    ) {
                        candidateIds.add(
                            selectedOrder.id,
                        );
                    }
                }

                /*
                 * If the order was already finalized elsewhere, there may be
                 * no local SERVED session candidates left. Refresh the lists
                 * so Incoming Orders and Sales History still synchronize.
                 */
                if (
                    candidateIds.size
                    ===
                    0
                ) {
                    await Promise.all([
                        loadOrders(),
                        loadTables(),
                    ]);

                    return;
                }

                setLoading(
                    true,
                );

                setError(
                    null,
                );

                try {
                    for (
                        const orderId
                        of candidateIds
                    ) {
                        const response =
                            await api.post<ApiOrderResponse>(
                                `/orders/${orderId}/complete`,
                                {},
                            );

                        if (
                            response.data
                            &&
                            selectedOrder
                            &&
                            selectedOrder.id
                            ===
                            orderId
                        ) {
                            setSelectedOrder(
                                normalizeOrder(
                                    response.data,
                                ),
                            );
                        }
                    }

                    /*
                     * COMPLETED orders leave Incoming Orders and become part
                     * of Sales History through the existing derived filters.
                     */
                    await Promise.all([
                        loadOrders(),
                        loadTables(),
                    ]);
                } finally {
                    setLoading(
                        false,
                    );
                }
            },
            [
                loadOrders,
                loadTables,
                orders,
                selectedOrder,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Create Takeaway
    |--------------------------------------------------------------------------
    */

    const createTakeaway =
        async (
            submission:
                TakeawaySubmissionData,
        ): Promise<boolean> => {
            if (
                cart.length
                ===
                0
            ) {
                setError(
                    'Add at least one menu item before creating the takeaway.',
                );

                return false;
            }

            setError(
                null,
            );

            try {
                const response =
                    await api.post<ApiOrderResponse>(
                        '/takeaway/orders',

                        {
                            client_order_id:
                                submission.clientOrderId,

                            customer_name:
                                submission.customerName,

                            customer_phone:
                                submission.customerPhone,

                            pickup_notes:
                                submission.pickupNotes,

                            items:
                                cart.map(
                                    (
                                        line,
                                    ) => ({
                                        menu_item_id:
                                            line.item.id,

                                        variant_id:
                                            line.variant
                                                ?.id
                                            ??
                                            null,

                                        quantity:
                                            line.quantity,

                                        notes:
                                            line.notes
                                            ||
                                            null,

                                        addons:
                                            line.addons.map(
                                                (
                                                    selected,
                                                ) => ({
                                                    addon_id:
                                                        selected.addon.id,

                                                    quantity:
                                                        selected.quantity,
                                                }),
                                            ),
                                    }),
                                ),
                        },
                    );

                const createdOrder =
                    normalizeOrder(
                        response.data,
                    );

                setSelectedOrder(
                    createdOrder,
                );

                /*
                 * IMPORTANT:
                 *
                 * Clear cart only after Laravel successfully
                 * creates or idempotently returns the order.
                 */
                setCart(
                    [],
                );

                await Promise.all([
                    loadOrders(),
                    loadTables(),
                ]);

                setActiveModule(
                    'current-order',
                );

                return true;
            } catch (
            exception
            ) {
                /*
                 * TakeawayModule retains the same client UUID,
                 * allowing safe idempotent retry.
                 */
                handleError(
                    exception,
                );

                return false;
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Open Payment
    |--------------------------------------------------------------------------
    */

    const openPayment =
        (
            order:
                Order,
        ): void => {
            setSelectedOrder(
                order,
            );

            setActiveModule(
                'payment',
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Module Router
    |--------------------------------------------------------------------------
    */

    const renderModule =
        (): ReactNode => {
            switch (
            activeModule
            ) {
                /*
                |--------------------------------------------------------------------------
                | Tables
                |--------------------------------------------------------------------------
                */

                case 'tables':
                    return (
                        <TablesModule
                            tables={
                                tables
                            }
                            loading={
                                loading
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Incoming Orders
                |--------------------------------------------------------------------------
                */

                case 'incoming':
                    return (
                        <IncomingOrdersModule
                            orders={
                                incomingOrders
                            }
                            loading={
                                loading
                            }
                            onView={
                                loadOrderDetail
                            }
                            onTransition={
                                transitionOrder
                            }
                            onOpenPayment={
                                openPayment
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | POS / Menu / Cart
                |--------------------------------------------------------------------------
                */

                case 'pos':
                    return (
                        <PosModule
                            categories={
                                categories
                            }
                            items={
                                menuItems
                            }
                            cart={
                                cart
                            }
                            cartTotal={
                                cartTotal
                            }
                            onAddSelection={
                                addSelectionToCart
                            }
                            onChangeQuantity={
                                changeCartQuantity
                            }
                            onRemove={
                                removeCartLine
                            }
                            onTakeaway={
                                () =>
                                    setActiveModule(
                                        'takeaway',
                                    )
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Takeaway
                |--------------------------------------------------------------------------
                */

                case 'takeaway':
                    return (
                        <TakeawayModule
                            cart={
                                cart
                            }
                            total={
                                cartTotal
                            }
                            onChangeQuantity={
                                changeCartQuantity
                            }
                            onRemove={
                                removeCartLine
                            }
                            onBackToProducts={
                                () =>
                                    setActiveModule(
                                        'pos',
                                    )
                            }
                            onSubmit={
                                createTakeaway
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Current Order
                |--------------------------------------------------------------------------
                */

                case 'current-order':
                    return (
                        <CurrentOrderModule
                            order={
                                selectedOrder
                            }
                            loading={
                                loading
                            }
                            onTransition={
                                transitionOrder
                            }
                            onOpenPayment={
                                openPayment
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Payment / Billing
                |--------------------------------------------------------------------------
                */

                case 'payment':
                    return (
                        <PaymentModule
                            order={
                                selectedOrder
                            }
                            onSessionExpired={
                                onSessionExpired
                            }
                            onPaymentCompleted={
                                finalizePaidInvoiceOrders
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Sales History
                |--------------------------------------------------------------------------
                */

                case 'history':
                    return (
                        <SalesHistoryModule
                            orders={
                                salesHistory
                            }
                            loading={
                                loading
                            }
                            onView={
                                loadOrderDetail
                            }
                            onOpenBilling={
                                openPayment
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Cash Drawer
                |--------------------------------------------------------------------------
                */

                case 'drawer':
                    return (
                        <CashDrawerModule
                            onSessionExpired={
                                onSessionExpired
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Cashier Shift
                |--------------------------------------------------------------------------
                */

                case 'shift':
                    return (
                        <CashierShiftModule
                            onSessionExpired={
                                onSessionExpired
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Business Day
                |--------------------------------------------------------------------------
                */

                case 'business-day':
                    return (
                        <BusinessDayModule
                            permissions={
                                user.permissions
                            }
                            onSessionExpired={
                                onSessionExpired
                            }
                        />
                    );

                /*
                |--------------------------------------------------------------------------
                | Settings
                |--------------------------------------------------------------------------
                */

                case 'settings':
                    return (
                        <SettingsModule
                            user={
                                user
                            }
                            online={
                                online
                            }
                        />
                    );

                default:
                    return null;
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <main className="pos-app">
            {/*
            |--------------------------------------------------------------------------
            | Sidebar
            |--------------------------------------------------------------------------
            */}

            <aside className="pos-sidebar">
                <div className="pos-brand">
                    <div className="pos-brand__mark">
                        RP
                    </div>

                    <div>
                        <strong>
                            Restaurant
                        </strong>

                        <span>
                            Cashier POS
                        </span>
                    </div>
                </div>

                <nav className="pos-nav">
                    {
                        visibleModuleItems.map(
                            (
                                item,
                            ) => (
                                <button
                                    key={
                                        item.key
                                    }
                                    type="button"
                                    className={
                                        [
                                            'pos-nav__button',

                                            activeModule
                                                ===
                                                item.key
                                                ? 'is-active'
                                                : '',
                                        ]
                                            .filter(
                                                Boolean,
                                            )
                                            .join(
                                                ' ',
                                            )
                                    }
                                    onClick={
                                        () =>
                                            setActiveModule(
                                                item.key,
                                            )
                                    }
                                >
                                    <span className="pos-nav__badge">
                                        {
                                            item.short
                                        }
                                    </span>

                                    <span>
                                        {
                                            item.label
                                        }
                                    </span>
                                </button>
                            ),
                        )
                    }
                </nav>

                <div className="sidebar-user">
                    <strong>
                        {
                            user.name
                        }
                    </strong>

                    <span>
                        {
                            user.role
                                ?.name
                            ??
                            'Staff'
                        }
                    </span>

                    <button
                        type="button"
                        className="logout-button"
                        onClick={
                            () => {
                                void onLogout();
                            }
                        }
                    >
                        Sign Out
                    </button>
                </div>
            </aside>

            {/*
            |--------------------------------------------------------------------------
            | Main Content
            |--------------------------------------------------------------------------
            */}

            <section className="pos-main">
                {/*
                |--------------------------------------------------------------------------
                | Top Bar
                |--------------------------------------------------------------------------
                */}

                <header className="pos-topbar">
                    <div>
                        <p className="eyebrow">
                            {
                                visibleModuleItems
                                    .find(
                                        (
                                            item,
                                        ) =>
                                            item.key
                                            ===
                                            activeModule,
                                    )
                                    ?.label
                            }
                        </p>

                        <h2>
                            Restaurant POS
                        </h2>
                    </div>

                    <div className="topbar-actions">
                        <div
                            className={
                                online
                                    ? 'connection-pill is-online'
                                    : 'connection-pill is-offline'
                            }
                        >
                            <span />

                            {
                                online
                                    ? 'API Online'
                                    : 'API Offline'
                            }
                        </div>

                        <button
                            type="button"
                            className="secondary-button"
                            disabled={
                                loading
                            }
                            onClick={
                                () => {
                                    void refreshAll();
                                }
                            }
                        >
                            {
                                loading
                                    ? 'Refreshing...'
                                    : 'Refresh'
                            }
                        </button>

                        <div className="clock-box">
                            <strong>
                                {
                                    now.toLocaleTimeString(
                                        'en-LK',
                                        {
                                            hour:
                                                '2-digit',

                                            minute:
                                                '2-digit',
                                        },
                                    )
                                }
                            </strong>

                            <span>
                                {
                                    now.toLocaleDateString(
                                        'en-LK',
                                        {
                                            day:
                                                '2-digit',

                                            month:
                                                'short',

                                            year:
                                                'numeric',
                                        },
                                    )
                                }
                            </span>
                        </div>
                    </div>
                </header>

                {/*
                |--------------------------------------------------------------------------
                | Global Workspace Error
                |--------------------------------------------------------------------------
                */}

                {
                    error
                        ? (
                            <div className="workspace-alert">
                                <span>
                                    {
                                        error
                                    }
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
                                    Close
                                </button>
                            </div>
                        )
                        : null
                }

                {/*
                |--------------------------------------------------------------------------
                | Active Module
                |--------------------------------------------------------------------------
                */}

                <section className="module-container">
                    {
                        renderModule()
                    }
                </section>

                {/*
                |--------------------------------------------------------------------------
                | Status Footer
                |--------------------------------------------------------------------------
                */}

                <footer className="status-footer">
                    <span>
                        Secure session active
                    </span>

                    <span>
                        {
                            cart.length
                        }
                        {' '}
                        cart item
                        {
                            cart.length
                                ===
                                1
                                ? ''
                                : 's'
                        }
                    </span>

                    <span>
                        {
                            online
                                ? 'Connected'
                                : 'Disconnected'
                        }
                    </span>
                </footer>
            </section>
        </main>
    );
}