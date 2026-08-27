import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    MenuAddon,
    MenuCategory,
    MenuItem,
    MenuItemAddonPayload,
    MenuItemEditorSubmission,
    MenuVariantPayload,
} from "../types";

interface MenuItemFormModalProps {
    item: MenuItem | null;

    categories: MenuCategory[];

    addons: MenuAddon[];

    busy: boolean;

    onClose: () => void;

    onSave: (
        submission: MenuItemEditorSubmission
    ) => Promise<void>;

    onRemovePhoto: (
        item: MenuItem
    ) => Promise<void>;
}

interface VariantEditor extends MenuVariantPayload {
    local_id: string;
}

interface AddonEditor {
    addon_id: number;

    selected: boolean;

    price_override: string;

    is_default: boolean;

    sort_order: number;
}

function localId():
    string {
    return `${Date.now()}-${Math.random()}`;
}

export default function MenuItemFormModal(
    {
        item,
        categories,
        addons,
        busy,
        onClose,
        onSave,
        onRemovePhoto,
    }: MenuItemFormModalProps
) {
    const [
        categoryId,
        setCategoryId,
    ] =
        useState(
            item?.category_id
            ??
            categories[0]?.id
            ??
            0
        );

    const [
        name,
        setName,
    ] =
        useState(
            item?.name
            ??
            ""
        );

    const [
        description,
        setDescription,
    ] =
        useState(
            item?.description
            ??
            ""
        );

    const [
        price,
        setPrice,
    ] =
        useState(
            String(
                item?.price
                ??
                0
            )
        );

    const [
        taxRate,
        setTaxRate,
    ] =
        useState(
            String(
                item?.tax_rate
                ??
                0
            )
        );

    const [
        sortOrder,
        setSortOrder,
    ] =
        useState(
            item?.sort_order
            ??
            0
        );

    const [
        isAvailable,
        setIsAvailable,
    ] =
        useState(
            item?.is_available
            ??
            true
        );

    const [
        isActive,
        setIsActive,
    ] =
        useState(
            item?.is_active
            ??
            true
        );

    const [
        websiteVisible,
        setWebsiteVisible,
    ] =
        useState(
            item?.is_visible_on_website
            ??
            true
        );

    const [
        qrVisible,
        setQrVisible,
    ] =
        useState(
            item?.is_visible_on_qr
            ??
            true
        );

    const [
        photo,
        setPhoto,
    ] =
        useState<File | null>(
            null
        );

    const [
        localError,
        setLocalError,
    ] =
        useState(
            ""
        );

    const [
        variants,
        setVariants,
    ] =
        useState<VariantEditor[]>(
            () =>
                item?.variants.map(
                    (
                        variant
                    ) => ({
                        id:
                            variant.id,

                        local_id:
                            String(
                                variant.id
                            ),

                        name:
                            variant.name,

                        price:
                            variant.price,

                        is_default:
                            variant.is_default,

                        is_available:
                            variant.is_available,

                        is_active:
                            variant.is_active,

                        sort_order:
                            variant.sort_order,
                    })
                )
                ??
                []
        );

    const [
        addonEditors,
        setAddonEditors,
    ] =
        useState<AddonEditor[]>(
            () =>
                addons.map(
                    (
                        addon
                    ) => {
                        const attached =
                            item?.addons.find(
                                (
                                    existing
                                ) =>
                                    existing.id
                                    ===
                                    addon.id
                            );

                        const override =
                            attached
                                &&
                                attached.price
                                !==
                                attached.base_price
                                ? String(
                                    attached.price
                                )
                                : "";

                        return {
                            addon_id:
                                addon.id,

                            selected:
                                Boolean(
                                    attached
                                ),

                            price_override:
                                override,

                            is_default:
                                attached
                                    ?.is_default
                                ??
                                false,

                            sort_order:
                                attached
                                    ?.sort_order
                                ??
                                addon.sort_order,
                        };
                    }
                )
        );

    const selectedAddonCount =
        useMemo(
            () =>
                addonEditors.filter(
                    (
                        addon
                    ) =>
                        addon.selected
                ).length,
            [
                addonEditors,
            ]
        );

    const addVariant =
        (): void => {
            setVariants(
                (
                    current
                ) => [
                        ...current,

                        {
                            local_id:
                                localId(),

                            name:
                                "",

                            price:
                                Number(
                                    price
                                )
                                ||
                                0,

                            is_default:
                                current.length
                                ===
                                0,

                            is_available:
                                true,

                            is_active:
                                true,

                            sort_order:
                                current.length,
                        },
                    ]
            );
        };

    const updateVariant =
        (
            localVariantId: string,

            patch: Partial<VariantEditor>
        ): void => {
            setVariants(
                (
                    current
                ) =>
                    current.map(
                        (
                            variant
                        ) =>
                            variant.local_id
                                ===
                                localVariantId
                                ? {
                                    ...variant,
                                    ...patch,
                                }
                                : variant
                    )
            );
        };

    const removeVariant =
        (
            localVariantId: string
        ): void => {
            setVariants(
                (
                    current
                ) =>
                    current.filter(
                        (
                            variant
                        ) =>
                            variant.local_id
                            !==
                            localVariantId
                    )
            );
        };

    const toggleDefaultVariant =
        (
            localVariantId: string
        ): void => {
            setVariants(
                (
                    current
                ) =>
                    current.map(
                        (
                            variant
                        ) => ({
                            ...variant,

                            is_default:
                                variant.local_id
                                ===
                                localVariantId,
                        })
                    )
            );
        };

    const submit =
        async (
            event:
                FormEvent<HTMLFormElement>
        ): Promise<void> => {
            event.preventDefault();

            if (
                categoryId <= 0
            ) {
                setLocalError(
                    "Please select a category."
                );

                return;
            }

            if (
                name.trim()
                ===
                ""
            ) {
                setLocalError(
                    "Menu item name is required."
                );

                return;
            }

            const numericPrice =
                Number(
                    price
                );

            if (
                Number.isNaN(
                    numericPrice
                )
                ||
                numericPrice < 0
            ) {
                setLocalError(
                    "Enter a valid price."
                );

                return;
            }

            if (
                variants.some(
                    (
                        variant
                    ) =>
                        variant.name.trim()
                        ===
                        ""
                )
            ) {
                setLocalError(
                    "Every variant requires a name."
                );

                return;
            }

            if (
                variants.length > 0
                &&
                !variants.some(
                    (
                        variant
                    ) =>
                        variant.is_default
                )
            ) {
                setLocalError(
                    "Select one default variant."
                );

                return;
            }

            const variantPayload:
                MenuVariantPayload[] =
                variants.map(
                    (
                        variant,
                        index
                    ) => ({
                        id:
                            variant.id,

                        name:
                            variant.name.trim(),

                        price:
                            Number(
                                variant.price
                            ),

                        is_default:
                            variant.is_default,

                        is_available:
                            variant.is_available,

                        is_active:
                            variant.is_active,

                        sort_order:
                            index,
                    })
                );

            const addonPayload:
                MenuItemAddonPayload[] =
                addonEditors
                    .filter(
                        (
                            addon
                        ) =>
                            addon.selected
                    )
                    .map(
                        (
                            addon,
                            index
                        ) => ({
                            addon_id:
                                addon.addon_id,

                            price_override:
                                addon
                                    .price_override
                                    .trim()
                                    ===
                                    ""
                                    ? null
                                    : Number(
                                        addon
                                            .price_override
                                    ),

                            is_default:
                                addon.is_default,

                            sort_order:
                                index,
                        })
                    );

            setLocalError(
                ""
            );

            await onSave({
                category_id:
                    categoryId,

                name:
                    name.trim(),

                description:
                    description.trim()
                        ===
                        ""
                        ? null
                        : description.trim(),

                price:
                    numericPrice,

                tax_rate:
                    taxRate.trim()
                        ===
                        ""
                        ? null
                        : Number(
                            taxRate
                        ),

                sort_order:
                    sortOrder,

                is_available:
                    isAvailable,

                is_active:
                    isActive,

                is_visible_on_website:
                    websiteVisible,

                is_visible_on_qr:
                    qrVisible,

                variants:
                    variantPayload,

                addons:
                    addonPayload,

                photo,
            });
        };

    return (
        <div
            className="ops-menu-modal-backdrop"
            role="presentation"
        >
            <form
                className="ops-menu-modal ops-menu-item-modal"
                onSubmit={
                    (
                        event
                    ) => {
                        void submit(
                            event
                        );
                    }
                }
            >
                <header className="ops-menu-modal-header">
                    <div>
                        <span>
                            MENU ITEM
                        </span>

                        <h3>
                            {
                                item
                                    ? "Edit Menu Item"
                                    : "Create Menu Item"
                            }
                        </h3>
                    </div>

                    <button
                        type="button"
                        className="ops-menu-modal-close"
                        disabled={
                            busy
                        }
                        onClick={
                            onClose
                        }
                    >
                        ×
                    </button>
                </header>

                <div className="ops-menu-modal-scroll">
                    {
                        localError
                        &&
                        (
                            <div className="ops-menu-form-error">
                                {
                                    localError
                                }
                            </div>
                        )
                    }

                    <section className="ops-menu-form-section">
                        <header>
                            <h4>
                                Basic Information
                            </h4>

                            <p>
                                Main customer-facing information and selling price.
                            </p>
                        </header>

                        <div className="ops-menu-form-grid">
                            <label>
                                <span>
                                    Category *
                                </span>

                                <select
                                    value={
                                        categoryId
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setCategoryId(
                                                Number(
                                                    event.target.value
                                                )
                                            )
                                    }
                                >
                                    {
                                        categories.map(
                                            (
                                                category
                                            ) => (
                                                <option
                                                    key={
                                                        category.id
                                                    }
                                                    value={
                                                        category.id
                                                    }
                                                >
                                                    {
                                                        category.name
                                                    }
                                                </option>
                                            )
                                        )
                                    }
                                </select>
                            </label>

                            <label>
                                <span>
                                    Item Name *
                                </span>

                                <input
                                    value={
                                        name
                                    }
                                    maxLength={
                                        190
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setName(
                                                event.target.value
                                            )
                                    }
                                />
                            </label>

                            <label>
                                <span>
                                    Base Price (Rs.) *
                                </span>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                        price
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setPrice(
                                                event.target.value
                                            )
                                    }
                                />
                            </label>

                            <label>
                                <span>
                                    Tax Rate %
                                </span>

                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={
                                        taxRate
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setTaxRate(
                                                event.target.value
                                            )
                                    }
                                />
                            </label>

                            <label>
                                <span>
                                    Sort Order
                                </span>

                                <input
                                    type="number"
                                    min="0"
                                    value={
                                        sortOrder
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setSortOrder(
                                                Math.max(
                                                    0,
                                                    Number(
                                                        event.target.value
                                                    )
                                                    ||
                                                    0
                                                )
                                            )
                                    }
                                />
                            </label>

                            <label>
                                <span>
                                    Photo
                                </span>

                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setPhoto(
                                                event
                                                    .target
                                                    .files
                                                ?.[0]
                                                ??
                                                null
                                            )
                                    }
                                />
                            </label>
                        </div>

                        <label className="ops-menu-form-full">
                            <span>
                                Description
                            </span>

                            <textarea
                                rows={
                                    4
                                }
                                maxLength={
                                    2000
                                }
                                value={
                                    description
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setDescription(
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        {
                            item
                                ?.photo_url
                            &&
                            (
                                <div className="ops-menu-current-photo">
                                    <img
                                        src={
                                            item.photo_url
                                        }
                                        alt={
                                            item.name
                                        }
                                    />

                                    <div>
                                        <strong>
                                            Current Photo
                                        </strong>

                                        <button
                                            type="button"
                                            disabled={
                                                busy
                                            }
                                            onClick={
                                                () => {
                                                    void onRemovePhoto(
                                                        item
                                                    );
                                                }
                                            }
                                        >
                                            Remove Photo
                                        </button>
                                    </div>
                                </div>
                            )
                        }
                    </section>

                    <section className="ops-menu-form-section">
                        <header>
                            <h4>
                                Availability & Visibility
                            </h4>

                            <p>
                                Control where this item can be sold and displayed.
                            </p>
                        </header>

                        <div className="ops-menu-toggle-grid">
                            <Toggle
                                label="Active"
                                checked={
                                    isActive
                                }
                                onChange={
                                    setIsActive
                                }
                            />

                            <Toggle
                                label="Available for Sale"
                                checked={
                                    isAvailable
                                }
                                onChange={
                                    setIsAvailable
                                }
                            />

                            <Toggle
                                label="Website"
                                checked={
                                    websiteVisible
                                }
                                onChange={
                                    setWebsiteVisible
                                }
                            />

                            <Toggle
                                label="Customer QR"
                                checked={
                                    qrVisible
                                }
                                onChange={
                                    setQrVisible
                                }
                            />
                        </div>
                    </section>

                    <section className="ops-menu-form-section">
                        <header className="ops-menu-form-section-action">
                            <div>
                                <h4>
                                    Variants
                                </h4>

                                <p>
                                    Optional sizes or selling variants.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    addVariant
                                }
                            >
                                + Add Variant
                            </button>
                        </header>

                        {
                            variants.length
                                ===
                                0
                                ? (
                                    <div className="ops-menu-form-empty">
                                        No variants. The base item price will be used.
                                    </div>
                                )
                                : (
                                    <div className="ops-menu-variant-list">
                                        {
                                            variants.map(
                                                (
                                                    variant
                                                ) => (
                                                    <div
                                                        key={
                                                            variant.local_id
                                                        }
                                                        className="ops-menu-variant-row"
                                                    >
                                                        <input
                                                            placeholder="Variant name"
                                                            value={
                                                                variant.name
                                                            }
                                                            onChange={
                                                                (
                                                                    event
                                                                ) =>
                                                                    updateVariant(
                                                                        variant.local_id,
                                                                        {
                                                                            name:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                            }
                                                        />

                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={
                                                                variant.price
                                                            }
                                                            onChange={
                                                                (
                                                                    event
                                                                ) =>
                                                                    updateVariant(
                                                                        variant.local_id,
                                                                        {
                                                                            price:
                                                                                Number(
                                                                                    event.target.value
                                                                                )
                                                                                ||
                                                                                0,
                                                                        }
                                                                    )
                                                            }
                                                        />

                                                        <label>
                                                            <input
                                                                type="radio"
                                                                name="default-variant"
                                                                checked={
                                                                    variant.is_default
                                                                }
                                                                onChange={
                                                                    () =>
                                                                        toggleDefaultVariant(
                                                                            variant.local_id
                                                                        )
                                                                }
                                                            />

                                                            Default
                                                        </label>

                                                        <label>
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    variant.is_available
                                                                }
                                                                onChange={
                                                                    (
                                                                        event
                                                                    ) =>
                                                                        updateVariant(
                                                                            variant.local_id,
                                                                            {
                                                                                is_available:
                                                                                    event.target.checked,
                                                                            }
                                                                        )
                                                                }
                                                            />

                                                            Available
                                                        </label>

                                                        <button
                                                            type="button"
                                                            className="danger"
                                                            onClick={
                                                                () =>
                                                                    removeVariant(
                                                                        variant.local_id
                                                                    )
                                                            }
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                )
                                            )
                                        }
                                    </div>
                                )
                        }
                    </section>

                    <section className="ops-menu-form-section">
                        <header>
                            <h4>
                                Add-ons
                            </h4>

                            <p>
                                {
                                    selectedAddonCount
                                }
                                {" "}
                                selected
                            </p>
                        </header>

                        {
                            addons.length
                                ===
                                0
                                ? (
                                    <div className="ops-menu-form-empty">
                                        No add-ons have been created yet.
                                    </div>
                                )
                                : (
                                    <div className="ops-menu-addon-selector">
                                        {
                                            addons.map(
                                                (
                                                    addon,
                                                    index
                                                ) => {
                                                    const editor =
                                                        addonEditors[index];

                                                    return (
                                                        <article
                                                            key={
                                                                addon.id
                                                            }
                                                        >
                                                            <label>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        editor.selected
                                                                    }
                                                                    onChange={
                                                                        (
                                                                            event
                                                                        ) =>
                                                                            setAddonEditors(
                                                                                (
                                                                                    current
                                                                                ) =>
                                                                                    current.map(
                                                                                        (
                                                                                            value
                                                                                        ) =>
                                                                                            value.addon_id
                                                                                                ===
                                                                                                addon.id
                                                                                                ? {
                                                                                                    ...value,
                                                                                                    selected:
                                                                                                        event.target.checked,
                                                                                                }
                                                                                                : value
                                                                                    )
                                                                            )
                                                                    }
                                                                />

                                                                <span>
                                                                    <strong>
                                                                        {
                                                                            addon.name
                                                                        }
                                                                    </strong>

                                                                    <small>
                                                                        Rs.{" "}
                                                                        {
                                                                            addon.base_price.toFixed(
                                                                                2
                                                                            )
                                                                        }
                                                                    </small>
                                                                </span>
                                                            </label>

                                                            {
                                                                editor.selected
                                                                &&
                                                                (
                                                                    <div className="ops-menu-addon-options">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            placeholder="Price override"
                                                                            value={
                                                                                editor.price_override
                                                                            }
                                                                            onChange={
                                                                                (
                                                                                    event
                                                                                ) =>
                                                                                    setAddonEditors(
                                                                                        (
                                                                                            current
                                                                                        ) =>
                                                                                            current.map(
                                                                                                (
                                                                                                    value
                                                                                                ) =>
                                                                                                    value.addon_id
                                                                                                        ===
                                                                                                        addon.id
                                                                                                        ? {
                                                                                                            ...value,
                                                                                                            price_override:
                                                                                                                event.target.value,
                                                                                                        }
                                                                                                        : value
                                                                                            )
                                                                                    )
                                                                            }
                                                                        />

                                                                        <label>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={
                                                                                    editor.is_default
                                                                                }
                                                                                onChange={
                                                                                    (
                                                                                        event
                                                                                    ) =>
                                                                                        setAddonEditors(
                                                                                            (
                                                                                                current
                                                                                            ) =>
                                                                                                current.map(
                                                                                                    (
                                                                                                        value
                                                                                                    ) =>
                                                                                                        value.addon_id
                                                                                                            ===
                                                                                                            addon.id
                                                                                                            ? {
                                                                                                                ...value,
                                                                                                                is_default:
                                                                                                                    event.target.checked,
                                                                                                            }
                                                                                                            : value
                                                                                                )
                                                                                        )
                                                                                }
                                                                            />

                                                                            Default
                                                                        </label>
                                                                    </div>
                                                                )
                                                            }
                                                        </article>
                                                    );
                                                }
                                            )
                                        }
                                    </div>
                                )
                        }
                    </section>
                </div>

                <footer className="ops-menu-modal-footer">
                    <button
                        type="button"
                        className="secondary"
                        disabled={
                            busy
                        }
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="primary"
                        disabled={
                            busy
                            ||
                            categories.length
                            ===
                            0
                        }
                    >
                        {
                            busy
                                ? "Saving..."
                                : item
                                    ? "Save Changes"
                                    : "Create Item"
                        }
                    </button>
                </footer>
            </form>
        </div>
    );
}

function Toggle(
    {
        label,
        checked,
        onChange,
    }: {
        label: string;

        checked: boolean;

        onChange: (
            value: boolean
        ) => void;
    }
) {
    return (
        <label className="ops-menu-toggle">
            <input
                type="checkbox"
                checked={
                    checked
                }
                onChange={
                    (
                        event
                    ) =>
                        onChange(
                            event.target.checked
                        )
                }
            />

            <span>
                {
                    label
                }
            </span>
        </label>
    );
}