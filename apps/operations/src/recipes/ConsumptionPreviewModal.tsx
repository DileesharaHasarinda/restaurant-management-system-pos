import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    MenuItem,
} from "../menu/types";

import {
    previewRecipeConsumption,
} from "./recipeService";

import type {
    ConsumptionPreviewPayload,
    ConsumptionPreviewResponse,
} from "./types";

interface ConsumptionPreviewModalProps {
    menuItem: MenuItem;
    onClose: () => void;
}

const money =
    new Intl.NumberFormat(
        "en-LK",
        {
            style: "currency",
            currency: "LKR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        },
    );

const quantity =
    new Intl.NumberFormat(
        "en-LK",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        },
    );

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Consumption preview could not be generated.";
}

export default function ConsumptionPreviewModal({
    menuItem,
    onClose,
}: ConsumptionPreviewModalProps) {
    const [variantValue, setVariantValue] =
        useState("base");

    const [itemQuantity, setItemQuantity] = useState(1);

    const [addonQuantities, setAddonQuantities] = useState<
        Record<number, number>
    >({});

    const [result, setResult] =
        useState<ConsumptionPreviewResponse | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const selectedAddonCount = useMemo(
        () =>
            Object.values(addonQuantities).filter(
                (value) => value > 0,
            ).length,
        [addonQuantities],
    );

    const updateAddon = (
        addonId: number,
        value: number,
    ) => {
        setAddonQuantities((current) => ({
            ...current,
            [addonId]: value,
        }));
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        setError("");
        setResult(null);

        if (
            !Number.isInteger(itemQuantity) ||
            itemQuantity < 1 ||
            itemQuantity > 100
        ) {
            setError(
                "Item quantity must be a whole number between 1 and 100.",
            );

            return;
        }

        if (selectedAddonCount > 30) {
            setError(
                "A maximum of 30 add-ons can be included in one preview.",
            );

            return;
        }

        const addons = [];

        for (const addon of menuItem.addons) {
            const addonQuantity =
                addonQuantities[addon.id] ?? 0;

            if (addonQuantity === 0) {
                continue;
            }

            if (
                !Number.isInteger(addonQuantity) ||
                addonQuantity < 1 ||
                addonQuantity > 20
            ) {
                setError(
                    `Quantity for ${addon.name} must be a whole number between 1 and 20.`,
                );

                return;
            }

            addons.push({
                addon_id: addon.id,
                quantity: addonQuantity,
            });
        }

        const payload: ConsumptionPreviewPayload = {
            variant_id:
                variantValue === "base"
                    ? null
                    : Number(variantValue),
            item_quantity: itemQuantity,
            addons,
        };

        setLoading(true);

        try {
            const preview =
                await previewRecipeConsumption(
                    menuItem.id,
                    payload,
                );

            setResult(preview);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="recipes-modal-backdrop"
            role="presentation"
        >
            <div
                className="recipes-modal recipes-preview-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Consumption preview for ${menuItem.name}`}
            >
                <div className="recipes-modal-header">
                    <div>
                        <div className="recipes-modal-eyebrow">
                            Inventory Simulation
                        </div>

                        <h2>Consumption Preview</h2>

                        <p>
                            {menuItem.name}
                            {" — "}
                            preview server-calculated
                            ingredient demand, stock
                            availability, cost and margin
                            before an order is sent to the
                            kitchen.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="recipes-icon-button"
                        onClick={onClose}
                        disabled={loading}
                        aria-label="Close consumption preview"
                    >
                        ×
                    </button>
                </div>

                <div className="recipes-modal-body">
                    {error && (
                        <div
                            className="recipes-alert recipes-alert-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <form
                        onSubmit={submit}
                        className="recipes-preview-form"
                    >
                        <div className="recipes-preview-controls">
                            <label className="recipes-field">
                                <span>Recipe / Variant</span>

                                <select
                                    value={variantValue}
                                    onChange={(event) => {
                                        setVariantValue(
                                            event.target.value,
                                        );

                                        setResult(null);
                                    }}
                                    disabled={loading}
                                >
                                    <option value="base">
                                        Base Recipe
                                    </option>

                                    {menuItem.variants.map(
                                        (variant) => (
                                            <option
                                                key={variant.id}
                                                value={variant.id}
                                            >
                                                {variant.name}
                                                {!variant.is_active
                                                    ? " — Inactive"
                                                    : ""}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </label>

                            <label className="recipes-field">
                                <span>Item Quantity</span>

                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={itemQuantity}
                                    onChange={(event) => {
                                        setItemQuantity(
                                            Number(
                                                event.target
                                                    .value,
                                            ),
                                        );

                                        setResult(null);
                                    }}
                                    disabled={loading}
                                />
                            </label>
                        </div>

                        {menuItem.addons.length > 0 && (
                            <section className="recipes-preview-addons">
                                <div className="recipes-section-heading">
                                    <div>
                                        <h3>Add-ons</h3>

                                        <p>
                                            Enter add-on
                                            quantity per ordered
                                            menu item.
                                        </p>
                                    </div>
                                </div>

                                <div className="recipes-addon-grid">
                                    {menuItem.addons.map(
                                        (addon) => (
                                            <label
                                                key={addon.id}
                                                className="recipes-addon-option"
                                            >
                                                <div>
                                                    <strong>
                                                        {addon.name}
                                                    </strong>

                                                    <span>
                                                        {money.format(
                                                            addon.price,
                                                        )}
                                                        {addon.consumes_inventory
                                                            ? " · Inventory"
                                                            : " · No inventory"}
                                                    </span>
                                                </div>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="20"
                                                    step="1"
                                                    value={
                                                        addonQuantities[
                                                        addon.id
                                                        ] ?? 0
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) => {
                                                        updateAddon(
                                                            addon.id,
                                                            Number(
                                                                event
                                                                    .target
                                                                    .value,
                                                            ),
                                                        );

                                                        setResult(
                                                            null,
                                                        );
                                                    }}
                                                    disabled={
                                                        loading ||
                                                        !addon.is_active ||
                                                        !addon.is_available
                                                    }
                                                />
                                            </label>
                                        ),
                                    )}
                                </div>
                            </section>
                        )}

                        <div className="recipes-preview-submit">
                            <button
                                type="submit"
                                className="recipes-button recipes-button-primary"
                                disabled={loading}
                            >
                                {loading
                                    ? "Calculating..."
                                    : "Generate Preview"}
                            </button>
                        </div>
                    </form>

                    {result && (
                        <div className="recipes-preview-results">
                            <section className="recipes-preview-summary">
                                <article className="recipes-cost-card">
                                    <span>
                                        Total Recipe Cost
                                    </span>
                                    <strong>
                                        {money.format(
                                            result.costing
                                                .total_recipe_cost,
                                        )}
                                    </strong>
                                </article>

                                <article className="recipes-cost-card">
                                    <span>
                                        Selling Price
                                    </span>
                                    <strong>
                                        {money.format(
                                            result.costing
                                                .total_selling_price,
                                        )}
                                    </strong>
                                </article>

                                <article className="recipes-cost-card">
                                    <span>Gross Margin</span>
                                    <strong>
                                        {money.format(
                                            result.costing
                                                .gross_margin,
                                        )}
                                    </strong>
                                </article>

                                <article className="recipes-cost-card">
                                    <span>Margin</span>
                                    <strong>
                                        {quantity.format(
                                            result.costing
                                                .gross_margin_percentage,
                                        )}
                                        %
                                    </strong>
                                </article>
                            </section>

                            <div className="recipes-status-row">
                                <span
                                    className={
                                        result.has_sufficient_stock
                                            ? "recipes-badge recipes-badge-success"
                                            : "recipes-badge recipes-badge-danger"
                                    }
                                >
                                    {result.has_sufficient_stock
                                        ? "Sufficient stock"
                                        : "Stock shortage"}
                                </span>

                                <span
                                    className={
                                        result.costing.cost_complete
                                            ? "recipes-badge recipes-badge-success"
                                            : "recipes-badge recipes-badge-warning"
                                    }
                                >
                                    {result.costing.cost_complete
                                        ? "Cost complete"
                                        : "Cost incomplete"}
                                </span>
                            </div>

                            {!result.costing.cost_complete && (
                                <div className="recipes-alert recipes-alert-warning">
                                    Zero-cost ingredients:{" "}
                                    {result.costing.uncosted_ingredients.join(
                                        ", ",
                                    )}
                                </div>
                            )}

                            <section>
                                <div className="recipes-section-heading">
                                    <div>
                                        <h3>
                                            Ingredient Requirements
                                        </h3>

                                        <p>
                                            Aggregated quantities
                                            after recipe
                                            conversion and order
                                            quantity
                                            multiplication.
                                        </p>
                                    </div>
                                </div>

                                {result.requirements.length ===
                                    0 ? (
                                    <div className="recipes-empty">
                                        No ingredient requirements
                                        were returned.
                                    </div>
                                ) : (
                                    <div className="recipes-table-wrap">
                                        <table className="recipes-table">
                                            <thead>
                                                <tr>
                                                    <th>Ingredient</th>
                                                    <th>Required</th>
                                                    <th>Current</th>
                                                    <th>Shortage</th>
                                                    <th>Cost</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {result.requirements.map(
                                                    (
                                                        requirement,
                                                    ) => (
                                                        <tr
                                                            key={
                                                                requirement.ingredient_id
                                                            }
                                                        >
                                                            <td>
                                                                <strong>
                                                                    {
                                                                        requirement.name
                                                                    }
                                                                </strong>

                                                                <small>
                                                                    {requirement.sku ||
                                                                        "No SKU"}
                                                                </small>
                                                            </td>

                                                            <td>
                                                                {quantity.format(
                                                                    requirement.required_quantity,
                                                                )}{" "}
                                                                {
                                                                    requirement
                                                                        .base_unit
                                                                        .symbol
                                                                }
                                                            </td>

                                                            <td>
                                                                {quantity.format(
                                                                    requirement.current_stock,
                                                                )}{" "}
                                                                {
                                                                    requirement
                                                                        .base_unit
                                                                        .symbol
                                                                }
                                                            </td>

                                                            <td>
                                                                {quantity.format(
                                                                    requirement.shortage_quantity,
                                                                )}{" "}
                                                                {
                                                                    requirement
                                                                        .base_unit
                                                                        .symbol
                                                                }
                                                            </td>

                                                            <td>
                                                                {money.format(
                                                                    requirement.estimated_cost,
                                                                )}
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={
                                                                        requirement.enough_stock
                                                                            ? "recipes-badge recipes-badge-success"
                                                                            : "recipes-badge recipes-badge-danger"
                                                                    }
                                                                >
                                                                    {requirement.enough_stock
                                                                        ? "Enough"
                                                                        : "Short"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>

                            {result.addons.length > 0 && (
                                <section>
                                    <div className="recipes-section-heading">
                                        <div>
                                            <h3>
                                                Add-on Breakdown
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="recipes-table-wrap">
                                        <table className="recipes-table">
                                            <thead>
                                                <tr>
                                                    <th>Add-on</th>
                                                    <th>Qty / Item</th>
                                                    <th>Unit Price</th>
                                                    <th>
                                                        Selling Total
                                                    </th>
                                                    <th>
                                                        Ingredient Cost
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {result.addons.map(
                                                    (addon) => (
                                                        <tr
                                                            key={
                                                                addon.addon_id
                                                            }
                                                        >
                                                            <td>
                                                                <strong>
                                                                    {
                                                                        addon.name
                                                                    }
                                                                </strong>

                                                                <small>
                                                                    {addon.consumes_inventory
                                                                        ? "Inventory tracked"
                                                                        : "No inventory consumption"}
                                                                </small>
                                                            </td>

                                                            <td>
                                                                {
                                                                    addon.quantity_per_item
                                                                }
                                                            </td>

                                                            <td>
                                                                {money.format(
                                                                    addon.effective_unit_price,
                                                                )}
                                                            </td>

                                                            <td>
                                                                {money.format(
                                                                    addon.selling_subtotal,
                                                                )}
                                                            </td>

                                                            <td>
                                                                {money.format(
                                                                    addon.estimated_ingredient_cost,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}