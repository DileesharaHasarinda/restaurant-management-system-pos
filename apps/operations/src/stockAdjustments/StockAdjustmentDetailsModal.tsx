import type {
    StockAdjustment,
} from "./types";

interface StockAdjustmentDetailsModalProps {
    adjustment:
    StockAdjustment;

    onClose:
    () => void;
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

function quantityText(
    value: number
): string {
    return value.toLocaleString(
        "en-LK",
        {
            maximumFractionDigits:
                4,
        }
    );
}

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
        new Date(
            value
        );

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
    ).format(
        date
    );
}

function directionLabel(
    direction:
        StockAdjustment["direction"]
): string {
    switch (
    direction
    ) {
        case "IN":
            return "Stock Increased";

        case "OUT":
            return "Stock Reduced";

        case "NONE":
            return "No Difference";
    }
}

export default function StockAdjustmentDetailsModal({
    adjustment,
    onClose,
}: StockAdjustmentDetailsModalProps) {
    const countSymbol =
        adjustment.count_unit?.symbol
        ?? "";

    const baseSymbol =
        adjustment.ingredient
            ?.base_unit
            ?.symbol
        ?? "";

    return (
        <div className="stock-adjustments-modal-backdrop">
            <div
                className="stock-adjustments-modal stock-adjustments-details-modal"
                role="dialog"
                aria-modal="true"
            >
                <div className="stock-adjustments-modal-header">
                    <div>
                        <div className="stock-adjustments-eyebrow">
                            Stock Adjustment Details
                        </div>

                        <h2>
                            {
                                adjustment.adjustment_number
                            }
                        </h2>

                        <p>
                            {
                                adjustment.ingredient?.name
                                ?? "Unknown ingredient"
                            }
                        </p>
                    </div>

                    <button
                        type="button"
                        className="stock-adjustments-icon-button"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="stock-adjustments-modal-body">
                    <section className="stock-adjustments-detail-summary">
                        <article>
                            <span>
                                Direction
                            </span>

                            <strong>
                                {
                                    directionLabel(
                                        adjustment.direction
                                    )
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Status
                            </span>

                            <strong>
                                {
                                    adjustment.status
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Adjustment Value
                            </span>

                            <strong>
                                {
                                    money.format(
                                        adjustment.adjustment_value
                                    )
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Posted At
                            </span>

                            <strong>
                                {
                                    formatDateTime(
                                        adjustment.posted_at
                                    )
                                }
                            </strong>
                        </article>
                    </section>

                    <section className="stock-adjustments-comparison">
                        <article>
                            <span>
                                System Quantity
                            </span>

                            <strong>
                                {
                                    quantityText(
                                        adjustment.system_quantity
                                    )
                                }

                                {" "}

                                {countSymbol}
                            </strong>
                        </article>

                        <div className="stock-adjustments-comparison-arrow">
                            →
                        </div>

                        <article>
                            <span>
                                Physical Quantity
                            </span>

                            <strong>
                                {
                                    quantityText(
                                        adjustment.actual_quantity
                                    )
                                }

                                {" "}

                                {countSymbol}
                            </strong>
                        </article>

                        <div className="stock-adjustments-comparison-arrow">
                            =
                        </div>

                        <article>
                            <span>
                                Difference
                            </span>

                            <strong>
                                {
                                    adjustment.difference_quantity
                                        > 0
                                        ? "+"
                                        : ""
                                }

                                {
                                    quantityText(
                                        adjustment.difference_quantity
                                    )
                                }

                                {" "}

                                {countSymbol}
                            </strong>
                        </article>
                    </section>

                    <section className="stock-adjustments-details-grid">
                        <article>
                            <span>
                                Ingredient
                            </span>

                            <strong>
                                {
                                    adjustment.ingredient?.name
                                    ?? "—"
                                }
                            </strong>

                            <small>
                                {
                                    adjustment.ingredient?.sku
                                    ?? "No SKU"
                                }
                            </small>
                        </article>

                        <article>
                            <span>
                                Base Difference
                            </span>

                            <strong>
                                {
                                    adjustment.difference_base_quantity
                                        > 0
                                        ? "+"
                                        : ""
                                }

                                {
                                    quantityText(
                                        adjustment.difference_base_quantity
                                    )
                                }

                                {" "}

                                {baseSymbol}
                            </strong>
                        </article>

                        <article>
                            <span>
                                Cost / Base Unit
                            </span>

                            <strong>
                                {
                                    money.format(
                                        adjustment.unit_cost_per_base_unit
                                    )
                                }
                            </strong>
                        </article>

                        <article>
                            <span>
                                Current Stock
                            </span>

                            <strong>
                                {
                                    adjustment.ingredient
                                        ? quantityText(
                                            adjustment.ingredient.current_stock
                                        )
                                        : "—"
                                }

                                {" "}

                                {baseSymbol}
                            </strong>
                        </article>
                    </section>

                    <section className="stock-adjustments-reason-box">
                        <span>
                            Reason
                        </span>

                        <p>
                            {
                                adjustment.reason
                            }
                        </p>
                    </section>

                    {
                        adjustment.stock_movement
                            ? (
                                <section className="stock-adjustments-movement-box">
                                    <div>
                                        <span>
                                            Stock Movement
                                        </span>

                                        <strong>
                                            {
                                                adjustment.stock_movement.movement_type
                                            }
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Quantity Delta
                                        </span>

                                        <strong>
                                            {
                                                adjustment.stock_movement.quantity_delta
                                                    > 0
                                                    ? "+"
                                                    : ""
                                            }

                                            {
                                                quantityText(
                                                    adjustment.stock_movement.quantity_delta
                                                )
                                            }

                                            {" "}

                                            {baseSymbol}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Balance After
                                        </span>

                                        <strong>
                                            {
                                                quantityText(
                                                    adjustment.stock_movement.balance_after
                                                )
                                            }

                                            {" "}

                                            {baseSymbol}
                                        </strong>
                                    </div>
                                </section>
                            )
                            : (
                                <div className="stock-adjustments-alert stock-adjustments-alert-info">
                                    System stock and physical stock were
                                    equal, so no inventory movement was
                                    required.
                                </div>
                            )
                    }

                    <section className="stock-adjustments-meta-grid">
                        <div>
                            <span>
                                Recorded By
                            </span>

                            <strong>
                                {
                                    adjustment.created_by?.name
                                    ?? "—"
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Business Day
                            </span>

                            <strong>
                                #
                                {
                                    adjustment.business_day_id
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Created At
                            </span>

                            <strong>
                                {
                                    formatDateTime(
                                        adjustment.created_at
                                    )
                                }
                            </strong>
                        </div>
                    </section>

                    <div className="stock-adjustments-modal-actions">
                        <button
                            type="button"
                            className="stock-adjustments-button stock-adjustments-button-secondary"
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