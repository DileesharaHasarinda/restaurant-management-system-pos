import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    CreateWastagePayload,
    WastageIngredientOption,
    WastageReasonCatalog,
    WastageReasonCode,
    WastageUnitOption,
} from "./types";

interface WastageFormModalProps {
    ingredients:
    WastageIngredientOption[];

    units:
    WastageUnitOption[];

    reasonCodes:
    WastageReasonCatalog;

    onClose:
    () => void;

    onSubmit:
    (
        payload:
            CreateWastagePayload
    ) => Promise<void>;
}

function generateUuid():
    string {
    if (
        typeof crypto
        !== "undefined"
        &&
        typeof crypto.randomUUID
        === "function"
    ) {
        return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
        .replace(
            /[xy]/g,
            (
                character
            ) => {
                const random =
                    Math.floor(
                        Math.random()
                        * 16
                    );

                const value =
                    character
                        === "x"
                        ? random
                        : (
                            random
                            & 0x3
                        )
                        | 0x8;

                return value.toString(
                    16
                );
            }
        );
}

function nullableText(
    value: string
): string | null {
    const result =
        value.trim();

    return result
        ? result
        : null;
}

function toReasonCode(
    value: string
): WastageReasonCode | null {
    switch (
    value
    ) {
        case "EXPIRED":
            return "EXPIRED";

        case "SPOILED":
            return "SPOILED";

        case "DAMAGED":
            return "DAMAGED";

        case "COOKING_ERROR":
            return "COOKING_ERROR";

        case "DROPPED":
            return "DROPPED";

        case "OVERPRODUCTION":
            return "OVERPRODUCTION";

        case "STAFF_MEAL":
            return "STAFF_MEAL";

        case "OTHER":
            return "OTHER";

        default:
            return null;
    }
}

function errorMessage(
    error: unknown
): string {
    if (
        error instanceof Error
        &&
        error.message
    ) {
        return error.message;
    }

    return "Unable to record wastage.";
}

const DEFAULT_REASONS:
    WastageReasonCatalog = {
    EXPIRED:
        "Expired",

    SPOILED:
        "Spoiled",

    DAMAGED:
        "Damaged",

    COOKING_ERROR:
        "Cooking Error",

    DROPPED:
        "Dropped",

    OVERPRODUCTION:
        "Overproduction",

    STAFF_MEAL:
        "Staff Meal",

    OTHER:
        "Other",
};

function rootUnitId(
    unit:
        WastageUnitOption,
    units:
        WastageUnitOption[]
): number {
    let current =
        unit;

    const visited =
        new Set<number>();

    while (
        current.base_unit_id
        &&
        current.base_unit_id
        !== current.id
        &&
        !visited.has(
            current.id
        )
    ) {
        visited.add(
            current.id
        );

        const parent =
            units.find(
                (
                    candidate
                ) =>
                    candidate.id
                    === current.base_unit_id
            );

        if (
            !parent
        ) {
            return current.base_unit_id;
        }

        current =
            parent;
    }

    return current.id;
}

export default function WastageFormModal({
    ingredients,
    units,
    reasonCodes,
    onClose,
    onSubmit,
}: WastageFormModalProps) {
    const [
        ingredientId,
        setIngredientId,
    ] =
        useState(
            0
        );

    const [
        unitId,
        setUnitId,
    ] =
        useState(
            0
        );

    const [
        quantity,
        setQuantity,
    ] =
        useState(
            ""
        );

    const [
        reasonCode,
        setReasonCode,
    ] =
        useState<
            WastageReasonCode
            | null
        >(
            null
        );

    const [
        reason,
        setReason,
    ] =
        useState(
            ""
        );

    const [
        clientRequestId,
    ] =
        useState(
            () =>
                generateUuid()
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

    const selectedIngredient =
        useMemo(
            () =>
                ingredients.find(
                    (
                        ingredient
                    ) =>
                        ingredient.id
                        === ingredientId
                )
                ?? null,
            [
                ingredientId,
                ingredients,
            ]
        );

    const compatibleUnits =
        useMemo(
            () => {
                if (
                    !selectedIngredient
                    ||
                    !selectedIngredient.base_unit
                ) {
                    return [];
                }

                const ingredientRoot =
                    selectedIngredient
                        .base_unit
                        .id;

                return units.filter(
                    (
                        unit
                    ) =>
                        rootUnitId(
                            unit,
                            units
                        )
                        === ingredientRoot
                );
            },
            [
                selectedIngredient,
                units,
            ]
        );

    const reasons =
        Object.keys(
            reasonCodes
        ).length
            > 0
            ? reasonCodes
            : DEFAULT_REASONS;

    const submit =
        async (
            event:
                FormEvent
        ) => {
            event.preventDefault();

            if (
                busy
            ) {
                return;
            }

            setError(
                ""
            );

            if (
                !selectedIngredient
            ) {
                setError(
                    "Select an ingredient."
                );

                return;
            }

            if (
                unitId <= 0
            ) {
                setError(
                    "Select the wastage unit."
                );

                return;
            }

            const amountText =
                quantity.trim();

            if (
                !/^\d+(\.\d{1,4})?$/.test(
                    amountText
                )
            ) {
                setError(
                    "Quantity can contain up to four decimal places."
                );

                return;
            }

            const numericQuantity =
                Number(
                    amountText
                );

            if (
                !Number.isFinite(
                    numericQuantity
                )
                ||
                numericQuantity <= 0
            ) {
                setError(
                    "Wastage quantity must be greater than zero."
                );

                return;
            }

            if (
                !reasonCode
            ) {
                setError(
                    "Select a wastage reason."
                );

                return;
            }

            if (
                reason.length
                > 255
            ) {
                setError(
                    "Reason description cannot exceed 255 characters."
                );

                return;
            }

            if (
                reasonCode
                === "OTHER"
                &&
                !reason.trim()
            ) {
                setError(
                    "Enter a description for the Other wastage reason."
                );

                return;
            }

            setBusy(
                true
            );

            try {
                await onSubmit({
                    client_request_id:
                        clientRequestId,

                    ingredient_id:
                        selectedIngredient.id,

                    quantity:
                        numericQuantity,

                    unit_id:
                        unitId,

                    reason_code:
                        reasonCode,

                    reason:
                        nullableText(
                            reason
                        ),
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
        <div className="wastage-modal-backdrop">
            <div
                className="wastage-modal"
                role="dialog"
                aria-modal="true"
            >
                <div className="wastage-modal-header">
                    <div>
                        <div className="wastage-eyebrow">
                            Inventory Control
                        </div>

                        <h2>
                            Record Wastage
                        </h2>

                        <p>
                            Record ingredient loss and automatically
                            deduct the corresponding stock quantity.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="wastage-icon-button"
                        disabled={busy}
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <form
                    className="wastage-modal-body"
                    onSubmit={submit}
                >
                    {
                        error
                        && (
                            <div className="wastage-alert wastage-alert-error">
                                {error}
                            </div>
                        )
                    }

                    <div className="wastage-alert wastage-alert-warning">
                        Recording wastage immediately reduces
                        inventory stock. This transaction cannot
                        currently be edited or deleted.
                    </div>

                    <section className="wastage-form-grid">
                        <label className="wastage-field wastage-field-full">
                            <span>
                                Ingredient *
                            </span>

                            <select
                                value={ingredientId}
                                disabled={busy}
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setIngredientId(
                                            Number(
                                                event.target.value
                                            )
                                        );

                                        setUnitId(
                                            0
                                        );
                                    }
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
                                            >
                                                {
                                                    ingredient.sku
                                                        ? `${ingredient.sku} — `
                                                        : ""
                                                }

                                                {
                                                    ingredient.name
                                                }
                                            </option>
                                        )
                                    )
                                }
                            </select>
                        </label>

                        {
                            selectedIngredient
                            && (
                                <div className="wastage-stock-card wastage-field-full">
                                    <span>
                                        Current Stock
                                    </span>

                                    <strong>
                                        {
                                            selectedIngredient.current_stock
                                                .toLocaleString(
                                                    "en-LK",
                                                    {
                                                        maximumFractionDigits:
                                                            4,
                                                    }
                                                )
                                        }

                                        {" "}

                                        {
                                            selectedIngredient.base_unit?.symbol
                                            ?? ""
                                        }
                                    </strong>

                                    <small>
                                        Backend verifies available stock again
                                        when the wastage is submitted.
                                    </small>
                                </div>
                            )
                        }

                        <label className="wastage-field">
                            <span>
                                Quantity *
                            </span>

                            <input
                                type="number"
                                min="0.0001"
                                step="0.0001"
                                value={quantity}
                                disabled={busy}
                                placeholder="0"
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setQuantity(
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label className="wastage-field">
                            <span>
                                Unit *
                            </span>

                            <select
                                value={unitId}
                                disabled={
                                    busy
                                    ||
                                    !selectedIngredient
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setUnitId(
                                            Number(
                                                event.target.value
                                            )
                                        )
                                }
                            >
                                <option value={0}>
                                    Select unit
                                </option>

                                {
                                    compatibleUnits.map(
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

                                                {
                                                    unit.symbol
                                                        ? ` (${unit.symbol})`
                                                        : ""
                                                }
                                            </option>
                                        )
                                    )
                                }
                            </select>
                        </label>

                        <label className="wastage-field wastage-field-full">
                            <span>
                                Wastage Reason *
                            </span>

                            <select
                                value={
                                    reasonCode
                                    ?? ""
                                }
                                disabled={busy}
                                onChange={
                                    (
                                        event
                                    ) => {
                                        const next =
                                            toReasonCode(
                                                event.target.value
                                            );

                                        setReasonCode(
                                            next
                                        );

                                        if (
                                            next
                                            !== "OTHER"
                                        ) {
                                            setReason(
                                                ""
                                            );
                                        }
                                    }
                                }
                            >
                                <option value="">
                                    Select reason
                                </option>

                                {
                                    Object.entries(
                                        reasons
                                    ).map(
                                        ([
                                            code,
                                            label,
                                        ]) => (
                                            <option
                                                key={code}
                                                value={code}
                                            >
                                                {label}
                                            </option>
                                        )
                                    )
                                }
                            </select>
                        </label>

                        <label className="wastage-field wastage-field-full">
                            <span>
                                {
                                    reasonCode
                                        === "OTHER"
                                        ? "Reason Description *"
                                        : "Additional Description"
                                }
                            </span>

                            <textarea
                                rows={4}
                                maxLength={255}
                                value={reason}
                                disabled={busy}
                                placeholder={
                                    reasonCode
                                        === "OTHER"
                                        ? "Describe the wastage reason..."
                                        : "Optional additional information..."
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setReason(
                                            event.target.value
                                        )
                                }
                            />

                            <small>
                                {reason.length}/255
                            </small>
                        </label>
                    </section>

                    <div className="wastage-modal-actions">
                        <button
                            type="button"
                            className="wastage-button wastage-button-secondary"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="wastage-button wastage-button-primary"
                            disabled={busy}
                        >
                            {
                                busy
                                    ? "Recording..."
                                    : "Record Wastage"
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}