'use client';

import {
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    appendQrOrderItems,
    getPublicOrderStatus,
    getQrMenu,
    openTableSession,
    PublicApiError,
    resolveTableQr,
    submitQrOrder,
} from '@/lib/public-ordering-api';

import type {
    AppendQrOrderPayload,
    CartAddon,
    CartLine,
    MenuAddon,
    MenuCategory,
    MenuItem,
    MenuVariant,
    PublicOrder,
    PublicTable,
    SubmitQrOrderPayload,
} from '@/types/public-ordering';

import styles
    from './customer-ordering.module.css';

interface Props {
    token: string;
}

interface StoredSubmission {
    id: string;
    signature: string;
}

/*
|--------------------------------------------------------------------------
| Currency
|--------------------------------------------------------------------------
*/

function money(
    value: number,
): string {
    return new Intl.NumberFormat(
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
    ).format(
        value,
    );
}

/*
|--------------------------------------------------------------------------
| Customer-friendly Status
|--------------------------------------------------------------------------
*/

function statusMessage(
    status: string,
): {
    title: string;
    description: string;
} {
    switch (status) {
        case 'PENDING':
            return {
                title:
                    'Awaiting cashier approval',

                description:
                    'Your order has reached the cashier and is waiting to be reviewed.',
            };

        case 'CONFIRMED':
            return {
                title:
                    'Order accepted',

                description:
                    'The cashier has accepted your order.',
            };

        case 'SENT_TO_KITCHEN':
            return {
                title:
                    'Preparing your order',

                description:
                    'Your order has been sent to the kitchen.',
            };

        case 'SERVED':
            return {
                title:
                    'Order served',

                description:
                    'Your order has been marked as served.',
            };

        case 'COMPLETED':
            return {
                title:
                    'Order completed',

                description:
                    'Thank you. Your order has been completed.',
            };

        case 'REJECTED':
            return {
                title:
                    'Order not accepted',

                description:
                    'The cashier could not accept this order. Please speak with a staff member.',
            };

        case 'CANCELLED':
            return {
                title:
                    'Order cancelled',

                description:
                    'This order has been cancelled.',
            };

        default:
            return {
                title:
                    'Order received',

                description:
                    'Your order status is being updated.',
            };
    }
}

/*
|--------------------------------------------------------------------------
| Storage Keys
|--------------------------------------------------------------------------
*/

function cartStorageKey(
    token: string,
): string {
    return `restaurant-qr-cart:${token}`;
}

function submissionStorageKey(
    token: string,
): string {
    return `restaurant-qr-submission:${token}`;
}

function activeOrderStorageKey(
    token: string,
): string {
    return `restaurant-qr-active-order:${token}`;
}

function additionalSubmissionStorageKey(
    statusToken: string,
): string {
    return `restaurant-qr-additional-submission:${statusToken}`;
}

/*
|--------------------------------------------------------------------------
| First-order Duplicate Protection
|--------------------------------------------------------------------------
*/

function buildSubmissionSignature(
    payload: Omit<
        SubmitQrOrderPayload,
        'client_order_id'
    >,
): string {
    return JSON.stringify(
        payload,
    );
}

function getOrCreateSubmissionId(
    token: string,
    signature: string,
): string {
    const key =
        submissionStorageKey(
            token,
        );

    const stored =
        window.sessionStorage
            .getItem(
                key,
            );

    if (stored) {
        try {
            const parsed =
                JSON.parse(
                    stored,
                ) as StoredSubmission;

            if (
                parsed.signature
                === signature
                && parsed.id
            ) {
                return parsed.id;
            }
        } catch {
            window.sessionStorage
                .removeItem(
                    key,
                );
        }
    }

    const id =
        crypto.randomUUID();

    const value:
        StoredSubmission = {
        id,
        signature,
    };

    window.sessionStorage
        .setItem(
            key,
            JSON.stringify(
                value,
            ),
        );

    return id;
}

/*
|--------------------------------------------------------------------------
| Additional-order Duplicate Protection
|--------------------------------------------------------------------------
*/

