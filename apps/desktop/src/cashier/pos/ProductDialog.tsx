import {
    useState,
} from 'react';

import type {
    MenuAddon,
    MenuItem,
    MenuVariant,
    SelectedAddon,
} from '../../types';

import {
    posMoney,
} from './helpers';

import type {
    ProductSelection,
} from './types';

interface ProductDialogProps {
    item:
    MenuItem;

    onClose:
    () => void;

    onAdd:
    (
        selection:
            ProductSelection,
    ) => void;
}

export default function ProductDialog(
    {
        item,
        onClose,
        onAdd,
    }: ProductDialogProps,
) {
    const variants =
        item.variants
        ??
        [];

    const addons =
        item.addons
        ??
        [];

    const [
        variant,
        setVariant,
    ] =
        useState<MenuVariant | null>(
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
        useState<Record<number, number>>(
            () => {
                const defaults:
                    Record<number, number> =
                    {};

                addons.forEach(
                    (
                        addon,
                    ) => {
                        if (
                            addon.is_default
                        ) {
                            defaults[
                                addon.id
                            ] =
                                1;
                        }
                    },
                );

                return defaults;
            },
        );

    const [
        quantity,
        setQuantity,
    ] =
        useState(
            1,
        );

    const [
        notes,
        setNotes,
    ] =
        useState(
            '',
        );

    /*
    |--------------------------------------------------------------------------
    | Add-on Quantity
    |--------------------------------------------------------------------------
    */

    const changeAddon =
        (
            addon:
                MenuAddon,

            difference:
                number,
        ): void => {
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
                                ??
                                0
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
                        ??
                        0
                    )
                    >
                    0,
            )
            .map(
                (
                    addon,
                ): SelectedAddon => ({
                    addon,

                    quantity:
                        addonQuantities[
                        addon.id
                        ],
                }),
            );

    /*
    |--------------------------------------------------------------------------
    | Pricing Preview
    |--------------------------------------------------------------------------
    */

    const basePrice =
        variant
            ? Number(
                variant.price,
            )
            : Number(
                item.price,
            );

    const addonPrice =
        selectedAddons.reduce(
            (
                total,
                selected,
            ) =>
                total
                +
                (
                    Number(
                        selected.addon.price,
                    )
                    *
                    selected.quantity
                ),

            0,
        );

    const unitPrice =
        basePrice
        +
        addonPrice;

    const total =
        unitPrice
        *
        quantity;

    return (
        <div
            className="pos-feature-dialog-backdrop"
            role="presentation"
        >
            <section
                className="pos-feature-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={`Customize ${item.name}`}
            >
                <header className="pos-feature-dialog-header">
                    <div>
                        <span className="pos-feature-kicker">
                            CUSTOMIZE PRODUCT
                        </span>

                        <h2>
                            {
                                item.name
                            }
                        </h2>

                        <span className="pos-feature-dialog-price">
                            {
                                posMoney(
                                    unitPrice,
                                )
                            }
                            {' '}
                            each
                        </span>
                    </div>

                    <button
                        type="button"
                        className="pos-feature-dialog-close"
                        aria-label="Close"
                        onClick={
                            onClose
                        }
                    >
                        ×
                    </button>
                </header>

                <div className="pos-feature-dialog-content">
                    {
                        variants.length
                            >
                            0
                            ? (
                                <section className="pos-feature-option-section">
                                    <div className="pos-feature-option-heading">
                                        <h3>
                                            Select Option
                                        </h3>

                                        <span>
                                            Choose one
                                        </span>
                                    </div>

                                    <div className="pos-feature-variant-grid">
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
                                                                ===
                                                                option.id
                                                                ? 'pos-feature-variant active'
                                                                : 'pos-feature-variant'
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
                                                                posMoney(
                                                                    option.price,
                                                                )
                                                            }
                                                        </span>
                                                    </button>
                                                ),
                                            )
                                        }
                                    </div>
                                </section>
                            )
                            : null
                    }

                    {
                        addons.length
                            >
                            0
                            ? (
                                <section className="pos-feature-option-section">
                                    <div className="pos-feature-option-heading">
                                        <h3>
                                            Add-ons
                                        </h3>

                                        <span>
                                            Optional
                                        </span>
                                    </div>

                                    <div className="pos-feature-addon-list">
                                        {
                                            addons.map(
                                                (
                                                    addon,
                                                ) => {
                                                    const addonQuantity =
                                                        addonQuantities[
                                                        addon.id
                                                        ]
                                                        ??
                                                        0;

                                                    return (
                                                        <article
                                                            key={
                                                                addon.id
                                                            }
                                                            className="pos-feature-addon-row"
                                                        >
                                                            <div>
                                                                <strong>
                                                                    {
                                                                        addon.name
                                                                    }
                                                                </strong>

                                                                <span>
                                                                    {
                                                                        posMoney(
                                                                            addon.price,
                                                                        )
                                                                    }
                                                                </span>
                                                            </div>

                                                            <DialogQuantityControl
                                                                quantity={
                                                                    addonQuantity
                                                                }
                                                                allowZero
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
                                                        </article>
                                                    );
                                                },
                                            )
                                        }
                                    </div>
                                </section>
                            )
                            : null
                    }

                    <section className="pos-feature-option-section">
                        <div className="pos-feature-option-heading">
                            <h3>
                                Item Notes
                            </h3>

                            <span>
                                Optional
                            </span>
                        </div>

                        <textarea
                            className="pos-feature-notes"
                            value={
                                notes
                            }
                            rows={4}
                            placeholder="Example: no onions, less spicy..."
                            onChange={
                                (
                                    event,
                                ) =>
                                    setNotes(
                                        event.target.value,
                                    )
                            }
                        />
                    </section>
                </div>

                <footer className="pos-feature-dialog-footer">
                    <DialogQuantityControl
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
                                            current - 1,
                                        ),
                                )
                        }
                        onIncrease={
                            () =>
                                setQuantity(
                                    (
                                        current,
                                    ) =>
                                        current + 1,
                                )
                        }
                    />

                    <button
                        type="button"
                        className="pos-feature-add-button"
                        onClick={
                            () =>
                                onAdd({
                                    item,

                                    variant,

                                    addons:
                                        selectedAddons,

                                    quantity,

                                    notes:
                                        notes.trim(),
                                })
                        }
                    >
                        Add
                        {' '}
                        {
                            quantity
                        }
                        {' • '}
                        {
                            posMoney(
                                total,
                            )
                        }
                    </button>
                </footer>
            </section>
        </div>
    );
}

function DialogQuantityControl(
    {
        quantity,
        allowZero = false,
        onDecrease,
        onIncrease,
    }: {
        quantity:
        number;

        allowZero?:
        boolean;

        onDecrease:
        () => void;

        onIncrease:
        () => void;
    },
) {
    return (
        <div className="pos-feature-dialog-quantity">
            <button
                type="button"
                disabled={
                    allowZero
                        ? quantity <= 0
                        : quantity <= 1
                }
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