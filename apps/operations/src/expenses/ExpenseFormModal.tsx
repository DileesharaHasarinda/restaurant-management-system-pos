import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import type {
    CreateExpensePayload,
    Expense,
    ExpenseCategory,
    ExpensePaymentMethod,
    ExpensePaymentMethodOption,
    UpdateExpensePayload,
} from "./types";

interface ExpenseFormModalProps {
    expense?: Expense;
    categories: ExpenseCategory[];
    paymentMethods: ExpensePaymentMethodOption[];
    allowCash: boolean;
    onClose: () => void;
    onCreate: (
        payload: CreateExpensePayload,
    ) => Promise<void>;
    onUpdate: (
        expenseId: number,
        payload: UpdateExpensePayload,
    ) => Promise<void>;
}

function todayInputValue(): string {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(
        2,
        "0",
    );
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

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

function nullableText(value: string): string | null {
    const result = value.trim();
    return result ? result : null;
}

function toPaymentMethod(
    value: string,
): ExpensePaymentMethod {
    switch (value) {
        case "CASH":
            return "CASH";
        case "CARD":
            return "CARD";
        case "BANK_TRANSFER":
            return "BANK_TRANSFER";
        case "CHEQUE":
            return "CHEQUE";
        case "QR":
            return "QR";
        case "OTHER":
            return "OTHER";
        default:
            return "OTHER";
    }
}

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Unable to save the expense.";
}

