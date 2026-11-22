import type {
    SupplierPaymentBatch,
} from "./types";

interface SupplierPaymentDetailsModalProps {
    batch: SupplierPaymentBatch;
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

/*
|--------------------------------------------------------------------------
| Batch reference formatter
|--------------------------------------------------------------------------
|
| Format: SP-YYYYMMDD-NN
|
| SP         → Supplier Payment prefix
| YYYYMMDD   → Payment date (falls back to created_at)
| NN         → Batch ID, zero-padded to at least 2 digits
|
| The underlying `batch.batch_number` (ULID) remains the
| authoritative identifier used by the backend.
|--------------------------------------------------------------------------
*/

function formatBatchReference(
    batch: SupplierPaymentBatch,
): string {
    let datePart = "";

    const paymentDate = batch.payment_date;

    if (
        paymentDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
    ) {
        /* Already YYYY-MM-DD — no timezone parsing needed. */
        datePart = paymentDate.replaceAll("-", "");
    } else {
        /*
         * `payment_date` may be null and `created_at` may also
         * be null. TypeScript requires an explicit null check
         * before passing to the Date constructor.
         */
        const rawDate =
            batch.payment_date ??
            batch.created_at ??
            null;

        if (!rawDate) {
            /* Fall back to the raw backend identifier. */
            return batch.batch_number;
        }

        const fallback = new Date(rawDate);

        if (Number.isNaN(fallback.getTime())) {
            return batch.batch_number;
        }

        const yyyy = fallback.getFullYear();
        const mm = String(
            fallback.getMonth() + 1,
        ).padStart(2, "0");
        const dd = String(
            fallback.getDate(),
        ).padStart(2, "0");

        datePart = `${yyyy}${mm}${dd}`;
    }

    const sequence = String(batch.id).padStart(2, "0");

    return `SP-${datePart}-${sequence}`;
}

function paymentMethodLabel(value: string): string {
    return value.replaceAll("_", " ");
}

function formatDateTime(
    value: string | null,
): string {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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
        },
    ).format(date);
}

export default function SupplierPaymentDetailsModal({
    batch,
    onClose,
}: SupplierPaymentDetailsModalProps) {
    const cashTotal = batch.payments.reduce(
        (total, payment) =>
            payment.payment_method === "CASH"
                ? total + payment.amount
                : total,
        0,
    );

    const shortReference = formatBatchReference(batch);

    return (
        <div className="supplier-payments-modal-backdrop">
            <div
                className="supplier-payments-modal supplier-payments-details-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Payment details ${shortReference}`}
            >
                <div className="supplier-payments-modal-header">
                    <div>
                        <div className="supplier-payments-eyebrow">
                            Payment Details
                        </div>

                        <h2
                            className="supplier-payments-batch-ref"
                            title={batch.batch_number}
                        >
                            {shortReference}
                        </h2>

                        <p>
                            {batch.supplier?.name ??
                                "Unknown supplier"}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="supplier-payments-icon-button"
                        onClick={onClose}
                        aria-label="Close details"
                    >
                        ×
                    </button>
                </div>

                <div className="supplier-payments-modal-body">
                    <section className="supplier-payments-details-summary">
                        <article>
                            <span>Payment Date</span>
                            <strong>
                                {batch.payment_date ?? "—"}
                            </strong>
                        </article>

                        <article>
                            <span>Purchase</span>
                            <strong>
                                {batch.purchase
                                    ?.purchase_number ?? "—"}
                            </strong>
                        </article>

                        <article>
                            <span>Total Paid</span>
                            <strong>
                                {money.format(
                                    batch.total_amount,
                                )}
                            </strong>
                        </article>

                        <article>
                            <span>Cash Portion</span>
                            <strong>
                                {money.format(cashTotal)}
                            </strong>
                        </article>
                    </section>

                    {batch.purchase && (
                        <section className="supplier-payments-purchase-summary">
                            <article>
                                <span>Purchase Total</span>
                                <strong>
                                    {money.format(
                                        batch.purchase
                                            .grand_total,
                                    )}
                                </strong>
                            </article>

                            <article>
                                <span>Current Paid</span>
                                <strong>
                                    {money.format(
                                        batch.purchase
                                            .paid_amount,
                                    )}
                                </strong>
                            </article>

                            <article>
                                <span>Current Balance</span>
                                <strong>
                                    {money.format(
                                        batch.purchase
                                            .balance_due,
                                    )}
                                </strong>
                            </article>

                            <article>
                                <span>Payment Status</span>
                                <strong>
                                    {
                                        batch.purchase
                                            .payment_status
                                    }
                                </strong>
                            </article>
                        </section>
                    )}

                    <section className="supplier-payments-details-section">
                        <h3>Payment Breakdown</h3>

                        <div className="supplier-payments-table-wrap">
                            <table className="supplier-payments-table">
                                <thead>
                                    <tr>
                                        <th>Payment</th>
                                        <th>Method</th>
                                        <th>Amount</th>
                                        <th>Reference</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {batch.payments.map(
                                        (payment) => (
                                            <tr key={payment.id}>
                                                <td>
                                                    <strong>
                                                        {
                                                            payment.payment_number
                                                        }
                                                    </strong>
                                                </td>

                                                <td>
                                                    <span className="supplier-payments-method-badge">
                                                        {paymentMethodLabel(
                                                            payment.payment_method,
                                                        )}
                                                    </span>
                                                </td>

                                                <td>
                                                    <strong>
                                                        {money.format(
                                                            payment.amount,
                                                        )}
                                                    </strong>
                                                </td>

                                                <td>
                                                    {payment.reference ??
                                                        "—"}
                                                </td>

                                                <td>
                                                    {payment.notes ??
                                                        "—"}
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {batch.notes && (
                        <section className="supplier-payments-note-box">
                            <span>Batch Notes</span>
                            <p>{batch.notes}</p>
                        </section>
                    )}

                    <div className="supplier-payments-details-footer">
                        <span>
                            Recorded by:{" "}
                            {batch.created_by?.name ?? "—"}
                        </span>

                        <span>
                            Created:{" "}
                            {formatDateTime(batch.created_at)}
                        </span>
                    </div>

                    <div className="supplier-payments-modal-actions">
                        <button
                            type="button"
                            className="supplier-payments-button supplier-payments-button-secondary"
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