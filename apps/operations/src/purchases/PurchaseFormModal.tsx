import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    Purchase,
    PurchaseIngredientOption,
    PurchaseLinePayload,
    PurchasePayload,
    PurchaseUnitOption,
} from "./types";

import type {
    Supplier,
} from "../suppliers/types";

interface PurchaseFormModalProps {
    purchase: Purchase | null;

    suppliers: Supplier[];

    ingredients:
    PurchaseIngredientOption[];

    units:
    PurchaseUnitOption[];

    onClose: () => void;

    onSubmit: (
        payload: PurchasePayload
    ) => Promise<void>;
}

interface EditableLine {
    key: number;

    ingredientId: number;

    unitId: number;

    quantity: string;

    unitCost: string;
}

let nextLineKey =
    1;

function newLine(): EditableLine {
    return {
        key:
            nextLineKey++,

        ingredientId:
            0,

        unitId:
            0,

        quantity:
            "1",

        unitCost:
            "0",
    };
}

function lineFromPurchaseItem(
    item: Purchase["items"][number]
): EditableLine {
    return {
        key:
            nextLineKey++,

        ingredientId:
            item.ingredient?.id
            ?? 0,

        unitId:
            item.purchase_unit?.id
            ?? 0,

        quantity:
            String(
                item.quantity
            ),

        unitCost:
            String(
                item.unit_cost
            ),
    };
}

function nullableText(
    value: string
): string | null {
    const clean =
        value.trim();

    return clean
        ? clean
        : null;
}