function getOrCreateAdditionalSubmissionId(
    statusToken: string,
    signature: string,
): string {
    const key =
        additionalSubmissionStorageKey(
            statusToken,
        );

    const stored =
        window.sessionStorage
            .getItem(
                key,
            );

    if (stored) {
        try {
            const parsed =
                JSON.parse(
                    stored,
                ) as StoredSubmission;

            if (
                parsed.signature
                === signature
                && parsed.id
            ) {
                return parsed.id;
            }
        } catch {
            window.sessionStorage
                .removeItem(
                    key,
                );
        }
    }

    const id =
        crypto.randomUUID();

    window.sessionStorage
        .setItem(
            key,
            JSON.stringify({
                id,
                signature,
            }),
        );

    return id;
}

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function CustomerOrderingPage(
    {
        token,
    }: Props,
) {
    /*
    |--------------------------------------------------------------------------
    | Restaurant/Table Data
    |--------------------------------------------------------------------------
    */

    const [
        table,
        setTable,
    ] =
        useState<
            PublicTable | null
        >(
            null,
        );

    const [
        categories,
        setCategories,
    ] =
        useState<
            MenuCategory[]
        >(
            [],
        );

    const [
        activeCategory,
        setActiveCategory,
    ] =
        useState<
            number | 'all'
        >(
            'all',
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
    | Loading/Error
    |--------------------------------------------------------------------------
    */

    const [
        loading,
        setLoading,
    ] =
        useState(
            true,
        );

    const [
        pageError,
        setPageError,
    ] =
        useState<
            string | null
        >(
            null,
        );

    const [
        actionError,
        setActionError,
    ] =
        useState<
            string | null
        >(
            null,
        );

    /*
    |--------------------------------------------------------------------------
    | Cart
    |--------------------------------------------------------------------------
    */

    const [
        cart,
        setCart,
    ] =
        useState<
            CartLine[]
        >(
            [],
        );

    const [
        cartHydrated,
        setCartHydrated,
    ] =
        useState(
            false,
        );

    const [
        cartOpen,
        setCartOpen,
    ] =
        useState(
            false,
        );

    /*
    |--------------------------------------------------------------------------
    | Item Configurator
    |--------------------------------------------------------------------------
    */

    const [
        selectedItem,
        setSelectedItem,
    ] =
        useState<
            MenuItem | null
        >(
            null,
        );

    const [
        selectedVariantId,
        setSelectedVariantId,
    ] =
        useState<
            number | null
        >(
            null,
        );

    const [
        selectedAddons,
        setSelectedAddons,
    ] =
        useState<
            Record<
                number,
                number
            >
        >(
            {},
        );

    const [
        itemQuantity,
        setItemQuantity,
    ] =
        useState(
            1,
        );

    const [
        specialNotes,
        setSpecialNotes,
    ] =
        useState(
            '',
        );

    /*
    |--------------------------------------------------------------------------
    | First-order Customer Information
    |--------------------------------------------------------------------------
    */

    const [
        customerName,
        setCustomerName,
    ] =
        useState(
            '',
        );

    const [
        customerPhone,
        setCustomerPhone,
    ] =
        useState(
            '',
        );

    const [
        orderNotes,
        setOrderNotes,
    ] =
        useState(
            '',
        );

    /*
    |--------------------------------------------------------------------------
    | Submission
    |--------------------------------------------------------------------------
    */

    const [
        submitting,
        setSubmitting,
    ] =
        useState(
            false,
        );

    /*
    |--------------------------------------------------------------------------
    | Current Cumulative Order
    |--------------------------------------------------------------------------
    |
    | This stays in state when Order More is clicked.
    |
    | We DO NOT set it to null.
    |
    */

    const [
        activeOrder,
        setActiveOrder,
    ] =
        useState<
            PublicOrder | null
        >(
            null,
        );

    /*
     * true:
     *
     * customer is browsing the menu to add
     * additional items to activeOrder.
     */
    const [
        orderingMore,
        setOrderingMore,
    ] =
        useState(
            false,
        );

    const activeOrderStatusToken =
        activeOrder
            ?.statusToken
        ?? null;

    /*
 |--------------------------------------------------------------------------
 | Load Saved Cart
 |--------------------------------------------------------------------------
 |
 | React 19's eslint rules discourage synchronous setState
 | calls directly inside an effect.
 |
 | The localStorage restoration therefore runs on the next
 | animation frame after the component is mounted.
 |
 */

    useEffect(
        () => {
            const frameId =
                window.requestAnimationFrame(
                    () => {
                        let restoredCart:
                            CartLine[] = [];

                        try {
                            const saved =
                                window.localStorage
                                    .getItem(
                                        cartStorageKey(
                                            token,
                                        ),
                                    );

                            if (saved) {
                                const parsed =
                                    JSON.parse(
                                        saved,
                                    );

                                if (
                                    Array.isArray(
                                        parsed,
                                    )
                                ) {
                                    restoredCart =
                                        parsed as CartLine[];
                                }
                            }
                        } catch {
                            window.localStorage
                                .removeItem(
                                    cartStorageKey(
                                        token,
                                    ),
                                );
                        }

                        setCart(
                            restoredCart,
                        );

                        setCartHydrated(
                            true,
                        );
                    },
                );

            return () => {
                window.cancelAnimationFrame(
                    frameId,
                );
            };
        },
        [
            token,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Persist Cart
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            if (
                !cartHydrated
            ) {
                return;
            }

            if (
                cart.length === 0
            ) {
                window.localStorage
                    .removeItem(
                        cartStorageKey(
                            token,
                        ),
                    );

                return;
            }

            window.localStorage
                .setItem(
                    cartStorageKey(
                        token,
                    ),

                    JSON.stringify(
                        cart,
                    ),
                );
        },
        [
            cart,
            cartHydrated,
            token,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Bootstrap QR Ordering
    |--------------------------------------------------------------------------
    |
    | 1. Validate QR
    | 2. Detect table
    | 3. Open/reuse session
    | 4. Load menu
    | 5. Restore existing active customer order
    |
    */

    useEffect(
        () => {
            let cancelled =
                false;

            async function bootstrap():
                Promise<void> {
                setLoading(
                    true,
                );

                setPageError(
                    null,
                );

                try {
                    /*
                    |--------------------------------------------------------------------------
                    | Table QR
                    |--------------------------------------------------------------------------
                    */

                    const resolvedTable =
                        await resolveTableQr(
                            token,
                        );

                    if (
                        cancelled
                    ) {
                        return;
                    }

                    if (
                        !resolvedTable
                            .qrOrderingEnabled
                    ) {
                        throw new PublicApiError(
                            'QR ordering is currently disabled for this table.',
                            'QR_ORDERING_DISABLED',
                            403,
                        );
                    }

                    setTable(
                        resolvedTable,
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Table Session
                    |--------------------------------------------------------------------------
                    */

                    await openTableSession(
                        token,
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Public Menu
                    |--------------------------------------------------------------------------
                    */

                    const menu =
                        await getQrMenu();

                    if (
                        cancelled
                    ) {
                        return;
                    }

                    setCategories(
                        menu,
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Restore Existing Customer Order
                    |--------------------------------------------------------------------------
                    */

                    const savedStatusToken =
                        window.localStorage
                            .getItem(
                                activeOrderStorageKey(
                                    token,
                                ),
                            );

                    if (
                        savedStatusToken
                    ) {
                        try {
                            const existingOrder =
                                await getPublicOrderStatus(
                                    savedStatusToken,
                                );

                            if (
                                cancelled
                            ) {
                                return;
                            }

                            setActiveOrder(
                                existingOrder,
                            );

                            /*
                             * If an additional cart was
                             * saved before refresh, return
                             * customer to menu mode.
                             */
                            const savedCart =
                                window.localStorage
                                    .getItem(
                                        cartStorageKey(
                                            token,
                                        ),
                                    );

                            let hasSavedItems =
                                false;

                            if (savedCart) {
                                try {
                                    const parsed =
                                        JSON.parse(
                                            savedCart,
                                        );

                                    hasSavedItems =
                                        Array.isArray(
                                            parsed,
                                        )
                                        && parsed.length
                                        > 0;
                                } catch {
                                    hasSavedItems =
                                        false;
                                }
                            }

                            setOrderingMore(
                                hasSavedItems,
                            );
                        } catch {
                            /*
                             * Old/invalid status token.
                             */
                            window.localStorage
                                .removeItem(
                                    activeOrderStorageKey(
                                        token,
                                    ),
                                );
                        }
                    }
                } catch (error) {
                    if (
                        cancelled
                    ) {
                        return;
                    }

                    setPageError(
                        error instanceof Error
                            ? error.message
                            : 'Unable to load the restaurant menu.',
                    );
                } finally {
                    if (
                        !cancelled
                    ) {
                        setLoading(
                            false,
                        );
                    }
                }
            }

            void bootstrap();

            return () => {
                cancelled =
                    true;
            };
        },
        [
            token,
        ],
    );

    /*
 |--------------------------------------------------------------------------
 | Poll Cumulative Order Status
 |--------------------------------------------------------------------------
 |
 | Continues even while the customer is
 | browsing for additional items.
 |
 */

    useEffect(
        () => {
            if (
                !activeOrderStatusToken
            ) {
                return;
            }

            /*
             * Copy the narrowed value into a local
             * string constant.
             *
             * This prevents TypeScript from treating
             * the captured value as string | null
             * inside the async function.
             */
            const statusToken:
                string =
                activeOrderStatusToken;

            let active =
                true;

            async function refreshStatus():
                Promise<void> {
                try {
                    const latest =
                        await getPublicOrderStatus(
                            statusToken,
                        );

                    if (active) {
                        setActiveOrder(
                            latest,
                        );
                    }
                } catch {
                    /*
                     * Temporary polling errors should
                     * never destroy the confirmed order.
                     */
                }
            }

            const timer =
                window.setInterval(
                    () => {
                        void refreshStatus();
                    },
                    5000,
                );

            return () => {
                active =
                    false;

                window.clearInterval(
                    timer,
                );
            };
        },
        [
            activeOrderStatusToken,
        ],
    );
    /*
    |--------------------------------------------------------------------------
    | Filter Menu
    |--------------------------------------------------------------------------
    */

    const filteredCategories =
        useMemo(
            () => {
                const normalizedSearch =
                    search
                        .trim()
                        .toLowerCase();

                return categories
                    .filter(
                        (category) =>
                            activeCategory
                            === 'all'
                            || category.id
                            === activeCategory,
                    )
                    .map(
                        (category) => ({
                            ...category,

                            items:
                                category
                                    .items
                                    .filter(
                                        (item) => {
                                            if (
                                                normalizedSearch
                                                === ''
                                            ) {
                                                return true;
                                            }

                                            return (
                                                item.name
                                                    .toLowerCase()
                                                    .includes(
                                                        normalizedSearch,
                                                    )
                                                ||
                                                (
                                                    item.description
                                                    ?? ''
                                                )
                                                    .toLowerCase()
                                                    .includes(
                                                        normalizedSearch,
                                                    )
                                            );
                                        },
                                    ),
                        }),
                    )
                    .filter(
                        (category) =>
                            category.items
                                .length
                            > 0,
                    );
            },
            [
                activeCategory,
                categories,
                search,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Current Configurator Variant
    |--------------------------------------------------------------------------
    */

    const selectedVariant =
        useMemo<MenuVariant | null>(
            () => {
                if (
                    !selectedItem
                    || selectedVariantId
                    === null
                ) {
                    return null;
                }

                return (
                    selectedItem
                        .variants
                        .find(
                            (variant) =>
                                variant.id
                                === selectedVariantId,
                        )
                    ?? null
                );
            },
            [
                selectedItem,
                selectedVariantId,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Configurator Pricing
    |--------------------------------------------------------------------------
    |
    | Frontend amount is display-only.
    |
    | Laravel still calculates authoritative prices.
    |
    */

    const configuratorBasePrice =
        selectedVariant
            ? selectedVariant.price
            : selectedItem
                ?.price
            ?? 0;

    const configuratorAddonPrice =
        useMemo(
            () => {
                if (
                    !selectedItem
                ) {
                    return 0;
                }

                return selectedItem
                    .addons
                    .reduce(
                        (
                            total,
                            addon,
                        ) => {
                            const quantity =
                                selectedAddons[
                                addon.id
                                ]
                                ?? 0;

                            return total
                                +
                                (
                                    addon.price
                                    * quantity
                                );
                        },
                        0,
                    );
            },
            [
                selectedAddons,
                selectedItem,
            ],
        );

    const configuratorTotal =
        (
            configuratorBasePrice
            +
            configuratorAddonPrice
        )
        * itemQuantity;

    /*
    |--------------------------------------------------------------------------
    | Cart Totals
    |--------------------------------------------------------------------------
    */

    const cartItemCount =
        useMemo(
            () =>
                cart.reduce(
                    (
                        total,
                        line,
                    ) =>
                        total
                        + line.quantity,
                    0,
                ),
            [
                cart,
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
                        line
                            .displayLineTotal,
                    0,
                ),
            [
                cart,
            ],
        );

    const predictedCombinedTotal =
        (
            activeOrder
                ?.grandTotal
            ?? 0
        )
        +
        cartTotal;

    /*
    |--------------------------------------------------------------------------
    | Open Item Configurator
    |--------------------------------------------------------------------------
    */

    function openConfigurator(
        item: MenuItem,
    ): void {
        setActionError(
            null,
        );

        if (
            item.hasVariants
            && item.variants.length
            === 0
        ) {
            setActionError(
                `${item.name} does not currently have an available size or variant.`,
            );

            return;
        }

        const defaultVariant =
            item.variants.find(
                (variant) =>
                    variant.isDefault,
            )
            ?? item.variants[0]
            ?? null;

        setSelectedItem(
            item,
        );

        setSelectedVariantId(
            defaultVariant
                ?.id
            ?? null,
        );

        setSelectedAddons(
            {},
        );

        setItemQuantity(
            1,
        );

        setSpecialNotes(
            '',
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Close Configurator
    |--------------------------------------------------------------------------
    */

    function closeConfigurator():
        void {
        setSelectedItem(
            null,
        );

        setSelectedVariantId(
            null,
        );

        setSelectedAddons(
            {},
        );

        setItemQuantity(
            1,
        );

        setSpecialNotes(
            '',
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Add-on Selection
    |--------------------------------------------------------------------------
    */

    function toggleAddon(
        addon: MenuAddon,
    ): void {
        setSelectedAddons(
            (current) => {
                const next = {
                    ...current,
                };

                if (
                    next[addon.id]
                ) {
                    delete next[
                        addon.id
                    ];
                } else {
                    next[
                        addon.id
                    ] = 1;
                }

                return next;
            },
        );
    }

    function changeAddonQuantity(
        addonId: number,
        change: number,
    ): void {
        setSelectedAddons(
            (current) => {
                const existing =
                    current[
                    addonId
                    ]
                    ?? 0;

                const nextQuantity =
                    Math.max(
                        0,
                        Math.min(
                            10,
                            existing
                            + change,
                        ),
                    );

                const next = {
                    ...current,
                };

                if (
                    nextQuantity <= 0
                ) {
                    delete next[
                        addonId
                    ];
                } else {
                    next[
                        addonId
                    ] =
                        nextQuantity;
                }

                return next;
            },
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Add Configured Item To LOCAL Cart
    |--------------------------------------------------------------------------
    |
    | No backend request happens here.
    |
    */

    function addConfiguredItem():
        void {
        if (
            !selectedItem
        ) {
            return;
        }

        if (
            selectedItem
                .hasVariants
            && !selectedVariant
        ) {
            setActionError(
                'Please select a size or variant.',
            );

            return;
        }

        const addons:
            CartAddon[] =
            selectedItem
                .addons
                .filter(
                    (addon) =>
                        (
                            selectedAddons[
                            addon.id
                            ]
                            ?? 0
                        ) > 0,
                )
                .map(
                    (addon) => {
                        const quantity =
                            selectedAddons[
                            addon.id
                            ];

                        return {
                            addonId:
                                addon.id,

                            name:
                                addon.name,

                            quantity,

                            unitPrice:
                                addon.price,

                            lineTotal:
                                addon.price
                                *
                                quantity
                                *
                                itemQuantity,
                        };
                    },
                );

        const line:
            CartLine = {
            lineId:
                crypto.randomUUID(),

            menuItemId:
                selectedItem.id,

            itemName:
                selectedItem.name,

            variantId:
                selectedVariant
                    ?.id
                ?? null,

            variantName:
                selectedVariant
                    ?.name
                ?? null,

            quantity:
                itemQuantity,

            unitPrice:
                configuratorBasePrice,

            addons,

            specialNotes:
                specialNotes
                    .trim(),

            displayLineTotal:
                configuratorTotal,
        };

        setCart(
            (current) => [
                ...current,
                line,
            ],
        );

        closeConfigurator();
    }

    /*
    |--------------------------------------------------------------------------
    | Update Cart Quantity
    |--------------------------------------------------------------------------
    */

    function updateCartQuantity(
        lineId: string,
        nextQuantity: number,
    ): void {
        if (
            nextQuantity <= 0
        ) {
            setCart(
                (current) =>
                    current.filter(
                        (line) =>
                            line.lineId
                            !== lineId,
                    ),
            );

            return;
        }

        const safeQuantity =
            Math.min(
                20,
                nextQuantity,
            );

        setCart(
            (current) =>
                current.map(
                    (line) => {
                        if (
                            line.lineId
                            !== lineId
                        ) {
                            return line;
                        }

                        const addonsPerItem =
                            line.addons
                                .reduce(
                                    (
                                        total,
                                        addon,
                                    ) =>
                                        total
                                        +
                                        (
                                            addon
                                                .unitPrice
                                            *
                                            addon
                                                .quantity
                                        ),
                                    0,
                                );

                        return {
                            ...line,

                            quantity:
                                safeQuantity,

                            addons:
                                line.addons
                                    .map(
                                        (addon) => ({
                                            ...addon,

                                            lineTotal:
                                                addon
                                                    .unitPrice
                                                *
                                                addon
                                                    .quantity
                                                *
                                                safeQuantity,
                                        }),
                                    ),

                            displayLineTotal:
                                (
                                    line.unitPrice
                                    +
                                    addonsPerItem
                                )
                                *
                                safeQuantity,
                        };
                    },
                ),
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Remove Cart Line
    |--------------------------------------------------------------------------
    */

    function removeCartLine(
        lineId: string,
    ): void {
        setCart(
            (current) =>
                current.filter(
                    (line) =>
                        line.lineId
                        !== lineId,
                ),
        );
    }

    /*
    |--------------------------------------------------------------------------
    | View Existing Order
    |--------------------------------------------------------------------------
    |
    | If customer ordered more but added nothing:
    |
    | NO API request.
    | NO order update.
    | NO database change.
    |
    */

    function viewMyOrder():
        void {
        if (
            !activeOrder
        ) {
            return;
        }

        setActionError(
            null,
        );

        if (
            cart.length === 0
        ) {
            setOrderingMore(
                false,
            );

            return;
        }

        /*
         * There are unsubmitted items.
         *
         * Show them instead of silently
         * discarding them.
         */
        setCartOpen(
            true,
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cancel Additional Items
    |--------------------------------------------------------------------------
    |
    | These items only exist in the browser cart.
    |
    | Therefore cancelling requires ZERO database update.
    |
    */

    function cancelAdditionalItems():
        void {
        if (
            !activeOrder
        ) {
            return;
        }

        setCart(
            [],
        );

        setCartOpen(
            false,
        );

        setOrderingMore(
            false,
        );

        setActionError(
            null,
        );

        window.localStorage
            .removeItem(
                cartStorageKey(
                    token,
                ),
            );

        window.sessionStorage
            .removeItem(
                additionalSubmissionStorageKey(
                    activeOrder
                        .statusToken,
                ),
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Submit First / Additional Order
    |--------------------------------------------------------------------------
    */

    async function placeOrder():
        Promise<void> {
        if (
            cart.length === 0
            || submitting
        ) {
            return;
        }

        setSubmitting(
            true,
        );

        setActionError(
            null,
        );

        /*
        |--------------------------------------------------------------------------
        | Common Item Payload
        |--------------------------------------------------------------------------
        */

        const items =
            cart.map(
                (line) => ({
                    menu_item_id:
                        line.menuItemId,

                    variant_id:
                        line.variantId,

                    quantity:
                        line.quantity,

                    special_notes:
                        line.specialNotes
                            .trim()
                        || null,

                    addons:
                        line.addons
                            .map(
                                (addon) => ({
                                    addon_id:
                                        addon
                                            .addonId,

                                    quantity:
                                        addon
                                            .quantity,
                                }),
                            ),
                }),
            );

        try {
            /*
            |--------------------------------------------------------------------------
            | ADDITIONAL ITEMS
            |--------------------------------------------------------------------------
            */

            if (
                activeOrder
            ) {
                const signature =
                    JSON.stringify({
                        items,
                    });

                const clientSubmissionId =
                    getOrCreateAdditionalSubmissionId(
                        activeOrder
                            .statusToken,

                        signature,
                    );

                const payload:
                    AppendQrOrderPayload = {
                    client_submission_id:
                        clientSubmissionId,

                    items,
                };

                const updatedOrder =
                    await appendQrOrderItems(
                        activeOrder
                            .statusToken,

                        payload,
                    );

                /*
                 * SAME order returned with:
                 *
                 * original items
                 * +
                 * newly appended items
                 */
                setActiveOrder(
                    updatedOrder,
                );

                setCart(
                    [],
                );

                setCartOpen(
                    false,
                );

                setOrderingMore(
                    false,
                );

                window.localStorage
                    .removeItem(
                        cartStorageKey(
                            token,
                        ),
                    );

                window.sessionStorage
                    .removeItem(
                        additionalSubmissionStorageKey(
                            activeOrder
                                .statusToken,
                        ),
                    );

                return;
            }

            /*
            |--------------------------------------------------------------------------
            | FIRST ORDER
            |--------------------------------------------------------------------------
            */

            const payloadWithoutId:
                Omit<
                    SubmitQrOrderPayload,
                    'client_order_id'
                > = {
                customer_name:
                    customerName
                        .trim()
                    || null,

                customer_phone:
                    customerPhone
                        .trim()
                    || null,

                notes:
                    orderNotes
                        .trim()
                    || null,

                items,
            };

            const signature =
                buildSubmissionSignature(
                    payloadWithoutId,
                );

            const clientOrderId =
                getOrCreateSubmissionId(
                    token,
                    signature,
                );

            const payload:
                SubmitQrOrderPayload = {
                client_order_id:
                    clientOrderId,

                ...payloadWithoutId,
            };

            const order =
                await submitQrOrder(
                    token,
                    payload,
                );

            setActiveOrder(
                order,
            );

            setOrderingMore(
                false,
            );

            setCart(
                [],
            );

            setCartOpen(
                false,
            );

            /*
             * Store only the secure customer
             * status token.
             */
            window.localStorage
                .setItem(
                    activeOrderStorageKey(
                        token,
                    ),

                    order.statusToken,
                );

            window.localStorage
                .removeItem(
                    cartStorageKey(
                        token,
                    ),
                );

            window.sessionStorage
                .removeItem(
                    submissionStorageKey(
                        token,
                    ),
                );
        } catch (error) {
            setActionError(
                error
                    instanceof PublicApiError
                    ? error.message
                    : 'Your order could not be submitted. Please try again.',
            );
        } finally {
            setSubmitting(
                false,
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Loading Page
    |--------------------------------------------------------------------------
    */

    if (loading) {
        return (
            <main
                className={
                    styles.loadingPage
                }
            >
                <div
                    className={
                        styles.loadingCard
                    }
                >
                    <div
                        className={
                            styles.brandMark
                        }
                    >
                        R
                    </div>

                    <div
                        className={
                            styles.spinner
                        }
                    />

                    <h1>
                        Loading menu
                    </h1>

                    <p>
                        Validating your table and
                        preparing the menu.
                    </p>
                </div>
            </main>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Invalid QR / Error
    |--------------------------------------------------------------------------
    */

    if (
        pageError
        || !table
    ) {
        return (
            <main
                className={
                    styles.loadingPage
                }
            >
                <div
                    className={
                        styles.errorCard
                    }
                >
                    <div
                        className={
                            styles.errorIcon
                        }
                    >
                        !
                    </div>

                    <h1>
                        Unable to start ordering
                    </h1>

                    <p>
                        {
                            pageError
                            ?? 'This table QR code is not available.'
                        }
                    </p>

                    <button
                        type="button"
                        className={
                            styles.primaryButton
                        }
                        onClick={
                            () =>
                                window.location
                                    .reload()
                        }
                    >
                        Try Again
                    </button>
                </div>
            </main>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cumulative Order Confirmation / Status
    |--------------------------------------------------------------------------
    */

    if (
        activeOrder
        && !orderingMore
    ) {
        const message =
            statusMessage(
                activeOrder.status,
            );

        const canOrderMore =
            ![
                'COMPLETED',
                'CANCELLED',
                'REJECTED',
            ].includes(
                activeOrder.status,
            );

        return (
            <main
                className={
                    styles.successPage
                }
            >
                <section
                    className={
                        styles.successCard
                    }
                >
                    <div
                        className={
                            styles.successIcon
                        }
                    >
                        ✓
                    </div>

                    <span
                        className={
                            styles.successEyebrow
                        }
                    >
                        {
                            activeOrder
                                .table
                                .name
                        }
                    </span>

                    <h1>
                        {
                            message.title
                        }
                    </h1>

                    <p
                        className={
                            styles.successDescription
                        }
                    >
                        {
                            message
                                .description
                        }
                    </p>

                    {/*
                    |--------------------------------------------------------------------------
                    | Order Number
                    |--------------------------------------------------------------------------
                    */}

                    <div
                        className={
                            styles.orderNumberBox
                        }
                    >
                        <span>
                            Order Number
                        </span>

                        <strong>
                            {
                                activeOrder
                                    .orderNumber
                            }
                        </strong>
                    </div>

                    {/*
                    |--------------------------------------------------------------------------
                    | Status
                    |--------------------------------------------------------------------------
                    */}

                    <div
                        className={
                            styles.statusPill
                        }
                    >
                        <span
                            className={
                                styles.statusDot
                            }
                        />

                        {
                            activeOrder
                                .customerStatus
                                .replaceAll(
                                    '_',
                                    ' ',
                                )
                        }
                    </div>

                    {/*
                    |--------------------------------------------------------------------------
                    | COMPLETE CUMULATIVE ORDER
                    |--------------------------------------------------------------------------
                    |
                    | First order items
                    | +
                    | all additional items
                    |
                    */}

                    <div
                        className={
                            styles.orderSummaryItems
                        }
                    >
                        {
                            activeOrder
                                .items
                                .map(
                                    (item) => (
                                        <div
                                            key={
                                                item.id
                                            }
                                            className={
                                                styles.orderSummaryItem
                                            }
                                        >
                                            <div
                                                className={
                                                    styles.orderSummaryItemTop
                                                }
                                            >
                                                <div>
                                                    <strong>
                                                        {
                                                            item.quantity
                                                        }
                                                        {' × '}
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
                                                </div>

                                                <strong>
                                                    {
                                                        money(
                                                            item.lineTotal,
                                                        )
                                                    }
                                                </strong>
                                            </div>

                                            {/*
                                             * Add-ons
                                             */}

                                            {
                                                item
                                                    .addons
                                                    .length
                                                    > 0
                                                    ? (
                                                        <div
                                                            className={
                                                                styles.orderSummaryAddons
                                                            }
                                                        >
                                                            {
                                                                item.addons
                                                                    .map(
                                                                        (
                                                                            addon,
                                                                            index,
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    `${item.id}-${index}`
                                                                                }
                                                                            >
                                                                                + {
                                                                                    addon.name
                                                                                }

                                                                                {
                                                                                    addon.quantity
                                                                                        > 1
                                                                                        ? ` ×${addon.quantity}`
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

                                            {/*
                                             * Special Notes
                                             */}

                                            {
                                                item.specialNotes
                                                    ? (
                                                        <p
                                                            className={
                                                                styles.orderSummaryNotes
                                                            }
                                                        >
                                                            “
                                                            {
                                                                item.specialNotes
                                                            }
                                                            ”
                                                        </p>
                                                    )
                                                    : null
                                            }

                                            {/*
                                             * Per-item Status
                                             */}

                                            <div
                                                className={
                                                    styles.orderItemStatuses
                                                }
                                            >
                                                <span>
                                                    {
                                                        item.status
                                                    }
                                                </span>

                                                <span>
                                                    {
                                                        item
                                                            .kitchenStatus
                                                            .replaceAll(
                                                                '_',
                                                                ' ',
                                                            )
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    ),
                                )
                        }
                    </div>

                    {/*
                    |--------------------------------------------------------------------------
                    | Cumulative Total
                    |--------------------------------------------------------------------------
                    */}

                    <div
                        className={
                            styles.successTotal
                        }
                    >
                        <span>
                            Total Ordered
                        </span>

                        <strong>
                            {
                                money(
                                    activeOrder
                                        .grandTotal,
                                )
                            }
                        </strong>
                    </div>

                    <p
                        className={
                            styles.autoUpdateText
                        }
                    >
                        This page updates
                        automatically when your
                        order status changes.
                    </p>

                    {/*
                    |--------------------------------------------------------------------------
                    | ORDER MORE
                    |--------------------------------------------------------------------------
                    */}

                    {
                        canOrderMore
                            ? (
                                <button
                                    type="button"
                                    className={
                                        styles.primaryButton
                                    }
                                    onClick={
                                        () => {
                                            setOrderingMore(
                                                true,
                                            );

                                            setActionError(
                                                null,
                                            );

                                            setSearch(
                                                '',
                                            );

                                            setActiveCategory(
                                                'all',
                                            );
                                        }
                                    }
                                >
                                    Order More
                                </button>
                            )
                            : null
                    }
                </section>
            </main>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Menu / Additional-order Mode
    |--------------------------------------------------------------------------
    */

    return (
        <main
            className={
                styles.page
            }
        >
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

            <header
                className={
                    styles.header
                }
            >
                <div
                    className={
                        styles.headerInner
                    }
                >
                    <div
                        className={
                            styles.brand
                        }
                    >
                        <div
                            className={
                                styles.brandMark
                            }
                        >
                            R
                        </div>

                        <div>
                            <strong>
                                Restaurant Menu
                            </strong>

                            <span>
                                Order from your table
                            </span>
                        </div>
                    </div>

                    <div
                        className={
                            styles.tableBadge
                        }
                    >
                        <span>
                            TABLE
                        </span>

                        <strong>
                            {
                                table.name
                            }
                        </strong>
                    </div>
                </div>
            </header>

            {/*
            |--------------------------------------------------------------------------
            | Order More Banner
            |--------------------------------------------------------------------------
            */}

            {
                activeOrder
                    && orderingMore
                    ? (
                        <div
                            className={
                                styles.orderMoreBanner
                            }
                        >
                            <div>
                                <span>
                                    Adding items to
                                </span>

                                <strong>
                                    {
                                        activeOrder
                                            .orderNumber
                                    }
                                </strong>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    viewMyOrder
                                }
                            >
                                View My Order
                            </button>
                        </div>
                    )
                    : null
            }

            {/*
            |--------------------------------------------------------------------------
            | Hero
            |--------------------------------------------------------------------------
            */}

            <section
                className={
                    styles.hero
                }
            >
                <div
                    className={
                        styles.heroContent
                    }
                >
                    <span
                        className={
                            styles.eyebrow
                        }
                    >
                        {
                            activeOrder
                                ? 'ORDER MORE'
                                : 'DINE-IN ORDERING'
                        }
                    </span>

                    <h1>
                        {
                            activeOrder
                                ? 'Anything else?'
                                : 'What would you like today?'
                        }
                    </h1>

                    <p>
                        {
                            activeOrder
                                ? 'Choose any additional items. They will be added to your existing order.'
                                : 'Choose your items, customize them and send your order directly to the cashier.'
                        }
                    </p>
                </div>
            </section>

            {/*
            |--------------------------------------------------------------------------
            | Search / Categories
            |--------------------------------------------------------------------------
            */}

            <section
                className={
                    styles.toolbar
                }
            >
                <div
                    className={
                        styles.searchBox
                    }
                >
                    <span
                        aria-hidden="true"
                    >
                        ⌕
                    </span>

                    <input
                        type="search"
                        value={
                            search
                        }
                        onChange={
                            (event) =>
                                setSearch(
                                    event
                                        .target
                                        .value,
                                )
                        }
                        placeholder="Search the menu..."
                        aria-label="Search menu"
                    />
                </div>

                <div
                    className={
                        styles.categoryScroller
                    }
                >
                    <button
                        type="button"
                        className={
                            activeCategory
                                === 'all'
                                ? styles.categoryActive
                                : styles.categoryButton
                        }
                        onClick={
                            () =>
                                setActiveCategory(
                                    'all',
                                )
                        }
                    >
                        All
                    </button>

                    {
                        categories.map(
                            (category) => (
                                <button
                                    type="button"
                                    key={
                                        category.id
                                    }
                                    className={
                                        activeCategory
                                            === category.id
                                            ? styles.categoryActive
                                            : styles.categoryButton
                                    }
                                    onClick={
                                        () =>
                                            setActiveCategory(
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
            </section>

            {/*
            |--------------------------------------------------------------------------
            | Action Error
            |--------------------------------------------------------------------------
            */}

            {
                actionError
                    ? (
                        <div
                            className={
                                styles.alert
                            }
                        >
                            <span>
                                !
                            </span>

                            <p>
                                {
                                    actionError
                                }
                            </p>

                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setActionError(
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
            | Menu
            |--------------------------------------------------------------------------
            */}

            <section
                className={
                    styles.menuContent
                }
            >
                {
                    filteredCategories
                        .length
                        === 0
                        ? (
                            <div
                                className={
                                    styles.emptyMenu
                                }
                            >
                                <div>
                                    ⌕
                                </div>

                                <h2>
                                    No menu items found
                                </h2>

                                <p>
                                    Try another search or
                                    category.
                                </p>
                            </div>
                        )
                        : (
                            filteredCategories
                                .map(
                                    (category) => (
                                        <section
                                            key={
                                                category.id
                                            }
                                            className={
                                                styles.menuSection
                                            }
                                        >
                                            <div
                                                className={
                                                    styles.sectionHeading
                                                }
                                            >
                                                <div>
                                                    <h2>
                                                        {
                                                            category.name
                                                        }
                                                    </h2>

                                                    {
                                                        category
                                                            .description
                                                            ? (
                                                                <p>
                                                                    {
                                                                        category
                                                                            .description
                                                                    }
                                                                </p>
                                                            )
                                                            : null
                                                    }
                                                </div>

                                                <span>
                                                    {
                                                        category
                                                            .items
                                                            .length
                                                    } items
                                                </span>
                                            </div>

                                            <div
                                                className={
                                                    styles.menuGrid
                                                }
                                            >
                                                {
                                                    category
                                                        .items
                                                        .map(
                                                            (item) => (
                                                                <article
                                                                    key={
                                                                        item.id
                                                                    }
                                                                    className={
                                                                        styles.menuCard
                                                                    }
                                                                >
                                                                    <div
                                                                        className={
                                                                            styles.menuImage
                                                                        }
                                                                    >
                                                                        {
                                                                            item.imageUrl
                                                                                ? (
                                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                                    <img
                                                                                        src={
                                                                                            item.imageUrl
                                                                                        }
                                                                                        alt={
                                                                                            item.name
                                                                                        }
                                                                                    />
                                                                                )
                                                                                : (
                                                                                    <div
                                                                                        className={
                                                                                            styles.imagePlaceholder
                                                                                        }
                                                                                    >
                                                                                        🍽
                                                                                    </div>
                                                                                )
                                                                        }
                                                                    </div>

                                                                    <div
                                                                        className={
                                                                            styles.menuCardBody
                                                                        }
                                                                    >
                                                                        <div>
                                                                            <h3>
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </h3>

                                                                            {
                                                                                item.description
                                                                                    ? (
                                                                                        <p>
                                                                                            {
                                                                                                item.description
                                                                                            }
                                                                                        </p>
                                                                                    )
                                                                                    : null
                                                                            }
                                                                        </div>

                                                                        <div
                                                                            className={
                                                                                styles.menuCardFooter
                                                                            }
                                                                        >
                                                                            <div
                                                                                className={
                                                                                    styles.price
                                                                                }
                                                                            >
                                                                                {
                                                                                    item.hasVariants
                                                                                        && item.variants.length
                                                                                        > 0
                                                                                        ? (
                                                                                            <>
                                                                                                <small>
                                                                                                    From
                                                                                                </small>

                                                                                                <strong>
                                                                                                    {
                                                                                                        money(
                                                                                                            Math.min(
                                                                                                                ...item
                                                                                                                    .variants
                                                                                                                    .map(
                                                                                                                        (variant) =>
                                                                                                                            variant.price,
                                                                                                                    ),
                                                                                                            ),
                                                                                                        )
                                                                                                    }
                                                                                                </strong>
                                                                                            </>
                                                                                        )
                                                                                        : (
                                                                                            <strong>
                                                                                                {
                                                                                                    money(
                                                                                                        item.price,
                                                                                                    )
                                                                                                }
                                                                                            </strong>
                                                                                        )
                                                                                }
                                                                            </div>

                                                                            <button
                                                                                type="button"
                                                                                className={
                                                                                    styles.addButton
                                                                                }
                                                                                onClick={
                                                                                    () =>
                                                                                        openConfigurator(
                                                                                            item,
                                                                                        )
                                                                                }
                                                                            >
                                                                                Add
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </article>
                                                            ),
                                                        )
                                                }
                                            </div>
                                        </section>
                                    ),
                                )
                        )
                }
            </section>

            {/*
            |--------------------------------------------------------------------------
            | Floating Cart
            |--------------------------------------------------------------------------
            */}

            {
                cart.length
                    > 0
                    ? (
                        <div
                            className={
                                styles.cartBar
                            }
                        >
                            <button
                                type="button"
                                className={
                                    styles.cartBarButton
                                }
                                onClick={
                                    () =>
                                        setCartOpen(
                                            true,
                                        )
                                }
                            >
                                <span
                                    className={
                                        styles.cartCount
                                    }
                                >
                                    {
                                        cartItemCount
                                    }
                                </span>

                                <span>
                                    {
                                        activeOrder
                                            ? 'View Additional Items'
                                            : 'View Cart'
                                    }
                                </span>

                                <strong>
                                    {
                                        money(
                                            cartTotal,
                                        )
                                    }
                                </strong>
                            </button>
                        </div>
                    )
                    : null
            }

            {/*
            |--------------------------------------------------------------------------
            | Item Configurator Modal
            |--------------------------------------------------------------------------
            */}

            {
                selectedItem
                    ? (
                        <div
                            className={
                                styles.modalBackdrop
                            }
                            role="presentation"
                            onMouseDown={
                                (event) => {
                                    if (
                                        event.target
                                        === event.currentTarget
                                    ) {
                                        closeConfigurator();
                                    }
                                }
                            }
                        >
                            <section
                                className={
                                    styles.configurator
                                }
                                role="dialog"
                                aria-modal="true"
                                aria-label={
                                    `Customize ${selectedItem.name}`
                                }
                            >
                                <div
                                    className={
                                        styles.modalHandle
                                    }
                                />

                                <div
                                    className={
                                        styles.modalHeader
                                    }
                                >
                                    <div>
                                        <span>
                                            CUSTOMIZE ITEM
                                        </span>

                                        <h2>
                                            {
                                                selectedItem.name
                                            }
                                        </h2>
                                    </div>

                                    <button
                                        type="button"
                                        className={
                                            styles.closeButton
                                        }
                                        onClick={
                                            closeConfigurator
                                        }
                                        aria-label="Close"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div
                                    className={
                                        styles.modalBody
                                    }
                                >
                                    {
                                        selectedItem.description
                                            ? (
                                                <p
                                                    className={
                                                        styles.itemDescription
                                                    }
                                                >
                                                    {
                                                        selectedItem.description
                                                    }
                                                </p>
                                            )
                                            : null
                                    }

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Variants
                                    |--------------------------------------------------------------------------
                                    */}

                                    {
                                        selectedItem.hasVariants
                                            ? (
                                                <div
                                                    className={
                                                        styles.optionSection
                                                    }
                                                >
                                                    <div
                                                        className={
                                                            styles.optionTitle
                                                        }
                                                    >
                                                        <h3>
                                                            Choose a size
                                                        </h3>

                                                        <span>
                                                            Required
                                                        </span>
                                                    </div>

                                                    <div
                                                        className={
                                                            styles.variantList
                                                        }
                                                    >
                                                        {
                                                            selectedItem
                                                                .variants
                                                                .map(
                                                                    (variant) => (
                                                                        <label
                                                                            key={
                                                                                variant.id
                                                                            }
                                                                            className={
                                                                                selectedVariantId
                                                                                    === variant.id
                                                                                    ? styles.variantSelected
                                                                                    : styles.variantOption
                                                                            }
                                                                        >
                                                                            <input
                                                                                type="radio"
                                                                                name="variant"
                                                                                checked={
                                                                                    selectedVariantId
                                                                                    === variant.id
                                                                                }
                                                                                onChange={
                                                                                    () =>
                                                                                        setSelectedVariantId(
                                                                                            variant.id,
                                                                                        )
                                                                                }
                                                                            />

                                                                            <span>
                                                                                {
                                                                                    variant.name
                                                                                }
                                                                            </span>

                                                                            <strong>
                                                                                {
                                                                                    money(
                                                                                        variant.price,
                                                                                    )
                                                                                }
                                                                            </strong>
                                                                        </label>
                                                                    ),
                                                                )
                                                        }
                                                    </div>
                                                </div>
                                            )
                                            : null
                                    }

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Add-ons
                                    |--------------------------------------------------------------------------
                                    */}

                                    {
                                        selectedItem
                                            .addons
                                            .length
                                            > 0
                                            ? (
                                                <div
                                                    className={
                                                        styles.optionSection
                                                    }
                                                >
                                                    <div
                                                        className={
                                                            styles.optionTitle
                                                        }
                                                    >
                                                        <h3>
                                                            Add-ons
                                                        </h3>

                                                        <span>
                                                            Optional
                                                        </span>
                                                    </div>

                                                    <div
                                                        className={
                                                            styles.addonList
                                                        }
                                                    >
                                                        {
                                                            selectedItem
                                                                .addons
                                                                .map(
                                                                    (addon) => {
                                                                        const quantity =
                                                                            selectedAddons[
                                                                            addon.id
                                                                            ]
                                                                            ?? 0;

                                                                        return (
                                                                            <div
                                                                                key={
                                                                                    addon.id
                                                                                }
                                                                                className={
                                                                                    quantity
                                                                                        > 0
                                                                                        ? styles.addonSelected
                                                                                        : styles.addonOption
                                                                                }
                                                                            >
                                                                                <button
                                                                                    type="button"
                                                                                    className={
                                                                                        styles.addonMain
                                                                                    }
                                                                                    onClick={
                                                                                        () =>
                                                                                            toggleAddon(
                                                                                                addon,
                                                                                            )
                                                                                    }
                                                                                >
                                                                                    <span
                                                                                        className={
                                                                                            styles.checkbox
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            quantity
                                                                                                > 0
                                                                                                ? '✓'
                                                                                                : ''
                                                                                        }
                                                                                    </span>

                                                                                    <span
                                                                                        className={
                                                                                            styles.addonName
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            addon.name
                                                                                        }

                                                                                        <small>
                                                                                            +
                                                                                            {
                                                                                                money(
                                                                                                    addon.price,
                                                                                                )
                                                                                            }
                                                                                        </small>
                                                                                    </span>
                                                                                </button>

                                                                                {
                                                                                    quantity
                                                                                        > 0
                                                                                        ? (
                                                                                            <div
                                                                                                className={
                                                                                                    styles.smallStepper
                                                                                                }
                                                                                            >
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={
                                                                                                        () =>
                                                                                                            changeAddonQuantity(
                                                                                                                addon.id,
                                                                                                                -1,
                                                                                                            )
                                                                                                    }
                                                                                                >
                                                                                                    −
                                                                                                </button>

                                                                                                <span>
                                                                                                    {
                                                                                                        quantity
                                                                                                    }
                                                                                                </span>

                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={
                                                                                                        () =>
                                                                                                            changeAddonQuantity(
                                                                                                                addon.id,
                                                                                                                1,
                                                                                                            )
                                                                                                    }
                                                                                                >
                                                                                                    +
                                                                                                </button>
                                                                                            </div>
                                                                                        )
                                                                                        : null
                                                                                }
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

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Special Notes
                                    |--------------------------------------------------------------------------
                                    */}

                                    <div
                                        className={
                                            styles.optionSection
                                        }
                                    >
                                        <div
                                            className={
                                                styles.optionTitle
                                            }
                                        >
                                            <h3>
                                                Special instructions
                                            </h3>

                                            <span>
                                                Optional
                                            </span>
                                        </div>

                                        <textarea
                                            className={
                                                styles.notesInput
                                            }
                                            value={
                                                specialNotes
                                            }
                                            onChange={
                                                (event) =>
                                                    setSpecialNotes(
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                            }
                                            maxLength={
                                                1000
                                            }
                                            placeholder="Example: Less spicy, no onion..."
                                        />
                                    </div>
                                </div>

                                {/*
                                |--------------------------------------------------------------------------
                                | Configurator Footer
                                |--------------------------------------------------------------------------
                                */}

                                <div
                                    className={
                                        styles.configuratorFooter
                                    }
                                >
                                    <div
                                        className={
                                            styles.stepper
                                        }
                                    >
                                        <button
                                            type="button"
                                            onClick={
                                                () =>
                                                    setItemQuantity(
                                                        (value) =>
                                                            Math.max(
                                                                1,
                                                                value
                                                                - 1,
                                                            ),
                                                    )
                                            }
                                        >
                                            −
                                        </button>

                                        <strong>
                                            {
                                                itemQuantity
                                            }
                                        </strong>

                                        <button
                                            type="button"
                                            onClick={
                                                () =>
                                                    setItemQuantity(
                                                        (value) =>
                                                            Math.min(
                                                                20,
                                                                value
                                                                + 1,
                                                            ),
                                                    )
                                            }
                                        >
                                            +
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        className={
                                            styles.addToCartButton
                                        }
                                        onClick={
                                            addConfiguredItem
                                        }
                                    >
                                        <span>
                                            Add to Cart
                                        </span>

                                        <strong>
                                            {
                                                money(
                                                    configuratorTotal,
                                                )
                                            }
                                        </strong>
                                    </button>
                                </div>
                            </section>
                        </div>
                    )
                    : null
            }

            {/*
            |--------------------------------------------------------------------------
            | Cart / Additional Items Modal
            |--------------------------------------------------------------------------
            */}

            {
                cartOpen
                    ? (
                        <div
                            className={
                                styles.modalBackdrop
                            }
                        >
                            <section
                                className={
                                    styles.cartSheet
                                }
                                role="dialog"
                                aria-modal="true"
                                aria-label={
                                    activeOrder
                                        ? 'Additional items'
                                        : 'Your cart'
                                }
                            >
                                <div
                                    className={
                                        styles.modalHandle
                                    }
                                />

                                <div
                                    className={
                                        styles.modalHeader
                                    }
                                >
                                    <div>
                                        <span>
                                            {
                                                activeOrder
                                                    ? activeOrder
                                                        .orderNumber
                                                    : table.name
                                            }
                                        </span>

                                        <h2>
                                            {
                                                activeOrder
                                                    ? 'Additional Items'
                                                    : 'Your Cart'
                                            }
                                        </h2>
                                    </div>

                                    <button
                                        type="button"
                                        className={
                                            styles.closeButton
                                        }
                                        onClick={
                                            () =>
                                                setCartOpen(
                                                    false,
                                                )
                                        }
                                        aria-label="Close cart"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div
                                    className={
                                        styles.cartBody
                                    }
                                >
                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Cart Items
                                    |--------------------------------------------------------------------------
                                    */}

                                    {
                                        cart.map(
                                            (line) => (
                                                <article
                                                    key={
                                                        line.lineId
                                                    }
                                                    className={
                                                        styles.cartItem
                                                    }
                                                >
                                                    <div
                                                        className={
                                                            styles.cartItemTop
                                                        }
                                                    >
                                                        <div>
                                                            <h3>
                                                                {
                                                                    line.itemName
                                                                }
                                                            </h3>

                                                            {
                                                                line.variantName
                                                                    ? (
                                                                        <span
                                                                            className={
                                                                                styles.variantLabel
                                                                            }
                                                                        >
                                                                            {
                                                                                line.variantName
                                                                            }
                                                                        </span>
                                                                    )
                                                                    : null
                                                            }
                                                        </div>

                                                        <strong>
                                                            {
                                                                money(
                                                                    line
                                                                        .displayLineTotal,
                                                                )
                                                            }
                                                        </strong>
                                                    </div>

                                                    {/*
                                                     * Add-ons
                                                     */}

                                                    {
                                                        line.addons
                                                            .length
                                                            > 0
                                                            ? (
                                                                <div
                                                                    className={
                                                                        styles.cartAddons
                                                                    }
                                                                >
                                                                    {
                                                                        line.addons
                                                                            .map(
                                                                                (addon) => (
                                                                                    <span
                                                                                        key={
                                                                                            addon.addonId
                                                                                        }
                                                                                    >
                                                                                        + {
                                                                                            addon.name
                                                                                        }

                                                                                        {
                                                                                            addon.quantity
                                                                                                > 1
                                                                                                ? ` ×${addon.quantity}`
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

                                                    {/*
                                                     * Special Notes
                                                     */}

                                                    {
                                                        line.specialNotes
                                                            ? (
                                                                <p
                                                                    className={
                                                                        styles.cartNotes
                                                                    }
                                                                >
                                                                    “
                                                                    {
                                                                        line.specialNotes
                                                                    }
                                                                    ”
                                                                </p>
                                                            )
                                                            : null
                                                    }

                                                    {/*
                                                     * Quantity / Remove
                                                     */}

                                                    <div
                                                        className={
                                                            styles.cartItemActions
                                                        }
                                                    >
                                                        <div
                                                            className={
                                                                styles.smallStepper
                                                            }
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    () =>
                                                                        updateCartQuantity(
                                                                            line.lineId,
                                                                            line.quantity
                                                                            - 1,
                                                                        )
                                                                }
                                                            >
                                                                −
                                                            </button>

                                                            <span>
                                                                {
                                                                    line.quantity
                                                                }
                                                            </span>

                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    () =>
                                                                        updateCartQuantity(
                                                                            line.lineId,
                                                                            line.quantity
                                                                            + 1,
                                                                        )
                                                                }
                                                            >
                                                                +
                                                            </button>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            className={
                                                                styles.removeButton
                                                            }
                                                            onClick={
                                                                () =>
                                                                    removeCartLine(
                                                                        line.lineId,
                                                                    )
                                                            }
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </article>
                                            ),
                                        )
                                    }

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Customer Details
                                    |--------------------------------------------------------------------------
                                    |
                                    | Only first submission can set them.
                                    |
                                    */}

                                    {
                                        !activeOrder
                                            ? (
                                                <div
                                                    className={
                                                        styles.customerSection
                                                    }
                                                >
                                                    <div
                                                        className={
                                                            styles.optionTitle
                                                        }
                                                    >
                                                        <h3>
                                                            Contact details
                                                        </h3>

                                                        <span>
                                                            Optional
                                                        </span>
                                                    </div>

                                                    <div
                                                        className={
                                                            styles.formGrid
                                                        }
                                                    >
                                                        <label>
                                                            <span>
                                                                Name
                                                            </span>

                                                            <input
                                                                value={
                                                                    customerName
                                                                }
                                                                onChange={
                                                                    (event) =>
                                                                        setCustomerName(
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                }
                                                                maxLength={
                                                                    150
                                                                }
                                                                placeholder="Your name"
                                                            />
                                                        </label>

                                                        <label>
                                                            <span>
                                                                Phone
                                                            </span>

                                                            <input
                                                                type="tel"
                                                                value={
                                                                    customerPhone
                                                                }
                                                                onChange={
                                                                    (event) =>
                                                                        setCustomerPhone(
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                }
                                                                maxLength={
                                                                    50
                                                                }
                                                                placeholder="Phone number"
                                                            />
                                                        </label>
                                                    </div>

                                                    <label
                                                        className={
                                                            styles.orderNotes
                                                        }
                                                    >
                                                        <span>
                                                            Note for this order
                                                        </span>

                                                        <textarea
                                                            value={
                                                                orderNotes
                                                            }
                                                            onChange={
                                                                (event) =>
                                                                    setOrderNotes(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                            }
                                                            maxLength={
                                                                2000
                                                            }
                                                            placeholder="Example: Please bring two extra plates..."
                                                        />
                                                    </label>
                                                </div>
                                            )
                                            : null
                                    }

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Checkout Error
                                    |--------------------------------------------------------------------------
                                    */}

                                    {
                                        actionError
                                            ? (
                                                <div
                                                    className={
                                                        styles.checkoutError
                                                    }
                                                >
                                                    {
                                                        actionError
                                                    }
                                                </div>
                                            )
                                            : null
                                    }
                                </div>

                                {/*
                                |--------------------------------------------------------------------------
                                | Checkout Footer
                                |--------------------------------------------------------------------------
                                */}

                                <footer
                                    className={
                                        styles.checkoutFooter
                                    }
                                >
                                    {
                                        activeOrder
                                            ? (
                                                <>
                                                    <div
                                                        className={
                                                            styles.totalRow
                                                        }
                                                    >
                                                        <span>
                                                            Current Order
                                                        </span>

                                                        <strong>
                                                            {
                                                                money(
                                                                    activeOrder
                                                                        .grandTotal,
                                                                )
                                                            }
                                                        </strong>
                                                    </div>

                                                    <div
                                                        className={
                                                            styles.totalRow
                                                        }
                                                    >
                                                        <span>
                                                            Additional Items
                                                        </span>

                                                        <strong>
                                                            {
                                                                money(
                                                                    cartTotal,
                                                                )
                                                            }
                                                        </strong>
                                                    </div>

                                                    <div
                                                        className={
                                                            styles.totalRow
                                                        }
                                                    >
                                                        <span>
                                                            Estimated Updated Total
                                                        </span>

                                                        <strong>
                                                            {
                                                                money(
                                                                    predictedCombinedTotal,
                                                                )
                                                            }
                                                        </strong>
                                                    </div>
                                                </>
                                            )
                                            : (
                                                <div
                                                    className={
                                                        styles.totalRow
                                                    }
                                                >
                                                    <span>
                                                        Estimated Total
                                                    </span>

                                                    <strong>
                                                        {
                                                            money(
                                                                cartTotal,
                                                            )
                                                        }
                                                    </strong>
                                                </div>
                                            )
                                    }

                                    <p
                                        className={
                                            styles.serverPriceNote
                                        }
                                    >
                                        Final prices are verified by the
                                        restaurant when the order is
                                        submitted.
                                    </p>

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Cancel ADDITIONAL items only
                                    |--------------------------------------------------------------------------
                                    */}

                                    {
                                        activeOrder
                                            ? (
                                                <button
                                                    type="button"
                                                    className={
                                                        styles.secondaryButton
                                                    }
                                                    disabled={
                                                        submitting
                                                    }
                                                    onClick={
                                                        cancelAdditionalItems
                                                    }
                                                >
                                                    Cancel Additional Items
                                                </button>
                                            )
                                            : null
                                    }

                                    {/*
                                    |--------------------------------------------------------------------------
                                    | Submit
                                    |--------------------------------------------------------------------------
                                    */}

                                    <button
                                        type="button"
                                        className={
                                            styles.placeOrderButton
                                        }
                                        disabled={
                                            submitting
                                            || cart.length
                                            === 0
                                        }
                                        onClick={
                                            () => {
                                                void placeOrder();
                                            }
                                        }
                                    >
                                        {
                                            submitting
                                                ? (
                                                    <>
                                                        <span
                                                            className={
                                                                styles.buttonSpinner
                                                            }
                                                        />

                                                        {
                                                            activeOrder
                                                                ? 'Adding Items...'
                                                                : 'Sending Order...'
                                                        }
                                                    </>
                                                )
                                                : (
                                                    <>
                                                        {
                                                            activeOrder
                                                                ? 'Submit Additional Items'
                                                                : 'Place Order'
                                                        }

                                                        <strong>
                                                            {
                                                                money(
                                                                    cartTotal,
                                                                )
                                                            }
                                                        </strong>
                                                    </>
                                                )
                                        }
                                    </button>
                                </footer>
                            </section>
                        </div>
                    )
                    : null
            }
        </main>
    );
}