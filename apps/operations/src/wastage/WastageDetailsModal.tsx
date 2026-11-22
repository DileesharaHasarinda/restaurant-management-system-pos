import type {
    WastageRecord,
} from "./types";

interface WastageDetailsModalProps {
    wastage: WastageRecord;
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

function quantityText(value: number): string {
    return value.toLocaleString(
        "en-LK",
        {
            maximumFractionDigits: 4,
        },
    );
}

export default function WastageDetailsModal({
    wastage,
    onClose,
}: WastageDetailsModalProps) {
    return (
        <div className="wastage-modal-backdrop">
            <div
                className="wastage-modal wastage-details-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Wastage details ${wastage.wastage_number}`}
            >
                <div className="wastage-modal-header">
                    <div>
                        <div className="wastage-eyebrow">
                            Wastage Details
                        </div>

                        <h2>{wastage.wastage_number}</h2>

                        <p>
                            {wastage.ingredient?.name ??
                                "Unknown ingredient"}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="wastage-icon-button"
                        onClick={onClose}
                        aria-label="Close details"
                    >
                        ×
                    </button>
                </div>

                <div className="wastage-modal-body">
                    <section className="wastage-details-summary">
                        <article>
                            <span>Status</span>
                            <strong>{wastage.status}</strong>
                        </article>

                        <article>
                            <span>Wasted At</span>
                            <strong>
                                {formatDateTime(
                                    wastage.wasted_at,
                                )}
                            </strong>
                        </article>

                        <article>
                            <span>Reason</span>
                            <strong>
                                {wastage.reason_label}
                            </strong>
                        </article>

                        <article>
                            <span>Estimated Cost</span>
                            <strong>
                                {money.format(
                                    wastage.estimated_cost,
                                )}
                            </strong>
                        </article>
                    </section>

                    <section className="wastage-details-grid">
                        <article>
                            <span>Ingredient</span>
                            <strong>
                                {wastage.ingredient?.name ??
                                    "—"}
                            </strong>
                            <small>
                                {wastage.ingredient?.sku ??
                                    "No SKU"}
                            </small>
                        </article>

                        <article>
                            <span>Entered Quantity</span>
                            <strong>
                                {quantityText(
                                    wastage.entered_quantity
                                        .quantity,
                                )}{" "}
                                {wastage.entered_quantity
                                    .unit?.symbol ?? ""}
                            </strong>
                        </article>

                        <article>
                            <span>Base Quantity</span>
                            <strong>
                                {quantityText(
                                    wastage.base_quantity,
                                )}{" "}
                                {wastage.ingredient?.base_unit
                                    ?.symbol ?? ""}
                            </strong>
                        </article>

                        <article>
                            <span>Current Stock</span>
                            <strong>
                                {wastage.ingredient
                                    ? quantityText(
                                        wastage.ingredient
                                            .current_stock,
                                    )
                                    : "—"}{" "}
                                {wastage.ingredient?.base_unit
                                    ?.symbol ?? ""}
                            </strong>
                        </article>
                    </section>

                    {wastage.reason && (
                        <section className="wastage-note-box">
                            <span>Description</span>
                            <p>{wastage.reason}</p>
                        </section>
                    )}

                    <section className="wastage-record-meta">
                        <div>
                            <span>Recorded By</span>
                            <strong>
                                {wastage.created_by?.name ??
                                    "—"}
                            </strong>
                        </div>

                        <div>
                            <span>Business Day ID</span>
                            <strong>
                                {wastage.business_day_id}
                            </strong>
                        </div>

                        <div>
                            <span>Created</span>
                            <strong>
                                {formatDateTime(
                                    wastage.created_at,
                                )}
                            </strong>
                        </div>
                    </section>

                    <div className="wastage-modal-actions">
                        <button
                            type="button"
                            className="wastage-button wastage-button-secondary"
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