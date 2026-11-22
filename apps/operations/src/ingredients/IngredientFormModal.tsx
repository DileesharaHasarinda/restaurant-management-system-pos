import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    Ingredient,
    IngredientEditorSubmission,
    IngredientUnit,
} from "./types";

interface IngredientFormModalProps {
    ingredient: Ingredient | null;

    units: IngredientUnit[];

    busy: boolean;

    onClose: () => void;

    onSave: (
        submission: IngredientEditorSubmission,
    ) => Promise<void>;
}

/*
|--------------------------------------------------------------------------
| Formatters
|--------------------------------------------------------------------------
*/

const quantityFormatter =
    new Intl.NumberFormat(
        "en-LK",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        },
    );

const moneyFormatter =
    new Intl.NumberFormat(
        "en-LK",
        {
            style: "currency",
            currency: "LKR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        },
    );

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Modal
|--------------------------------------------------------------------------
*/

export default function IngredientFormModal(
    {
        ingredient,
        units,
        busy,
        onClose,
        onSave,
    }: IngredientFormModalProps,
) {
    /*
     * Ingredient stock must use an active
     * root unit according to backend rules.
     */
    const rootUnits = useMemo(
        () =>
            units.filter(
                (unit) =>
                    unit.is_root_unit &&
                    unit.is_active,
            ),
        [units],
    );

    const [name, setName] = useState(
        ingredient?.name ?? "",
    );

    const [baseUnitId, setBaseUnitId] = useState(
        ingredient?.base_unit?.id ??
        rootUnits[0]?.id ??
        0,
    );

    const [minimumStock, setMinimumStock] = useState(
        String(ingredient?.minimum_stock ?? 0),
    );

    const [storageLocation, setStorageLocation] = useState(
        ingredient?.storage_location ?? "",
    );

    const [localError, setLocalError] = useState("");


    const isEditing = Boolean(ingredient);

    const submit = async (
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
        event.preventDefault();

        if (name.trim() === "") {
            setLocalError(
                "Ingredient name is required.",
            );

            return;
        }

        if (baseUnitId <= 0) {
            setLocalError(
                "Select a base unit.",
            );

            return;
        }

        const minimum = Number(minimumStock);

        if (Number.isNaN(minimum) || minimum < 0) {
            setLocalError(
                "Minimum stock must be zero or greater.",
            );

            return;
        }

        setLocalError("");

        await onSave({
            name: name.trim(),

            base_unit_id: baseUnitId,

            minimum_stock: minimum,

            storage_location:
                storageLocation.trim() === ""
                    ? null
                    : storageLocation.trim(),

            /*
             * Status is managed from the
             * ingredient list (Activate /
             * Deactivate actions). Preserve
             * the existing state on edit,
             * default to active on create.
             */
            is_active:
                ingredient?.is_active ?? true,
        });
    };

    return (
        <div
            className="ops-ingredient-modal-backdrop"
            role="presentation"
        >
            <form
                className="ops-ingredient-modal"
                onSubmit={(event) => {
                    void submit(event);
                }}
            >
                {/* =================================================
                    MODAL HEADER
                    ================================================= */}

                <header className="ops-ingredient-modal-header">
                    <div>
                        <span>Inventory Ingredient</span>

                        <h3>
                            {isEditing
                                ? "Edit Ingredient"
                                : "Create Ingredient"}
                        </h3>
                    </div>

                    <button
                        type="button"
                        className="ops-ingredient-modal-x"
                        disabled={busy}
                        onClick={onClose}
                        aria-label="Close ingredient form"
                    >
                        ×
                    </button>
                </header>

                {/* =================================================
                    MODAL BODY
                    ================================================= */}

                <div className="ops-ingredient-modal-content">
                    {localError && (
                        <div
                            className="ops-ingredient-form-error"
                            role="alert"
                        >
                            {localError}
                        </div>
                    )}

                    {/* -------- Readonly system values -------- */}

                    {ingredient && (
                        <section className="ops-ingredient-readonly">
                            <div>
                                <span>SKU</span>

                                <strong>
                                    {ingredient.sku ??
                                        "Not assigned"}
                                </strong>
                            </div>

                            <div>
                                <span>Current Stock</span>

                                <strong>
                                    {quantityFormatter.format(
                                        ingredient.current_stock,
                                    )}
                                    {ingredient.base_unit?.symbol
                                        ? ` ${ingredient.base_unit.symbol}`
                                        : ""}
                                </strong>
                            </div>

                            <div>
                                <span>Average Cost</span>

                                <strong>
                                    {moneyFormatter.format(
                                        ingredient.average_cost,
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Stock Value</span>

                                <strong>
                                    {moneyFormatter.format(
                                        ingredient.stock_value,
                                    )}
                                </strong>
                            </div>
                        </section>
                    )}

                    {/* -------- Ingredient details -------- */}

                    <section className="ops-ingredient-form-section">
                        <header>
                            <h4>Ingredient Details</h4>
                        </header>

                        <div className="ops-ingredient-form-grid">
                            <label>
                                <span>Ingredient Name *</span>

                                <input
                                    autoFocus
                                    required
                                    maxLength={190}
                                    value={name}
                                    placeholder="Example: All-purpose flour"
                                    onChange={(event) =>
                                        setName(
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>

                            <label>
                                <span>Base Unit *</span>

                                <select
                                    required
                                    value={baseUnitId}
                                    onChange={(event) =>
                                        setBaseUnitId(
                                            Number(
                                                event.target.value,
                                            ),
                                        )
                                    }
                                >
                                    {rootUnits.length === 0 && (
                                        <option value="0">
                                            No active root units
                                            available
                                        </option>
                                    )}

                                    {rootUnits.map((unit) => (
                                        <option
                                            key={unit.id}
                                            value={unit.id}
                                        >
                                            {unit.name} ({unit.symbol})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span>
                                    Reorder / Minimum Stock *
                                </span>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    required
                                    value={minimumStock}
                                    placeholder="0"
                                    onChange={(event) =>
                                        setMinimumStock(
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>

                            <label>
                                <span>Storage Location</span>

                                <input
                                    maxLength={190}
                                    value={storageLocation}
                                    placeholder="Example: Dry Store — Rack A"
                                    onChange={(event) =>
                                        setStorageLocation(
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                        </div>
                    </section>
                </div>

                {/* =================================================
                    MODAL FOOTER
                    ================================================= */}

                <footer className="ops-ingredient-modal-footer">
                    <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={onClose}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="primary"
                        disabled={
                            busy ||
                            rootUnits.length === 0
                        }
                    >
                        {busy
                            ? "Saving..."
                            : isEditing
                                ? "Save Changes"
                                : "Create Ingredient"}
                    </button>
                </footer>
            </form>
        </div>
    );
}