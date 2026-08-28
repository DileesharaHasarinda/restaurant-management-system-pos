import {
    useState,
    type ChangeEvent,
} from "react";

import type {
    Expense,
} from "./types";

interface ExpenseDetailsModalProps {
    expense:
    Expense;

    canEdit:
    boolean;

    canManageReceipt:
    boolean;

    onClose:
    () => void;

    onEdit:
    () => void;

    onDownloadReceipt:
    () => Promise<void>;

    onUploadReceipt:
    (
        file: File
    ) => Promise<void>;

    onRemoveReceipt:
    () => Promise<void>;
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

function formatDateTime(
    value:
        string | null
): string {
    if (
        !value
    ) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        "en-LK",
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }
    ).format(date);
}

function fileSize(
    value:
        number | null
): string {
    if (
        value === null
    ) {
        return "—";
    }

    if (
        value < 1024
    ) {
        return `${value} B`;
    }

    if (
        value < 1024 * 1024
    ) {
        return `${(
            value / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        value /
        (1024 * 1024)
    ).toFixed(1)} MB`;
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

    return "Receipt operation failed.";
}

export default function ExpenseDetailsModal({
    expense,
    canEdit,
    canManageReceipt,
    onClose,
    onEdit,
    onDownloadReceipt,
    onUploadReceipt,
    onRemoveReceipt,
}: ExpenseDetailsModalProps) {
    const [
        receiptBusy,
        setReceiptBusy,
    ] =
        useState(false);

    const [
        error,
        setError,
    ] =
        useState("");

    const upload =
        async (
            event:
                ChangeEvent<HTMLInputElement>
        ) => {
            const file =
                event.target.files?.[0];

            event.target.value =
                "";

            if (
                !file
            ) {
                return;
            }

            const allowed =
                [
                    "application/pdf",
                    "image/jpeg",
                    "image/png",
                ];

            if (
                !allowed.includes(
                    file.type
                )
            ) {
                setError(
                    "Receipt must be PDF, JPG, JPEG or PNG."
                );

                return;
            }

            if (
                file.size
                >
                10 * 1024 * 1024
            ) {
                setError(
                    "Receipt cannot exceed 10 MB."
                );

                return;
            }

            setReceiptBusy(true);
            setError("");

            try {
                await onUploadReceipt(
                    file
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(caught)
                );
            } finally {
                setReceiptBusy(false);
            }
        };

    const download =
        async () => {
            setReceiptBusy(true);
            setError("");

            try {
                await onDownloadReceipt();
            } catch (
            caught
            ) {
                setError(
                    errorMessage(caught)
                );
            } finally {
                setReceiptBusy(false);
            }
        };

    const remove =
        async () => {
            if (
                !window.confirm(
                    "Remove this expense receipt?"
                )
            ) {
                return;
            }

            setReceiptBusy(true);
            setError("");

            try {
                await onRemoveReceipt();
            } catch (
            caught
            ) {
                setError(
                    errorMessage(caught)
                );
            } finally {
                setReceiptBusy(false);
            }
        };

    return (
        <div className="expenses-modal-backdrop">
            <div
                className="expenses-modal expenses-details-modal"
                role="dialog"
                aria-modal="true"
            >
                <div className="expenses-modal-header">
                    <div>
                        <div className="expenses-eyebrow">
                            Expense Details
                        </div>

                        <h2>
                            {expense.expense_number}
                        </h2>

                        <p>
                            {expense.description}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="expenses-icon-button"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="expenses-modal-body">
                    {
                        error
                        && (
                            <div className="expenses-alert expenses-alert-error">
                                {error}
                            </div>
                        )
                    }

                    <section className="expenses-details-summary">
                        <article>
                            <span>
                                Amount
                            </span>

                            <strong>
                                {
                                    money.format(
                                        expense.amount
                                    )
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Payment
                            </span>

                            <strong>
                                {
                                    expense.payment_method_label
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Category
                            </span>

                            <strong>
                                {
                                    expense.category?.name
                                    ?? "—"
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Status
                            </span>

                            <strong>
                                {expense.status}
                            </strong>
                        </article>
                    </section>

                    <section className="expenses-details-grid">
                        <article>
                            <span>
                                Expense Date
                            </span>

                            <strong>
                                {expense.expense_date}
                            </strong>
                        </article>

                        <article>
                            <span>
                                Reference
                            </span>

                            <strong>
                                {
                                    expense.reference_number
                                    ?? "—"
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Business Day
                            </span>

                            <strong>
                                {
                                    expense.business_day
                                        ?.business_date
                                    ?? "—"
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Cashier Shift
                            </span>

                            <strong>
                                {
                                    expense.cashier_shift
                                        ?.shift_number
                                    ?? "Not linked"
                                }
                            </strong>
                        </article>
                    </section>

                    {
                        expense.notes
                        && (
                            <section className="expenses-note-box">
                                <span>
                                    Notes
                                </span>

                                <p>
                                    {expense.notes}
                                </p>
                            </section>
                        )
                    }

                    <section className="expenses-receipt-box">
                        <div className="expenses-receipt-heading">
                            <div>
                                <span>
                                    Private Receipt
                                </span>

                                {
                                    expense.receipt
                                        ? (
                                            <>
                                                <strong>
                                                    {
                                                        expense.receipt.original_name
                                                        ?? "Receipt"
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        fileSize(
                                                            expense.receipt.size
                                                        )
                                                    }

                                                    {" · Uploaded "}

                                                    {
                                                        formatDateTime(
                                                            expense.receipt.uploaded_at
                                                        )
                                                    }
                                                </small>
                                            </>
                                        )
                                        : (
                                            <strong>
                                                No receipt attached
                                            </strong>
                                        )
                                }
                            </div>

                            <div className="expenses-receipt-actions">
                                {
                                    expense.receipt
                                    && (
                                        <button
                                            type="button"
                                            className="expenses-button expenses-button-secondary"
                                            disabled={receiptBusy}
                                            onClick={
                                                () =>
                                                    void download()
                                            }
                                        >
                                            Download
                                        </button>
                                    )
                                }

                                {
                                    canManageReceipt
                                    && (
                                        <label className="expenses-upload-button">
                                            {
                                                receiptBusy
                                                    ? "Working..."
                                                    : expense.receipt
                                                        ? "Replace"
                                                        : "Upload"
                                            }

                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                disabled={receiptBusy}
                                                onChange={
                                                    upload
                                                }
                                            />
                                        </label>
                                    )
                                }

                                {
                                    canManageReceipt
                                    &&
                                    expense.receipt
                                    && (
                                        <button
                                            type="button"
                                            className="expenses-button expenses-button-danger"
                                            disabled={receiptBusy}
                                            onClick={
                                                () =>
                                                    void remove()
                                            }
                                        >
                                            Remove
                                        </button>
                                    )
                                }
                            </div>
                        </div>

                        <small>
                            Receipts are stored privately and
                            require authenticated access.
                        </small>
                    </section>

                    <section className="expenses-meta-grid">
                        <div>
                            <span>
                                Recorded By
                            </span>

                            <strong>
                                {
                                    expense.created_by?.name
                                    ?? "—"
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Created
                            </span>

                            <strong>
                                {
                                    formatDateTime(
                                        expense.created_at
                                    )
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Last Updated
                            </span>

                            <strong>
                                {
                                    formatDateTime(
                                        expense.updated_at
                                    )
                                }
                            </strong>
                        </div>
                    </section>

                    <div className="expenses-modal-actions">
                        {
                            canEdit
                            && (
                                <button
                                    type="button"
                                    className="expenses-button expenses-button-primary"
                                    onClick={onEdit}
                                >
                                    Edit Expense
                                </button>
                            )
                        }

                        <button
                            type="button"
                            className="expenses-button expenses-button-secondary"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}