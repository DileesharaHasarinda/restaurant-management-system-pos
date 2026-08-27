import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    Ingredient,
    IngredientEditorSubmission,
    IngredientUnit,
    MeasurementType,
} from "./types";

interface IngredientFormModalProps {
    ingredient:
    Ingredient
    |
    null;

    units:
    IngredientUnit[];

    busy:
    boolean;

    onClose:
    () => void;

    onSave:
    (
        submission:
            IngredientEditorSubmission
    ) => Promise<void>;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function measurementLabel(
    type: MeasurementType
): string {
    switch (
    type
    ) {
        case "MASS":
            return "Mass";

        case "VOLUME":
            return "Volume";

        case "COUNT":
            return "Count";

        default:
            return type;
    }
}

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
    }: IngredientFormModalProps
) {
    /*
     * Ingredient stock must use an active
     * root unit according to backend rules.
     */
    const rootUnits =
        useMemo(
            () =>
                units.filter(
                    (
                        unit
                    ) =>
                        unit.is_root_unit
                        &&
                        unit.is_active
                ),
            [
                units,
            ]
        );

    const [
        name,
        setName,
    ] =
        useState(
            ingredient?.name
            ??
            ""
        );

    const [
        baseUnitId,
        setBaseUnitId,
    ] =
        useState(
            ingredient
                ?.base_unit
                ?.id
            ??
            rootUnits[0]?.id
            ??
            0
        );

    const [
        minimumStock,
        setMinimumStock,
    ] =
        useState(
            String(
                ingredient?.minimum_stock
                ??
                0
            )
        );

    const [
        storageLocation,
        setStorageLocation,
    ] =
        useState(
            ingredient?.storage_location
            ??
            ""
        );

    const [
        active,
        setActive,
    ] =
        useState(
            ingredient?.is_active
            ??
            true
        );

    const [
        localError,
        setLocalError,
    ] =
        useState(
            ""
        );

    const selectedUnit =
        rootUnits.find(
            (
                unit
            ) =>
                unit.id
                ===
                baseUnitId
        )
        ??
        null;

    const submit =
        async (
            event:
                FormEvent<HTMLFormElement>
        ): Promise<void> => {
            event.preventDefault();

            if (
                name.trim()
                ===
                ""
            ) {
                setLocalError(
                    "Ingredient name is required."
                );

                return;
            }

            if (
                baseUnitId <= 0
            ) {
                setLocalError(
                    "Select a base unit."
                );

                return;
            }

            const minimum =
                Number(
                    minimumStock
                );

            if (
                Number.isNaN(
                    minimum
                )
                ||
                minimum < 0
            ) {
                setLocalError(
                    "Minimum stock must be zero or greater."
                );

                return;
            }

            setLocalError(
                ""
            );

            await onSave({
                name:
                    name.trim(),

                base_unit_id:
                    baseUnitId,

                minimum_stock:
                    minimum,

                storage_location:
                    storageLocation
                        .trim()
                        ===
                        ""
                        ? null
                        : storageLocation.trim(),

                is_active:
                    active,
            });
        };

    return (
        <div
            className="ops-ingredient-modal-backdrop"
            role="presentation"
        >
            <form
                className="ops-ingredient-modal"
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
                <header className="ops-ingredient-modal-header">
                    <div>
                        <span>
                            INVENTORY INGREDIENT
                        </span>

                        <h3>
                            {
                                ingredient
                                    ? "Edit Ingredient"
                                    : "Create Ingredient"
                            }
                        </h3>

                        <p>
                            Configure the ingredient used by purchasing,
                            recipes and inventory tracking.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="ops-ingredient-modal-x"
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

                <div className="ops-ingredient-modal-content">
                    {
                        localError
                        &&
                        (
                            <div className="ops-ingredient-form-error">
                                {
                                    localError
                                }
                            </div>
                        )
                    }

                    {
                        ingredient
                        &&
                        (
                            <section className="ops-ingredient-readonly">
                                <div>
                                    <span>
                                        SKU
                                    </span>

                                    <strong>
                                        {
                                            ingredient.sku
                                            ??
                                            "Not assigned"
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Current Stock
                                    </span>

                                    <strong>
                                        {
                                            ingredient.current_stock
                                        }
                                        {" "}
                                        {
                                            ingredient
                                                .base_unit
                                                ?.symbol
                                            ??
                                            ""
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Average Cost
                                    </span>

                                    <strong>
                                        Rs.{" "}
                                        {
                                            ingredient
                                                .average_cost
                                                .toFixed(
                                                    2
                                                )
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Stock Value
                                    </span>

                                    <strong>
                                        Rs.{" "}
                                        {
                                            ingredient
                                                .stock_value
                                                .toFixed(
                                                    2
                                                )
                                        }
                                    </strong>
                                </div>
                            </section>
                        )
                    }

                    <section className="ops-ingredient-form-section">
                        <header>
                            <h4>
                                Ingredient Details
                            </h4>

                            <p>
                                SKU is created automatically by the server.
                            </p>
                        </header>

                        <div className="ops-ingredient-form-grid">
                            <label>
                                <span>
                                    Ingredient Name *
                                </span>

                                <input
                                    autoFocus
                                    required
                                    maxLength={
                                        190
                                    }
                                    value={
                                        name
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
                                    Base Unit *
                                </span>

                                <select
                                    required
                                    value={
                                        baseUnitId
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setBaseUnitId(
                                                Number(
                                                    event.target.value
                                                )
                                            )
                                    }
                                >
                                    {
                                        rootUnits.length
                                        ===
                                        0
                                        &&
                                        (
                                            <option value="0">
                                                No active root units available
                                            </option>
                                        )
                                    }

                                    {
                                        rootUnits.map(
                                            (
                                                unit
                                            ) => (
                                                <option
                                                    key={
                                                        unit.id
                                                    }
                                                    value={
                                                        unit.id
                                                    }
                                                >
                                                    {
                                                        unit.name
                                                    }
                                                    {" ("}
                                                    {
                                                        unit.symbol
                                                    }
                                                    {")"}
                                                </option>
                                            )
                                        )
                                    }
                                </select>

                                {
                                    selectedUnit
                                    &&
                                    (
                                        <small>
                                            {
                                                measurementLabel(
                                                    selectedUnit.measurement_type
                                                )
                                            }
                                            {" · "}
                                            root inventory unit
                                        </small>
                                    )
                                }
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
                                    value={
                                        minimumStock
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setMinimumStock(
                                                event.target.value
                                            )
                                    }
                                />

                                <small>
                                    {
                                        selectedUnit
                                            ?.symbol
                                        ??
                                        "base units"
                                    }
                                </small>
                            </label>

                            <label>
                                <span>
                                    Storage Location
                                </span>

                                <input
                                    maxLength={
                                        190
                                    }
                                    placeholder="Example: Dry Store Rack A"
                                    value={
                                        storageLocation
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setStorageLocation(
                                                event.target.value
                                            )
                                    }
                                />
                            </label>
                        </div>
                    </section>

                    <section className="ops-ingredient-form-section">
                        <header>
                            <h4>
                                Inventory Protection
                            </h4>

                            <p>
                                Stock quantities and costs are controlled by inventory transactions.
                            </p>
                        </header>

                        <div className="ops-ingredient-rule-box">
                            <strong>
                                Base Unit Rule
                            </strong>

                            <p>
                                Use the smallest/root physical stock unit,
                                such as G instead of KG or ML instead of L.
                            </p>

                            {
                                ingredient
                                &&
                                (
                                    <p>
                                        After this ingredient receives stock
                                        or any movement history, the base unit
                                        cannot be changed.
                                    </p>
                                )
                            }
                        </div>

                        <div className="ops-ingredient-rule-box">
                            <strong>
                                Stock Quantity
                            </strong>

                            <p>
                                Current stock and average cost cannot be manually
                                changed here. Purchases, recipes, wastage and
                                stock adjustments update them through the inventory ledger.
                            </p>
                        </div>
                    </section>

                    {
                        !ingredient
                        &&
                        (
                            <section className="ops-ingredient-form-section">
                                <header>
                                    <h4>
                                        Initial Status
                                    </h4>
                                </header>

                                <label className="ops-ingredient-toggle">
                                    <input
                                        type="checkbox"
                                        checked={
                                            active
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setActive(
                                                    event.target.checked
                                                )
                                        }
                                    />

                                    <span>
                                        Ingredient is active
                                    </span>
                                </label>
                            </section>
                        )
                    }
                </div>

                <footer className="ops-ingredient-modal-footer">
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
                            rootUnits.length
                            ===
                            0
                        }
                    >
                        {
                            busy
                                ? "Saving..."
                                : ingredient
                                    ? "Save Changes"
                                    : "Create Ingredient"
                        }
                    </button>
                </footer>
            </form>
        </div>
    );
}