function todayInputValue():
    string {
    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-${day}`;
}

function errorMessage(
    error: unknown
): string {
    if (
        error instanceof Error
        && error.message
    ) {
        return error.message;
    }

    return "The purchase could not be saved.";
}

function rootUnitId(
    unit: PurchaseUnitOption,
    units: PurchaseUnitOption[]
): number {
    let current =
        unit;

    const visited =
        new Set<number>();

    while (
        current.base_unit_id !== null
    ) {
        if (
            visited.has(
                current.id
            )
        ) {
            break;
        }

        visited.add(
            current.id
        );

        const parent =
            units.find(
                (candidate) =>
                    candidate.id
                    === current.base_unit_id
            );

        if (!parent) {
            return current.base_unit_id;
        }

        current =
            parent;
    }

    return current.id;
}

const money =
    new Intl.NumberFormat(
        "en-LK",
        {
            style:
                "currency",

            currency:
                "LKR",

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2,
        }
    );

export default function PurchaseFormModal({
    purchase,
    suppliers,
    ingredients,
    units,
    onClose,
    onSubmit,
}: PurchaseFormModalProps) {
    const isEditing =
        purchase !== null;

    const [
        supplierId,
        setSupplierId,
    ] =
        useState(
            purchase?.supplier?.id
            ?? suppliers[0]?.id
            ?? 0
        );

    const [
        purchaseDate,
        setPurchaseDate,
    ] =
        useState(
            purchase?.purchase_date
            ?? todayInputValue()
        );

    const [
        supplierInvoice,
        setSupplierInvoice,
    ] =
        useState(
            purchase
                ?.supplier_invoice_number
            ?? ""
        );

    const [
        notes,
        setNotes,
    ] =
        useState(
            purchase?.notes
            ?? ""
        );

    const [
        lines,
        setLines,
    ] =
        useState<EditableLine[]>(
            purchase
                && purchase.items.length > 0
                ? purchase.items.map(
                    lineFromPurchaseItem
                )
                : [
                    newLine(),
                ]
        );

    const [
        busy,
        setBusy,
    ] =
        useState(
            false
        );

    const [
        error,
        setError,
    ] =
        useState(
            ""
        );

    const estimatedTotal =
        useMemo(
            () =>
                lines.reduce(
                    (
                        total,
                        line
                    ) => {
                        const quantity =
                            Number(
                                line.quantity
                            );

                        const unitCost =
                            Number(
                                line.unitCost
                            );

                        if (
                            !Number.isFinite(
                                quantity
                            )
                            || !Number.isFinite(
                                unitCost
                            )
                        ) {
                            return total;
                        }

                        return (
                            total
                            + quantity
                            * unitCost
                        );
                    },
                    0
                ),
            [
                lines,
            ]
        );

    const updateLine =
        (
            key: number,
            updates:
                Partial<EditableLine>
        ) => {
            setLines(
                (
                    current
                ) =>
                    current.map(
                        (line) =>
                            line.key === key
                                ? {
                                    ...line,
                                    ...updates,
                                }
                                : line
                    )
            );
        };

    const ingredientChanged =
        (
            line: EditableLine,
            ingredientId: number
        ) => {
            const ingredient =
                ingredients.find(
                    (item) =>
                        item.id
                        === ingredientId
                );

            updateLine(
                line.key,
                {
                    ingredientId,

                    unitId:
                        ingredient
                            ?.base_unit
                            ?.id
                        ?? 0,
                }
            );
        };

    const compatibleUnits =
        (
            ingredientId: number
        ) => {
            const ingredient =
                ingredients.find(
                    (candidate) =>
                        candidate.id
                        === ingredientId
                );

            const rootId =
                ingredient
                    ?.base_unit
                    ?.id;

            if (!rootId) {
                return [];
            }

            return units.filter(
                (unit) =>
                    rootUnitId(
                        unit,
                        units
                    ) === rootId
            );
        };

    const addLine =
        () => {
            if (
                lines.length >= 200
            ) {
                setError(
                    "A purchase cannot contain more than 200 items."
                );

                return;
            }

            setLines(
                (
                    current
                ) => [
                        ...current,
                        newLine(),
                    ]
            );
        };

    const removeLine =
        (
            key: number
        ) => {
            if (
                lines.length <= 1
            ) {
                return;
            }

            setLines(
                (
                    current
                ) =>
                    current.filter(
                        (line) =>
                            line.key !== key
                    )
            );
        };

    const submit =
        async (
            event: FormEvent
        ) => {
            event.preventDefault();

            if (busy) {
                return;
            }

            setError(
                ""
            );

            if (
                supplierId <= 0
            ) {
                setError(
                    "Select a supplier."
                );

                return;
            }

            if (!purchaseDate) {
                setError(
                    "Purchase date is required."
                );

                return;
            }

            if (
                supplierInvoice.length
                > 100
            ) {
                setError(
                    "Supplier invoice number cannot exceed 100 characters."
                );

                return;
            }

            if (
                notes.length > 2000
            ) {
                setError(
                    "Notes cannot exceed 2000 characters."
                );

                return;
            }

            if (
                lines.length === 0
            ) {
                setError(
                    "Add at least one purchase item."
                );

                return;
            }

            const ingredientIds =
                lines.map(
                    (line) =>
                        line.ingredientId
                );

            if (
                ingredientIds.some(
                    (id) =>
                        id <= 0
                )
            ) {
                setError(
                    "Select an ingredient for every line."
                );

                return;
            }

            if (
                new Set(
                    ingredientIds
                ).size
                !== ingredientIds.length
            ) {
                setError(
                    "The same ingredient cannot appear more than once in a purchase."
                );

                return;
            }

            const payloadLines:
                PurchaseLinePayload[] = [];

            for (
                const line
                of lines
            ) {
                if (
                    line.unitId <= 0
                ) {
                    setError(
                        "Select a purchase unit for every item."
                    );

                    return;
                }

                const quantity =
                    Number(
                        line.quantity
                    );

                const unitCost =
                    Number(
                        line.unitCost
                    );

                if (
                    !Number.isFinite(
                        quantity
                    )
                    || quantity <= 0
                ) {
                    setError(
                        "Every quantity must be greater than zero."
                    );

                    return;
                }

                if (
                    !Number.isFinite(
                        unitCost
                    )
                    || unitCost < 0
                ) {
                    setError(
                        "Unit cost cannot be negative."
                    );

                    return;
                }

                payloadLines.push({
                    ingredient_id:
                        line.ingredientId,

                    unit_id:
                        line.unitId,

                    quantity,

                    unit_cost:
                        unitCost,
                });
            }

            setBusy(
                true
            );

            try {
                await onSubmit({
                    supplier_id:
                        supplierId,

                    purchase_date:
                        purchaseDate,

                    supplier_invoice_number:
                        nullableText(
                            supplierInvoice
                        ),

                    notes:
                        nullableText(
                            notes
                        ),

                    items:
                        payloadLines,
                });
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );

                setBusy(
                    false
                );
            }
        };

    return (
        <div className="purchases-modal-backdrop">
            <div
                className="purchases-modal purchases-editor-modal"
                role="dialog"
                aria-modal="true"
            >
                <div className="purchases-modal-header">
                    <div>
                        <div className="purchases-eyebrow">
                            Purchasing
                        </div>

                        <h2>
                            {
                                isEditing
                                    ? `Edit ${purchase.purchase_number}`
                                    : "New Purchase"
                            }
                        </h2>

                        <p>
                            Save supplier purchases as drafts before receiving
                            inventory.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="purchases-icon-button"
                        onClick={onClose}
                        disabled={busy}
                    >
                        ×
                    </button>
                </div>

                <form
                    className="purchases-modal-body"
                    onSubmit={submit}
                >
                    {
                        error
                        && (
                            <div className="purchases-alert purchases-alert-error">
                                {error}
                            </div>
                        )
                    }

                    <div className="purchases-alert purchases-alert-info">
                        Saving or editing a draft does not change inventory.
                        Stock and supplier liability are updated only when the
                        purchase is completed.
                    </div>

                    <section className="purchases-form-grid">
                        <label className="purchases-field">
                            <span>
                                Supplier *
                            </span>

                            <select
                                value={supplierId}
                                disabled={busy}
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setSupplierId(
                                            Number(
                                                event.target.value
                                            )
                                        )
                                }
                            >
                                <option value={0}>
                                    Select supplier
                                </option>

                                {
                                    suppliers.map(
                                        (
                                            supplier
                                        ) => (
                                            <option
                                                key={supplier.id}
                                                value={supplier.id}
                                            >
                                                {
                                                    supplier.supplier_code
                                                }
                                                {" — "}
                                                {
                                                    supplier.name
                                                }
                                            </option>
                                        )
                                    )
                                }
                            </select>
                        </label>

                        <label className="purchases-field">
                            <span>
                                Purchase Date *
                            </span>

                            <input
                                type="date"
                                value={purchaseDate}
                                disabled={busy}
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setPurchaseDate(
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label className="purchases-field purchases-field-full">
                            <span>
                                Supplier Invoice Number
                            </span>

                            <input
                                type="text"
                                value={supplierInvoice}
                                maxLength={100}
                                disabled={busy}
                                placeholder="Optional supplier invoice/reference"
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setSupplierInvoice(
                                            event.target.value
                                        )
                                }
                            />
                        </label>
                    </section>

                    <section className="purchases-items-section">
                        <div className="purchases-section-heading">
                            <div>
                                <h3>
                                    Purchase Items
                                </h3>

                                <p>
                                    Cost is entered per selected purchase unit.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="purchases-button purchases-button-secondary"
                                onClick={addLine}
                                disabled={
                                    busy
                                    || lines.length >= 200
                                }
                            >
                                + Add Item
                            </button>
                        </div>

                        <div className="purchases-editor-table-wrap">
                            <table className="purchases-editor-table">
                                <thead>
                                    <tr>
                                        <th>
                                            Ingredient
                                        </th>

                                        <th>
                                            Unit
                                        </th>

                                        <th>
                                            Quantity
                                        </th>

                                        <th>
                                            Unit Cost
                                        </th>

                                        <th>
                                            Line Total
                                        </th>

                                        <th />
                                    </tr>
                                </thead>

                                <tbody>
                                    {
                                        lines.map(
                                            (
                                                line
                                            ) => {
                                                const lineUnits =
                                                    compatibleUnits(
                                                        line.ingredientId
                                                    );

                                                const quantity =
                                                    Number(
                                                        line.quantity
                                                    );

                                                const unitCost =
                                                    Number(
                                                        line.unitCost
                                                    );

                                                const lineTotal =
                                                    (
                                                        Number.isFinite(
                                                            quantity
                                                        )
                                                        && Number.isFinite(
                                                            unitCost
                                                        )
                                                    )
                                                        ? quantity
                                                        * unitCost
                                                        : 0;

                                                return (
                                                    <tr
                                                        key={line.key}
                                                    >
                                                        <td>
                                                            <select
                                                                value={line.ingredientId}
                                                                disabled={busy}
                                                                onChange={
                                                                    (
                                                                        event
                                                                    ) =>
                                                                        ingredientChanged(
                                                                            line,
                                                                            Number(
                                                                                event.target.value
                                                                            )
                                                                        )
                                                                }
                                                            >
                                                                <option value={0}>
                                                                    Select ingredient
                                                                </option>

                                                                {
                                                                    ingredients.map(
                                                                        (
                                                                            ingredient
                                                                        ) => (
                                                                            <option
                                                                                key={ingredient.id}
                                                                                value={ingredient.id}
                                                                                disabled={
                                                                                    lines.some(
                                                                                        (
                                                                                            other
                                                                                        ) =>
                                                                                            other.key
                                                                                            !== line.key
                                                                                            && other.ingredientId
                                                                                            === ingredient.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                {
                                                                                    ingredient.sku
                                                                                    ?? `#${ingredient.id}`
                                                                                }
                                                                                {" — "}
                                                                                {
                                                                                    ingredient.name
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )
                                                                }
                                                            </select>
                                                        </td>

                                                        <td>
                                                            <select
                                                                value={line.unitId}
                                                                disabled={
                                                                    busy
                                                                    || line.ingredientId <= 0
                                                                }
                                                                onChange={
                                                                    (
                                                                        event
                                                                    ) =>
                                                                        updateLine(
                                                                            line.key,
                                                                            {
                                                                                unitId:
                                                                                    Number(
                                                                                        event.target.value
                                                                                    ),
                                                                            }
                                                                        )
                                                                }
                                                            >
                                                                <option value={0}>
                                                                    Select unit
                                                                </option>

                                                                {
                                                                    lineUnits.map(
                                                                        (
                                                                            unit
                                                                        ) => (
                                                                            <option
                                                                                key={unit.id}
                                                                                value={unit.id}
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
                                                        </td>

                                                        <td>
                                                            <input
                                                                type="number"
                                                                min="0.0001"
                                                                step="0.0001"
                                                                value={line.quantity}
                                                                disabled={busy}
                                                                onChange={
                                                                    (
                                                                        event
                                                                    ) =>
                                                                        updateLine(
                                                                            line.key,
                                                                            {
                                                                                quantity:
                                                                                    event.target.value,
                                                                            }
                                                                        )
                                                                }
                                                            />
                                                        </td>

                                                        <td>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.0001"
                                                                value={line.unitCost}
                                                                disabled={busy}
                                                                onChange={
                                                                    (
                                                                        event
                                                                    ) =>
                                                                        updateLine(
                                                                            line.key,
                                                                            {
                                                                                unitCost:
                                                                                    event.target.value,
                                                                            }
                                                                        )
                                                                }
                                                            />
                                                        </td>

                                                        <td className="purchases-money-cell">
                                                            {
                                                                money.format(
                                                                    lineTotal
                                                                )
                                                            }
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="purchases-remove-button"
                                                                disabled={
                                                                    busy
                                                                    || lines.length <= 1
                                                                }
                                                                onClick={
                                                                    () =>
                                                                        removeLine(
                                                                            line.key
                                                                        )
                                                                }
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )
                                    }
                                </tbody>
                            </table>
                        </div>

                        <div className="purchases-estimated-total">
                            <span>
                                Draft Total
                            </span>

                            <strong>
                                {
                                    money.format(
                                        estimatedTotal
                                    )
                                }
                            </strong>

                            <small>
                                Laravel recalculates and stores the authoritative
                                total when the draft is saved.
                            </small>
                        </div>
                    </section>

                    <label className="purchases-field">
                        <span>
                            Notes
                        </span>

                        <textarea
                            value={notes}
                            rows={4}
                            maxLength={2000}
                            disabled={busy}
                            placeholder="Optional internal purchasing notes..."
                            onChange={
                                (
                                    event
                                ) =>
                                    setNotes(
                                        event.target.value
                                    )
                            }
                        />

                        <small>
                            {notes.length}/2000
                        </small>
                    </label>

                    <div className="purchases-modal-actions">
                        <button
                            type="button"
                            className="purchases-button purchases-button-secondary"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="purchases-button purchases-button-primary"
                            disabled={busy}
                        >
                            {
                                busy
                                    ? "Saving..."
                                    : isEditing
                                        ? "Save Draft Changes"
                                        : "Create Draft"
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}