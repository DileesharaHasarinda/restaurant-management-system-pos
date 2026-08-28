import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    Purchase,
} from "../purchases/types";

import type {
    SupplierPaymentLinePayload,
    SupplierPaymentMethod,
    SupplierPaymentPayload,
} from "./types";

interface SupplierPaymentModalProps {
    purchases: Purchase[];

    allowCash: boolean;

    onClose: () => void;

    onSubmit: (
        purchaseId: number,
        payload: SupplierPaymentPayload
    ) => Promise<void>;
}

interface EditablePaymentLine {
    key: number;

    paymentMethod:
    SupplierPaymentMethod;

    amount: string;

    reference: string;

    notes: string;
}

const PAYMENT_METHODS:
    Array<{
        value: SupplierPaymentMethod;
        label: string;
    }> = [
        {
            value: "CASH",
            label: "Cash",
        },

        {
            value: "CARD",
            label: "Card",
        },

        {
            value: "BANK_TRANSFER",
            label: "Bank Transfer",
        },

        {
            value: "CHEQUE",
            label: "Cheque",
        },

        {
            value: "OTHER",
            label: "Other",
        },
    ];

let nextLineKey =
    1;

function createLine():
    EditablePaymentLine {
    return {
        key:
            nextLineKey++,

        paymentMethod:
            "BANK_TRANSFER",

        amount:
            "",

        reference:
            "",

        notes:
            "",
    };
}

function toSupplierPaymentMethod(
    value: string
): SupplierPaymentMethod {
    switch (
    value
    ) {
        case "CASH":
            return "CASH";

        case "CARD":
            return "CARD";

        case "BANK_TRANSFER":
            return "BANK_TRANSFER";

        case "CHEQUE":
            return "CHEQUE";

        case "OTHER":
            return "OTHER";

        default:
            return "OTHER";
    }
}

