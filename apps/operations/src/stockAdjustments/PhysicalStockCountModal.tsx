import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    PhysicalStockCountPayload,
    StockAdjustmentIngredientOption,
    StockAdjustmentUnitOption,
} from "./types";

interface PhysicalStockCountModalProps {
    ingredients: StockAdjustmentIngredientOption[];
    units: StockAdjustmentUnitOption[];
    onClose: () => void;
    onSubmit: (
        ingredientId: number,
        payload: PhysicalStockCountPayload,
    ) => Promise<void>;
}

/*
|--------------------------------------------------------------------------
| UUID
|--------------------------------------------------------------------------
*/

function generateUuid(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (character) => {
            const random = Math.floor(Math.random() * 16);
            const value =
                character === "x"
                    ? random
                    : (random & 0x3) | 0x8;

            return value.toString(16);
        },
    );
}

/*
|--------------------------------------------------------------------------
| Error
|--------------------------------------------------------------------------
*/

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Unable to record the physical stock count.";
}

/*
|--------------------------------------------------------------------------
| Root Unit
|--------------------------------------------------------------------------
*/

function rootUnitId(
    unit: StockAdjustmentUnitOption,
    units: StockAdjustmentUnitOption[],
): number {
    let current = unit;

    const visited = new Set<number>();

    while (
        current.base_unit_id &&
        current.base_unit_id !== current.id &&
        !visited.has(current.id)
    ) {
        visited.add(current.id);

        const parent = units.find(
            (candidate) =>
                candidate.id === current.base_unit_id,
        );

        if (!parent) {
            return current.base_unit_id;
        }

        current = parent;
    }

    return current.id;
}

/*
|--------------------------------------------------------------------------
| Quantity
|--------------------------------------------------------------------------
*/

