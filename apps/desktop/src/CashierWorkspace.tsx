import KitchenPrinterModule from './KitchenPrinterModule';

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

import type {
    ReceiptPrinterSettings,
} from './receiptPrinterTypes';

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

    addon_id?:
    number | null;

    name?:
    string | null;

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

    name?:
    string | null;

    variant?:
    string | null;

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

/*
|--------------------------------------------------------------------------
| Phase 27-30 - Billing / Payments / Cashier Shift Types
|--------------------------------------------------------------------------
*/

interface CashierInvoiceItem {
    id: number;
    name: string;
    variant: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
}

interface CashierInvoice {
    id: number;
    invoice_number: string;
    invoice_type: string;
    business_day_id: number;
    cashier_shift_id: number | null;
    order_id: number | null;
    table_session_id: number | null;
    table_name: string | null;
    customer: {
        name: string | null;
        phone: string | null;
    };
    items: CashierInvoiceItem[];
    totals: {
        subtotal: number;
        discount: number;
        service_charge: number;
        tax: number;
        grand_total: number;
    };
    payment: {
        paid_amount: number;
        change_amount: number;
        balance_due: number;
        status: string;
    };
    status: string;
    issued_at: string | null;
}

interface GeneratedInvoiceData {
    invoice: CashierInvoice;
    created: boolean;
}

interface CustomerPaymentRecord {
    id?: number;
    payment_number?: string;
    payment_method?: string;
    method?: string;
    amount: number;
    tendered_amount?: number | null;
    change_given?: number;
    reference_number?: string | null;
    paid_at?: string | null;
}

interface CustomerPaymentHistoryData {
    invoice_id: number;
    invoice_number: string;
    payment_status: string;
    paid_amount: number;
    balance_due: number;
    payments: CustomerPaymentRecord[];
}

interface CustomerPaymentResultData {
    batch: {
        id: number;
        client_request_id: string;
        total_amount: number;
        cash_amount: number;
        payment_count: number;
        status: string;
        processed_at?: string | null;
    };
    payments: CustomerPaymentRecord[];
    invoice: CashierInvoice;
    cash_drawer: {
        should_open: boolean;
        cash_amount: number;
    };
    created: boolean;
}

type CustomerPaymentMethod =
    | 'CASH'
    | 'CARD'
    | 'QR'
    | 'BANK_TRANSFER'
    | 'OTHER';

interface PaymentInputRow {
    payment_method: CustomerPaymentMethod;
    amount: number;
    tendered_amount?: number;
    reference_number?: string;
}

interface CashierShiftRecord {
    id: number;
    shift_number: string;
    business_day_id: number;
    cashier_id: number;
    opening_cash: number;
    expected_cash: number;
    actual_cash: number | null;
    cash_difference: number | null;
    status: string;
    opened_at?: string | null;
    closed_at?: string | null;
    opening_notes?: string | null;
    closing_notes?: string | null;
}

interface CashierShiftSummary {
    opening_cash: number;
    cash_sales: number;
    cash_refunds: number;
    cash_in: number;
    cash_out: number;
    calculated_expected_cash: number;
    expected_cash: number;
    actual_cash: number | null;
    cash_difference: number | null;
}

interface CurrentCashierShiftData {
    shift: CashierShiftRecord | null;
    summary?: CashierShiftSummary;
}

interface CashierShiftMutationData {
    shift: CashierShiftRecord;
    summary: CashierShiftSummary;
    created?: boolean;
    closed?: boolean;
}

