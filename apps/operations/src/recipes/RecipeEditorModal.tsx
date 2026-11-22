import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    Ingredient,
    IngredientUnit,
} from "../ingredients/types";

import type {
    RecipeEditorTarget,
    RecipeResponse,
    SaveRecipePayload,
} from "./types";

/*
|--------------------------------------------------------------------------
| Props
|--------------------------------------------------------------------------
*/

interface RecipeEditorModalProps {
    target: RecipeEditorTarget;
    recipe: RecipeResponse;
    ingredients: Ingredient[];
    units: IngredientUnit[];
    canManage: boolean;
    onClose: () => void;
    onSave: (
        payload: SaveRecipePayload,
    ) => Promise<RecipeResponse>;
    onClear: () => Promise<RecipeResponse>;
}

/*
|--------------------------------------------------------------------------
| Local Types
|--------------------------------------------------------------------------
*/

interface EditorRow {
    key: string;
    ingredient_id: number;
    quantity: string;
    unit_id: number;
}

let rowSequence = 0;

function nextRowKey(): string {
    rowSequence += 1;
    return `recipe-row-${rowSequence}`;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "The recipe operation could not be completed.";
}

function rowsFromRecipe(
    recipe: RecipeResponse,
): EditorRow[] {
    return recipe.components.map((component) => ({
        key: nextRowKey(),
        ingredient_id: component.ingredient.id,
        quantity: String(component.quantity),
        unit_id: component.unit.id,
    }));
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

const quantityFormatter =
    new Intl.NumberFormat(
        "en-LK",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        },
    );

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function RecipeEditorModal({
    target,
    recipe,
    ingredients,
    units,
    canManage,
    onClose,
    onSave,
    onClear,
}: RecipeEditorModalProps) {
    const [displayRecipe, setDisplayRecipe] =
        useState<RecipeResponse>(recipe);

    const [rows, setRows] = useState<EditorRow[]>(() =>
        rowsFromRecipe(recipe),
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const title = useMemo(() => {
        if (target.kind === "ADDON") {
            return `Add-on Recipe — ${target.addon.name}`;
        }

        if (target.kind === "VARIANT") {
            return `${target.menuItem.name} — ${target.variant.name}`;
        }

        return `Base Recipe — ${target.menuItem.name}`;
    }, [target]);

    const subtitle = useMemo(() => {
        if (target.kind === "ADDON") {
            return "Configure the ingredient consumption for this add-on.";
        }

        if (target.kind === "VARIANT") {
            return "This recipe is used when this specific variant is ordered.";
        }

        return "Configure the base ingredient recipe for this menu item.";
    }, [target]);

    const maxComponents =
        target.kind === "ADDON" ? 50 : 100;

    const activeIngredientCount = ingredients.filter(
        (ingredient) => ingredient.is_active,
    ).length;

    const findIngredient = (ingredientId: number) =>
        ingredients.find(
            (ingredient) => ingredient.id === ingredientId,
        );

    const unitsForRow = (
        row: EditorRow,
    ): IngredientUnit[] => {
        const ingredient = findIngredient(
            row.ingredient_id,
        );

        if (!ingredient || !ingredient.base_unit) {
            return units.filter(
                (unit) =>
                    unit.is_active ||
                    unit.id === row.unit_id,
            );
        }

        return units.filter((unit) => {
            if (unit.id === row.unit_id) {
                return true;
            }

            if (!unit.is_active) {
                return false;
            }

            return (
                unit.measurement_type ===
                ingredient.base_unit?.measurement_type
            );
        });
    };

    const updateRow = (
        key: string,
        changes: Partial<EditorRow>,
    ) => {
        setRows((current) =>
            current.map((row) =>
                row.key === key
                    ? { ...row, ...changes }
                    : row,
            ),
        );
    };

    const selectIngredient = (
        row: EditorRow,
        ingredientId: number,
    ) => {
        const ingredient = findIngredient(ingredientId);

        let unitId = 0;

        if (ingredient?.base_unit) {
            const baseUnit = units.find(
                (unit) =>
                    unit.id === ingredient.base_unit?.id,
            );

            if (baseUnit?.is_active) {
                unitId = baseUnit.id;
            }
        }

        updateRow(row.key, {
            ingredient_id: ingredientId,
            unit_id: unitId,
        });
    };

    const addRow = () => {
        if (rows.length >= maxComponents) {
            return;
        }

        setRows((current) => [
            ...current,
            {
                key: nextRowKey(),
                ingredient_id: 0,
                quantity: "",
                unit_id: 0,
            },
        ]);
    };

    const removeRow = (key: string) => {
        setRows((current) =>
            current.filter((row) => row.key !== key),
        );
    };

    const validate = (): SaveRecipePayload | null => {
        setError("");

        if (rows.length < 1) {
            setError(
                "Add at least one ingredient component before saving.",
            );

            return null;
        }

        if (rows.length > maxComponents) {
            setError(
                `This recipe supports a maximum of ${maxComponents} components.`,
            );

            return null;
        }

        const ingredientIds = rows.map(
            (row) => row.ingredient_id,
        );

        if (
            new Set(ingredientIds).size !==
            ingredientIds.length
        ) {
            setError(
                "The same ingredient cannot be added more than once.",
            );

            return null;
        }

        const components = [];

        for (
            let index = 0;
            index < rows.length;
            index += 1
        ) {
            const row = rows[index];
            const ingredient = findIngredient(
                row.ingredient_id,
            );

            if (!ingredient) {
                setError(
                    `Select an ingredient for row ${index + 1}.`,
                );

                return null;
            }

            if (!ingredient.is_active) {
                setError(
                    `${ingredient.name} is inactive and cannot be saved in a recipe.`,
                );

                return null;
            }

            const parsedQuantity = Number(row.quantity);

            if (
                !Number.isFinite(parsedQuantity) ||
                parsedQuantity <= 0
            ) {
                setError(
                    `Enter a valid quantity greater than zero for ${ingredient.name}.`,
                );

                return null;
            }

            const unit = units.find(
                (candidate) =>
                    candidate.id === row.unit_id,
            );

            if (!unit) {
                setError(
                    `Select a unit for ${ingredient.name}.`,
                );

                return null;
            }

            if (!unit.is_active) {
                setError(
                    `${unit.name} is inactive and cannot be used when saving this recipe.`,
                );

                return null;
            }

            components.push({
                ingredient_id: ingredient.id,
                quantity: parsedQuantity,
                unit_id: unit.id,
            });
        }

        return { components };
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (!canManage || busy) {
            return;
        }

        const payload = validate();

        if (!payload) {
            return;
        }

        setBusy(true);
        setError("");
        setMessage("");

        try {
            const result = await onSave(payload);

            setDisplayRecipe(result);
            setRows(rowsFromRecipe(result));
            setMessage("Recipe saved successfully.");
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setBusy(false);
        }
    };

    const clearRecipe = async () => {
        if (
            !canManage ||
            busy ||
            !displayRecipe.configured
        ) {
            return;
        }

        const confirmed = window.confirm(
            "Clear this recipe? Existing recipe components will be removed. Historical stock movements are not changed.",
        );

        if (!confirmed) {
            return;
        }

        setBusy(true);
        setError("");
        setMessage("");

        try {
            const result = await onClear();

            setDisplayRecipe(result);
            setRows(rowsFromRecipe(result));
            setMessage("Recipe cleared successfully.");
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="recipes-modal-backdrop"
            role="presentation"
        >
            <div
                className="recipes-modal recipes-editor-modal"
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <div className="recipes-modal-header">
                    <div>
                        <div className="recipes-modal-eyebrow">
                            {target.kind === "ADDON"
                                ? "Add-on Inventory"
                                : target.kind === "VARIANT"
                                    ? "Variant Recipe"
                                    : "Menu Recipe"}
                        </div>

                        <h2>{title}</h2>

                        <p>{subtitle}</p>
                    </div>

                    <button
                        type="button"
                        className="recipes-icon-button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close recipe editor"
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

                    {message && (
                        <div
                            className="recipes-alert recipes-alert-success"
                            role="status"
                        >
                            {message}
                        </div>
                    )}

                    {!canManage && (
                        <div className="recipes-alert recipes-alert-info">
                            You have read-only recipe access.
                            Recipe changes require the{" "}
                            <strong>recipes.manage</strong>{" "}
                            permission.
                        </div>
                    )}

                    <section className="recipes-cost-grid">
                        <article className="recipes-cost-card">
                            <span>Recipe Cost</span>
                            <strong>
                                {money.format(
                                    displayRecipe.costing
                                        .recipe_cost,
                                )}
                            </strong>
                        </article>

                        <article className="recipes-cost-card">
                            <span>Selling Price</span>
                            <strong>
                                {money.format(
                                    displayRecipe.costing
                                        .selling_price,
                                )}
                            </strong>
                        </article>

                        <article className="recipes-cost-card">
                            <span>Gross Margin</span>
                            <strong>
                                {money.format(
                                    displayRecipe.costing
                                        .gross_margin,
                                )}
                            </strong>
                        </article>

                        <article className="recipes-cost-card">
                            <span>Margin</span>
                            <strong>
                                {quantityFormatter.format(
                                    displayRecipe.costing
                                        .gross_margin_percentage,
                                )}
                                %
                            </strong>
                        </article>
                    </section>

                    <div className="recipes-status-row">
                        <span
                            className={
                                displayRecipe.configured
                                    ? "recipes-badge recipes-badge-success"
                                    : "recipes-badge recipes-badge-muted"
                            }
                        >
                            {displayRecipe.configured
                                ? "Recipe configured"
                                : "Recipe not configured"}
                        </span>

                        <span
                            className={
                                displayRecipe.costing
                                    .cost_complete
                                    ? "recipes-badge recipes-badge-success"
                                    : "recipes-badge recipes-badge-warning"
                            }
                        >
                            {displayRecipe.costing.cost_complete
                                ? "Cost complete"
                                : "Cost incomplete"}
                        </span>

                        {target.kind === "ADDON" && (
                            <span
                                className={
                                    "addon" in displayRecipe &&
                                        displayRecipe.addon
                                            .consumes_inventory
                                        ? "recipes-badge recipes-badge-success"
                                        : "recipes-badge recipes-badge-muted"
                                }
                            >
                                {"addon" in displayRecipe &&
                                    displayRecipe.addon
                                        .consumes_inventory
                                    ? "Consumes inventory"
                                    : "No inventory consumption"}
                            </span>
                        )}
                    </div>

                    {!displayRecipe.costing.cost_complete && (
                        <div className="recipes-alert recipes-alert-warning">
                            <strong>Costing warning:</strong> The
                            following ingredients currently have
                            zero average cost:{" "}
                            {displayRecipe.costing.uncosted_ingredients.join(
                                ", ",
                            )}
                            .
                        </div>
                    )}

                    {canManage ? (
                        <form
                            onSubmit={submit}
                            className="recipes-editor-form"
                        >
                            <div className="recipes-section-heading">
                                <div>
                                    <h3>
                                        Ingredient Components
                                    </h3>

                                    <p>
                                        Laravel validates final
                                        unit compatibility and
                                        calculates authoritative
                                        recipe costing.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="recipes-button recipes-button-secondary"
                                    onClick={addRow}
                                    disabled={
                                        busy ||
                                        rows.length >=
                                        maxComponents ||
                                        activeIngredientCount ===
                                        0
                                    }
                                >
                                    + Add Ingredient
                                </button>
                            </div>

                            {rows.length === 0 ? (
                                <div className="recipes-empty">
                                    <strong>
                                        No components configured
                                    </strong>

                                    <p>
                                        Add at least one
                                        ingredient before saving
                                        this recipe.
                                    </p>
                                </div>
                            ) : (
                                <div className="recipes-editor-rows">
                                    {rows.map((row, index) => {
                                        const selectedIngredient =
                                            findIngredient(
                                                row.ingredient_id,
                                            );

                                        const availableUnits =
                                            unitsForRow(row);

                                        const usedIngredientIds =
                                            new Set(
                                                rows
                                                    .filter(
                                                        (
                                                            candidate,
                                                        ) =>
                                                            candidate.key !==
                                                            row.key,
                                                    )
                                                    .map(
                                                        (
                                                            candidate,
                                                        ) =>
                                                            candidate.ingredient_id,
                                                    ),
                                            );

                                        return (
                                            <div
                                                key={row.key}
                                                className="recipes-editor-row"
                                            >
                                                <div className="recipes-row-number">
                                                    {index + 1}
                                                </div>

                                                <label className="recipes-field">
                                                    <span>
                                                        Ingredient
                                                    </span>

                                                    <select
                                                        value={
                                                            row.ingredient_id
                                                        }
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            selectIngredient(
                                                                row,
                                                                Number(
                                                                    event
                                                                        .target
                                                                        .value,
                                                                ),
                                                            )
                                                        }
                                                        disabled={busy}
                                                    >
                                                        <option value={0}>
                                                            Select
                                                            ingredient
                                                        </option>

                                                        {ingredients.map(
                                                            (
                                                                ingredient,
                                                            ) => (
                                                                <option
                                                                    key={
                                                                        ingredient.id
                                                                    }
                                                                    value={
                                                                        ingredient.id
                                                                    }
                                                                    disabled={
                                                                        !ingredient.is_active ||
                                                                        usedIngredientIds.has(
                                                                            ingredient.id,
                                                                        )
                                                                    }
                                                                >
                                                                    {
                                                                        ingredient.name
                                                                    }
                                                                    {ingredient.sku
                                                                        ? ` — ${ingredient.sku}`
                                                                        : ""}
                                                                    {!ingredient.is_active
                                                                        ? " (Inactive)"
                                                                        : ""}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>

                                                    {selectedIngredient?.base_unit && (
                                                        <small>
                                                            Stock
                                                            base
                                                            unit:{" "}
                                                            {
                                                                selectedIngredient
                                                                    .base_unit
                                                                    .symbol
                                                            }
                                                        </small>
                                                    )}
                                                </label>

                                                <label className="recipes-field">
                                                    <span>
                                                        Quantity
                                                    </span>

                                                    <input
                                                        type="number"
                                                        min="0.0001"
                                                        step="0.0001"
                                                        value={
                                                            row.quantity
                                                        }
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            updateRow(
                                                                row.key,
                                                                {
                                                                    quantity:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                },
                                                            )
                                                        }
                                                        placeholder="0.0000"
                                                        disabled={busy}
                                                    />
                                                </label>

                                                <label className="recipes-field">
                                                    <span>Unit</span>

                                                    <select
                                                        value={row.unit_id}
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            updateRow(
                                                                row.key,
                                                                {
                                                                    unit_id:
                                                                        Number(
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                },
                                                            )
                                                        }
                                                        disabled={
                                                            busy ||
                                                            !row.ingredient_id
                                                        }
                                                    >
                                                        <option value={0}>
                                                            Select unit
                                                        </option>

                                                        {availableUnits.map(
                                                            (unit) => (
                                                                <option
                                                                    key={
                                                                        unit.id
                                                                    }
                                                                    value={
                                                                        unit.id
                                                                    }
                                                                    disabled={
                                                                        !unit.is_active
                                                                    }
                                                                >
                                                                    {
                                                                        unit.name
                                                                    }{" "}
                                                                    (
                                                                    {
                                                                        unit.symbol
                                                                    }
                                                                    )
                                                                    {!unit.is_active
                                                                        ? " — Inactive"
                                                                        : ""}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </label>

                                                <button
                                                    type="button"
                                                    className="recipes-remove-button"
                                                    onClick={() =>
                                                        removeRow(
                                                            row.key,
                                                        )
                                                    }
                                                    disabled={busy}
                                                    aria-label={`Remove recipe row ${index + 1}`}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="recipes-component-limit">
                                {rows.length} / {maxComponents}{" "}
                                components
                            </div>

                            <div className="recipes-modal-actions">
                                <div>
                                    <button
                                        type="button"
                                        className="recipes-button recipes-button-danger"
                                        onClick={clearRecipe}
                                        disabled={
                                            busy ||
                                            !displayRecipe.configured
                                        }
                                    >
                                        Clear Recipe
                                    </button>
                                </div>

                                <div className="recipes-action-group">
                                    <button
                                        type="button"
                                        className="recipes-button recipes-button-secondary"
                                        onClick={onClose}
                                        disabled={busy}
                                    >
                                        Close
                                    </button>

                                    <button
                                        type="submit"
                                        className="recipes-button recipes-button-primary"
                                        disabled={
                                            busy ||
                                            rows.length === 0
                                        }
                                    >
                                        {busy
                                            ? "Saving..."
                                            : "Save Recipe"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="recipes-readonly-components">
                            <div className="recipes-section-heading">
                                <div>
                                    <h3>
                                        Ingredient Components
                                    </h3>

                                    <p>
                                        Saved component
                                        quantities and
                                        server-calculated
                                        costing.
                                    </p>
                                </div>
                            </div>

                            {displayRecipe.components.length ===
                                0 ? (
                                <div className="recipes-empty">
                                    <strong>
                                        No recipe configured
                                    </strong>
                                </div>
                            ) : (
                                <div className="recipes-table-wrap">
                                    <table className="recipes-table">
                                        <thead>
                                            <tr>
                                                <th>Ingredient</th>
                                                <th>Recipe Qty.</th>
                                                <th>Base Qty.</th>
                                                <th>Stock</th>
                                                <th>Cost</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {displayRecipe.components.map(
                                                (component) => (
                                                    <tr
                                                        key={
                                                            component.id
                                                        }
                                                    >
                                                        <td>
                                                            <strong>
                                                                {
                                                                    component
                                                                        .ingredient
                                                                        .name
                                                                }
                                                            </strong>

                                                            <small>
                                                                {component
                                                                    .ingredient
                                                                    .sku ||
                                                                    "No SKU"}
                                                            </small>
                                                        </td>

                                                        <td>
                                                            {quantityFormatter.format(
                                                                component.quantity,
                                                            )}{" "}
                                                            {
                                                                component
                                                                    .unit
                                                                    .symbol
                                                            }
                                                        </td>

                                                        <td>
                                                            {quantityFormatter.format(
                                                                component.base_quantity,
                                                            )}{" "}
                                                            {
                                                                component
                                                                    .ingredient
                                                                    .base_unit
                                                                    .symbol
                                                            }
                                                        </td>

                                                        <td>
                                                            {quantityFormatter.format(
                                                                component
                                                                    .ingredient
                                                                    .current_stock,
                                                            )}{" "}
                                                            {
                                                                component
                                                                    .ingredient
                                                                    .base_unit
                                                                    .symbol
                                                            }
                                                        </td>

                                                        <td>
                                                            {money.format(
                                                                component.component_cost,
                                                            )}
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}