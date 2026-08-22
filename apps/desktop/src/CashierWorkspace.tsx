import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    ApiError,
    API_BASE_URL,
    api,
    extractList,
} from './api';

import type {
    CartLine,
    MenuAddon,
    MenuCategory,
    MenuItem,
    MenuVariant,
    Order,
    PosUser,
    RestaurantTable,
    SelectedAddon,
} from './types';

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
    | 'settings';

interface CashierWorkspaceProps {
    user: PosUser;

    onLogout:
    () => Promise<void>;

    onSessionExpired:
    () => void;
}

interface ProductSelection {
    item: MenuItem;

    variant:
    MenuVariant | null;

    addons:
    SelectedAddon[];

    quantity: number;

    notes: string;
}

/*
|--------------------------------------------------------------------------
| Laravel OrderResource response types
|--------------------------------------------------------------------------
|
| The Laravel API returns:
|
| customer: {
|   name,
|   phone
| }
|
| totals: {
|   subtotal,
|   discount,
|   tax,
|   service_charge,
|   grand_total
| }
|
| items: [
|   {
|     name,
|     variant
|   }
| ]
|
| The existing desktop Order Type uses the older flattened property names.
| We normalize the server response below instead of changing types.ts.
|
*/

interface ApiOrderCustomer {
    name?: string | null;
    phone?: string | null;
}

interface ApiOrderTotals {
    subtotal?: number;
    discount?: number;
    tax?: number;
    service_charge?: number;
    grand_total?: number;
}

interface ApiOrderAddon {
    id?: number;
    addon_id?: number | null;

    name?: string | null;

    quantity?: number;

    unit_price?: number;

    line_total?: number;
}

interface ApiOrderItem {
    id?: number;

    menu_item_id?:
    number | null;

    variant_id?:
    number | null;

    name?: string | null;

    variant?: string | null;

    quantity?: number;

    unit_price?: number;

    line_total?: number;

    status?: string;

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
    id?: number;

    order_number?: string;

    business_day_id?: number;

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

    order_type?: string;

    order_source?: string;

    session_sequence?:
    number | null;