interface CashDrawerManualOpenData {
    cash_drawer: {
        should_open: boolean;
    };
    created: boolean;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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

const roundMoney =
    (
        value:
            number | string | null | undefined,
    ): number =>
        Math.round(
            (
                Number(
                    value
                    ?? 0,
                )
                +
                Number.EPSILON
            )
            *
            100,
        )
        /
        100;

const hasUserPermission =
    (
        user:
            PosUser,

        code:
            string,
    ): boolean => {
        const permissions =
            user.permissions as unknown[];

        return permissions.some(
            (
                permission,
            ) => {
                if (
                    typeof permission
                    === 'string'
                ) {
                    return permission
                        === code;
                }

                if (
                    permission
                    &&
                    typeof permission
                    === 'object'
                ) {
                    const permissionCode =
                        (
                            permission as Record<string, unknown>
                        ).code;

                    return String(
                        permissionCode
                        ??
                        '',
                    )
                        === code;
                }

                return false;
            },
        );
    };

/*
|--------------------------------------------------------------------------
| Local UI ID
|--------------------------------------------------------------------------
|
| Used only for local React/cart identifiers.
|
| This is NOT sent as Laravel client_order_id.
|
*/

const makeLocalId =
    (): string =>
        `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

/*
|--------------------------------------------------------------------------
| UUID Generator
|--------------------------------------------------------------------------
|
| Laravel validates takeaway client_order_id using the "uuid" rule.
|
| Therefore Takeaway submissions must use a real RFC 4122 UUID instead
| of makeLocalId().
|
*/

const makeUuid =
    (): string => {
        const bytes =
            new Uint8Array(
                16,
            );

        crypto.getRandomValues(
            bytes,
        );

        /*
         * UUID version 4.
         */
        bytes[6] =
            (
                bytes[6]
                &
                0x0f
            )
            |
            0x40;

        /*
         * RFC 4122 variant.
         */
        bytes[8] =
            (
                bytes[8]
                &
                0x3f
            )
            |
            0x80;

        const hex =
            Array.from(
                bytes,
            ).map(
                (
                    value,
                ) =>
                    value
                        .toString(
                            16,
                        )
                        .padStart(
                            2,
                            '0',
                        ),
            );

        return [
            hex
                .slice(
                    0,
                    4,
                )
                .join(
                    '',
                ),

            hex
                .slice(
                    4,
                    6,
                )
                .join(
                    '',
                ),

            hex
                .slice(
                    6,
                    8,
                )
                .join(
                    '',
                ),

            hex
                .slice(
                    8,
                    10,
                )
                .join(
                    '',
                ),

            hex
                .slice(
                    10,
                    16,
                )
                .join(
                    '',
                ),
        ].join(
            '-',
        );
    };

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

    /*
    |--------------------------------------------------------------------------
    | Takeaway Idempotency UUID
    |--------------------------------------------------------------------------
    |
    | Laravel StoreTakeawayOrderRequest requires a UUID.
    |
    | We keep this UUID unchanged while the request is being retried.
    | A new UUID is generated only after a successful takeaway creation.
    |
    */

    const [
        takeawayClientOrderId,
        setTakeawayClientOrderId,
    ] =
        useState<string>(
            () =>
                makeUuid(),
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
                            /*
                             * Local cart ID only.
                             */
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

    /*
    |--------------------------------------------------------------------------
    | Create Takeaway Order
    |--------------------------------------------------------------------------
    */

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
                            /*
                             * Valid Laravel UUID.
                             */
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

                /*
                 * Clear the cart only after the server successfully creates
                 * the Takeaway order.
                 */
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

                /*
                 * Generate the idempotency UUID for the NEXT Takeaway order.
                 */
                setTakeawayClientOrderId(
                    makeUuid(),
                );

                await loadOrders();

                setActiveModule(
                    'current-order',
                );
            } catch (
            exception
            ) {
                /*
                 * Do not regenerate client_order_id here.
                 *
                 * Keeping the same UUID makes a retry safe if the server
                 * created the order but the desktop lost the response.
                 */
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
                            onPayment={
                                () =>
                                    setActiveModule(
                                        'payment',
                                    )
                            }
                        />
                    );

                case 'payment':
                    return (
                        <PaymentModule
                            order={
                                selectedOrder
                            }
                            onOrderPaid={
                                async (
                                    paidOrder,
                                ) => {
                                    if (
                                        paidOrder.status
                                        === 'SERVED'
                                    ) {
                                        await transitionOrder(
                                            paidOrder,
                                            'complete',
                                        );
                                    }
                                }
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
                        <CashDrawerModule
                            canManualOpen={
                                hasUserPermission(
                                    user,
                                    'cash_drawer.open',
                                )
                            }
                        />
                    );

                case 'shift':
                    return (
                        <CashierShiftModule
                            canOpen={
                                hasUserPermission(
                                    user,
                                    'cash_shift.open',
                                )
                            }
                            canClose={
                                hasUserPermission(
                                    user,
                                    'cash_shift.close',
                                )
                            }
                            canMoveCash={
                                hasUserPermission(
                                    user,
                                    'cash_drawer.movement',
                                )
                            }
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
        onPayment,
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

        onPayment:
        () => void;
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
                                    <>
                                        <button
                                            type="button"
                                            className="success-button big-action-button"
                                            onClick={
                                                onPayment
                                            }
                                        >
                                            Proceed to Payment
                                        </button>

                                        <div className="backend-note">
                                            Payment is required before the order is completed.
                                            The final invoice will be generated in the Payment module.
                                        </div>
                                    </>
                                )
                                : null
                        }
                    </div>
                </section>
            </div>
        </div>
    );
}

const printInvoiceReceipt =
    async (
        invoice:
            CashierInvoice,

        paymentHistory:
            CustomerPaymentRecord[],

        copyLabel:
            string | null = null,
    ): Promise<void> => {
        await window
            .posBridge
            .printCustomerReceipt({
                invoiceNumber:
                    invoice.invoice_number,

                tableName:
                    invoice.table_name,

                customerName:
                    invoice.customer.name,

                customerPhone:
                    invoice.customer.phone,

                items:
                    (
                        invoice.items
                        ?? []
                    ).map(
                        (
                            item,
                        ) => ({
                            name:
                                item.name,

                            variant:
                                item.variant,

                            quantity:
                                Number(
                                    item.quantity,
                                ),

                            unitPrice:
                                Number(
                                    item.unit_price,
                                ),

                            lineTotal:
                                Number(
                                    item.line_total,
                                ),
                        }),
                    ),

                subtotal:
                    Number(
                        invoice.totals.subtotal,
                    ),

                discount:
                    Number(
                        invoice.totals.discount,
                    ),

                serviceCharge:
                    Number(
                        invoice.totals.service_charge,
                    ),

                tax:
                    Number(
                        invoice.totals.tax,
                    ),

                grandTotal:
                    Number(
                        invoice.totals.grand_total,
                    ),

                paidAmount:
                    Number(
                        invoice.payment.paid_amount,
                    ),

                changeAmount:
                    Number(
                        invoice.payment.change_amount,
                    ),

                balanceDue:
                    Number(
                        invoice.payment.balance_due,
                    ),

                paymentStatus:
                    invoice.payment.status,

                payments:
                    paymentHistory.map(
                        (
                            payment,
                        ) => ({
                            method:
                                payment.payment_method
                                ??
                                payment.method
                                ??
                                'OTHER',

                            amount:
                                Number(
                                    payment.amount,
                                ),

                            tenderedAmount:
                                payment.tendered_amount
                                ??
                                null,

                            changeGiven:
                                Number(
                                    payment.change_given
                                    ??
                                    0,
                                ),

                            referenceNumber:
                                payment.reference_number
                                ??
                                null,
                        }),
                    ),

                issuedAt:
                    invoice.issued_at,

                printedAt:
                    new Date()
                        .toISOString(),

                copyLabel:
                    copyLabel,
            });
    };

function PaymentModule(
    {
        order,
        onOrderPaid,
    }: {
        order:
        Order | null;

        onOrderPaid:
        (
            order:
                Order,
        ) => Promise<void>;
    },
) {
    const [
        invoice,
        setInvoice,
    ] =
        useState<
            CashierInvoice | null
        >(null);

    const [
        mode,
        setMode,
    ] =
        useState<
            CustomerPaymentMethod
            | 'MIXED'
        >(
            'CASH',
        );

    const [
        cashReceived,
        setCashReceived,
    ] =
        useState('');

    const [
        cashAmount,
        setCashAmount,
    ] =
        useState('');

    const [
        cardAmount,
        setCardAmount,
    ] =
        useState('');

    const [
        qrAmount,
        setQrAmount,
    ] =
        useState('');

    const [
        bankAmount,
        setBankAmount,
    ] =
        useState('');

    const [
        otherAmount,
        setOtherAmount,
    ] =
        useState('');

    const [
        cardReference,
        setCardReference,
    ] =
        useState('');

    const [
        qrReference,
        setQrReference,
    ] =
        useState('');

    const [
        bankReference,
        setBankReference,
    ] =
        useState('');

    const [
        otherReference,
        setOtherReference,
    ] =
        useState('');

    const [
        loadingInvoice,
        setLoadingInvoice,
    ] =
        useState(false);

    const [
        processing,
        setProcessing,
    ] =
        useState(false);

    const [
        message,
        setMessage,
    ] =
        useState('');

    const [
        localError,
        setLocalError,
    ] =
        useState('');

    const [
        paymentRequestId,
        setPaymentRequestId,
    ] =
        useState<string>(
            () =>
                makeUuid(),
        );

    useEffect(
        () => {
            setInvoice(
                null,
            );

            setMode(
                'CASH',
            );

            setPaymentRequestId(
                makeUuid(),
            );

            setCashReceived(
                '',
            );

            setCashAmount(
                '',
            );

            setCardAmount(
                '',
            );

            setQrAmount(
                '',
            );

            setBankAmount(
                '',
            );

            setOtherAmount(
                '',
            );

            setCardReference(
                '',
            );

            setQrReference(
                '',
            );

            setBankReference(
                '',
            );

            setOtherReference(
                '',
            );

            setMessage(
                '',
            );

            setLocalError(
                '',
            );
        },
        [
            order?.id,
        ],
    );

    const orderReadyForBilling =
        Boolean(
            order
            &&
            [
                'SERVED',
                'COMPLETED',
            ].includes(
                order.status,
            ),
        );

    const ensureInvoice =
        useCallback(
            async (): Promise<CashierInvoice | null> => {
                if (
                    !order
                ) {
                    return null;
                }

                if (
                    ![
                        'SERVED',
                        'COMPLETED',
                    ].includes(
                        order.status,
                    )
                ) {
                    setLocalError(
                        'The order must be served before billing.',
                    );

                    return null;
                }

                if (
                    invoice
                ) {
                    return invoice;
                }

                setLoadingInvoice(
                    true,
                );

                setLocalError(
                    '',
                );

                try {
                    const response =
                        await api.post<
                            GeneratedInvoiceData
                        >(
                            `/orders/${order.id}/invoice`,
                            {},
                        );

                    const generated =
                        response.data.invoice;

                    setInvoice(
                        generated,
                    );

                    return generated;
                } catch (
                exception
                ) {
                    setLocalError(
                        exception
                            instanceof Error
                            ? exception.message
                            : 'Unable to generate invoice.',
                    );

                    return null;
                } finally {
                    setLoadingInvoice(
                        false,
                    );
                }
            },
            [
                order,
                invoice,
            ],
        );

    useEffect(
        () => {
            if (
                orderReadyForBilling
            ) {
                void ensureInvoice();
            }
        },
        [
            orderReadyForBilling,
            ensureInvoice,
        ],
    );

    if (
        !order
    ) {
        return (
            <div className="module-page">
                <ModuleHeader
                    title="Payment"
                    subtitle="Select a served order before processing payment."
                />

                <EmptyState
                    title="No order selected"
                    message="Open an order, mark it as served and then return to Payment."
                />
            </div>
        );
    }

    const balance =
        roundMoney(
            invoice
                ?.payment
                .balance_due
            ??
            order.grand_total
            ??
            0,
        );

    const cashTendered =
        roundMoney(
            cashReceived
            ||
            0,
        );

    const mixedCash =
        roundMoney(
            cashAmount
            ||
            0,
        );

    const mixedAllocated =
        roundMoney(
            mixedCash
            +
            roundMoney(
                cardAmount
                ||
                0,
            )
            +
            roundMoney(
                qrAmount
                ||
                0,
            )
            +
            roundMoney(
                bankAmount
                ||
                0,
            )
            +
            roundMoney(
                otherAmount
                ||
                0,
            ),
        );

    const mixedRemaining =
        roundMoney(
            balance
            -
            mixedAllocated,
        );

    const displayChange =
        mode
            === 'CASH'
            ? Math.max(
                0,
                roundMoney(
                    cashTendered
                    -
                    balance,
                ),
            )
            : mode
                === 'MIXED'
                ? Math.max(
                    0,
                    roundMoney(
                        cashTendered
                        -
                        mixedCash,
                    ),
                )
                : 0;

    const appendCashReceived =
        (
            value:
                string,
        ) => {
            setCashReceived(
                (
                    current,
                ) =>
                    current
                    +
                    value,
            );
        };


    const buildPayments =
        (
            payableBalance:
                number,
        ): PaymentInputRow[] => {
            if (
                payableBalance
                <=
                0
            ) {
                throw new Error(
                    'This invoice has no outstanding balance.',
                );
            }

            if (
                mode
                === 'CASH'
            ) {
                if (
                    cashTendered
                    <
                    payableBalance
                ) {
                    throw new Error(
                        'Cash received cannot be less than the invoice balance.',
                    );
                }

                return [
                    {
                        payment_method:
                            'CASH',

                        amount:
                            payableBalance,

                        tendered_amount:
                            cashTendered,
                    },
                ];
            }

            if (
                mode
                !== 'MIXED'
            ) {
                const reference =
                    mode
                        === 'CARD'
                        ? cardReference
                        : mode
                            === 'QR'
                            ? qrReference
                            : mode
                                === 'BANK_TRANSFER'
                                ? bankReference
                                : otherReference;

                return [
                    {
                        payment_method:
                            mode,

                        amount:
                            payableBalance,

                        reference_number:
                            reference.trim()
                            ||
                            undefined,
                    },
                ];
            }

            if (
                Math.abs(
                    mixedRemaining,
                )
                >
                0.009
            ) {
                throw new Error(
                    `Mixed payments must exactly equal the invoice balance. Remaining: ${money(
                        mixedRemaining,
                    )}`,
                );
            }

            const rows:
                PaymentInputRow[] =
                [];

            if (
                mixedCash
                >
                0
            ) {
                if (
                    cashTendered
                    <
                    mixedCash
                ) {
                    throw new Error(
                        'Cash received cannot be less than the cash allocation.',
                    );
                }

                rows.push({
                    payment_method:
                        'CASH',

                    amount:
                        mixedCash,

                    tendered_amount:
                        cashTendered,
                });
            }

            const addNonCash =
                (
                    paymentMethod:
                        CustomerPaymentMethod,

                    rawAmount:
                        string,

                    reference:
                        string,
                ): void => {
                    const value =
                        roundMoney(
                            rawAmount
                            ||
                            0,
                        );

                    if (
                        value
                        <=
                        0
                    ) {
                        return;
                    }

                    rows.push({
                        payment_method:
                            paymentMethod,

                        amount:
                            value,

                        reference_number:
                            reference.trim()
                            ||
                            undefined,
                    });
                };

            addNonCash(
                'CARD',
                cardAmount,
                cardReference,
            );

            addNonCash(
                'QR',
                qrAmount,
                qrReference,
            );

            addNonCash(
                'BANK_TRANSFER',
                bankAmount,
                bankReference,
            );

            addNonCash(
                'OTHER',
                otherAmount,
                otherReference,
            );

            if (
                rows.length
                ===
                0
            ) {
                throw new Error(
                    'Add at least one payment.',
                );
            }

            return rows;
        };

    const processPayment =
        async (): Promise<void> => {
            if (
                processing
            ) {
                return;
            }

            setMessage(
                '',
            );

            setLocalError(
                '',
            );

            const currentInvoice =
                await ensureInvoice();

            if (
                !currentInvoice
            ) {
                return;
            }

            const currentBalance =
                roundMoney(
                    currentInvoice.payment.balance_due,
                );

            if (
                currentBalance
                <=
                0.009
            ) {
                setMessage(
                    'This invoice is already fully paid.',
                );

                return;
            }

            setProcessing(
                true,
            );

            try {
                const payments =
                    buildPayments(
                        currentBalance,
                    );

                const containsCash =
                    payments.some(
                        (
                            payment,
                        ) =>
                            payment.payment_method
                            === 'CASH',
                    );

                let shiftId:
                    number | null =
                    null;

                try {
                    const shiftResponse =
                        await api.get<
                            CurrentCashierShiftData
                        >(
                            '/cashier-shifts/current',
                        );

                    shiftId =
                        shiftResponse.data.shift
                            ?.id
                        ??
                        null;
                } catch (
                shiftException
                ) {
                    if (
                        containsCash
                    ) {
                        throw shiftException;
                    }
                }

                if (
                    containsCash
                    &&
                    !shiftId
                ) {
                    throw new Error(
                        'Open a cashier shift before accepting cash.',
                    );
                }

                const response =
                    await api.post<
                        CustomerPaymentResultData
                    >(
                        `/invoices/${currentInvoice.id}/payments`,
                        {
                            client_request_id:
                                paymentRequestId,

                            cashier_shift_id:
                                shiftId,

                            payments:
                                payments,
                        },
                    );

                const result =
                    response.data;

                setInvoice(
                    result.invoice,
                );

                setPaymentRequestId(
                    makeUuid(),
                );

                if (
                    result.invoice.payment.status
                    === 'PAID'
                ) {
                    await onOrderPaid(
                        order,
                    );
                }

                if (
                    !result.created
                ) {
                    setMessage(
                        'This payment request was already processed. No duplicate receipt or drawer opening was performed.',
                    );

                    return;
                }

                const [
                    freshInvoiceResponse,
                    historyResponse,
                ] =
                    await Promise.all([
                        api.get<
                            CashierInvoice
                        >(
                            `/invoices/${result.invoice.id}`,
                        ),

                        api.get<
                            CustomerPaymentHistoryData
                        >(
                            `/invoices/${result.invoice.id}/payments`,
                        ),
                    ]);

                const freshInvoice =
                    freshInvoiceResponse.data;

                setInvoice(
                    freshInvoice,
                );

                try {
                    await printInvoiceReceipt(
                        freshInvoice,

                        historyResponse.data.payments,
                    );
                } catch (
                receiptException
                ) {
                    setLocalError(
                        `Payment was SAVED successfully, but the receipt could not be sent to the printer. The cash drawer was NOT opened. ${receiptException
                            instanceof Error
                            ? receiptException.message
                            : ''
                        }`,
                    );

                    return;
                }

                if (
                    result.cash_drawer.should_open
                ) {
                    try {
                        await window
                            .posBridge
                            .openCashDrawerHardware();
                    } catch (
                    drawerException
                    ) {
                        setLocalError(
                            `Payment was SAVED and the receipt was sent successfully, but the cash drawer did not open. Use the audited Manual Open option in Cash Drawer. ${drawerException
                                instanceof Error
                                ? drawerException.message
                                : ''
                            }`,
                        );

                        return;
                    }
                }

                setMessage(
                    result.cash_drawer.should_open
                        ? 'Payment completed. Receipt sent and cash drawer pulse sent.'
                        : 'Payment completed and receipt sent. Cash drawer remained closed.',
                );
            } catch (
            exception
            ) {
                setLocalError(
                    exception
                        instanceof Error
                        ? exception.message
                        : 'Unable to process payment.',
                );
            } finally {
                setProcessing(
                    false,
                );
            }
        };

    const reprintReceipt =
        async (): Promise<void> => {
            if (
                !invoice
            ) {
                return;
            }

            setProcessing(
                true,
            );

            setLocalError(
                '',
            );

            setMessage(
                '',
            );

            try {
                const [
                    invoiceResponse,
                    paymentHistory,
                ] =
                    await Promise.all([
                        api.get<
                            CashierInvoice
                        >(
                            `/invoices/${invoice.id}`,
                        ),

                        api.get<
                            CustomerPaymentHistoryData
                        >(
                            `/invoices/${invoice.id}/payments`,
                        ),
                    ]);

                await printInvoiceReceipt(
                    invoiceResponse.data,

                    paymentHistory.data.payments,

                    'REPRINT',
                );

                setMessage(
                    'Receipt reprinted successfully. The cash drawer was not opened.',
                );
            } catch (
            exception
            ) {
                setLocalError(
                    exception
                        instanceof Error
                        ? exception.message
                        : 'Unable to reprint receipt.',
                );
            } finally {
                setProcessing(
                    false,
                );
            }
        };


    return (
        <div className="module-page">
            <ModuleHeader
                title="Payment"
                subtitle="Secure customer payment, receipt printing and cash drawer control."
            />

            {
                localError
                    ? (
                        <div className="workspace-alert">
                            <span>
                                {localError}
                            </span>
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div className="backend-note">
                            {message}
                        </div>
                    )
                    : null
            }

            {
                !orderReadyForBilling
                    ? (
                        <div className="backend-note">
                            This order is not ready for billing.
                            Mark it as served before accepting payment.
                        </div>
                    )
                    : null
            }

            <div className="payment-layout">
                <section className="module-card payment-summary">
                    <span>
                        Order
                    </span>

                    <strong>
                        {
                            order.order_number
                        }
                    </strong>

                    <span>
                        Invoice
                    </span>

                    <strong>
                        {
                            loadingInvoice
                                ? 'Loading...'
                                : invoice?.invoice_number
                                ??
                                'Not generated'
                        }
                    </strong>

                    <span>
                        Balance Due
                    </span>

                    <strong>
                        {
                            money(
                                balance,
                            )
                        }
                    </strong>

                    <div className="payment-methods">
                        {
                            [
                                'CASH',
                                'CARD',
                                'QR',
                                'BANK_TRANSFER',
                                'OTHER',
                                'MIXED',
                            ].map(
                                (
                                    method,
                                ) => (
                                    <button
                                        key={
                                            method
                                        }
                                        type="button"
                                        className={
                                            mode
                                                === method
                                                ? 'is-active'
                                                : ''
                                        }
                                        disabled={
                                            processing
                                            ||
                                            !orderReadyForBilling
                                        }
                                        onClick={
                                            () => {
                                                setMode(
                                                    method as CustomerPaymentMethod | 'MIXED',
                                                );

                                                setMessage(
                                                    '',
                                                );

                                                setLocalError(
                                                    '',
                                                );
                                            }
                                        }
                                    >
                                        {
                                            method.replace(
                                                /_/g,
                                                ' ',
                                            )
                                        }
                                    </button>
                                ),
                            )
                        }
                    </div>

                    {
                        mode
                            === 'CASH'
                            ? (
                                <>
                                    <span>
                                        Cash Received
                                    </span>

                                    <div className="received-display">
                                        {
                                            money(
                                                cashTendered,
                                            )
                                        }
                                    </div>

                                    <span>
                                        Change
                                    </span>

                                    <strong className="change-value">
                                        {
                                            money(
                                                displayChange,
                                            )
                                        }
                                    </strong>
                                </>
                            )
                            : null
                    }

                    {
                        mode
                            === 'CARD'
                            ? (
                                <div>
                                    <label className="field-label">
                                        Card Reference
                                    </label>

                                    <input
                                        className="touch-input"
                                        value={
                                            cardReference
                                        }
                                        placeholder="Optional reference / last digits"
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setCardReference(
                                                    event.target.value,
                                                )
                                        }
                                    />
                                </div>
                            )
                            : null
                    }

                    {
                        mode
                            === 'QR'
                            ? (
                                <div>
                                    <label className="field-label">
                                        QR Reference
                                    </label>

                                    <input
                                        className="touch-input"
                                        value={
                                            qrReference
                                        }
                                        placeholder="Optional QR transaction reference"
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setQrReference(
                                                    event.target.value,
                                                )
                                        }
                                    />
                                </div>
                            )
                            : null
                    }

                    {
                        mode
                            === 'BANK_TRANSFER'
                            ? (
                                <div>
                                    <label className="field-label">
                                        Bank Transfer Reference
                                    </label>

                                    <input
                                        className="touch-input"
                                        value={
                                            bankReference
                                        }
                                        placeholder="Optional bank reference"
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setBankReference(
                                                    event.target.value,
                                                )
                                        }
                                    />
                                </div>
                            )
                            : null
                    }

                    {
                        mode
                            === 'OTHER'
                            ? (
                                <div>
                                    <label className="field-label">
                                        Payment Reference
                                    </label>

                                    <input
                                        className="touch-input"
                                        value={
                                            otherReference
                                        }
                                        placeholder="Optional payment reference"
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setOtherReference(
                                                    event.target.value,
                                                )
                                        }
                                    />
                                </div>
                            )
                            : null
                    }

                    {
                        mode
                            === 'MIXED'
                            ? (
                                <>
                                    <div className="form-grid">
                                        <div>
                                            <label className="field-label">
                                                Cash Allocation
                                            </label>

                                            <input
                                                className="touch-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    cashAmount
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setCashAmount(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Cash Received
                                            </label>

                                            <input
                                                className="touch-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    cashReceived
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setCashReceived(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Card
                                            </label>

                                            <input
                                                className="touch-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    cardAmount
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setCardAmount(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                QR
                                            </label>

                                            <input
                                                className="touch-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    qrAmount
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setQrAmount(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Bank Transfer
                                            </label>

                                            <input
                                                className="touch-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    bankAmount
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setBankAmount(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Other
                                            </label>

                                            <input
                                                className="touch-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    otherAmount
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setOtherAmount(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Card Reference
                                            </label>

                                            <input
                                                className="touch-input"
                                                value={
                                                    cardReference
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setCardReference(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                QR Reference
                                            </label>

                                            <input
                                                className="touch-input"
                                                value={
                                                    qrReference
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setQrReference(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Bank Reference
                                            </label>

                                            <input
                                                className="touch-input"
                                                value={
                                                    bankReference
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setBankReference(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Other Reference
                                            </label>

                                            <input
                                                className="touch-input"
                                                value={
                                                    otherReference
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setOtherReference(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="backend-note">
                                        Allocated: {
                                            money(
                                                mixedAllocated,
                                            )
                                        }
                                        {' • '}
                                        Remaining: {
                                            money(
                                                mixedRemaining,
                                            )
                                        }
                                        {' • '}
                                        Cash Change: {
                                            money(
                                                displayChange,
                                            )
                                        }
                                    </div>
                                </>
                            )
                            : null
                    }

                    <div className="order-action-stack">
                        <button
                            type="button"
                            className="success-button big-action-button"
                            disabled={
                                processing
                                ||
                                loadingInvoice
                                ||
                                !invoice
                                ||
                                !orderReadyForBilling
                                ||
                                balance
                                <=
                                0.009
                            }
                            onClick={
                                () => {
                                    void processPayment();
                                }
                            }
                        >
                            {
                                processing
                                    ? 'Processing...'
                                    : `Complete Payment • ${money(
                                        balance,
                                    )}`
                            }
                        </button>

                        {
                            invoice
                                &&
                                Number(
                                    invoice.payment.paid_amount,
                                )
                                >
                                0
                                ? (
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        disabled={
                                            processing
                                        }
                                        onClick={
                                            () => {
                                                void reprintReceipt();
                                            }
                                        }
                                    >
                                        Reprint Receipt
                                    </button>
                                )
                                : null
                        }
                    </div>
                </section>

                {
                    mode
                        === 'CASH'
                        ? (
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
                                                disabled={
                                                    processing
                                                }
                                                onClick={
                                                    () =>
                                                        appendCashReceived(
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
                                    disabled={
                                        processing
                                    }
                                    onClick={
                                        () =>
                                            setCashReceived(
                                                '',
                                            )
                                    }
                                >
                                    CLEAR
                                </button>

                                <button
                                    type="button"
                                    className="keypad-back"
                                    disabled={
                                        processing
                                    }
                                    onClick={
                                        () =>
                                            setCashReceived(
                                                (
                                                    current,
                                                ) =>
                                                    current.slice(
                                                        0,
                                                        -1,
                                                    ),
                                            )
                                    }
                                >
                                    BACK
                                </button>
                            </section>
                        )
                        : (
                            <section className="module-card">
                                <h3>
                                    Cash Drawer Rule
                                </h3>

                                <p>
                                    Laravel is the authority for whether the drawer may open.
                                </p>

                                <p>
                                    Card-only and QR-only payments never open the drawer.
                                    Mixed payment opens it only when Laravel confirms a cash component.
                                </p>

                                <p>
                                    Receipt reprints never open the drawer.
                                </p>
                            </section>
                        )
                }
            </div>
        </div>
    );
}


function CashDrawerModule(
    {
        canManualOpen,
    }: {
        canManualOpen:
        boolean;
    },
) {
    const [
        shift,
        setShift,
    ] =
        useState<
            CashierShiftRecord | null
        >(null);

    const [
        settings,
        setSettings,
    ] =
        useState<
            ReceiptPrinterSettings
        >({
            printerName:
                'Cashier Receipt Printer',

            host:
                '',

            port:
                9100,

            paperWidthMm:
                80,

            connectTimeoutMs:
                4000,

            drawerPin:
                0,

            drawerPulseOnMs:
                50,

            drawerPulseOffMs:
                500,
        });

    const [
        reason,
        setReason,
    ] =
        useState('');

    const [
        manualOpenRequestId,
        setManualOpenRequestId,
    ] =
        useState<string>(
            () =>
                makeUuid(),
        );

    const [
        busy,
        setBusy,
    ] =
        useState(false);

    const [
        message,
        setMessage,
    ] =
        useState('');

    const [
        localError,
        setLocalError,
    ] =
        useState('');

    const load =
        useCallback(
            async (): Promise<void> => {
                try {
                    const [
                        savedSettings,
                        shiftResponse,
                    ] =
                        await Promise.all([
                            window
                                .posBridge
                                .getReceiptPrinterSettings(),

                            api.get<
                                CurrentCashierShiftData
                            >(
                                '/cashier-shifts/current',
                            ),
                        ]);

                    setSettings(
                        savedSettings,
                    );

                    setShift(
                        shiftResponse.data.shift,
                    );
                } catch (
                exception
                ) {
                    setLocalError(
                        exception
                            instanceof Error
                            ? exception.message
                            : 'Unable to load cash drawer.',
                    );
                }
            },
            [],
        );

    useEffect(
        () => {
            void load();
        },
        [
            load,
        ],
    );

    useEffect(
        () => {
            setManualOpenRequestId(
                makeUuid(),
            );
        },
        [
            reason,
        ],
    );

    const run =
        async (
            action:
                () => Promise<void>,
        ): Promise<void> => {
            setBusy(
                true,
            );

            setMessage(
                '',
            );

            setLocalError(
                '',
            );

            try {
                await action();
            } catch (
            exception
            ) {
                setLocalError(
                    exception
                        instanceof Error
                        ? exception.message
                        : 'Cash drawer operation failed.',
                );
            } finally {
                setBusy(
                    false,
                );
            }
        };

    const save =
        async (): Promise<void> => {
            await run(
                async () => {
                    const saved =
                        await window
                            .posBridge
                            .setReceiptPrinterSettings(
                                settings,
                            );

                    setSettings(
                        saved,
                    );

                    setMessage(
                        'Receipt printer settings saved.',
                    );
                },
            );
        };

    const saveSettingsForTest =
        async (): Promise<void> => {
            const saved =
                await window
                    .posBridge
                    .setReceiptPrinterSettings(
                        settings,
                    );

            setSettings(
                saved,
            );
        };

    const testConnection =
        async (): Promise<void> => {
            await run(
                async () => {
                    await saveSettingsForTest();

                    const result =
                        await window
                            .posBridge
                            .testReceiptPrinterConnection();

                    setMessage(
                        result.message,
                    );
                },
            );
        };

    const testReceipt =
        async (): Promise<void> => {
            await run(
                async () => {
                    await saveSettingsForTest();

                    const result =
                        await window
                            .posBridge
                            .testReceiptPrinter();

                    setMessage(
                        result.message,
                    );
                },
            );
        };

    const testDrawer =
        async (): Promise<void> => {
            await run(
                async () => {
                    await saveSettingsForTest();

                    const result =
                        await window
                            .posBridge
                            .testCashDrawer();

                    setMessage(
                        `${result.message} This was a local hardware test and did not create a financial record.`,
                    );
                },
            );
        };

    const manualOpen =
        async (): Promise<void> => {
            if (
                !shift
            ) {
                setLocalError(
                    'Open a cashier shift before manually opening the drawer.',
                );

                return;
            }

            if (
                !canManualOpen
            ) {
                setLocalError(
                    'Your account does not have permission to manually open the cash drawer.',
                );

                return;
            }

            if (
                !reason.trim()
            ) {
                setLocalError(
                    'Enter a reason for manually opening the drawer.',
                );

                return;
            }

            await run(
                async () => {
                    const response =
                        await api.post<
                            CashDrawerManualOpenData
                        >(
                            `/cashier-shifts/${shift.id}/manual-open`,
                            {
                                client_request_id:
                                    manualOpenRequestId,

                                reason:
                                    reason.trim(),
                            },
                        );

                    if (
                        !response.data.cash_drawer.should_open
                    ) {
                        setMessage(
                            'This manual-open authorization was already processed. No second drawer pulse was sent.',
                        );

                        return;
                    }

                    try {
                        await window
                            .posBridge
                            .openCashDrawerHardware();
                    } catch (
                    hardwareException
                    ) {
                        setLocalError(
                            `Laravel authorized and audited the manual open, but the hardware pulse failed. ${hardwareException
                                instanceof Error
                                ? hardwareException.message
                                : ''
                            }`,
                        );

                        return;
                    }

                    setMessage(
                        'Manual drawer opening authorized, audited and sent to the printer.',
                    );

                    setReason(
                        '',
                    );

                    setManualOpenRequestId(
                        makeUuid(),
                    );

                    await load();
                },
            );
        };

    return (
        <div className="module-page">
            <ModuleHeader
                title="Cash Drawer"
                subtitle="Configure the cashier receipt printer and control its attached drawer."
            />

            {
                localError
                    ? (
                        <div className="workspace-alert">
                            <span>
                                {localError}
                            </span>
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div className="backend-note">
                            {message}
                        </div>
                    )
                    : null
            }

            <div className="settings-grid">
                <section className="module-card">
                    <h2>
                        Receipt Printer
                    </h2>

                    <div className="form-grid">
                        <div>
                            <label className="field-label">
                                Printer Name
                            </label>

                            <input
                                className="touch-input"
                                value={
                                    settings.printerName
                                }
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setSettings({
                                            ...settings,

                                            printerName:
                                                event.target.value,
                                        })
                                }
                            />
                        </div>

                        <div>
                            <label className="field-label">
                                Printer IP Address
                            </label>

                            <input
                                className="touch-input"
                                value={
                                    settings.host
                                }
                                placeholder="192.168.1.150"
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setSettings({
                                            ...settings,

                                            host:
                                                event.target.value,
                                        })
                                }
                            />
                        </div>

                        <div>
                            <label className="field-label">
                                TCP Port
                            </label>

                            <input
                                className="touch-input"
                                type="number"
                                min="1"
                                max="65535"
                                value={
                                    settings.port
                                }
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setSettings({
                                            ...settings,

                                            port:
                                                Number(
                                                    event.target.value,
                                                ),
                                        })
                                }
                            />
                        </div>

                        <div>
                            <label className="field-label">
                                Drawer Pin
                            </label>

                            <select
                                className="touch-input"
                                value={
                                    settings.drawerPin
                                }
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setSettings({
                                            ...settings,

                                            drawerPin:
                                                Number(
                                                    event.target.value,
                                                )
                                                    ===
                                                    1
                                                    ? 1
                                                    : 0,
                                        })
                                }
                            >
                                <option value={0}>
                                    Pin 2 / ESC p 0
                                </option>

                                <option value={1}>
                                    Pin 5 / ESC p 1
                                </option>
                            </select>
                        </div>

                        <div>
                            <label className="field-label">
                                Pulse ON (ms)
                            </label>

                            <input
                                className="touch-input"
                                type="number"
                                min="2"
                                max="510"
                                value={
                                    settings.drawerPulseOnMs
                                }
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setSettings({
                                            ...settings,

                                            drawerPulseOnMs:
                                                Number(
                                                    event.target.value,
                                                ),
                                        })
                                }
                            />
                        </div>

                        <div>
                            <label className="field-label">
                                Pulse OFF (ms)
                            </label>

                            <input
                                className="touch-input"
                                type="number"
                                min="2"
                                max="510"
                                value={
                                    settings.drawerPulseOffMs
                                }
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setSettings({
                                            ...settings,

                                            drawerPulseOffMs:
                                                Number(
                                                    event.target.value,
                                                ),
                                        })
                                }
                            />
                        </div>
                    </div>

                    <div className="order-action-stack">
                        <button
                            type="button"
                            className="secondary-button"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void save();
                                }
                            }
                        >
                            Save Printer Settings
                        </button>

                        <button
                            type="button"
                            className="secondary-button"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void testConnection();
                                }
                            }
                        >
                            Test Connection
                        </button>

                        <button
                            type="button"
                            className="secondary-button"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void testReceipt();
                                }
                            }
                        >
                            Test Receipt
                        </button>

                        <button
                            type="button"
                            className="primary-button"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void testDrawer();
                                }
                            }
                        >
                            Test Drawer
                        </button>
                    </div>
                </section>


                <section className="module-card">
                    <h2>
                        Manual Drawer Open
                    </h2>

                    <div className="customer-summary">
                        <div>
                            <span>
                                Current Shift
                            </span>

                            <strong>
                                {
                                    shift?.shift_number
                                    ??
                                    'No open shift'
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Expected Cash
                            </span>

                            <strong>
                                {
                                    money(
                                        shift?.expected_cash
                                        ??
                                        0,
                                    )
                                }
                            </strong>
                        </div>
                    </div>

                    <div>
                        <label className="field-label">
                            Reason
                        </label>

                        <input
                            className="touch-input"
                            value={
                                reason
                            }
                            placeholder="Example: customer needs change"
                            onChange={
                                (
                                    event,
                                ) =>
                                    setReason(
                                        event.target.value,
                                    )
                            }
                        />
                    </div>

                    <div className="backend-note">
                        Manual Open is permission checked and audited by Laravel.
                        It does not change the expected drawer cash balance.
                    </div>

                    <button
                        type="button"
                        className="success-button big-action-button"
                        disabled={
                            busy
                            ||
                            !shift
                            ||
                            !canManualOpen
                        }
                        onClick={
                            () => {
                                void manualOpen();
                            }
                        }
                    >
                        {
                            busy
                                ? 'Please Wait...'
                                : 'Manual Open Drawer'
                        }
                    </button>
                </section>
            </div>
        </div>
    );
}

function CashierShiftModule(
    {
        canOpen,
        canClose,
        canMoveCash,
    }: {
        canOpen:
        boolean;

        canClose:
        boolean;

        canMoveCash:
        boolean;
    },
) {
    const [
        shift,
        setShift,
    ] =
        useState<
            CashierShiftRecord | null
        >(null);

    const [
        summary,
        setSummary,
    ] =
        useState<
            CashierShiftSummary | null
        >(null);

    const [
        openingCash,
        setOpeningCash,
    ] =
        useState('');

    const [
        openingNotes,
        setOpeningNotes,
    ] =
        useState('');

    const [
        movementType,
        setMovementType,
    ] =
        useState<
            'cash-in'
            |
            'cash-out'
        >(
            'cash-in',
        );

    const [
        movementAmount,
        setMovementAmount,
    ] =
        useState('');

    const [
        movementReason,
        setMovementReason,
    ] =
        useState('');

    const [
        actualCash,
        setActualCash,
    ] =
        useState('');

    const [
        closingNotes,
        setClosingNotes,
    ] =
        useState('');

    const [
        openRequestId,
        setOpenRequestId,
    ] =
        useState<string>(
            () =>
                makeUuid(),
        );

    const [
        movementRequestId,
        setMovementRequestId,
    ] =
        useState<string>(
            () =>
                makeUuid(),
        );

    const [
        closeRequestId,
        setCloseRequestId,
    ] =
        useState<string>(
            () =>
                makeUuid(),
        );

    const [
        busy,
        setBusy,
    ] =
        useState(false);

    const [
        message,
        setMessage,
    ] =
        useState('');

    const [
        localError,
        setLocalError,
    ] =
        useState('');

    const loadCurrentShift =
        useCallback(
            async (): Promise<void> => {
                try {
                    const response =
                        await api.get<
                            CurrentCashierShiftData
                        >(
                            '/cashier-shifts/current',
                        );

                    setShift(
                        response.data.shift,
                    );

                    setSummary(
                        response.data.summary
                        ??
                        null,
                    );
                } catch (
                exception
                ) {
                    setLocalError(
                        exception
                            instanceof Error
                            ? exception.message
                            : 'Unable to load cashier shift.',
                    );
                }
            },
            [],
        );

    useEffect(
        () => {
            void loadCurrentShift();
        },
        [
            loadCurrentShift,
        ],
    );

    useEffect(
        () => {
            setOpenRequestId(
                makeUuid(),
            );
        },
        [
            openingCash,
            openingNotes,
        ],
    );

    useEffect(
        () => {
            setMovementRequestId(
                makeUuid(),
            );
        },
        [
            movementType,
            movementAmount,
            movementReason,
        ],
    );

    useEffect(
        () => {
            setCloseRequestId(
                makeUuid(),
            );
        },
        [
            actualCash,
            closingNotes,
        ],
    );

    const run =
        async (
            action:
                () => Promise<void>,
        ): Promise<void> => {
            setBusy(
                true,
            );

            setMessage(
                '',
            );

            setLocalError(
                '',
            );

            try {
                await action();
            } catch (
            exception
            ) {
                setLocalError(
                    exception
                        instanceof Error
                        ? exception.message
                        : 'Cashier shift operation failed.',
                );
            } finally {
                setBusy(
                    false,
                );
            }
        };

    const openShift =
        async (): Promise<void> => {
            if (
                !canOpen
            ) {
                setLocalError(
                    'Your account does not have permission to open a cashier shift.',
                );

                return;
            }

            const opening =
                roundMoney(
                    openingCash
                    ||
                    0,
                );

            if (
                opening
                <
                0
            ) {
                setLocalError(
                    'Opening cash cannot be negative.',
                );

                return;
            }

            await run(
                async () => {
                    const response =
                        await api.post<
                            CashierShiftMutationData
                        >(
                            '/cashier-shifts/open',
                            {
                                client_request_id:
                                    openRequestId,

                                opening_cash:
                                    opening,

                                opening_notes:
                                    openingNotes.trim()
                                    ||
                                    null,
                            },
                        );

                    setShift(
                        response.data.shift,
                    );

                    setSummary(
                        response.data.summary,
                    );

                    setOpeningCash(
                        '',
                    );

                    setOpeningNotes(
                        '',
                    );

                    setOpenRequestId(
                        makeUuid(),
                    );

                    setMessage(
                        response.data.created
                            === false
                            ? 'The existing open-shift request was returned safely.'
                            : 'Cashier shift opened successfully.',
                    );
                },
            );
        };

    const recordMovement =
        async (): Promise<void> => {
            if (
                !shift
                ||
                shift.status
                !== 'OPEN'
            ) {
                setLocalError(
                    'An open cashier shift is required.',
                );

                return;
            }

            if (
                !canMoveCash
            ) {
                setLocalError(
                    'Your account does not have permission to record cash drawer movements.',
                );

                return;
            }

            const amount =
                roundMoney(
                    movementAmount
                    ||
                    0,
                );

            if (
                amount
                <=
                0
            ) {
                setLocalError(
                    'Enter a cash movement amount greater than zero.',
                );

                return;
            }

            if (
                !movementReason.trim()
            ) {
                setLocalError(
                    'A reason is required for Cash In / Cash Out.',
                );

                return;
            }

            await run(
                async () => {
                    const response =
                        await api.post<
                            CashierShiftMutationData
                        >(
                            `/cashier-shifts/${shift.id}/${movementType}`,
                            {
                                client_request_id:
                                    movementRequestId,

                                amount:
                                    amount,

                                reason:
                                    movementReason.trim(),
                            },
                        );

                    setShift(
                        response.data.shift,
                    );

                    setSummary(
                        response.data.summary,
                    );

                    setMovementAmount(
                        '',
                    );

                    setMovementReason(
                        '',
                    );

                    setMovementRequestId(
                        makeUuid(),
                    );

                    setMessage(
                        movementType
                            === 'cash-in'
                            ? 'Cash In recorded successfully.'
                            : 'Cash Out recorded successfully.',
                    );
                },
            );
        };


    const closeShift =
        async (): Promise<void> => {
            if (
                !shift
                ||
                shift.status
                !== 'OPEN'
            ) {
                setLocalError(
                    'There is no open cashier shift to close.',
                );

                return;
            }

            if (
                !canClose
            ) {
                setLocalError(
                    'Your account does not have permission to close a cashier shift.',
                );

                return;
            }

            const countedCash =
                roundMoney(
                    actualCash
                    ||
                    0,
                );

            if (
                countedCash
                <
                0
            ) {
                setLocalError(
                    'Actual cash cannot be negative.',
                );

                return;
            }

            await run(
                async () => {
                    const response =
                        await api.post<
                            CashierShiftMutationData
                        >(
                            `/cashier-shifts/${shift.id}/close`,
                            {
                                client_request_id:
                                    closeRequestId,

                                actual_cash:
                                    countedCash,

                                closing_notes:
                                    closingNotes.trim()
                                    ||
                                    null,
                            },
                        );

                    setShift(
                        response.data.shift,
                    );

                    setSummary(
                        response.data.summary,
                    );

                    setActualCash(
                        '',
                    );

                    setClosingNotes(
                        '',
                    );

                    setCloseRequestId(
                        makeUuid(),
                    );

                    setMessage(
                        response.data.closed
                            === false
                            ? 'The existing shift-close request was returned safely.'
                            : 'Cashier shift closed successfully.',
                    );
                },
            );
        };

    const isOpen =
        shift?.status
        === 'OPEN';

    return (
        <div className="module-page">
            <ModuleHeader
                title="Cashier Shift"
                subtitle="Opening cash, cash movement tracking and drawer reconciliation."
            />

            {
                localError
                    ? (
                        <div className="workspace-alert">
                            <span>
                                {localError}
                            </span>
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div className="backend-note">
                            {message}
                        </div>
                    )
                    : null
            }

            {
                isOpen
                    ? (
                        <>
                            <div className="settings-grid">
                                <SettingCard
                                    label="Shift"
                                    value={
                                        shift?.shift_number
                                        ??
                                        '—'
                                    }
                                />

                                <SettingCard
                                    label="Opening Cash"
                                    value={
                                        money(
                                            summary?.opening_cash
                                            ??
                                            shift?.opening_cash
                                            ??
                                            0,
                                        )
                                    }
                                />

                                <SettingCard
                                    label="Cash Sales"
                                    value={
                                        money(
                                            summary?.cash_sales
                                            ??
                                            0,
                                        )
                                    }
                                />

                                <SettingCard
                                    label="Cash Refunds"
                                    value={
                                        money(
                                            summary?.cash_refunds
                                            ??
                                            0,
                                        )
                                    }
                                />

                                <SettingCard
                                    label="Cash In"
                                    value={
                                        money(
                                            summary?.cash_in
                                            ??
                                            0,
                                        )
                                    }
                                />

                                <SettingCard
                                    label="Cash Out"
                                    value={
                                        money(
                                            summary?.cash_out
                                            ??
                                            0,
                                        )
                                    }
                                />

                                <SettingCard
                                    label="Expected Drawer"
                                    value={
                                        money(
                                            summary?.expected_cash
                                            ??
                                            shift?.expected_cash
                                            ??
                                            0,
                                        )
                                    }
                                />
                            </div>

                            <div className="settings-grid">
                                <section className="module-card">
                                    <h2>
                                        Cash In / Cash Out
                                    </h2>

                                    <div className="payment-methods">
                                        <button
                                            type="button"
                                            className={
                                                movementType
                                                    === 'cash-in'
                                                    ? 'is-active'
                                                    : ''
                                            }
                                            disabled={
                                                busy
                                            }
                                            onClick={
                                                () =>
                                                    setMovementType(
                                                        'cash-in',
                                                    )
                                            }
                                        >
                                            CASH IN
                                        </button>

                                        <button
                                            type="button"
                                            className={
                                                movementType
                                                    === 'cash-out'
                                                    ? 'is-active'
                                                    : ''
                                            }
                                            disabled={
                                                busy
                                            }
                                            onClick={
                                                () =>
                                                    setMovementType(
                                                        'cash-out',
                                                    )
                                            }
                                        >
                                            CASH OUT
                                        </button>
                                    </div>

                                    <div className="form-grid">
                                        <div>
                                            <label className="field-label">
                                                Amount
                                            </label>

                                            <input
                                                className="touch-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    movementAmount
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setMovementAmount(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Reason
                                            </label>

                                            <input
                                                className="touch-input"
                                                value={
                                                    movementReason
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setMovementReason(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="primary-button big-action-button"
                                        disabled={
                                            busy
                                            ||
                                            !canMoveCash
                                        }
                                        onClick={
                                            () => {
                                                void recordMovement();
                                            }
                                        }
                                    >
                                        {
                                            movementType
                                                === 'cash-in'
                                                ? 'Record Cash In'
                                                : 'Record Cash Out'
                                        }
                                    </button>
                                </section>

                                <section className="module-card">
                                    <h2>
                                        Close Shift
                                    </h2>

                                    <div className="backend-note">
                                        Expected Drawer: {
                                            money(
                                                summary?.expected_cash
                                                ??
                                                shift?.expected_cash
                                                ??
                                                0,
                                            )
                                        }
                                    </div>

                                    <div className="form-grid">
                                        <div>
                                            <label className="field-label">
                                                Actual Cash Counted
                                            </label>

                                            <input
                                                className="touch-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    actualCash
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setActualCash(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label className="field-label">
                                                Closing Notes
                                            </label>

                                            <input
                                                className="touch-input"
                                                value={
                                                    closingNotes
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setClosingNotes(
                                                            event.target.value,
                                                        )
                                                }
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="success-button big-action-button"
                                        disabled={
                                            busy
                                            ||
                                            !canClose
                                        }
                                        onClick={
                                            () => {
                                                void closeShift();
                                            }
                                        }
                                    >
                                        Close Shift
                                    </button>
                                </section>
                            </div>
                        </>
                    )
                    : (
                        <section className="module-card">
                            <h2>
                                Open Cashier Shift
                            </h2>

                            {
                                shift
                                    &&
                                    shift.status
                                    === 'CLOSED'
                                    ? (
                                        <div className="backend-note">
                                            Previous shift closed.
                                            Expected: {
                                                money(
                                                    shift.expected_cash,
                                                )
                                            }
                                            {' • '}
                                            Actual: {
                                                money(
                                                    shift.actual_cash
                                                    ??
                                                    0,
                                                )
                                            }
                                            {' • '}
                                            Difference: {
                                                money(
                                                    shift.cash_difference
                                                    ??
                                                    0,
                                                )
                                            }
                                        </div>
                                    )
                                    : null
                            }

                            <div className="form-grid">
                                <div>
                                    <label className="field-label">
                                        Opening Cash
                                    </label>

                                    <input
                                        className="touch-input"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                            openingCash
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setOpeningCash(
                                                    event.target.value,
                                                )
                                        }
                                        placeholder="10000.00"
                                    />
                                </div>

                                <div>
                                    <label className="field-label">
                                        Opening Notes
                                    </label>

                                    <input
                                        className="touch-input"
                                        value={
                                            openingNotes
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setOpeningNotes(
                                                    event.target.value,
                                                )
                                        }
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>

                            <button
                                type="button"
                                className="success-button big-action-button"
                                disabled={
                                    busy
                                    ||
                                    !canOpen
                                }
                                onClick={
                                    () => {
                                        void openShift();
                                    }
                                }
                            >
                                Open Shift
                            </button>
                        </section>
                    )
            }

            <button
                type="button"
                className="secondary-button"
                disabled={
                    busy
                }
                onClick={
                    () => {
                        void loadCurrentShift();
                    }
                }
            >
                Refresh Shift
            </button>
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
                subtitle="Cashier terminal, connection and kitchen printer configuration."
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

            <KitchenPrinterModule />
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