function nullableText(
    value: string
): string | null {
    const cleaned =
        value.trim();

    return cleaned
        ? cleaned
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
            date.getMonth()
            + 1
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

function generateUuid():
    string {
    if (
        typeof crypto !== "undefined"
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
                    character === "x"
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

    return "The supplier payment could not be recorded.";
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

export default function SupplierPaymentModal({
    purchases,
    allowCash,
    onClose,
    onSubmit,
}: SupplierPaymentModalProps) {
    const [
        purchaseId,
        setPurchaseId,
    ] =
        useState(
            0
        );

    const [
        paymentDate,
        setPaymentDate,
    ] =
        useState(
            todayInputValue()
        );

    const [
        notes,
        setNotes,
    ] =
        useState(
            ""
        );

    const [
        paymentLines,
        setPaymentLines,
    ] =
        useState<
            EditablePaymentLine[]
        >(
            [
                createLine(),
            ]
        );

    const [
        idempotencyKey,
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

    const availablePaymentMethods =
        useMemo(
            () =>
                allowCash
                    ? PAYMENT_METHODS
                    : PAYMENT_METHODS.filter(
                        (
                            method
                        ) =>
                            method.value
                            !== "CASH"
                    ),
            [
                allowCash,
            ]
        );

    const selectedPurchase =
        useMemo(
            () =>
                purchases.find(
                    (
                        purchase
                    ) =>
                        purchase.id
                        === purchaseId
                )
                ?? null,
            [
                purchases,
                purchaseId,
            ]
        );

    const paymentTotal =
        useMemo(
            () =>
                paymentLines.reduce(
                    (
                        total,
                        payment
                    ) => {
                        const amount =
                            Number(
                                payment.amount
                            );

                        if (
                            !Number.isFinite(
                                amount
                            )
                        ) {
                            return total;
                        }

                        return total
                            + amount;
                    },
                    0
                ),
            [
                paymentLines,
            ]
        );

    const cashAmount =
        useMemo(
            () =>
                paymentLines.reduce(
                    (
                        total,
                        payment
                    ) => {
                        if (
                            payment.paymentMethod
                            !== "CASH"
                        ) {
                            return total;
                        }

                        const amount =
                            Number(
                                payment.amount
                            );

                        if (
                            !Number.isFinite(
                                amount
                            )
                        ) {
                            return total;
                        }

                        return total
                            + amount;
                    },
                    0
                ),
            [
                paymentLines,
            ]
        );

    const remainingAfterPayment =
        selectedPurchase
            ? Math.max(
                0,

                selectedPurchase.balance_due
                -
                paymentTotal
            )
            : 0;

    const updateLine =
        (
            key: number,
            updates:
                Partial<EditablePaymentLine>
        ) => {
            setPaymentLines(
                (
                    current
                ) =>
                    current.map(
                        (
                            line
                        ) =>
                            line.key === key
                                ? {
                                    ...line,
                                    ...updates,
                                }
                                : line
                    )
            );
        };

    const addLine =
        () => {
            if (
                paymentLines.length
                >= 10
            ) {
                setError(
                    "A payment batch cannot contain more than 10 payment methods."
                );

                return;
            }

            setPaymentLines(
                (
                    current
                ) => [
                        ...current,

                        createLine(),
                    ]
            );
        };

    const removeLine =
        (
            key: number
        ) => {
            if (
                paymentLines.length
                <= 1
            ) {
                return;
            }

            setPaymentLines(
                (
                    current
                ) =>
                    current.filter(
                        (
                            line
                        ) =>
                            line.key
                            !== key
                    )
            );
        };

    const payFullRemaining =
        () => {
            if (
                !selectedPurchase
            ) {
                return;
            }

            setPaymentLines(
                (
                    current
                ) =>
                    current.map(
                        (
                            line,
                            index
                        ) =>
                            index === 0
                                ? {
                                    ...line,

                                    amount:
                                        String(
                                            selectedPurchase.balance_due
                                        ),
                                }
                                : {
                                    ...line,

                                    amount:
                                        "",
                                }
                    )
            );
        };

    const submit =
        async (
            event: FormEvent
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
                !selectedPurchase
            ) {
                setError(
                    "Select an outstanding purchase."
                );

                return;
            }

            if (
                selectedPurchase.status
                !== "COMPLETED"
            ) {
                setError(
                    "Supplier payments can only be recorded against completed purchases."
                );

                return;
            }

            if (
                selectedPurchase.balance_due
                <= 0
            ) {
                setError(
                    "This purchase is already fully paid."
                );

                return;
            }

            if (
                !paymentDate
            ) {
                setError(
                    "Payment date is required."
                );

                return;
            }

            if (
                notes.length
                > 2000
            ) {
                setError(
                    "Payment notes cannot exceed 2000 characters."
                );

                return;
            }

            const payloadLines:
                SupplierPaymentLinePayload[] = [];

            for (
                const line
                of paymentLines
            ) {
                if (
                    line.paymentMethod
                    === "CASH"
                    &&
                    !allowCash
                ) {
                    setError(
                        "Cash supplier payments must be recorded by the local cashier."
                    );

                    return;
                }

                const amountText =
                    line.amount.trim();

                if (
                    !/^\d+(\.\d{1,2})?$/.test(
                        amountText
                    )
                ) {
                    setError(
                        "Every payment amount must contain no more than two decimal places."
                    );

                    return;
                }

                const amount =
                    Number(
                        amountText
                    );

                if (
                    !Number.isFinite(
                        amount
                    )
                    ||
                    amount <= 0
                ) {
                    setError(
                        "Every payment amount must be greater than zero."
                    );

                    return;
                }

                if (
                    line.paymentMethod
                    === "CHEQUE"
                    &&
                    !line.reference.trim()
                ) {
                    setError(
                        "A cheque number/reference is required for cheque payments."
                    );

                    return;
                }

                payloadLines.push({
                    payment_method:
                        line.paymentMethod,

                    amount,

                    reference:
                        nullableText(
                            line.reference
                        ),

                    notes:
                        nullableText(
                            line.notes
                        ),
                });
            }

            const total =
                payloadLines.reduce(
                    (
                        current,
                        line
                    ) =>
                        current
                        + line.amount,
                    0
                );

            if (
                total
                >
                selectedPurchase.balance_due
                + 0.001
            ) {
                setError(
                    `Payment total ${money.format(total)} exceeds the outstanding balance ${money.format(selectedPurchase.balance_due)}.`
                );

                return;
            }

            setBusy(
                true
            );

            try {
                await onSubmit(
                    selectedPurchase.id,

                    {
                        idempotency_key:
                            idempotencyKey,

                        payment_date:
                            paymentDate,

                        notes:
                            nullableText(
                                notes
                            ),

                        payments:
                            payloadLines,
                    }
                );
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
        <div className="supplier-payments-modal-backdrop">
            <div
                className="supplier-payments-modal supplier-payments-editor-modal"
                role="dialog"
                aria-modal="true"
            >
                <div className="supplier-payments-modal-header">
                    <div>
                        <div className="supplier-payments-eyebrow">
                            Accounts Payable
                        </div>

                        <h2>
                            Record Supplier Payment
                        </h2>

                        <p>
                            Record a partial, full or split payment
                            against a completed purchase.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="supplier-payments-icon-button"
                        disabled={busy}
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <form
                    className="supplier-payments-modal-body"
                    onSubmit={submit}
                >
                    {
                        error
                        && (
                            <div className="supplier-payments-alert supplier-payments-alert-error">
                                {error}
                            </div>
                        )
                    }

                    {
                        !allowCash
                        && (
                            <div className="supplier-payments-alert supplier-payments-alert-info">
                                <strong>
                                    Remote management payment
                                </strong>

                                <br />

                                Cash payments must be recorded by the
                                local cashier. You can record Bank
                                Transfer, Card, Cheque or Other
                                payments here.
                            </div>
                        )
                    }

                    <section className="supplier-payments-form-grid">
                        <label className="supplier-payments-field supplier-payments-field-full">
                            <span>
                                Outstanding Purchase *
                            </span>

                            <select
                                value={purchaseId}
                                disabled={
                                    busy
                                    ||
                                    purchases.length
                                    === 0
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setPurchaseId(
                                            Number(
                                                event.target.value
                                            )
                                        )
                                }
                            >
                                <option value={0}>
                                    Select purchase
                                </option>

                                {
                                    purchases.map(
                                        (
                                            purchase
                                        ) => (
                                            <option
                                                key={purchase.id}
                                                value={purchase.id}
                                            >
                                                {
                                                    purchase.purchase_number
                                                }

                                                {" — "}

                                                {
                                                    purchase.supplier?.name
                                                    ?? "Unknown Supplier"
                                                }

                                                {" — Due "}

                                                {
                                                    money.format(
                                                        purchase.balance_due
                                                    )
                                                }
                                            </option>
                                        )
                                    )
                                }
                            </select>
                        </label>

                        <label className="supplier-payments-field">
                            <span>
                                Payment Date *
                            </span>

                            <input
                                type="date"
                                value={paymentDate}
                                disabled={busy}
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setPaymentDate(
                                            event.target.value
                                        )
                                }
                            />
                        </label>
                    </section>

                    {
                        selectedPurchase
                        && (
                            <section className="supplier-payments-purchase-summary">
                                <article>
                                    <span>
                                        Supplier
                                    </span>

                                    <strong>
                                        {
                                            selectedPurchase.supplier?.name
                                            ?? "—"
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Purchase Total
                                    </span>

                                    <strong>
                                        {
                                            money.format(
                                                selectedPurchase.grand_total
                                            )
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Already Paid
                                    </span>

                                    <strong>
                                        {
                                            money.format(
                                                selectedPurchase.paid_amount
                                            )
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Outstanding
                                    </span>

                                    <strong className="supplier-payments-danger-money">
                                        {
                                            money.format(
                                                selectedPurchase.balance_due
                                            )
                                        }
                                    </strong>
                                </article>
                            </section>
                        )
                    }

                    <section className="supplier-payments-methods-section">
                        <div className="supplier-payments-section-heading">
                            <div>
                                <h3>
                                    Payment Methods
                                </h3>

                                <p>
                                    Up to 10 methods can be combined
                                    in one payment.
                                </p>
                            </div>

                            <div className="supplier-payments-section-actions">
                                {
                                    selectedPurchase
                                    && (
                                        <button
                                            type="button"
                                            className="supplier-payments-button supplier-payments-button-secondary"
                                            disabled={busy}
                                            onClick={payFullRemaining}
                                        >
                                            Use Full Balance
                                        </button>
                                    )
                                }

                                <button
                                    type="button"
                                    className="supplier-payments-button supplier-payments-button-secondary"
                                    disabled={
                                        busy
                                        ||
                                        paymentLines.length
                                        >= 10
                                    }
                                    onClick={addLine}
                                >
                                    + Add Method
                                </button>
                            </div>
                        </div>

                        <div className="supplier-payments-table-wrap">
                            <table className="supplier-payments-editor-table">
                                <thead>
                                    <tr>
                                        <th>
                                            Method
                                        </th>

                                        <th>
                                            Amount
                                        </th>

                                        <th>
                                            Reference
                                        </th>

                                        <th>
                                            Notes
                                        </th>

                                        <th />
                                    </tr>
                                </thead>

                                <tbody>
                                    {
                                        paymentLines.map(
                                            (
                                                line
                                            ) => (
                                                <tr key={line.key}>
                                                    <td>
                                                        <select
                                                            value={line.paymentMethod}
                                                            disabled={busy}
                                                            onChange={
                                                                (
                                                                    event
                                                                ) =>
                                                                    updateLine(
                                                                        line.key,

                                                                        {
                                                                            paymentMethod:
                                                                                toSupplierPaymentMethod(
                                                                                    event.target.value
                                                                                ),
                                                                        }
                                                                    )
                                                            }
                                                        >
                                                            {
                                                                availablePaymentMethods.map(
                                                                    (
                                                                        method
                                                                    ) => (
                                                                        <option
                                                                            key={method.value}
                                                                            value={method.value}
                                                                        >
                                                                            {
                                                                                method.label
                                                                            }
                                                                        </option>
                                                                    )
                                                                )
                                                            }
                                                        </select>
                                                    </td>

                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            value={line.amount}
                                                            disabled={busy}
                                                            placeholder="0.00"
                                                            onChange={
                                                                (
                                                                    event
                                                                ) =>
                                                                    updateLine(
                                                                        line.key,

                                                                        {
                                                                            amount:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                            }
                                                        />
                                                    </td>

                                                    <td>
                                                        <input
                                                            type="text"
                                                            maxLength={190}
                                                            value={line.reference}
                                                            disabled={busy}
                                                            placeholder={
                                                                line.paymentMethod
                                                                    === "CHEQUE"
                                                                    ? "Cheque number *"
                                                                    : "Optional reference"
                                                            }
                                                            onChange={
                                                                (
                                                                    event
                                                                ) =>
                                                                    updateLine(
                                                                        line.key,

                                                                        {
                                                                            reference:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                            }
                                                        />
                                                    </td>

                                                    <td>
                                                        <input
                                                            type="text"
                                                            maxLength={500}
                                                            value={line.notes}
                                                            disabled={busy}
                                                            placeholder="Optional"
                                                            onChange={
                                                                (
                                                                    event
                                                                ) =>
                                                                    updateLine(
                                                                        line.key,

                                                                        {
                                                                            notes:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                            }
                                                        />
                                                    </td>

                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="supplier-payments-remove-button"
                                                            disabled={
                                                                busy
                                                                ||
                                                                paymentLines.length
                                                                <= 1
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
                                            )
                                        )
                                    }
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {
                        cashAmount > 0
                        && (
                            <div className="supplier-payments-alert supplier-payments-alert-warning">
                                <strong>
                                    Cash payment:
                                    {" "}
                                    {
                                        money.format(
                                            cashAmount
                                        )
                                    }
                                </strong>

                                <br />

                                This amount will be deducted from
                                your currently open cashier drawer.
                            </div>
                        )
                    }

                    <section className="supplier-payments-total-summary">
                        <article>
                            <span>
                                Payment Total
                            </span>

                            <strong>
                                {
                                    money.format(
                                        paymentTotal
                                    )
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Cash Portion
                            </span>

                            <strong>
                                {
                                    money.format(
                                        cashAmount
                                    )
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Remaining After Payment
                            </span>

                            <strong>
                                {
                                    selectedPurchase
                                        ? money.format(
                                            remainingAfterPayment
                                        )
                                        : "—"
                                }
                            </strong>
                        </article>
                    </section>

                    <label className="supplier-payments-field">
                        <span>
                            Batch Notes
                        </span>

                        <textarea
                            rows={4}
                            maxLength={2000}
                            value={notes}
                            disabled={busy}
                            placeholder="Optional payment notes..."
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

                    <div className="supplier-payments-modal-actions">
                        <button
                            type="button"
                            className="supplier-payments-button supplier-payments-button-secondary"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="supplier-payments-button supplier-payments-button-primary"
                            disabled={
                                busy
                                ||
                                purchases.length
                                === 0
                            }
                        >
                            {
                                busy
                                    ? "Recording..."
                                    : "Record Payment"
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}