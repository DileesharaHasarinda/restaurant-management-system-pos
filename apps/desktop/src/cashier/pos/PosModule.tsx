import {
    useMemo,
    useState,
} from 'react';

import {
    api,
} from '../../api';

import type {
    CartLine,
    MenuCategory,
    MenuItem,
} from '../../types';

import CartPanel
    from './CartPanel';

import ProductDialog
    from './ProductDialog';

import {
    posMoney,
} from './helpers';

import type {
    ProductSelection,
} from './types';

import './PosModule.css';

/*
|--------------------------------------------------------------------------
| Props
|--------------------------------------------------------------------------
*/

interface PosModuleProps {
    categories:
    MenuCategory[];

    items:
    MenuItem[];

    cart:
    CartLine[];

    cartTotal:
    number;

    onAddSelection:
    (
        selection:
            ProductSelection,
    ) => void;

    onChangeQuantity:
    (
        id: string,
        difference: number,
    ) => void;

    onRemove:
    (
        id: string,
    ) => void;

    onTakeaway:
    () => void;
}

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function PosModule(
    {
        categories,
        items,
        cart,
        cartTotal,
        onAddSelection,
        onChangeQuantity,
        onRemove,
        onTakeaway,
    }: PosModuleProps,
) {
    const [
        selectedCategory,
        setSelectedCategory,
    ] =
        useState<number | null>(
            null,
        );

    const [
        search,
        setSearch,
    ] =
        useState(
            '',
        );

    const [
        selectedProduct,
        setSelectedProduct,
    ] =
        useState<MenuItem | null>(
            null,
        );

    const [
        loadingProduct,
        setLoadingProduct,
    ] =
        useState(
            false,
        );

    const [
        productError,
        setProductError,
    ] =
        useState(
            '',
        );

    /*
    |--------------------------------------------------------------------------
    | Filter Menu
    |--------------------------------------------------------------------------
    */

    const filteredItems =
        useMemo(
            () => {
                const query =
                    search
                        .trim()
                        .toLowerCase();

                return items
                    .filter(
                        (
                            item,
                        ) =>
                            selectedCategory
                            ===
                            null
                            ||
                            item.category_id
                            ===
                            selectedCategory,
                    )
                    .filter(
                        (
                            item,
                        ) => {
                            if (
                                query
                                ===
                                ''
                            ) {
                                return true;
                            }

                            return [
                                item.name,
                                item.sku
                                ??
                                '',
                                item.description
                                ??
                                '',
                            ]
                                .join(
                                    ' ',
                                )
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
                            Number(
                                left.sort_order
                                ??
                                0,
                            )
                            -
                            Number(
                                right.sort_order
                                ??
                                0,
                            ),
                    );
            },
            [
                items,
                search,
                selectedCategory,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Open Product
    |--------------------------------------------------------------------------
    */

    const openProduct =
        async (
            item:
                MenuItem,
        ): Promise<void> => {
            if (
                loadingProduct
            ) {
                return;
            }

            setLoadingProduct(
                true,
            );

            setProductError(
                '',
            );

            try {
                const response =
                    await api.get<MenuItem>(
                        `/menu/items/${item.id}`,
                    );

                setSelectedProduct(
                    response.data
                    ??
                    item,
                );
            } catch {
                /*
                 * The list response already has enough data for
                 * standard cart selection, so do not block cashier
                 * operation when the detail endpoint is unavailable.
                 */
                setSelectedProduct(
                    item,
                );

                setProductError(
                    'Product details could not be refreshed. Using the current menu information.',
                );
            } finally {
                setLoadingProduct(
                    false,
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Add Selection
    |--------------------------------------------------------------------------
    */

    const addSelection =
        (
            selection:
                ProductSelection,
        ): void => {
            onAddSelection(
                selection,
            );

            setSelectedProduct(
                null,
            );

            setProductError(
                '',
            );
        };

    return (
        <div className="cashier-pos-feature">
            <div className="pos-feature-layout">
                <section className="pos-feature-menu">
                    <header className="pos-feature-header">
                        <div>
                            <span className="pos-feature-kicker">
                                CASHIER POS
                            </span>

                            <h1>
                                Menu
                            </h1>

                            <p>
                                Select menu items, variants and
                                add-ons to build the customer order.
                            </p>
                        </div>

                        <div className="pos-feature-menu-total">
                            <strong>
                                {
                                    items.length
                                }
                            </strong>

                            <span>
                                Menu Items
                            </span>
                        </div>
                    </header>

                    {
                        productError
                            ? (
                                <div className="pos-feature-product-warning">
                                    {
                                        productError
                                    }
                                </div>
                            )
                            : null
                    }

                    <section className="pos-feature-toolbar">
                        <div className="pos-feature-search">
                            <span>
                                ⌕
                            </span>

                            <input
                                type="search"
                                value={
                                    search
                                }
                                placeholder="Search item name, SKU or description..."
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

                        <div className="pos-feature-categories">
                            <button
                                type="button"
                                className={
                                    selectedCategory
                                        ===
                                        null
                                        ? 'active'
                                        : ''
                                }
                                onClick={
                                    () =>
                                        setSelectedCategory(
                                            null,
                                        )
                                }
                            >
                                All

                                <span>
                                    {
                                        items.length
                                    }
                                </span>
                            </button>

                            {
                                categories.map(
                                    (
                                        category,
                                    ) => {
                                        const count =
                                            items.filter(
                                                (
                                                    item,
                                                ) =>
                                                    item.category_id
                                                    ===
                                                    category.id,
                                            ).length;

                                        return (
                                            <button
                                                key={
                                                    category.id
                                                }
                                                type="button"
                                                className={
                                                    selectedCategory
                                                        ===
                                                        category.id
                                                        ? 'active'
                                                        : ''
                                                }
                                                onClick={
                                                    () =>
                                                        setSelectedCategory(
                                                            category.id,
                                                        )
                                                }
                                            >
                                                {
                                                    category.name
                                                }

                                                <span>
                                                    {
                                                        count
                                                    }
                                                </span>
                                            </button>
                                        );
                                    },
                                )
                            }
                        </div>
                    </section>

                    {
                        loadingProduct
                            ? (
                                <div className="pos-feature-loading-product">
                                    Loading product options...
                                </div>
                            )
                            : null
                    }

                    {
                        filteredItems.length
                            ===
                            0
                            ? (
                                <div className="pos-feature-empty-menu">
                                    <div>
                                        MN
                                    </div>

                                    <strong>
                                        No Menu Items
                                    </strong>

                                    <span>
                                        No available products match
                                        the current search and category.
                                    </span>
                                </div>
                            )
                            : (
                                <div className="pos-feature-product-grid">
                                    {
                                        filteredItems.map(
                                            (
                                                item,
                                            ) => (
                                                <button
                                                    key={
                                                        item.id
                                                    }
                                                    type="button"
                                                    className="pos-feature-product-card"
                                                    disabled={
                                                        loadingProduct
                                                    }
                                                    onClick={
                                                        () => {
                                                            void openProduct(
                                                                item,
                                                            );
                                                        }
                                                    }
                                                >
                                                    <div className="pos-feature-product-image">
                                                        {
                                                            item.photo_url
                                                                ? (
                                                                    <img
                                                                        src={
                                                                            item.photo_url
                                                                        }
                                                                        alt={
                                                                            item.name
                                                                        }
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

                                                    <div className="pos-feature-product-info">
                                                        <strong>
                                                            {
                                                                item.name
                                                            }
                                                        </strong>

                                                        {
                                                            item.sku
                                                                ? (
                                                                    <small>
                                                                        SKU:
                                                                        {' '}
                                                                        {
                                                                            item.sku
                                                                        }
                                                                    </small>
                                                                )
                                                                : (
                                                                    <small>
                                                                        {
                                                                            item.has_variants
                                                                                ? 'Options available'
                                                                                : 'Tap to add'
                                                                        }
                                                                    </small>
                                                                )
                                                        }

                                                        <div>
                                                            <b>
                                                                {
                                                                    posMoney(
                                                                        item.price,
                                                                    )
                                                                }
                                                            </b>

                                                            {
                                                                item.has_variants
                                                                    ? (
                                                                        <span>
                                                                            VARIANTS
                                                                        </span>
                                                                    )
                                                                    : null
                                                            }
                                                        </div>
                                                    </div>
                                                </button>
                                            ),
                                        )
                                    }
                                </div>
                            )
                    }
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
                    onTakeaway={
                        onTakeaway
                    }
                />
            </div>

            {
                selectedProduct
                    ? (
                        <ProductDialog
                            item={
                                selectedProduct
                            }
                            onClose={
                                () => {
                                    setSelectedProduct(
                                        null,
                                    );

                                    setProductError(
                                        '',
                                    );
                                }
                            }
                            onAdd={
                                addSelection
                            }
                        />
                    )
                    : null
            }
        </div>
    );
}