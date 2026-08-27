import type {
    Purchase,
} from "./types";

interface PurchaseDetailsModalProps {
    purchase: Purchase;

    canManage: boolean;

    busy: boolean;

    onClose: () => void;

    onEdit: (
        purchase: Purchase
    ) => void;

    onComplete: (
        purchase: Purchase
    ) => void;

    onCancel: (
        purchase: Purchase
    ) => void;
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
    value: string | null
): string {
    if (!value) {
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
            year:
                "numeric",

            month:
                "short",

            day:
                "2-digit",

            hour:
                "2-digit",

            minute:
                "2-digit",
        }
    ).format(date);
}

export default function PurchaseDetailsModal({
    purchase,
    canManage,
    busy,
    onClose,
    onEdit,
    onComplete,
    onCancel,
}: PurchaseDetailsModalProps) {
    return (
        <div className="purchases-modal-backdrop">
            <div
                className="purchases-modal purchases-details-modal"
                role="dialog"
                aria-modal="true"
            >
                <div className="purchases-modal-header">
                    <div>
                        <div className="purchases-eyebrow">
                            Purchase Details
                        </div>

                        <h2>
                            {purchase.purchase_number}
                        </h2>

                        <p>
                            {
                                purchase.supplier?.name
                                ?? "Unknown supplier"
                            }
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

                <div className="purchases-modal-body">
                    <section className="purchases-details-summary">
                        <article>
                            <span>
                                Status
                            </span>

                            <strong>
                                {purchase.status}
                            </strong>
                        </article>

                        <article>
                            <span>
                                Payment
                            </span>

                            <strong>
                                {
                                    purchase.payment_status
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Purchase Date
                            </span>

                            <strong>
                                {
                                    purchase.purchase_date
                                    ?? "—"
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Supplier Invoice
                            </span>

                            <strong>
                                {
                                    purchase.supplier_invoice_number
                                    ?? "—"
                                }
                            </strong>
                        </article>
                    </section>

                    <section className="purchases-financial-summary">
                        <article>
                            <span>
                                Grand Total
                            </span>

                            <strong>
                                {
                                    money.format(
                                        purchase.grand_total
                                    )
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Paid
                            </span>

                            <strong>
                                {
                                    money.format(
                                        purchase.paid_amount
                                    )
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Balance Due
                            </span>

                            <strong>
                                {
                                    money.format(
                                        purchase.balance_due
                                    )
                                }
                            </strong>
                        </article>
                    </section>

                    <section className="purchases-details-section">
                        <h3>
                            Items
                        </h3>

                        <div className="purchases-table-wrap">
                            <table className="purchases-table">
                                <thead>
                                    <tr>
                                        <th>
                                            Ingredient
                                        </th>

                                        <th>
                                            Purchased
                                        </th>

                                        <th>
                                            Unit Cost
                                        </th>

                                        <th>
                                            Total
                                        </th>

                                        <th>
                                            Base Qty
                                        </th>

                                        <th>
                                            Base Cost
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {
                                        purchase.items.map(
                                            (
                                                item
                                            ) => (
                                                <tr key={item.id}>
                                                    <td>
                                                        <strong>
                                                            {
                                                                item.ingredient?.name
                                                                ?? "Unknown"
                                                            }
                                                        </strong>

                                                        <small className="purchases-table-subtext">
                                                            {
                                                                item.ingredient?.sku
                                                                ?? "—"
                                                            }
                                                        </small>
                                                    </td>

                                                    <td>
                                                        {
                                                            item.quantity
                                                        }
                                                        {" "}
                                                        {
                                                            item.purchase_unit?.symbol
                                                            ?? ""
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            money.format(
                                                                item.unit_cost
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {
                                                                money.format(
                                                                    item.line_total
                                                                )
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {
                                                            item.base_quantity
                                                                === null
                                                                ? "Pending completion"
                                                                : `${item.base_quantity} ${item.ingredient
                                                                    ?.base_unit
                                                                    ?.symbol
                                                                ?? ""
                                                                }`
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            item.base_unit_cost
                                                                === null
                                                                ? "—"
                                                                : money.format(
                                                                    item.base_unit_cost
                                                                )
                                                        }
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
                        purchase.notes
                        && (
                            <section className="purchases-note-box">
                                <span>
                                    Notes
                                </span>

                                <p>
                                    {purchase.notes}
                                </p>
                            </section>
                        )
                    }

                    <div className="purchases-details-dates">
                        <span>
                            Created:
                            {" "}
                            {
                                formatDateTime(
                                    purchase.created_at
                                )
                            }
                        </span>

                        <span>
                            Completed:
                            {" "}
                            {
                                formatDateTime(
                                    purchase.completed_at
                                )
                            }
                        </span>
                    </div>

                    <div className="purchases-modal-actions">
                        <button
                            type="button"
                            className="purchases-button purchases-button-secondary"
                            onClick={onClose}
                            disabled={busy}
                        >
                            Close
                        </button>

                        {
                            canManage
                            && purchase.status
                            === "DRAFT"
                            && (
                                <>
                                    <button
                                        type="button"
                                        className="purchases-button purchases-button-danger"
                                        disabled={busy}
                                        onClick={
                                            () =>
                                                onCancel(
                                                    purchase
                                                )
                                        }
                                    >
                                        Cancel Purchase
                                    </button>

                                    <button
                                        type="button"
                                        className="purchases-button purchases-button-secondary"
                                        disabled={busy}
                                        onClick={
                                            () =>
                                                onEdit(
                                                    purchase
                                                )
                                        }
                                    >
                                        Edit Draft
                                    </button>

                                    <button
                                        type="button"
                                        className="purchases-button purchases-button-success"
                                        disabled={busy}
                                        onClick={
                                            () =>
                                                onComplete(
                                                    purchase
                                                )
                                        }
                                    >
                                        {
                                            busy
                                                ? "Processing..."
                                                : "Complete & Receive Stock"
                                        }
                                    </button>
                                </>
                            )
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}