export default function ExpenseFormModal({
    expense,
    categories,
    paymentMethods,
    allowCash,
    onClose,
    onCreate,
    onUpdate,
}: ExpenseFormModalProps) {
    const editing = expense !== undefined;

    const [categoryId, setCategoryId] = useState(
        expense?.category?.id ?? 0,
    );

    const [expenseDate, setExpenseDate] = useState(
        expense?.expense_date ?? todayInputValue(),
    );

    const [description, setDescription] = useState(
        expense?.description ?? "",
    );

    const [notes, setNotes] = useState(
        expense?.notes ?? "",
    );

    const [amount, setAmount] = useState(
        expense ? String(expense.amount) : "",
    );

    const [paymentMethod, setPaymentMethod] =
        useState<ExpensePaymentMethod>(
            expense?.payment_method ??
            (allowCash ? "CASH" : "BANK_TRANSFER"),
        );

    const [referenceNumber, setReferenceNumber] = useState(
        expense?.reference_number ?? "",
    );

    const [clientRequestId] = useState(() =>
        generateUuid(),
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    /*
    |--------------------------------------------------------------------------
    | Payment Options
    |--------------------------------------------------------------------------
    */

    const availablePaymentMethods = useMemo(() => {
        if (allowCash) {
            return paymentMethods;
        }

        if (
            expense?.payment_method === "CASH" &&
            expense.cashier_shift === null
        ) {
            return paymentMethods;
        }

        return paymentMethods.filter(
            (method) => method.code !== "CASH",
        );
    }, [allowCash, expense, paymentMethods]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (busy) {
            return;
        }

        setError("");

        if (categoryId <= 0) {
            setError("Select an expense category.");
            return;
        }

        if (!expenseDate) {
            setError("Expense date is required.");
            return;
        }

        if (expenseDate > todayInputValue()) {
            setError(
                "Expense date cannot be in the future.",
            );

            return;
        }

        const cleanedDescription = description.trim();

        if (!cleanedDescription) {
            setError("Expense description is required.");
            return;
        }

        if (cleanedDescription.length > 255) {
            setError(
                "Description cannot exceed 255 characters.",
            );

            return;
        }

        if (notes.length > 2000) {
            setError(
                "Notes cannot exceed 2000 characters.",
            );

            return;
        }

        const amountText = amount.trim();

        if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
            setError(
                "Amount can contain no more than two decimal places.",
            );

            return;
        }

        const numericAmount = Number(amountText);

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {
            setError(
                "Expense amount must be greater than zero.",
            );

            return;
        }

        if (
            paymentMethod === "CASH" &&
            !allowCash &&
            !(
                editing &&
                expense?.payment_method === "CASH" &&
                expense.cashier_shift === null
            )
        ) {
            setError(
                "Drawer cash expenses must be recorded by the local cashier.",
            );

            return;
        }

        if (referenceNumber.length > 150) {
            setError(
                "Reference number cannot exceed 150 characters.",
            );

            return;
        }

        if (
            paymentMethod === "CHEQUE" &&
            !referenceNumber.trim()
        ) {
            setError(
                "A cheque number/reference is required.",
            );

            return;
        }

        setBusy(true);

        const common = {
            expense_category_id: categoryId,
            expense_date: expenseDate,
            description: cleanedDescription,
            notes: nullableText(notes),
            amount: numericAmount,
            payment_method: paymentMethod,
            reference_number:
                nullableText(referenceNumber),
        };

        try {
            if (editing && expense) {
                await onUpdate(expense.id, common);
            } else {
                await onCreate({
                    client_request_id: clientRequestId,
                    ...common,
                });
            }
        } catch (caught) {
            setError(errorMessage(caught));
            setBusy(false);
        }
    };

    return (
        <div className="expenses-modal-backdrop">
            <div
                className="expenses-modal"
                role="dialog"
                aria-modal="true"
                aria-label={
                    editing
                        ? "Edit expense"
                        : "Record expense"
                }
            >
                <div className="expenses-modal-header">
                    <div>
                        <div className="expenses-eyebrow">
                            Financial Control
                        </div>

                        <h2>
                            {editing
                                ? "Edit Expense"
                                : "Record Expense"}
                        </h2>

                        <p>
                            Record restaurant operating
                            expenses against the current
                            business day.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="expenses-icon-button"
                        disabled={busy}
                        onClick={onClose}
                        aria-label="Close expense form"
                    >
                        ×
                    </button>
                </div>

                <form
                    className="expenses-modal-body"
                    onSubmit={submit}
                >
                    {error && (
                        <div
                            className="expenses-alert expenses-alert-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    {!allowCash && !editing && (
                        <div className="expenses-alert expenses-alert-info">
                            Cash drawer expenses must be
                            recorded by the local cashier.
                            Remote management can record
                            Card, Bank Transfer, Cheque, QR
                            and Other expenses.
                        </div>
                    )}

                    {paymentMethod === "CASH" && (
                        <div className="expenses-alert expenses-alert-warning">
                            <strong>Cash Expense</strong>

                            <br />

                            If you have an open cashier
                            shift, Laravel will automatically
                            deduct this amount from your
                            expected drawer cash.
                        </div>
                    )}

                    <section className="expenses-form-grid">
                        <label className="expenses-field">
                            <span>Category *</span>

                            <select
                                value={categoryId}
                                disabled={busy}
                                onChange={(event) =>
                                    setCategoryId(
                                        Number(
                                            event.target.value,
                                        ),
                                    )
                                }
                            >
                                <option value={0}>
                                    Select category
                                </option>

                                {categories.map((category) => (
                                    <option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="expenses-field">
                            <span>Expense Date *</span>

                            <input
                                type="date"
                                max={todayInputValue()}
                                value={expenseDate}
                                disabled={busy}
                                onChange={(event) =>
                                    setExpenseDate(
                                        event.target.value,
                                    )
                                }
                            />
                        </label>

                        <label className="expenses-field expenses-field-full">
                            <span>Description *</span>

                            <input
                                type="text"
                                maxLength={255}
                                value={description}
                                disabled={busy}
                                placeholder="Example: Kitchen gas refill"
                                onChange={(event) =>
                                    setDescription(
                                        event.target.value,
                                    )
                                }
                            />
                        </label>

                        <label className="expenses-field">
                            <span>Amount *</span>

                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={amount}
                                disabled={busy}
                                placeholder="0.00"
                                onChange={(event) =>
                                    setAmount(event.target.value)
                                }
                            />
                        </label>

                        <label className="expenses-field">
                            <span>Payment Method *</span>

                            <select
                                value={paymentMethod}
                                disabled={busy}
                                onChange={(event) =>
                                    setPaymentMethod(
                                        toPaymentMethod(
                                            event.target.value,
                                        ),
                                    )
                                }
                            >
                                {availablePaymentMethods.map(
                                    (method) => (
                                        <option
                                            key={method.code}
                                            value={method.code}
                                        >
                                            {method.label}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>

                        <label className="expenses-field expenses-field-full">
                            <span>
                                {paymentMethod === "CHEQUE"
                                    ? "Cheque Number / Reference *"
                                    : "Reference Number"}
                            </span>

                            <input
                                type="text"
                                maxLength={150}
                                value={referenceNumber}
                                disabled={busy}
                                placeholder="Optional transaction/reference number"
                                onChange={(event) =>
                                    setReferenceNumber(
                                        event.target.value,
                                    )
                                }
                            />
                        </label>

                        <label className="expenses-field expenses-field-full">
                            <span>Notes</span>

                            <textarea
                                rows={4}
                                maxLength={2000}
                                value={notes}
                                disabled={busy}
                                placeholder="Optional additional notes..."
                                onChange={(event) =>
                                    setNotes(event.target.value)
                                }
                            />

                            <small>{notes.length}/2000</small>
                        </label>
                    </section>

                    <div className="expenses-modal-actions">
                        <button
                            type="button"
                            className="expenses-button expenses-button-secondary"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="expenses-button expenses-button-primary"
                            disabled={busy}
                        >
                            {busy
                                ? "Saving..."
                                : editing
                                    ? "Save Changes"
                                    : "Record Expense"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}