    status?: string;

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

const money =
    (
        value:
            number | string | null | undefined,
    ): string => {
        const number =
            Number(
                value ?? 0,
            );

        return `Rs. ${number.toLocaleString(
            'en-LK',
            {
                minimumFractionDigits:
                    2,

                maximumFractionDigits:
                    2,
            },
        )}`;
    };

const makeLocalId =
    (): string =>
        `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

/*
|--------------------------------------------------------------------------
| Order Normalizer
|--------------------------------------------------------------------------
|
| Converts Laravel OrderResource into the structure currently expected by
| the Electron application and existing types.ts file.
|
*/

const normalizeOrder =
    (
        raw:
            ApiOrderResponse,
    ): Order => {
        const totals =
            raw.totals
            ?? {};

        const customer =
            raw.customer
            ?? {};

        const items =
            (
                raw.items
                ?? []
            ).map(
                (
                    item,
                ) => ({
                    id:
                        Number(
                            item.id
                            ?? 0,
                        ),

                    menu_item_id:
                        item.menu_item_id
                        ?? null,

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
                        ?? null,

                    variant_name:
                        item.variant
                        ?? null,

                    quantity:
                        Number(
                            item.quantity
                            ?? 0,
                        ),

                    unit_price:
                        Number(
                            item.unit_price
                            ?? 0,
                        ),

                    line_total:
                        Number(
                            item.line_total
                            ?? 0,
                        ),

                    status:
                        item.status
                        ??
                        'ACTIVE',

                    special_notes:
                        item.special_notes
                        ?? null,

                    sent_to_kitchen_at:
                        item.sent_to_kitchen_at
                        ?? null,

                    addons:
                        (
                            item.addons
                            ?? []
                        ).map(
                            (
                                addon,
                            ) => ({
                                id:
                                    addon.id,

                                addon_id:
                                    addon.addon_id
                                    ?? undefined,

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
                                        ?? 0,
                                    ),

                                unit_price:
                                    Number(
                                        addon.unit_price
                                        ?? 0,
                                    ),

                                line_total:
                                    Number(
                                        addon.line_total
                                        ?? 0,
                                    ),
                            }),
                        ),
                }),
            );

        return {
            id:
                Number(
                    raw.id
                    ?? 0,
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
                ?? null,

            table_id:
                raw.table_id
                ?? null,

            table_name_snapshot:
                raw.table_name
                ?? null,

            table_name:
                raw.table_name
                ?? null,

            takeaway_token:
                raw.takeaway_token
                ?? null,

            customer_name:
                customer.name
                ?? null,

            customer_phone:
                customer.phone
                ?? null,

            customer_notes:
                raw.customer_notes
                ?? null,

            pickup_notes:
                raw.pickup_notes
                ?? null,

            subtotal:
                Number(
                    totals.subtotal
                    ?? 0,
                ),

            discount_total:
                Number(
                    totals.discount
                    ?? 0,
                ),

            tax_total:
                Number(
                    totals.tax
                    ?? 0,
                ),

            service_charge_total:
                Number(
                    totals.service_charge
                    ?? 0,
                ),

            grand_total:
                Number(
                    totals.grand_total
                    ?? 0,
                ),

            created_at:
                raw.created_at
                ?? null,

            confirmed_at:
                raw.confirmed_at
                ?? null,

            sent_to_kitchen_at:
                raw.sent_to_kitchen_at
                ?? null,

            served_at:
                raw.served_at
                ?? null,

            completed_at:
                raw.completed_at
                ?? null,

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

const moduleItems:
    Array<{
        key: PosModule;
        label: string;
        short: string;
    }> = [
        {
            key: 'tables',
            label: 'Tables',
            short: 'TB',
        },
        {
            key: 'incoming',
            label: 'Incoming Orders',
            short: 'IN',
        },
        {
            key: 'pos',
            label: 'POS',
            short: 'PO',
        },
        {
            key: 'takeaway',
            label: 'Takeaway',
            short: 'TA',
        },
        {
            key: 'current-order',
            label: 'Current Order',
            short: 'CO',
        },
        {
            key: 'payment',
            label: 'Payment',
            short: 'PY',
        },
        {
            key: 'history',
            label: 'Sales History',
            short: 'SH',
        },
        {
            key: 'drawer',
            label: 'Cash Drawer',
            short: 'CD',
        },
        {
            key: 'shift',
            label: 'Shift',
            short: 'SF',
        },
        {
            key: 'settings',
            label: 'Settings',
            short: 'ST',
        },
    ];

const cartUnitPrice =
    (
        line: CartLine,
    ): number => {
        const base =
            line.variant
                ? Number(
                    line.variant.price,
                )
                : Number(
                    line.item.price,
                );

        const addonTotal =
            line.addons
                .reduce(
                    (
                        total,
                        selection,
                    ) =>
                        total
                        +
                        (
                            Number(
                                selection
                                    .addon
                                    .price,
                            )
                            *
                            selection
                                .quantity
                        ),

                    0,
                );

        return base
            +
            addonTotal;
    };

const cartLineTotal =
    (
        line: CartLine,
    ): number =>
        cartUnitPrice(
            line,
        )
        *
        line.quantity;

const orderItemName =
    (
        item: {
            item_name_snapshot?: string;
            item_name?: string;
        },
    ): string =>
        item
            .item_name_snapshot
        ??
        item.item_name
        ??
        'Item';

export default function CashierWorkspace(
    {
        user,
        onLogout,
        onSessionExpired,
    }: CashierWorkspaceProps,
) {
    const [
        activeModule,
        setActiveModule,
    ] =
        useState<PosModule>(
            'tables',
        );

    const [
        now,
        setNow,
    ] =
        useState(
            new Date(),
        );

    const [
        tables,
        setTables,
    ] =
        useState<
            RestaurantTable[]
        >([]);

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
        useState<
            MenuCategory[]
        >([]);

    const [
        menuItems,
        setMenuItems,
    ] =
        useState<MenuItem[]>(
            [],
        );

    const [
        loading,
        setLoading,
    ] =
        useState(false);

    const [
        error,
        setError,
    ] =
        useState<
            string | null
        >(null);

    const [
        online,
        setOnline,
    ] =
        useState(false);

    const [
        selectedOrder,
        setSelectedOrder,
    ] =
        useState<
            Order | null
        >(null);

    const [
        cart,
        setCart,
    ] =
        useState<CartLine[]>(
            [],
        );

    const [
        selectedCategory,
        setSelectedCategory,
    ] =
        useState<
            number | null
        >(null);

    const [
        search,
        setSearch,
    ] =
        useState('');

    const [
        productDialog,
        setProductDialog,
    ] =
        useState<
            MenuItem | null
        >(null);

    const [
        takeawayCustomerName,
        setTakeawayCustomerName,
    ] =
        useState('');

    const [
        takeawayCustomerPhone,
        setTakeawayCustomerPhone,
    ] =
        useState('');

    const [
        takeawayNotes,
        setTakeawayNotes,
    ] =
        useState('');

    const [
        takeawayClientOrderId,
        setTakeawayClientOrderId,
    ] =
        useState(
            makeLocalId(),
        );

    const [
        submittingTakeaway,
        setSubmittingTakeaway,
    ] =
        useState(false);

    const handleError =
        useCallback(
            (
                exception: unknown,
            ) => {
                if (
                    exception
                    instanceof ApiError
                    &&
                    exception.status
                    === 401
                ) {
                    onSessionExpired();

                    return;
                }

                const message =
                    exception
                        instanceof Error
                        ? exception.message
                        : 'An unexpected error occurred.';

                setError(
                    message,
                );
            },
            [
                onSessionExpired,
            ],
        );

    const loadTables =
        useCallback(
            async () => {
                try {
                    const response =
                        await api.get<unknown>(
                            '/tables',
                        );

                    setTables(
                        extractList<
                            RestaurantTable
                        >(
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

    const loadOrders =
        useCallback(
            async () => {
                try {
                    const response =
                        await api.get<unknown>(
                            '/orders',
                        );

                    const rawOrders =
                        extractList<
                            ApiOrderResponse
                        >(
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

    const loadMenu =
        useCallback(
            async () => {
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

                    setCategories(
                        extractList<
                            MenuCategory
                        >(
                            categoryResponse.data,
                        )
                            .filter(
                                (
                                    category,
                                ) =>
                                    category
                                        .is_active
                                    !== false,
                            ),
                    );

                    setMenuItems(
                        extractList<MenuItem>(
                            itemResponse.data,
                        )
                            .filter(
                                (
                                    item,
                                ) =>
                                    item.is_active
                                    !== false
                                    &&
                                    item
                                        .is_available
                                    !== false,
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

    const refreshAll =
        useCallback(
            async () => {
                setLoading(
                    true,
                );

                setError(
                    null,
                );

                await Promise.all([
                    loadTables(),
                    loadOrders(),
                    loadMenu(),
                ]);

                setLoading(
                    false,
                );
            },
            [
                loadMenu,
                loadOrders,
                loadTables,
            ],
        );

    useEffect(
        () => {
            void refreshAll();
        },
        [
            refreshAll,
        ],
    );

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

    const filteredMenu =
        useMemo(
            () => {
                const query =
                    search
                        .trim()
                        .toLowerCase();

                return menuItems
                    .filter(
                        (
                            item,
                        ) =>
                            selectedCategory
                            === null
                            ||
                            item
                                .category_id
                            === selectedCategory,
                    )
                    .filter(
                        (
                            item,
                        ) => {
                            if (
                                query === ''
                            ) {
                                return true;
                            }

                            return [
                                item.name,
                                item.sku ?? '',
                                item.description
                                ?? '',
                            ]
                                .join(' ')
                                .toLowerCase()
                                .includes(
                                    query,
                                );
                        },
                    )
                    .sort(
                        (
                            left,
                            right,
                        ) =>
                            left
                                .sort_order
                            -
                            right
                                .sort_order,
                    );
            },
            [
                menuItems,
                search,
                selectedCategory,
            ],
        );

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

    const openProduct =
        async (
            item: MenuItem,
        ) => {
            setError(
                null,
            );

            try {
                const response =
                    await api.get<MenuItem>(
                        `/menu/items/${item.id}`,
                    );

                setProductDialog(
                    response.data
                    ??
                    item,
                );
            } catch {
                setProductDialog(
                    item,
                );
            }
        };

    const addSelectionToCart =
        (
            selection:
                ProductSelection,
        ) => {
            const addonSignature =
                selection.addons
                    .map(
                        (
                            selected,
                        ) =>
                            `${selected.addon.id}:${selected.quantity}`,
                    )
                    .sort()
                    .join('|');

            const signature =
                [
                    selection.item.id,
                    selection.variant
                        ?.id
                    ?? 'base',
                    addonSignature,
                    selection
                        .notes
                        .trim(),
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
                                line.id
                                    .startsWith(
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
                                    === existing.id
                                    ? {
                                        ...line,

                                        quantity:
                                            line.quantity
                                            +
                                            selection
                                                .quantity,
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
                                selection
                                    .notes
                                    .trim(),
                        },
                    ];
                },
            );

            setProductDialog(
                null,
            );
        };

    const changeCartQuantity =
        (
            id: string,
            difference: number,
        ) => {
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
                                    === id
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
                                > 0,
                        ),
            );
        };

    const removeCartLine =
        (
            id: string,
        ) => {
            setCart(
                (
                    current,
                ) =>
                    current.filter(
                        (
                            line,
                        ) =>
                            line.id
                            !== id,
                    ),
            );
        };

    const loadOrderDetail =
        async (
            order: Order,
        ) => {
            setError(
                null,
            );

            try {
                const response =
                    await api.get<
                        ApiOrderResponse
                    >(
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

                setSelectedOrder(
                    order,
                );
            }

            setActiveModule(
                'current-order',
            );
        };

    const transitionOrder =
        async (
            order: Order,
            action:
                'confirm'
                | 'send-to-kitchen'
                | 'serve'
                | 'complete',
        ) => {
            setLoading(
                true,
            );

            setError(
                null,
            );

            try {
                const response =
                    await api.post<
                        ApiOrderResponse
                    >(
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

                await loadOrders();
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

    const placeTakeaway =
        async () => {
            if (
                cart.length === 0
                ||
                submittingTakeaway
            ) {
                return;
            }

            setSubmittingTakeaway(
                true,
            );

            setError(
                null,
            );

            try {
                const response =
                    await api.post<
                        ApiOrderResponse
                    >(
                        '/takeaway/orders',
                        {
                            client_order_id:
                                takeawayClientOrderId,

                            customer_name:
                                takeawayCustomerName
                                    .trim()
                                || null,

                            customer_phone:
                                takeawayCustomerPhone
                                    .trim()
                                || null,

                            pickup_notes:
                                takeawayNotes
                                    .trim()
                                || null,

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
                                            ?? null,

                                        quantity:
                                            line.quantity,

                                        notes:
                                            line.notes
                                            || null,

                                        addons:
                                            line.addons.map(
                                                (
                                                    selection,
                                                ) => ({
                                                    addon_id:
                                                        selection
                                                            .addon
                                                            .id,

                                                    quantity:
                                                        selection
                                                            .quantity,
                                                }),
                                            ),
                                    }),
                                ),
                        },
                    );

                setSelectedOrder(
                    normalizeOrder(
                        response.data,
                    ),
                );

                setCart(
                    [],
                );

                setTakeawayCustomerName(
                    '',
                );

                setTakeawayCustomerPhone(
                    '',
                );

                setTakeawayNotes(
                    '',
                );

                setTakeawayClientOrderId(
                    makeLocalId(),
                );

                await loadOrders();

                setActiveModule(
                    'current-order',
                );
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );
            } finally {
                setSubmittingTakeaway(
                    false,
                );
            }
        };

    const renderModule =
        () => {
            switch (
            activeModule
            ) {
                case 'tables':
                    return (
                        <TablesModule
                            tables={
                                tables
                            }
                        />
                    );

                case 'incoming':
                    return (
                        <OrdersModule
                            title="Incoming Orders"
                            subtitle="Review and progress active restaurant orders."
                            orders={
                                incomingOrders
                            }
                            onView={
                                loadOrderDetail
                            }
                            onTransition={
                                transitionOrder
                            }
                        />
                    );

                case 'pos':
                    return (
                        <PosModuleView
                            categories={
                                categories
                            }
                            items={
                                filteredMenu
                            }
                            selectedCategory={
                                selectedCategory
                            }
                            search={
                                search
                            }
                            cart={
                                cart
                            }
                            cartTotal={
                                cartTotal
                            }
                            onCategory={
                                setSelectedCategory
                            }
                            onSearch={
                                setSearch
                            }
                            onProduct={
                                openProduct
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

                case 'takeaway':
                    return (
                        <TakeawayModule
                            cart={
                                cart
                            }
                            total={
                                cartTotal
                            }
                            customerName={
                                takeawayCustomerName
                            }
                            customerPhone={
                                takeawayCustomerPhone
                            }
                            notes={
                                takeawayNotes
                            }
                            submitting={
                                submittingTakeaway
                            }
                            onCustomerName={
                                setTakeawayCustomerName
                            }
                            onCustomerPhone={
                                setTakeawayCustomerPhone
                            }
                            onNotes={
                                setTakeawayNotes
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
                                placeTakeaway
                            }
                        />
                    );

                case 'current-order':
                    return (
                        <CurrentOrderModule
                            order={
                                selectedOrder
                            }
                            onTransition={
                                transitionOrder
                            }
                        />
                    );

                case 'payment':
                    return (
                        <PaymentModule
                            order={
                                selectedOrder
                            }
                        />
                    );

                case 'history':
                    return (
                        <OrdersModule
                            title="Sales History"
                            subtitle="Completed, cancelled and rejected orders."
                            orders={
                                salesHistory
                            }
                            onView={
                                loadOrderDetail
                            }
                            onTransition={
                                transitionOrder
                            }
                            history
                        />
                    );

                case 'drawer':
                    return (
                        <UnavailableModule
                            title="Cash Drawer"
                            message="Cash drawer database structures and permissions exist, but the Laravel cash drawer API and Electron printer/drawer IPC are not implemented yet."
                            actionLabel="Manual Drawer Open"
                        />
                    );

                case 'shift':
                    return (
                        <UnavailableModule
                            title="Cashier Shift"
                            message="Cashier shift tables and permissions exist, but shift open/close API endpoints have not been implemented yet."
                            actionLabel="Open Shift"
                        />
                    );

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

    return (
        <main className="pos-app">
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
                        moduleItems.map(
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
                                                === item.key
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
                        {user.name}
                    </strong>

                    <span>
                        {
                            user.role
                                ?.name
                            ?? 'Staff'
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

            <section className="pos-main">
                <header className="pos-topbar">
                    <div>
                        <p className="eyebrow">
                            {
                                moduleItems
                                    .find(
                                        (
                                            item,
                                        ) =>
                                            item.key
                                            === activeModule,
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

                {
                    error
                        ? (
                            <div className="workspace-alert">
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
                                    Close
                                </button>
                            </div>
                        )
                        : null
                }

                <section className="module-container">
                    {
                        renderModule()
                    }
                </section>

                <footer className="status-footer">
                    <span>
                        Secure session active
                    </span>

                    <span>
                        {
                            cart.length
                        } cart item
                        {
                            cart.length
                                === 1
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

            {
                productDialog
                    ? (
                        <ProductDialog
                            item={
                                productDialog
                            }
                            onClose={
                                () =>
                                    setProductDialog(
                                        null,
                                    )
                            }
                            onAdd={
                                addSelectionToCart
                            }
                        />
                    )
                    : null
            }
        </main>
    );
}

function TablesModule(
    {
        tables,
    }: {
        tables:
        RestaurantTable[];
    },
) {
    return (
        <div className="module-page">
            <ModuleHeader
                title="Tables"
                subtitle="Live restaurant floor status."
            />

            {
                tables.length
                    === 0
                    ? (
                        <EmptyState
                            title="No tables found"
                            message="No restaurant tables were returned by the API."
                        />
                    )
                    : (
                        <div className="table-grid">
                            {
                                tables.map(
                                    (
                                        table,
                                    ) => {
                                        const session =
                                            table
                                                .open_session
                                            ??
                                            table
                                                .openSession
                                            ??
                                            null;

                                        return (
                                            <article
                                                key={
                                                    table.id
                                                }
                                                className="table-card"
                                            >
                                                <div className="table-card__header">
                                                    <div>
                                                        <span className="table-number">
                                                            {
                                                                table
                                                                    .table_number
                                                                ?? table.id
                                                            }
                                                        </span>

                                                        <h3>
                                                            {
                                                                table.name
                                                            }
                                                        </h3>
                                                    </div>

                                                    <StatusBadge
                                                        status={
                                                            table.status
                                                        }
                                                    />
                                                </div>

                                                <div className="table-card__meta">
                                                    <span>
                                                        Capacity
                                                        <strong>
                                                            {
                                                                table.capacity
                                                            }
                                                        </strong>
                                                    </span>

                                                    <span>
                                                        Area
                                                        <strong>
                                                            {
                                                                table.area
                                                                ?? 'Main'
                                                            }
                                                        </strong>
                                                    </span>
                                                </div>

                                                {
                                                    session
                                                        ? (
                                                            <div className="table-session-strip">
                                                                <span>
                                                                    Session #
                                                                    {
                                                                        session.id
                                                                    }
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        session
                                                                            .guest_count
                                                                    } guests
                                                                </strong>
                                                            </div>
                                                        )
                                                        : (
                                                            <div className="table-session-strip is-empty">
                                                                No active session
                                                            </div>
                                                        )
                                                }

                                                {
                                                    session
                                                        ?.bill_requested
                                                        ? (
                                                            <div className="bill-requested">
                                                                BILL REQUESTED
                                                            </div>
                                                        )
                                                        : null
                                                }
                                            </article>
                                        );
                                    },
                                )
                            }
                        </div>
                    )
            }
        </div>
    );
}

function OrdersModule(
    {
        title,
        subtitle,
        orders,
        onView,
        onTransition,
        history = false,
    }: {
        title: string;
        subtitle: string;

        orders:
        Order[];

        onView:
        (
            order: Order,
        ) => void;

        onTransition:
        (
            order: Order,
            action:
                'confirm'
                | 'send-to-kitchen'
                | 'serve'
                | 'complete',
        ) => Promise<void>;

        history?: boolean;
    },
) {
    return (
        <div className="module-page">
            <ModuleHeader
                title={
                    title
                }
                subtitle={
                    subtitle
                }
            />

            {
                orders.length
                    === 0
                    ? (
                        <EmptyState
                            title={
                                history
                                    ? 'No sales history'
                                    : 'No active orders'
                            }
                            message={
                                history
                                    ? 'Completed sales will appear here.'
                                    : 'Incoming customer and staff orders will appear here automatically after refresh.'
                            }
                        />
                    )
                    : (
                        <div className="order-list">
                            {
                                orders.map(
                                    (
                                        order,
                                    ) => (
                                        <article
                                            className="order-card"
                                            key={
                                                order.id
                                            }
                                        >
                                            <div className="order-card__top">
                                                <div>
                                                    <span className="order-number">
                                                        {
                                                            order
                                                                .order_number
                                                        }
                                                    </span>

                                                    <h3>
                                                        {
                                                            order
                                                                .order_type
                                                        }
                                                    </h3>
                                                </div>

                                                <StatusBadge
                                                    status={
                                                        order.status
                                                    }
                                                />
                                            </div>

                                            <div className="order-card__details">
                                                <span>
                                                    Source

                                                    <strong>
                                                        {
                                                            order
                                                                .order_source
                                                        }
                                                    </strong>
                                                </span>

                                                <span>
                                                    Table

                                                    <strong>
                                                        {
                                                            order
                                                                .table_name_snapshot
                                                            ??
                                                            order
                                                                .table_name
                                                            ??
                                                            'Takeaway'
                                                        }
                                                    </strong>
                                                </span>

                                                <span>
                                                    Customer

                                                    <strong>
                                                        {
                                                            order
                                                                .customer_name
                                                            ??
                                                            'Walk-in'
                                                        }
                                                    </strong>
                                                </span>

                                                <span>
                                                    Total

                                                    <strong className="money-text">
                                                        {
                                                            money(
                                                                order
                                                                    .grand_total,
                                                            )
                                                        }
                                                    </strong>
                                                </span>
                                            </div>

                                            <div className="order-card__actions">
                                                <button
                                                    type="button"
                                                    className="secondary-button"
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
                                                    !history
                                                        &&
                                                        order.status
                                                        === 'PENDING'
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="success-button"
                                                                onClick={
                                                                    () => {
                                                                        void onTransition(
                                                                            order,
                                                                            'confirm',
                                                                        );
                                                                    }
                                                                }
                                                            >
                                                                Confirm
                                                            </button>
                                                        )
                                                        : null
                                                }

                                                {
                                                    !history
                                                        &&
                                                        order.status
                                                        === 'CONFIRMED'
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="primary-button"
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
                                                        )
                                                        : null
                                                }
                                            </div>
                                        </article>
                                    ),
                                )
                            }
                        </div>
                    )
            }
        </div>
    );
}

function PosModuleView(
    {
        categories,
        items,
        selectedCategory,
        search,
        cart,
        cartTotal,
        onCategory,
        onSearch,
        onProduct,
        onChangeQuantity,
        onRemove,
        onTakeaway,
    }: {
        categories:
        MenuCategory[];

        items:
        MenuItem[];

        selectedCategory:
        number | null;

        search:
        string;

        cart:
        CartLine[];

        cartTotal:
        number;

        onCategory:
        (
            category:
                number | null,
        ) => void;

        onSearch:
        (
            value: string,
        ) => void;

        onProduct:
        (
            item: MenuItem,
        ) => void;

        onChangeQuantity:
        (
            id: string,
            amount: number,
        ) => void;

        onRemove:
        (
            id: string,
        ) => void;

        onTakeaway:
        () => void;
    },
) {
    return (
        <div className="pos-workspace">
            <section className="product-area">
                <div className="product-toolbar">
                    <input
                        className="touch-input product-search"
                        value={
                            search
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                onSearch(
                                    event
                                        .target
                                        .value,
                                )
                        }
                        placeholder="Search product or SKU..."
                    />
                </div>

                <div className="category-strip">
                    <button
                        type="button"
                        className={
                            selectedCategory
                                === null
                                ? 'category-button is-active'
                                : 'category-button'
                        }
                        onClick={
                            () =>
                                onCategory(
                                    null,
                                )
                        }
                    >
                        All
                    </button>

                    {
                        categories.map(
                            (
                                category,
                            ) => (
                                <button
                                    key={
                                        category.id
                                    }
                                    type="button"
                                    className={
                                        selectedCategory
                                            === category.id
                                            ? 'category-button is-active'
                                            : 'category-button'
                                    }
                                    onClick={
                                        () =>
                                            onCategory(
                                                category.id,
                                            )
                                    }
                                >
                                    {
                                        category.name
                                    }
                                </button>
                            ),
                        )
                    }
                </div>

                <div className="product-grid">
                    {
                        items.map(
                            (
                                item,
                            ) => (
                                <button
                                    type="button"
                                    className="product-card"
                                    key={
                                        item.id
                                    }
                                    onClick={
                                        () =>
                                            onProduct(
                                                item,
                                            )
                                    }
                                >
                                    <div className="product-card__image">
                                        {
                                            item.photo_url
                                                ? (
                                                    <img
                                                        src={
                                                            item
                                                                .photo_url
                                                        }
                                                        alt=""
                                                    />
                                                )
                                                : (
                                                    <span>
                                                        {
                                                            item.name
                                                                .slice(
                                                                    0,
                                                                    2,
                                                                )
                                                                .toUpperCase()
                                                        }
                                                    </span>
                                                )
                                        }
                                    </div>

                                    <div className="product-card__body">
                                        <strong>
                                            {
                                                item.name
                                            }
                                        </strong>

                                        <span>
                                            {
                                                item
                                                    .has_variants
                                                    ? 'Options available'
                                                    : 'Tap to add'
                                            }
                                        </span>

                                        <b>
                                            {
                                                money(
                                                    item.price,
                                                )
                                            }
                                        </b>
                                    </div>
                                </button>
                            ),
                        )
                    }
                </div>
            </section>

            <CartPanel
                cart={
                    cart
                }
                total={
                    cartTotal
                }
                onChangeQuantity={
                    onChangeQuantity
                }
                onRemove={
                    onRemove
                }
                footer={
                    <>
                        <div className="backend-note">
                            Cashier dine-in order creation API is not implemented yet.
                            Takeaway orders are available now.
                        </div>

                        <button
                            type="button"
                            className="primary-button big-action-button"
                            disabled={
                                cart.length
                                === 0
                            }
                            onClick={
                                onTakeaway
                            }
                        >
                            Continue as Takeaway
                        </button>
                    </>
                }
            />
        </div>
    );
}

function TakeawayModule(
    {
        cart,
        total,
        customerName,
        customerPhone,
        notes,
        submitting,
        onCustomerName,
        onCustomerPhone,
        onNotes,
        onChangeQuantity,
        onRemove,
        onBackToProducts,
        onSubmit,
    }: {
        cart:
        CartLine[];

        total:
        number;

        customerName:
        string;

        customerPhone:
        string;

        notes:
        string;

        submitting:
        boolean;

        onCustomerName:
        (
            value: string,
        ) => void;

        onCustomerPhone:
        (
            value: string,
        ) => void;

        onNotes:
        (
            value: string,
        ) => void;

        onChangeQuantity:
        (
            id: string,
            amount: number,
        ) => void;

        onRemove:
        (
            id: string,
        ) => void;

        onBackToProducts:
        () => void;

        onSubmit:
        () => Promise<void>;
    },
) {
    return (
        <div className="takeaway-layout">
            <section className="module-card">
                <ModuleHeader
                    title="Takeaway"
                    subtitle="Customer details are optional."
                />

                <div className="form-grid">
                    <div>
                        <label className="field-label">
                            Customer Name
                        </label>

                        <input
                            className="touch-input"
                            value={
                                customerName
                            }
                            onChange={
                                (
                                    event,
                                ) =>
                                    onCustomerName(
                                        event
                                            .target
                                            .value,
                                    )
                            }
                            placeholder="Optional"
                        />
                    </div>

                    <div>
                        <label className="field-label">
                            Phone Number
                        </label>

                        <input
                            className="touch-input"
                            inputMode="tel"
                            value={
                                customerPhone
                            }
                            onChange={
                                (
                                    event,
                                ) =>
                                    onCustomerPhone(
                                        event
                                            .target
                                            .value,
                                    )
                            }
                            placeholder="Optional"
                        />
                    </div>

                    <div className="form-grid__wide">
                        <label className="field-label">
                            Pickup Notes
                        </label>

                        <textarea
                            className="touch-textarea"
                            value={
                                notes
                            }
                            onChange={
                                (
                                    event,
                                ) =>
                                    onNotes(
                                        event
                                            .target
                                            .value,
                                    )
                            }
                            placeholder="Optional pickup instructions"
                        />
                    </div>
                </div>

                <button
                    type="button"
                    className="secondary-button"
                    onClick={
                        onBackToProducts
                    }
                >
                    Add More Products
                </button>
            </section>

            <CartPanel
                cart={
                    cart
                }
                total={
                    total
                }
                onChangeQuantity={
                    onChangeQuantity
                }
                onRemove={
                    onRemove
                }
                footer={
                    <button
                        type="button"
                        className="success-button big-action-button"
                        disabled={
                            cart.length
                            === 0
                            ||
                            submitting
                        }
                        onClick={
                            () => {
                                void onSubmit();
                            }
                        }
                    >
                        {
                            submitting
                                ? 'Creating Takeaway...'
                                : `Create Takeaway • ${money(total)}`
                        }
                    </button>
                }
            />
        </div>
    );
}

function CurrentOrderModule(
    {
        order,
        onTransition,
    }: {
        order:
        Order | null;

        onTransition:
        (
            order: Order,
            action:
                'confirm'
                | 'send-to-kitchen'
                | 'serve'
                | 'complete',
        ) => Promise<void>;
    },
) {
    if (!order) {
        return (
            <EmptyState
                title="No order selected"
                message="Open an incoming order, sales record or create a takeaway order."
            />
        );
    }

    return (
        <div className="module-page">
            <ModuleHeader
                title={
                    order
                        .order_number
                }
                subtitle={
                    `${order.order_type} • ${order.order_source}`
                }
            />

            <div className="current-order-grid">
                <section className="module-card">
                    <div className="order-summary-header">
                        <div>
                            <span>
                                Current Status
                            </span>

                            <StatusBadge
                                status={
                                    order.status
                                }
                            />
                        </div>

                        {
                            order
                                .takeaway_token
                                ? (
                                    <div className="pickup-token">
                                        <span>
                                            PICKUP TOKEN
                                        </span>

                                        <strong>
                                            {
                                                order
                                                    .takeaway_token
                                            }
                                        </strong>
                                    </div>
                                )
                                : null
                        }
                    </div>

                    <div className="customer-summary">
                        <div>
                            <span>
                                Customer
                            </span>

                            <strong>
                                {
                                    order
                                        .customer_name
                                    ??
                                    'Walk-in Customer'
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Phone
                            </span>

                            <strong>
                                {
                                    order
                                        .customer_phone
                                    ??
                                    '—'
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Table
                            </span>

                            <strong>
                                {
                                    order
                                        .table_name_snapshot
                                    ??
                                    order
                                        .table_name
                                    ??
                                    'Takeaway'
                                }
                            </strong>
                        </div>
                    </div>

                    <div className="current-item-list">
                        {
                            order.items
                                ?.length
                                ? order.items.map(
                                    (
                                        item,
                                    ) => (
                                        <div
                                            key={
                                                item.id
                                            }
                                            className="current-item-row"
                                        >
                                            <div>
                                                <strong>
                                                    {
                                                        orderItemName(
                                                            item,
                                                        )
                                                    }
                                                </strong>

                                                {
                                                    item
                                                        .variant_name_snapshot
                                                        ? (
                                                            <span>
                                                                {
                                                                    item
                                                                        .variant_name_snapshot
                                                                }
                                                            </span>
                                                        )
                                                        : null
                                                }

                                                {
                                                    item.addons
                                                        ?.length
                                                        > 0
                                                        ? (
                                                            <small>
                                                                Add-ons: {
                                                                    item.addons
                                                                        .map(
                                                                            (
                                                                                addon,
                                                                            ) =>
                                                                                `${addon.name ?? addon.addon_name_snapshot ?? 'Add-on'} ×${addon.quantity}`,
                                                                        )
                                                                        .join(
                                                                            ', ',
                                                                        )
                                                                }
                                                            </small>
                                                        )
                                                        : null
                                                }

                                                {
                                                    item
                                                        .special_notes
                                                        ? (
                                                            <small>
                                                                Note: {
                                                                    item
                                                                        .special_notes
                                                                }
                                                            </small>
                                                        )
                                                        : null
                                                }

                                                <small>
                                                    {
                                                        money(
                                                            item
                                                                .unit_price,
                                                        )
                                                    } each
                                                </small>
                                            </div>

                                            <b>
                                                ×{
                                                    item.quantity
                                                }
                                            </b>

                                            <strong>
                                                {
                                                    money(
                                                        item
                                                            .line_total,
                                                    )
                                                }
                                            </strong>
                                        </div>
                                    ),
                                )
                                : (
                                    <p className="muted-text">
                                        No items are available for this order.
                                    </p>
                                )
                        }
                    </div>
                </section>

                <section className="module-card total-card">
                    <div>
                        <span>
                            Subtotal
                        </span>

                        <strong>
                            {
                                money(
                                    order
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
                            - {
                                money(
                                    order
                                        .discount_total
                                    ?? 0,
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
                                money(
                                    order
                                        .tax_total
                                    ?? 0,
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
                                money(
                                    order
                                        .service_charge_total
                                    ?? 0,
                                )
                            }
                        </strong>
                    </div>

                    <div className="grand-total-row">
                        <span>
                            Grand Total
                        </span>

                        <strong>
                            {
                                money(
                                    order
                                        .grand_total,
                                )
                            }
                        </strong>
                    </div>

                    <div className="order-action-stack">
                        {
                            order.status
                                === 'PENDING'
                                ? (
                                    <button
                                        type="button"
                                        className="success-button big-action-button"
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
                                )
                                : null
                        }

                        {
                            order.status
                                === 'CONFIRMED'
                                ? (
                                    <button
                                        type="button"
                                        className="primary-button big-action-button"
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
                                )
                                : null
                        }

                        {
                            order.status
                                === 'SENT_TO_KITCHEN'
                                ? (
                                    <button
                                        type="button"
                                        className="success-button big-action-button"
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
                                )
                                : null
                        }

                        {
                            order.status
                                === 'SERVED'
                                ? (
                                    <button
                                        type="button"
                                        className="success-button big-action-button"
                                        onClick={
                                            () => {
                                                void onTransition(
                                                    order,
                                                    'complete',
                                                );
                                            }
                                        }
                                    >
                                        Complete Order
                                    </button>
                                )
                                : null
                        }
                    </div>
                </section>
            </div>
        </div>
    );
}

function PaymentModule(
    {
        order,
    }: {
        order:
        Order | null;
    },
) {
    const [
        amount,
        setAmount,
    ] =
        useState('');

    const append =
        (
            value: string,
        ) => {
            setAmount(
                (
                    current,
                ) =>
                    current
                    +
                    value,
            );
        };

    const backspace =
        () => {
            setAmount(
                (
                    current,
                ) =>
                    current.slice(
                        0,
                        -1,
                    ),
            );
        };

    const received =
        Number(
            amount
            || 0,
        );

    const total =
        Number(
            order
                ?.grand_total
            ?? 0,
        );

    const change =
        Math.max(
            0,
            received
            -
            total,
        );

    return (
        <div className="module-page">
            <ModuleHeader
                title="Payment"
                subtitle="Touchscreen payment workspace."
            />

            <div className="payment-layout">
                <section className="module-card payment-summary">
                    <span>
                        Order Total
                    </span>

                    <strong>
                        {
                            money(
                                total,
                            )
                        }
                    </strong>

                    <span>
                        Amount Received
                    </span>

                    <div className="received-display">
                        {
                            money(
                                received,
                            )
                        }
                    </div>

                    <span>
                        Change
                    </span>

                    <strong className="change-value">
                        {
                            money(
                                change,
                            )
                        }
                    </strong>

                    <div className="payment-methods">
                        <button
                            type="button"
                            disabled
                        >
                            CASH
                        </button>

                        <button
                            type="button"
                            disabled
                        >
                            CARD
                        </button>

                        <button
                            type="button"
                            disabled
                        >
                            QR
                        </button>

                        <button
                            type="button"
                            disabled
                        >
                            MIXED
                        </button>
                    </div>

                    <div className="backend-note">
                        Customer invoice/payment APIs are not implemented yet.
                        Payment processing is intentionally disabled.
                    </div>
                </section>

                <section className="numeric-keypad">
                    {
                        [
                            '7',
                            '8',
                            '9',
                            '4',
                            '5',
                            '6',
                            '1',
                            '2',
                            '3',
                            '00',
                            '0',
                            '.',
                        ].map(
                            (
                                key,
                            ) => (
                                <button
                                    key={
                                        key
                                    }
                                    type="button"
                                    onClick={
                                        () =>
                                            append(
                                                key,
                                            )
                                    }
                                >
                                    {key}
                                </button>
                            ),
                        )
                    }

                    <button
                        type="button"
                        className="keypad-clear"
                        onClick={
                            () =>
                                setAmount(
                                    '',
                                )
                        }
                    >
                        CLEAR
                    </button>

                    <button
                        type="button"
                        className="keypad-back"
                        onClick={
                            backspace
                        }
                    >
                        BACK
                    </button>
                </section>
            </div>
        </div>
    );
}

function SettingsModule(
    {
        user,
        online,
    }: {
        user:
        PosUser;

        online:
        boolean;
    },
) {
    return (
        <div className="module-page">
            <ModuleHeader
                title="Settings"
                subtitle="Cashier terminal information."
            />

            <div className="settings-grid">
                <SettingCard
                    label="API"
                    value={
                        API_BASE_URL
                    }
                />

                <SettingCard
                    label="Connection"
                    value={
                        online
                            ? 'Online'
                            : 'Offline'
                    }
                />

                <SettingCard
                    label="Signed In User"
                    value={
                        user.name
                    }
                />

                <SettingCard
                    label="Role"
                    value={
                        user.role
                            ?.name
                        ?? 'Unknown'
                    }
                />

                <SettingCard
                    label="Permissions"
                    value={
                        `${user.permissions.length}`
                    }
                />

                <SettingCard
                    label="Credential Storage"
                    value="OS Secure Storage"
                />
            </div>
        </div>
    );
}

function UnavailableModule(
    {
        title,
        message,
        actionLabel,
    }: {
        title: string;
        message: string;
        actionLabel: string;
    },
) {
    return (
        <div className="module-page">
            <ModuleHeader
                title={
                    title
                }
                subtitle="Touchscreen module prepared."
            />

            <section className="unavailable-card">
                <div className="unavailable-icon">
                    !
                </div>

                <h3>
                    Backend integration pending
                </h3>

                <p>
                    {message}
                </p>

                <button
                    type="button"
                    className="primary-button big-action-button"
                    disabled
                >
                    {
                        actionLabel
                    }
                </button>
            </section>
        </div>
    );
}

function ProductDialog(
    {
        item,
        onClose,
        onAdd,
    }: {
        item: MenuItem;

        onClose:
        () => void;

        onAdd:
        (
            selection:
                ProductSelection,
        ) => void;
    },
) {
    const variants =
        item.variants
        ?? [];

    const addons =
        item.addons
        ?? [];

    const [
        variant,
        setVariant,
    ] =
        useState<
            MenuVariant | null
        >(
            variants.find(
                (
                    option,
                ) =>
                    option.is_default,
            )
            ??
            variants[0]
            ??
            null,
        );

    const [
        addonQuantities,
        setAddonQuantities,
    ] =
        useState<
            Record<
                number,
                number
            >
        >(
            () => {
                const initial:
                    Record<
                        number,
                        number
                    > = {};

                addons.forEach(
                    (
                        addon,
                    ) => {
                        if (
                            addon.is_default
                        ) {
                            initial[
                                addon.id
                            ] = 1;
                        }
                    },
                );

                return initial;
            },
        );

    const [
        quantity,
        setQuantity,
    ] =
        useState(1);

    const [
        notes,
        setNotes,
    ] =
        useState('');

    const changeAddon =
        (
            addon:
                MenuAddon,
            difference:
                number,
        ) => {
            setAddonQuantities(
                (
                    current,
                ) => ({
                    ...current,

                    [addon.id]:
                        Math.max(
                            0,
                            (
                                current[
                                addon.id
                                ]
                                ?? 0
                            )
                            +
                            difference,
                        ),
                }),
            );
        };

    const selectedAddons =
        addons
            .filter(
                (
                    addon,
                ) =>
                    (
                        addonQuantities[
                        addon.id
                        ]
                        ?? 0
                    )
                    > 0,
            )
            .map(
                (
                    addon,
                ) => ({
                    addon,

                    quantity:
                        addonQuantities[
                        addon.id
                        ],
                }),
            );

    const unitPrice =
        Number(
            variant
                ?.price
            ??
            item.price,
        )
        +
        selectedAddons.reduce(
            (
                total,
                selection,
            ) =>
                total
                +
                (
                    Number(
                        selection
                            .addon
                            .price,
                    )
                    *
                    selection
                        .quantity
                ),

            0,
        );

    return (
        <div className="modal-backdrop">
            <section className="product-modal">
                <div className="modal-header">
                    <div>
                        <p className="eyebrow">
                            PRODUCT OPTIONS
                        </p>

                        <h2>
                            {
                                item.name
                            }
                        </h2>
                    </div>

                    <button
                        type="button"
                        className="modal-close"
                        onClick={
                            onClose
                        }
                    >
                        Close
                    </button>
                </div>

                <div className="modal-scroll">
                    {
                        variants.length
                            > 0
                            ? (
                                <div className="option-section">
                                    <h3>
                                        Select Size / Variant
                                    </h3>

                                    <div className="option-grid">
                                        {
                                            variants.map(
                                                (
                                                    option,
                                                ) => (
                                                    <button
                                                        key={
                                                            option.id
                                                        }
                                                        type="button"
                                                        className={
                                                            variant
                                                                ?.id
                                                                === option.id
                                                                ? 'option-button is-selected'
                                                                : 'option-button'
                                                        }
                                                        onClick={
                                                            () =>
                                                                setVariant(
                                                                    option,
                                                                )
                                                        }
                                                    >
                                                        <strong>
                                                            {
                                                                option.name
                                                            }
                                                        </strong>

                                                        <span>
                                                            {
                                                                money(
                                                                    option
                                                                        .price,
                                                                )
                                                            }
                                                        </span>
                                                    </button>
                                                ),
                                            )
                                        }
                                    </div>
                                </div>
                            )
                            : null
                    }

                    {
                        addons.length
                            > 0
                            ? (
                                <div className="option-section">
                                    <h3>
                                        Add-ons
                                    </h3>

                                    <div className="addon-list">
                                        {
                                            addons.map(
                                                (
                                                    addon,
                                                ) => {
                                                    const addonQuantity =
                                                        addonQuantities[
                                                        addon.id
                                                        ]
                                                        ?? 0;

                                                    return (
                                                        <div
                                                            key={
                                                                addon.id
                                                            }
                                                            className="addon-row"
                                                        >
                                                            <div>
                                                                <strong>
                                                                    {
                                                                        addon.name
                                                                    }
                                                                </strong>

                                                                <span>
                                                                    {
                                                                        money(
                                                                            addon
                                                                                .price,
                                                                        )
                                                                    }
                                                                </span>
                                                            </div>

                                                            <QuantityButtons
                                                                quantity={
                                                                    addonQuantity
                                                                }
                                                                onDecrease={
                                                                    () =>
                                                                        changeAddon(
                                                                            addon,
                                                                            -1,
                                                                        )
                                                                }
                                                                onIncrease={
                                                                    () =>
                                                                        changeAddon(
                                                                            addon,
                                                                            1,
                                                                        )
                                                                }
                                                            />
                                                        </div>
                                                    );
                                                },
                                            )
                                        }
                                    </div>
                                </div>
                            )
                            : null
                    }

                    <div className="option-section">
                        <h3>
                            Item Notes
                        </h3>

                        <textarea
                            className="touch-textarea"
                            value={
                                notes
                            }
                            onChange={
                                (
                                    event,
                                ) =>
                                    setNotes(
                                        event
                                            .target
                                            .value,
                                    )
                            }
                            placeholder="Example: no onions, less spicy..."
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <QuantityButtons
                        quantity={
                            quantity
                        }
                        onDecrease={
                            () =>
                                setQuantity(
                                    (
                                        current,
                                    ) =>
                                        Math.max(
                                            1,
                                            current
                                            -
                                            1,
                                        ),
                                )
                        }
                        onIncrease={
                            () =>
                                setQuantity(
                                    (
                                        current,
                                    ) =>
                                        current
                                        +
                                        1,
                                )
                        }
                    />

                    <button
                        type="button"
                        className="success-button modal-add-button"
                        onClick={
                            () =>
                                onAdd({
                                    item,

                                    variant,

                                    addons:
                                        selectedAddons,

                                    quantity,

                                    notes,
                                })
                        }
                    >
                        Add {
                            quantity
                        } • {
                            money(
                                unitPrice
                                *
                                quantity,
                            )
                        }
                    </button>
                </div>
            </section>
        </div>
    );
}

function CartPanel(
    {
        cart,
        total,
        onChangeQuantity,
        onRemove,
        footer,
    }: {
        cart:
        CartLine[];

        total:
        number;

        onChangeQuantity:
        (
            id: string,
            amount: number,
        ) => void;

        onRemove:
        (
            id: string,
        ) => void;

        footer:
        React.ReactNode;
    },
) {
    return (
        <aside className="cart-panel">
            <div className="cart-panel__header">
                <div>
                    <p className="eyebrow">
                        CURRENT CART
                    </p>

                    <h2>
                        Order
                    </h2>
                </div>

                <span className="cart-count">
                    {
                        cart.length
                    }
                </span>
            </div>

            <div className="cart-lines">
                {
                    cart.length
                        === 0
                        ? (
                            <div className="empty-cart">
                                <strong>
                                    Cart is empty
                                </strong>

                                <span>
                                    Tap a product card to add an item.
                                </span>
                            </div>
                        )
                        : cart.map(
                            (
                                line,
                            ) => (
                                <article
                                    className="cart-line"
                                    key={
                                        line.id
                                    }
                                >
                                    <div className="cart-line__title">
                                        <strong>
                                            {
                                                line
                                                    .item
                                                    .name
                                            }
                                        </strong>

                                        {
                                            line.variant
                                                ? (
                                                    <span>
                                                        {
                                                            line
                                                                .variant
                                                                .name
                                                        }
                                                    </span>
                                                )
                                                : null
                                        }

                                        {
                                            line
                                                .addons
                                                .length
                                                > 0
                                                ? (
                                                    <small>
                                                        {
                                                            line
                                                                .addons
                                                                .map(
                                                                    (
                                                                        addon,
                                                                    ) =>
                                                                        `${addon.addon.name} ×${addon.quantity}`,
                                                                )
                                                                .join(
                                                                    ', ',
                                                                )
                                                        }
                                                    </small>
                                                )
                                                : null
                                        }

                                        {
                                            line.notes
                                                ? (
                                                    <small>
                                                        Note: {
                                                            line.notes
                                                        }
                                                    </small>
                                                )
                                                : null
                                        }
                                    </div>

                                    <div className="cart-line__bottom">
                                        <QuantityButtons
                                            quantity={
                                                line.quantity
                                            }
                                            onDecrease={
                                                () =>
                                                    onChangeQuantity(
                                                        line.id,
                                                        -1,
                                                    )
                                            }
                                            onIncrease={
                                                () =>
                                                    onChangeQuantity(
                                                        line.id,
                                                        1,
                                                    )
                                            }
                                        />

                                        <strong>
                                            {
                                                money(
                                                    cartLineTotal(
                                                        line,
                                                    ),
                                                )
                                            }
                                        </strong>
                                    </div>

                                    <button
                                        type="button"
                                        className="remove-line-button"
                                        onClick={
                                            () =>
                                                onRemove(
                                                    line.id,
                                                )
                                        }
                                    >
                                        Remove Item
                                    </button>
                                </article>
                            ),
                        )
                }
            </div>

            <div className="cart-summary">
                <div>
                    <span>
                        Total
                    </span>

                    <strong>
                        {
                            money(
                                total,
                            )
                        }
                    </strong>
                </div>

                {
                    footer
                }
            </div>
        </aside>
    );
}

function QuantityButtons(
    {
        quantity,
        onDecrease,
        onIncrease,
    }: {
        quantity: number;

        onDecrease:
        () => void;

        onIncrease:
        () => void;
    },
) {
    return (
        <div className="quantity-control">
            <button
                type="button"
                onClick={
                    onDecrease
                }
            >
                −
            </button>

            <strong>
                {
                    quantity
                }
            </strong>

            <button
                type="button"
                onClick={
                    onIncrease
                }
            >
                +
            </button>
        </div>
    );
}

function ModuleHeader(
    {
        title,
        subtitle,
    }: {
        title: string;
        subtitle: string;
    },
) {
    return (
        <div className="module-header">
            <div>
                <h2>
                    {
                        title
                    }
                </h2>

                <p>
                    {
                        subtitle
                    }
                </p>
            </div>
        </div>
    );
}

function StatusBadge(
    {
        status,
    }: {
        status: string;
    },
) {
    return (
        <span
            className={
                `status-label status-${status
                    .toLowerCase()
                    .replace(
                        /_/g,
                        '-',
                    )}`
            }
        >
            {
                status
                    .replace(
                        /_/g,
                        ' ',
                    )
            }
        </span>
    );
}

function EmptyState(
    {
        title,
        message,
    }: {
        title: string;
        message: string;
    },
) {
    return (
        <div className="empty-state">
            <div>
                —
            </div>

            <h3>
                {
                    title
                }
            </h3>

            <p>
                {
                    message
                }
            </p>
        </div>
    );
}

function SettingCard(
    {
        label,
        value,
    }: {
        label: string;
        value: string;
    },
) {
    return (
        <article className="setting-card">
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
        </article>
    );
}