function quantityText(value: number): string {
    return value.toLocaleString(
        "en-LK",
        {
            maximumFractionDigits: 4,
        },
    );
}

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function PhysicalStockCountModal({
    ingredients,
    units,
    onClose,
    onSubmit,
}: PhysicalStockCountModalProps) {
    const [ingredientId, setIngredientId] = useState(0);
    const [unitId, setUnitId] = useState(0);
    const [actualQuantity, setActualQuantity] = useState("");
    const [reason, setReason] = useState("");

    const [clientRequestId] = useState(() =>
        generateUuid(),
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    /*
    |--------------------------------------------------------------------------
    | Selected Ingredient
    |--------------------------------------------------------------------------
    */

    const selectedIngredient = useMemo(
        () =>
            ingredients.find(
                (ingredient) =>
                    ingredient.id === ingredientId,
            ) ?? null,
        [ingredientId, ingredients],
    );

    /*
    |--------------------------------------------------------------------------
    | Compatible Units
    |--------------------------------------------------------------------------
    */

    const compatibleUnits = useMemo(() => {
        if (
            !selectedIngredient ||
            !selectedIngredient.base_unit
        ) {
            return [];
        }

        const baseUnitId =
            selectedIngredient.base_unit.id;

        return units.filter(
            (unit) =>
                rootUnitId(unit, units) === baseUnitId,
        );
    }, [selectedIngredient, units]);

    /*
    |--------------------------------------------------------------------------
    | Submit
    |--------------------------------------------------------------------------
    */

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (busy) {
            return;
        }

        setError("");

        if (!selectedIngredient) {
            setError("Select an ingredient.");
            return;
        }

        if (unitId <= 0) {
            setError("Select the physical count unit.");
            return;
        }

        const quantityTextValue = actualQuantity.trim();

        if (!/^\d+(\.\d{1,4})?$/.test(quantityTextValue)) {
            setError(
                "Actual quantity must contain no more than four decimal places.",
            );

            return;
        }

        const numericQuantity = Number(quantityTextValue);

        if (
            !Number.isFinite(numericQuantity) ||
            numericQuantity < 0
        ) {
            setError(
                "Actual stock quantity cannot be negative.",
            );

            return;
        }

        const cleanedReason = reason.trim();

        if (cleanedReason.length < 3) {
            setError(
                "Enter a clear reason containing at least 3 characters.",
            );

            return;
        }

        if (cleanedReason.length > 255) {
            setError("Reason cannot exceed 255 characters.");
            return;
        }

        setBusy(true);

        try {
            await onSubmit(
                selectedIngredient.id,
                {
                    client_request_id: clientRequestId,
                    unit_id: unitId,
                    actual_quantity: numericQuantity,
                    reason: cleanedReason,
                },
            );
        } catch (caught) {
            setError(errorMessage(caught));

            /*
             * Keep UUID unchanged.
             * Retry remains idempotent.
             */
            setBusy(false);
        }
    };

    return (
        <div className="stock-adjustments-modal-backdrop">
            <div
                className="stock-adjustments-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Physical stock count"
            >
                <div className="stock-adjustments-modal-header">
                    <div>
                        <div className="stock-adjustments-eyebrow">
                            Inventory Control
                        </div>

                        <h2>Physical Stock Count</h2>

                        <p>
                            Enter the quantity physically
                            available. The system calculates
                            the required adjustment
                            automatically.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="stock-adjustments-icon-button"
                        disabled={busy}
                        onClick={onClose}
                        aria-label="Close physical stock count"
                    >
                        ×
                    </button>
                </div>

                <form
                    className="stock-adjustments-modal-body"
                    onSubmit={submit}
                >
                    {error && (
                        <div
                            className="stock-adjustments-alert stock-adjustments-alert-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <div className="stock-adjustments-alert stock-adjustments-alert-warning">
                        <strong>Important</strong>

                        <br />

                        Enter the actual quantity you
                        physically counted — not the amount
                        you want to add or remove.
                    </div>

                    <div className="stock-adjustments-example">
                        <strong>Example</strong>

                        <span>
                            System has 10 KG and you
                            physically count 8 KG → system
                            automatically posts a 2 KG OUT
                            adjustment.
                        </span>
                    </div>

                    <section className="stock-adjustments-form-grid">
                        <label className="stock-adjustments-field stock-adjustments-field-full">
                            <span>Ingredient *</span>

                            <select
                                value={ingredientId}
                                disabled={busy}
                                onChange={(event) => {
                                    setIngredientId(
                                        Number(
                                            event.target.value,
                                        ),
                                    );

                                    setUnitId(0);
                                    setActualQuantity("");
                                }}
                            >
                                <option value={0}>
                                    Select ingredient
                                </option>

                                {ingredients.map((ingredient) => (
                                    <option
                                        key={ingredient.id}
                                        value={ingredient.id}
                                    >
                                        {ingredient.sku
                                            ? `${ingredient.sku} — `
                                            : ""}
                                        {ingredient.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {selectedIngredient && (
                            <div className="stock-adjustments-current-stock stock-adjustments-field-full">
                                <div>
                                    <span>System Stock</span>

                                    <strong>
                                        {quantityText(
                                            selectedIngredient
                                                .current_stock,
                                        )}{" "}
                                        {selectedIngredient
                                            .base_unit?.symbol ??
                                            ""}
                                    </strong>
                                </div>

                                <small>
                                    This is for reference only.
                                    Laravel locks the ingredient
                                    and reads the latest stock
                                    again when you submit.
                                </small>
                            </div>
                        )}

                        <label className="stock-adjustments-field">
                            <span>
                                Physical Count Unit *
                            </span>

                            <select
                                value={unitId}
                                disabled={
                                    busy ||
                                    !selectedIngredient
                                }
                                onChange={(event) =>
                                    setUnitId(
                                        Number(
                                            event.target.value,
                                        ),
                                    )
                                }
                            >
                                <option value={0}>
                                    Select unit
                                </option>

                                {compatibleUnits.map((unit) => (
                                    <option
                                        key={unit.id}
                                        value={unit.id}
                                    >
                                        {unit.name}
                                        {unit.symbol
                                            ? ` (${unit.symbol})`
                                            : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="stock-adjustments-field">
                            <span>
                                Actual Physical Quantity *
                            </span>

                            <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={actualQuantity}
                                disabled={
                                    busy ||
                                    !selectedIngredient
                                }
                                placeholder="0"
                                onChange={(event) =>
                                    setActualQuantity(
                                        event.target.value,
                                    )
                                }
                            />

                            <small>
                                Zero is allowed when no
                                physical stock remains.
                            </small>
                        </label>

                        <label className="stock-adjustments-field stock-adjustments-field-full">
                            <span>Reason *</span>

                            <textarea
                                rows={4}
                                maxLength={255}
                                value={reason}
                                disabled={busy}
                                placeholder="Example: Physical monthly stock count..."
                                onChange={(event) =>
                                    setReason(
                                        event.target.value,
                                    )
                                }
                            />

                            <small>
                                {reason.length}/255
                            </small>
                        </label>
                    </section>

                    <div className="stock-adjustments-modal-actions">
                        <button
                            type="button"
                            className="stock-adjustments-button stock-adjustments-button-secondary"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="stock-adjustments-button stock-adjustments-button-primary"
                            disabled={busy}
                        >
                            {busy
                                ? "Posting Count..."
                                : "Post Physical Count"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}