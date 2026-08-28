import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    useAuth,
} from "../auth/useAuth";

import {
    closeBusinessDay,
    getBusinessDayClosing,
    getBusinessDayClosingPreview,
    getCurrentBusinessDay,
} from "./businessDayService";

import type {
    BusinessDay,
    BusinessDayBlockers,
    BusinessDayClosing,
    BusinessDayPaymentBreakdown,
    BusinessDayPreview,
    BusinessDaySummary,
} from "./types";

import "./BusinessDayPage.css";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const LAST_CLOSING_STORAGE_KEY =
    "restaurant-last-business-day-closing-id";

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

const dateFormatter =
    new Intl.DateTimeFormat(
        "en-LK",
        {
            year:
                "numeric",

            month:
                "short",

            day:
                "2-digit",
        }
    );

const dateTimeFormatter =
    new Intl.DateTimeFormat(
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
    );

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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

    return "The restaurant business day operation could not be completed.";
}

function formatMoney(
    value:
        number
        | null
        | undefined
): string {
    const amount =
        Number(
            value
            ??
            0
        );

    return money.format(
        Number.isFinite(
            amount
        )
            ? amount
            : 0
    );
}

function formatDate(
    value:
        string
        | null
        | undefined
): string {
    if (!value) {
        return "—";
    }

    const date =
        new Date(
            `${value}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return dateFormatter.format(
        date
    );
}

function formatDateTime(
    value:
        string
        | null
        | undefined
): string {
    if (!value) {
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

    return dateTimeFormatter.format(
        date
    );
}

function makeUuid(): string {
    if (
        typeof crypto
        !==
        "undefined"
        &&
        typeof crypto.randomUUID
        ===
        "function"
    ) {
        return crypto.randomUUID();
    }

    return (
        `${Date.now()}-${Math.random()}`
    );
}

function reconciliationLabel(
    difference: number
): {
    label: string;
    tone:
    "balanced"
    | "shortage"
    | "excess";
} {
    if (
        difference < 0
    ) {
        return {
            label:
                "SHORTAGE",

            tone:
                "shortage",
        };
    }

    if (
        difference > 0
    ) {
        return {
            label:
                "EXCESS",

            tone:
                "excess",
        };
    }

    return {
        label:
            "BALANCED",

        tone:
            "balanced",
    };
}

function blockerLabel(
    value: number
): string {
    return value === 0
        ? "Clear"
        : `${value} unresolved`;
}

/*
|--------------------------------------------------------------------------
| Small Components
|--------------------------------------------------------------------------
*/

interface SummaryRowProps {
    label: string;

    value: string;

    strong?: boolean;

    negative?: boolean;
}

function SummaryRow({
    label,
    value,
    strong = false,
    negative = false,
}: SummaryRowProps) {
    return (
        <div
            className={[
                "business-day-summary-row",

                strong
                    ? "business-day-summary-row--strong"
                    : "",

                negative
                    ? "business-day-summary-row--negative"
                    : "",
            ]
                .filter(
                    Boolean
                )
                .join(
                    " "
                )}
        >
            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>
        </div>
    );
}

interface BlockerCardProps {
    label: string;

    description: string;

    value: number;
}

function BlockerCard({
    label,
    description,
    value,
}: BlockerCardProps) {
    const clear =
        value === 0;

    return (
        <article
            className={[
                "business-day-blocker",

                clear
                    ? "business-day-blocker--clear"
                    : "business-day-blocker--blocked",
            ].join(
                " "
            )}
        >
            <div
                className="business-day-blocker__icon"
                aria-hidden="true"
            >
                {clear
                    ? "✓"
                    : "!"}
            </div>

            <div
                className="business-day-blocker__content"
            >
                <div
                    className="business-day-blocker__heading"
                >
                    <strong>
                        {label}
                    </strong>

                    <span>
                        {blockerLabel(
                            value
                        )}
                    </span>
                </div>

                <p>
                    {description}
                </p>
            </div>
        </article>
    );
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function BusinessDayPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canClose =
        hasPermission(
            "business_day.close"
        );

    const [
        preview,
        setPreview,
    ] =
        useState<BusinessDayPreview | null>(
            null
        );

    const [
        historicalClosing,
        setHistoricalClosing,
    ] =
        useState<BusinessDayClosing | null>(
            null
        );

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(false);

    const [
        closing,
        setClosing,
    ] =
        useState(false);

    const [
        error,
        setError,
    ] =
        useState<string | null>(
            null
        );

    const [
        message,
        setMessage,
    ] =
        useState<string | null>(
            null
        );

    const [
        showCloseModal,
        setShowCloseModal,
    ] =
        useState(false);

    const [
        closingNotes,
        setClosingNotes,
    ] =
        useState("");

    /*
     * Stable request ID for retries.
     *
     * It is generated once when the manager
     * starts a close attempt and retained across
     * failed/network retries.
     */
    const [
        closeRequestId,
        setCloseRequestId,
    ] =
        useState<string | null>(
            null
        );

    /*
    |--------------------------------------------------------------------------
    | Load Historical Closing
    |--------------------------------------------------------------------------
    */

    const loadStoredClosing =
        useCallback(
            async (): Promise<void> => {
                const stored =
                    sessionStorage.getItem(
                        LAST_CLOSING_STORAGE_KEY
                    );

                if (!stored) {
                    setHistoricalClosing(
                        null
                    );

                    return;
                }

                const closingId =
                    Number(
                        stored
                    );

                if (
                    !Number.isInteger(
                        closingId
                    )
                    ||
                    closingId <= 0
                ) {
                    sessionStorage.removeItem(
                        LAST_CLOSING_STORAGE_KEY
                    );

                    setHistoricalClosing(
                        null
                    );

                    return;
                }

                try {
                    const result =
                        await getBusinessDayClosing(
                            closingId
                        );

                    setHistoricalClosing(
                        result
                    );
                } catch {
                    /*
                     * The stored UI convenience pointer
                     * is not authoritative.
                     */
                    sessionStorage.removeItem(
                        LAST_CLOSING_STORAGE_KEY
                    );

                    setHistoricalClosing(
                        null
                    );
                }
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Initial Load
    |--------------------------------------------------------------------------
    */

    const loadCurrent =
        useCallback(
            async (
                background = false
            ): Promise<void> => {
                if (
                    background
                ) {
                    setRefreshing(
                        true
                    );
                } else {
                    setLoading(
                        true
                    );
                }

                setError(
                    null
                );

                try {
                    const result =
                        await getCurrentBusinessDay();

                    setPreview(
                        result
                    );

                    if (
                        result.business_day
                    ) {
                        /*
                         * A new OPEN day is authoritative.
                         * Do not show an old cached closing.
                         */
                        setHistoricalClosing(
                            null
                        );

                        return;
                    }

                    await loadStoredClosing();
                } catch (
                loadError
                ) {
                    setError(
                        errorMessage(
                            loadError
                        )
                    );
                } finally {
                    setLoading(
                        false
                    );

                    setRefreshing(
                        false
                    );
                }
            },
            [
                loadStoredClosing,
            ]
        );

    useEffect(
        () => {
            let cancelled =
                false;

            void getCurrentBusinessDay()
                .then(
                    async result => {
                        if (
                            cancelled
                        ) {
                            return;
                        }

                        setPreview(
                            result
                        );

                        if (
                            result.business_day
                        ) {
                            setHistoricalClosing(
                                null
                            );

                            return;
                        }

                        const stored =
                            sessionStorage.getItem(
                                LAST_CLOSING_STORAGE_KEY
                            );

                        if (
                            !stored
                        ) {
                            setHistoricalClosing(
                                null
                            );

                            return;
                        }

                        const closingId =
                            Number(
                                stored
                            );

                        if (
                            !Number.isInteger(
                                closingId
                            )
                            ||
                            closingId <= 0
                        ) {
                            sessionStorage.removeItem(
                                LAST_CLOSING_STORAGE_KEY
                            );

                            setHistoricalClosing(
                                null
                            );

                            return;
                        }

                        try {
                            const closingResult =
                                await getBusinessDayClosing(
                                    closingId
                                );

                            if (
                                cancelled
                            ) {
                                return;
                            }

                            setHistoricalClosing(
                                closingResult
                            );
                        } catch {
                            sessionStorage.removeItem(
                                LAST_CLOSING_STORAGE_KEY
                            );

                            if (
                                !cancelled
                            ) {
                                setHistoricalClosing(
                                    null
                                );
                            }
                        }
                    }
                )
                .catch(
                    loadError => {
                        if (
                            cancelled
                        ) {
                            return;
                        }

                        setError(
                            errorMessage(
                                loadError
                            )
                        );
                    }
                )
                .finally(
                    () => {
                        if (
                            cancelled
                        ) {
                            return;
                        }

                        setLoading(
                            false
                        );
                    }
                );

            return () => {
                cancelled =
                    true;
            };
        },
        []
    );

    /*
    |--------------------------------------------------------------------------
    | Explicit Refresh
    |--------------------------------------------------------------------------
    */

    const refresh =
        async (): Promise<void> => {
            setMessage(
                null
            );

            setError(
                null
            );

            const currentDay =
                preview
                    ?.business_day;

            if (
                currentDay
            ) {
                setRefreshing(
                    true
                );

                try {
                    const result =
                        await getBusinessDayClosingPreview(
                            currentDay.id
                        );

                    setPreview(
                        result
                    );

                    setMessage(
                        "Restaurant day status refreshed."
                    );
                } catch (
                refreshError
                ) {
                    setError(
                        errorMessage(
                            refreshError
                        )
                    );
                } finally {
                    setRefreshing(
                        false
                    );
                }

                return;
            }

            await loadCurrent(
                true
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Close Modal
    |--------------------------------------------------------------------------
    */

    const openCloseModal =
        (): void => {
            if (
                !preview
                    ?.business_day
            ) {
                return;
            }

            setError(
                null
            );

            setMessage(
                null
            );

            setClosingNotes(
                ""
            );

            setCloseRequestId(
                makeUuid()
            );

            setShowCloseModal(
                true
            );
        };

    const cancelClose =
        (): void => {
            if (
                closing
            ) {
                return;
            }

            setShowCloseModal(
                false
            );

            setClosingNotes(
                ""
            );

            setCloseRequestId(
                null
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Confirm Close
    |--------------------------------------------------------------------------
    */

    const confirmClose =
        async (): Promise<void> => {
            const businessDay =
                preview
                    ?.business_day;

            if (
                !businessDay
            ) {
                return;
            }

            if (
                closingNotes.length
                >
                2000
            ) {
                setError(
                    "Closing notes cannot exceed 2,000 characters."
                );

                return;
            }

            const requestId =
                closeRequestId
                ??
                makeUuid();

            if (
                !closeRequestId
            ) {
                setCloseRequestId(
                    requestId
                );
            }

            setClosing(
                true
            );

            setError(
                null
            );

            setMessage(
                null
            );

            try {
                const result =
                    await closeBusinessDay(
                        businessDay.id,

                        {
                            client_request_id:
                                requestId,

                            closing_notes:
                                closingNotes
                                    .trim()
                                ||
                                null,
                        }
                    );

                sessionStorage.setItem(
                    LAST_CLOSING_STORAGE_KEY,
                    String(
                        result
                            .closing
                            .id
                    )
                );

                setHistoricalClosing(
                    result.closing
                );

                setPreview(
                    {
                        business_day:
                            null,

                        blockers:
                            null,

                        summary:
                            null,

                        closing:
                            result.closing,
                    }
                );

                setShowCloseModal(
                    false
                );

                setClosingNotes(
                    ""
                );

                setCloseRequestId(
                    null
                );

                setMessage(
                    result.closed
                        ? "Restaurant business day closed successfully."
                        : "The existing restaurant day closing has been loaded."
                );
            } catch (
            closeError
            ) {
                /*
                 * Do NOT regenerate closeRequestId here.
                 *
                 * Retaining the UUID keeps a retry
                 * idempotent.
                 */
                setError(
                    errorMessage(
                        closeError
                    )
                );

                /*
                 * Refresh blockers after a 409-style
                 * close failure because operational state
                 * may have changed after the preview.
                 */
                try {
                    const refreshed =
                        await getBusinessDayClosingPreview(
                            businessDay.id
                        );

                    setPreview(
                        refreshed
                    );
                } catch {
                    /*
                     * Preserve the original close error.
                     */
                }
            } finally {
                setClosing(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Derived State
    |--------------------------------------------------------------------------
    */

    const businessDay:
        BusinessDay
        | null =
        preview
            ?.business_day
        ??
        null;

    const blockers:
        BusinessDayBlockers
        | null =
        preview
            ?.blockers
        ??
        null;

    const summary:
        BusinessDaySummary
        | null =
        preview
            ?.summary
        ??
        null;

    const paymentSummary:
        BusinessDayPaymentBreakdown
        | null =
        summary
            ?.payments
            .net
        ??
        null;

    const reconciliation =
        useMemo(
            () => {
                const difference =
                    summary
                        ?.cash_difference
                    ??
                    historicalClosing
                        ?.cash_difference
                    ??
                    0;

                return reconciliationLabel(
                    Number(
                        difference
                    )
                );
            },
            [
                historicalClosing,
                summary,
            ]
        );

    const closeEnabled =
        Boolean(
            canClose
            &&
            businessDay
            &&
            blockers
                ?.can_close
            &&
            !closing
        );

    /*
    |--------------------------------------------------------------------------
    | Loading
    |--------------------------------------------------------------------------
    */

    if (
        loading
    ) {
        return (
            <main
                className="business-day-page"
            >
                <section
                    className="business-day-loading"
                >
                    <div
                        className="business-day-spinner"
                    />

                    <strong>
                        Loading restaurant day…
                    </strong>

                    <span>
                        Checking operational and financial status.
                    </span>
                </section>
            </main>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Closed Historical View
    |--------------------------------------------------------------------------
    */

    if (
        !businessDay
        &&
        historicalClosing
    ) {
        const snapshot =
            historicalClosing
                .snapshot;

        const orders =
            snapshot
                ?.orders
                ?.completed
            ??
            null;

        const grossSales =
            snapshot
                ?.sales
                ?.gross_invoice_sales
            ??
            (
                historicalClosing
                    .total_sales
                +
                historicalClosing
                    .total_refunds
            );

        return (
            <main
                className="business-day-page"
            >
                <header
                    className="business-day-header"
                >
                    <div>
                        <span
                            className="business-day-eyebrow"
                        >
                            FINANCE
                        </span>

                        <h1>
                            Restaurant Day Closing
                        </h1>

                        <p>
                            Final immutable restaurant day reconciliation and financial snapshot.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="business-day-button business-day-button--secondary"
                        onClick={
                            () => {
                                void refresh();
                            }
                        }
                        disabled={
                            refreshing
                        }
                    >
                        {refreshing
                            ? "Refreshing…"
                            : "Refresh"}
                    </button>
                </header>

                {message
                    ? (
                        <div
                            className="business-day-alert business-day-alert--success"
                        >
                            {message}
                        </div>
                    )
                    : null}

                {error
                    ? (
                        <div
                            className="business-day-alert business-day-alert--error"
                        >
                            {error}
                        </div>
                    )
                    : null}

                <section
                    className="business-day-closed-banner"
                >
                    <div
                        className="business-day-closed-banner__icon"
                        aria-hidden="true"
                    >
                        ✓
                    </div>

                    <div>
                        <span>
                            BUSINESS DAY
                        </span>

                        <h2>
                            CLOSED
                        </h2>

                        <p>
                            This closing is an immutable historical financial snapshot.
                        </p>
                    </div>

                    <div
                        className="business-day-closed-banner__meta"
                    >
                        <span>
                            Closed by
                        </span>

                        <strong>
                            {
                                historicalClosing
                                    .closed_by
                                    ?.name
                                ??
                                "Unknown"
                            }
                        </strong>

                        <span>
                            {
                                formatDateTime(
                                    historicalClosing
                                        .closed_at
                                )
                            }
                        </span>
                    </div>
                </section>

                <section
                    className="business-day-identity-card"
                >
                    <div>
                        <span>
                            Business Date
                        </span>

                        <strong>
                            {
                                formatDate(
                                    historicalClosing
                                        .business_day
                                        ?.business_date
                                )
                            }
                        </strong>
                    </div>

                    <div>
                        <span>
                            Closed By
                        </span>

                        <strong>
                            {
                                historicalClosing
                                    .closed_by
                                    ?.name
                                ??
                                "—"
                            }
                        </strong>
                    </div>

                    <div>
                        <span>
                            Closed At
                        </span>

                        <strong>
                            {
                                formatDateTime(
                                    historicalClosing
                                        .closed_at
                                )
                            }
                        </strong>
                    </div>

                    <div>
                        <span>
                            Snapshot ID
                        </span>

                        <strong>
                            #
                            {
                                historicalClosing
                                    .id
                            }
                        </strong>
                    </div>
                </section>

                <div
                    className="business-day-grid business-day-grid--three"
                >
                    <section
                        className="business-day-panel"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    SALES
                                </span>

                                <h2>
                                    Sales Summary
                                </h2>
                            </div>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Completed Orders"
                                value={
                                    orders
                                        !==
                                        null
                                        ? String(
                                            orders
                                        )
                                        : "—"
                                }
                            />

                            <SummaryRow
                                label="Gross Sales"
                                value={
                                    formatMoney(
                                        grossSales
                                    )
                                }
                            />

                            <SummaryRow
                                label="Discounts"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .total_discounts
                                    )
                                }
                            />

                            <SummaryRow
                                label="Refunds"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .total_refunds
                                    )
                                }
                                negative
                            />

                            <SummaryRow
                                label="Net Sales"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .total_sales
                                    )
                                }
                                strong
                            />
                        </div>
                    </section>

                    <section
                        className="business-day-panel"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    PAYMENTS
                                </span>

                                <h2>
                                    Net Payment Mix
                                </h2>
                            </div>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Cash"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .payments
                                            .cash
                                    )
                                }
                            />

                            <SummaryRow
                                label="Card"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .payments
                                            .card
                                    )
                                }
                            />

                            <SummaryRow
                                label="QR"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .payments
                                            .qr
                                    )
                                }
                            />

                            <SummaryRow
                                label="Bank Transfer"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .payments
                                            .bank_transfer
                                    )
                                }
                            />

                            <SummaryRow
                                label="Other"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .payments
                                            .other
                                    )
                                }
                            />
                        </div>
                    </section>

                    <section
                        className="business-day-panel"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    OPERATIONS
                                </span>

                                <h2>
                                    Purchasing
                                </h2>
                            </div>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Purchases"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .total_purchases
                                    )
                                }
                            />

                            <SummaryRow
                                label="Supplier Payments"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .supplier_payments
                                    )
                                }
                            />
                        </div>

                        <p
                            className="business-day-panel__note"
                        >
                            Purchases and supplier payments are shown for operational cash-flow visibility and are not deducted again from profit.
                        </p>
                    </section>
                </div>

                <div
                    className="business-day-grid business-day-grid--two"
                >
                    <section
                        className="business-day-panel business-day-panel--profit"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    PROFITABILITY
                                </span>

                                <h2>
                                    Final Profit Snapshot
                                </h2>
                            </div>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Net Sales"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .total_sales
                                    )
                                }
                            />

                            <SummaryRow
                                label="COGS"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .total_cogs
                                    )
                                }
                                negative
                            />

                            <SummaryRow
                                label="Gross Profit"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .gross_profit
                                    )
                                }
                                strong
                            />

                            <SummaryRow
                                label="Expenses"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .total_expenses
                                    )
                                }
                                negative
                            />

                            <SummaryRow
                                label="Wastage"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .total_wastage_cost
                                    )
                                }
                                negative
                            />

                            <div
                                className="business-day-net-profit"
                            >
                                <span>
                                    Estimated Net Profit
                                </span>

                                <strong>
                                    {
                                        formatMoney(
                                            historicalClosing
                                                .estimated_net_profit
                                        )
                                    }
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section
                        className="business-day-panel business-day-panel--cash"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    CASH
                                </span>

                                <h2>
                                    Cash Reconciliation
                                </h2>
                            </div>

                            <span
                                className={[
                                    "business-day-reconciliation-badge",

                                    `business-day-reconciliation-badge--${reconciliation.tone}`,
                                ].join(
                                    " "
                                )}
                            >
                                {
                                    reconciliation
                                        .label
                                }
                            </span>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Expected Cash"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .expected_cash
                                    )
                                }
                            />

                            <SummaryRow
                                label="Actual Cash"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .actual_cash
                                    )
                                }
                            />

                            <SummaryRow
                                label="Difference"
                                value={
                                    formatMoney(
                                        historicalClosing
                                            .cash_difference
                                    )
                                }
                                strong
                                negative={
                                    historicalClosing
                                        .cash_difference
                                    <
                                    0
                                }
                            />
                        </div>
                    </section>
                </div>

                {historicalClosing
                    .closing_notes
                    ? (
                        <section
                            className="business-day-notes-card"
                        >
                            <span>
                                Closing Notes
                            </span>

                            <p>
                                {
                                    historicalClosing
                                        .closing_notes
                                }
                            </p>
                        </section>
                    )
                    : null}
            </main>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | No Open Business Day
    |--------------------------------------------------------------------------
    */

    if (
        !businessDay
        ||
        !blockers
        ||
        !summary
        ||
        !paymentSummary
    ) {
        return (
            <main
                className="business-day-page"
            >
                <header
                    className="business-day-header"
                >
                    <div>
                        <span
                            className="business-day-eyebrow"
                        >
                            FINANCE
                        </span>

                        <h1>
                            Restaurant Day Closing
                        </h1>

                        <p>
                            Review operational readiness and close the restaurant business day.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="business-day-button business-day-button--secondary"
                        onClick={
                            () => {
                                void refresh();
                            }
                        }
                        disabled={
                            refreshing
                        }
                    >
                        {refreshing
                            ? "Refreshing…"
                            : "Refresh"}
                    </button>
                </header>

                {error
                    ? (
                        <div
                            className="business-day-alert business-day-alert--error"
                        >
                            {error}
                        </div>
                    )
                    : null}

                <section
                    className="business-day-empty"
                >
                    <div
                        className="business-day-empty__icon"
                        aria-hidden="true"
                    >
                        ◷
                    </div>

                    <h2>
                        No Open Business Day
                    </h2>

                    <p>
                        There is currently no open restaurant business day available for closing.
                    </p>
                </section>
            </main>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | OPEN Day View
    |--------------------------------------------------------------------------
    */

    return (
        <main
            className="business-day-page"
        >
            <header
                className="business-day-header"
            >
                <div>
                    <span
                        className="business-day-eyebrow"
                    >
                        FINANCE
                    </span>

                    <h1>
                        Restaurant Day Closing
                    </h1>

                    <p>
                        Review every operational blocker and the server-calculated financial snapshot before closing the restaurant day.
                    </p>
                </div>

                <div
                    className="business-day-header__actions"
                >
                    <button
                        type="button"
                        className="business-day-button business-day-button--secondary"
                        onClick={
                            () => {
                                void refresh();
                            }
                        }
                        disabled={
                            refreshing
                            ||
                            closing
                        }
                    >
                        {refreshing
                            ? "Refreshing…"
                            : "Refresh"}
                    </button>

                    {canClose
                        ? (
                            <button
                                type="button"
                                className="business-day-button business-day-button--danger"
                                disabled={
                                    !closeEnabled
                                }
                                onClick={
                                    openCloseModal
                                }
                            >
                                Close Restaurant Day
                            </button>
                        )
                        : null}
                </div>
            </header>

            {message
                ? (
                    <div
                        className="business-day-alert business-day-alert--success"
                    >
                        {message}
                    </div>
                )
                : null}

            {error
                ? (
                    <div
                        className="business-day-alert business-day-alert--error"
                    >
                        {error}
                    </div>
                )
                : null}

            <section
                className="business-day-status-card"
            >
                <div
                    className="business-day-status-card__primary"
                >
                    <span>
                        BUSINESS DATE
                    </span>

                    <strong>
                        {
                            formatDate(
                                businessDay
                                    .business_date
                            )
                        }
                    </strong>
                </div>

                <div
                    className="business-day-status-divider"
                />

                <div>
                    <span>
                        STATUS
                    </span>

                    <strong
                        className="business-day-status-open"
                    >
                        OPEN
                    </strong>
                </div>

                <div
                    className="business-day-status-divider"
                />

                <div>
                    <span>
                        OPENED BY
                    </span>

                    <strong>
                        {
                            businessDay
                                .opened_by
                                ?.name
                            ??
                            "—"
                        }
                    </strong>
                </div>

                <div
                    className="business-day-status-divider"
                />

                <div>
                    <span>
                        OPENED AT
                    </span>

                    <strong>
                        {
                            formatDateTime(
                                businessDay
                                    .opened_at
                            )
                        }
                    </strong>
                </div>
            </section>

            <section
                className="business-day-section"
            >
                <div
                    className="business-day-section__header"
                >
                    <div>
                        <span>
                            STEP 1
                        </span>

                        <h2>
                            Pre-Close Checks
                        </h2>

                        <p>
                            Every operational item must be resolved before Laravel will allow the day to close.
                        </p>
                    </div>

                    <span
                        className={[
                            "business-day-readiness",

                            blockers
                                .can_close
                                ? "business-day-readiness--ready"
                                : "business-day-readiness--blocked",
                        ].join(
                            " "
                        )}
                    >
                        {
                            blockers
                                .can_close
                                ? "READY TO CLOSE"
                                : "ACTION REQUIRED"
                        }
                    </span>
                </div>

                <div
                    className="business-day-blockers"
                >
                    <BlockerCard
                        label="Open Tables"
                        description="Active dine-in table sessions must be closed."
                        value={
                            blockers
                                .open_tables
                        }
                    />

                    <BlockerCard
                        label="Active Orders"
                        description="Pending, confirmed, kitchen and served orders must be finalized."
                        value={
                            blockers
                                .active_orders
                        }
                    />

                    <BlockerCard
                        label="Unpaid Bills"
                        description="Issued unpaid or partially paid invoices must be settled."
                        value={
                            blockers
                                .unpaid_invoices
                        }
                    />

                    <BlockerCard
                        label="Open Cashier Shifts"
                        description="Every cashier must reconcile and close their drawer."
                        value={
                            blockers
                                .open_cashier_shifts
                        }
                    />
                </div>
            </section>

            <section
                className="business-day-section"
            >
                <div
                    className="business-day-section__header"
                >
                    <div>
                        <span>
                            STEP 2
                        </span>

                        <h2>
                            Financial Review
                        </h2>

                        <p>
                            These figures are calculated by Laravel from the current business day's authoritative records.
                        </p>
                    </div>
                </div>

                <div
                    className="business-day-kpis"
                >
                    <article>
                        <span>
                            Completed Orders
                        </span>

                        <strong>
                            {
                                summary
                                    .orders
                                    ?.completed
                                ??
                                0
                            }
                        </strong>

                        <small>
                            {
                                summary
                                    .orders
                                    ?.cancelled
                                ??
                                0
                            }
                            {" "}
                            cancelled ·
                            {" "}
                            {
                                summary
                                    .orders
                                    ?.rejected
                                ??
                                0
                            }
                            {" "}
                            rejected
                        </small>
                    </article>

                    <article>
                        <span>
                            Gross Sales
                        </span>

                        <strong>
                            {
                                formatMoney(
                                    summary
                                        .sales
                                        .gross_invoice_sales
                                )
                            }
                        </strong>

                        <small>
                            Before refunds
                        </small>
                    </article>

                    <article>
                        <span>
                            Net Sales
                        </span>

                        <strong>
                            {
                                formatMoney(
                                    summary
                                        .sales
                                        .net_sales
                                )
                            }
                        </strong>

                        <small>
                            After refunds
                        </small>
                    </article>

                    <article
                        className="business-day-kpi-profit"
                    >
                        <span>
                            Estimated Net Profit
                        </span>

                        <strong>
                            {
                                formatMoney(
                                    summary
                                        .estimated_net_profit
                                )
                            }
                        </strong>

                        <small>
                            After COGS, expenses and wastage
                        </small>
                    </article>
                </div>

                <div
                    className="business-day-grid business-day-grid--three"
                >
                    <section
                        className="business-day-panel"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    SALES
                                </span>

                                <h3>
                                    Sales Summary
                                </h3>
                            </div>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Subtotal"
                                value={
                                    formatMoney(
                                        summary
                                            .sales
                                            .subtotal
                                    )
                                }
                            />

                            <SummaryRow
                                label="Discounts"
                                value={
                                    formatMoney(
                                        summary
                                            .sales
                                            .discounts
                                    )
                                }
                                negative
                            />

                            <SummaryRow
                                label="Tax"
                                value={
                                    formatMoney(
                                        summary
                                            .sales
                                            .tax
                                    )
                                }
                            />

                            <SummaryRow
                                label="Service Charge"
                                value={
                                    formatMoney(
                                        summary
                                            .sales
                                            .service_charge
                                    )
                                }
                            />

                            <SummaryRow
                                label="Gross Invoice Sales"
                                value={
                                    formatMoney(
                                        summary
                                            .sales
                                            .gross_invoice_sales
                                    )
                                }
                            />

                            <SummaryRow
                                label="Refunds"
                                value={
                                    formatMoney(
                                        summary
                                            .sales
                                            .refunds
                                    )
                                }
                                negative
                            />

                            <SummaryRow
                                label="Net Sales"
                                value={
                                    formatMoney(
                                        summary
                                            .sales
                                            .net_sales
                                    )
                                }
                                strong
                            />
                        </div>
                    </section>

                    <section
                        className="business-day-panel"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    PAYMENTS
                                </span>

                                <h3>
                                    Net Payment Breakdown
                                </h3>
                            </div>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Cash"
                                value={
                                    formatMoney(
                                        paymentSummary
                                            .cash
                                    )
                                }
                            />

                            <SummaryRow
                                label="Card"
                                value={
                                    formatMoney(
                                        paymentSummary
                                            .card
                                    )
                                }
                            />

                            <SummaryRow
                                label="QR"
                                value={
                                    formatMoney(
                                        paymentSummary
                                            .qr
                                    )
                                }
                            />

                            <SummaryRow
                                label="Bank Transfer"
                                value={
                                    formatMoney(
                                        paymentSummary
                                            .bank_transfer
                                    )
                                }
                            />

                            <SummaryRow
                                label="Other"
                                value={
                                    formatMoney(
                                        paymentSummary
                                            .other
                                    )
                                }
                            />
                        </div>

                        <p
                            className="business-day-panel__note"
                        >
                            Completed refunds are already deducted from the corresponding payment method.
                        </p>
                    </section>

                    <section
                        className="business-day-panel"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    OPERATIONS
                                </span>

                                <h3>
                                    Purchases & Suppliers
                                </h3>
                            </div>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Purchases"
                                value={
                                    formatMoney(
                                        summary
                                            .purchases
                                    )
                                }
                            />

                            <SummaryRow
                                label="Supplier Payments"
                                value={
                                    formatMoney(
                                        summary
                                            .supplier_payments
                                    )
                                }
                            />
                        </div>

                        <p
                            className="business-day-panel__note"
                        >
                            These figures are management and cash-flow information. They are not deducted again from profit when COGS is used.
                        </p>
                    </section>
                </div>

                <div
                    className="business-day-grid business-day-grid--two"
                >
                    <section
                        className="business-day-panel business-day-panel--profit"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    PROFITABILITY
                                </span>

                                <h3>
                                    Profit Estimate
                                </h3>
                            </div>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Net Sales"
                                value={
                                    formatMoney(
                                        summary
                                            .sales
                                            .net_sales
                                    )
                                }
                            />

                            <SummaryRow
                                label="COGS"
                                value={
                                    formatMoney(
                                        summary
                                            .cogs
                                    )
                                }
                                negative
                            />

                            <SummaryRow
                                label="Gross Profit"
                                value={
                                    formatMoney(
                                        summary
                                            .gross_profit
                                    )
                                }
                                strong
                            />

                            <SummaryRow
                                label="Expenses"
                                value={
                                    formatMoney(
                                        summary
                                            .expenses
                                    )
                                }
                                negative
                            />

                            <SummaryRow
                                label="Wastage"
                                value={
                                    formatMoney(
                                        summary
                                            .wastage
                                    )
                                }
                                negative
                            />

                            <div
                                className="business-day-net-profit"
                            >
                                <span>
                                    Estimated Net Profit
                                </span>

                                <strong>
                                    {
                                        formatMoney(
                                            summary
                                                .estimated_net_profit
                                        )
                                    }
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section
                        className="business-day-panel business-day-panel--cash"
                    >
                        <div
                            className="business-day-panel__header"
                        >
                            <div>
                                <span>
                                    CASH
                                </span>

                                <h3>
                                    Cash Reconciliation
                                </h3>
                            </div>

                            <span
                                className={[
                                    "business-day-reconciliation-badge",

                                    `business-day-reconciliation-badge--${reconciliation.tone}`,
                                ].join(
                                    " "
                                )}
                            >
                                {
                                    reconciliation
                                        .label
                                }
                            </span>
                        </div>

                        <div
                            className="business-day-summary"
                        >
                            <SummaryRow
                                label="Expected Cash"
                                value={
                                    formatMoney(
                                        summary
                                            .expected_cash
                                    )
                                }
                            />

                            <SummaryRow
                                label="Actual Cash"
                                value={
                                    formatMoney(
                                        summary
                                            .actual_cash
                                    )
                                }
                            />

                            <SummaryRow
                                label="Difference"
                                value={
                                    formatMoney(
                                        summary
                                            .cash_difference
                                    )
                                }
                                strong
                                negative={
                                    summary
                                        .cash_difference
                                    <
                                    0
                                }
                            />
                        </div>

                        <p
                            className="business-day-panel__note"
                        >
                            This is the combined reconciliation result from closed cashier shifts.
                        </p>
                    </section>
                </div>
            </section>

            <section
                className="business-day-final-action"
            >
                <div>
                    <span>
                        FINAL STEP
                    </span>

                    <h2>
                        Close Restaurant Business Day
                    </h2>

                    <p>
                        Closing creates an immutable financial snapshot and changes the business day status to CLOSED.
                    </p>
                </div>

                {canClose
                    ? (
                        <button
                            type="button"
                            className="business-day-button business-day-button--danger business-day-button--large"
                            disabled={
                                !closeEnabled
                            }
                            onClick={
                                openCloseModal
                            }
                        >
                            {
                                blockers
                                    .can_close
                                    ? "Close Restaurant Day"
                                    : "Resolve Blockers First"
                            }
                        </button>
                    )
                    : (
                        <div
                            className="business-day-permission-note"
                        >
                            Your account can review this day but does not have permission to close it.
                        </div>
                    )}
            </section>

            {showCloseModal
                ? (
                    <div
                        className="business-day-modal-backdrop"
                        role="presentation"
                    >
                        <section
                            className="business-day-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="business-day-close-title"
                        >
                            <div
                                className="business-day-modal__header"
                            >
                                <div>
                                    <span>
                                        FINAL CONFIRMATION
                                    </span>

                                    <h2
                                        id="business-day-close-title"
                                    >
                                        Close Restaurant Day?
                                    </h2>

                                    <p>
                                        This will create the final immutable financial snapshot for
                                        {" "}
                                        <strong>
                                            {
                                                formatDate(
                                                    businessDay
                                                        .business_date
                                                )
                                            }
                                        </strong>
                                        .
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="business-day-modal__close"
                                    onClick={
                                        cancelClose
                                    }
                                    disabled={
                                        closing
                                    }
                                    aria-label="Close confirmation"
                                >
                                    ×
                                </button>
                            </div>

                            <div
                                className="business-day-modal__warning"
                            >
                                <strong>
                                    Historical protection
                                </strong>

                                <p>
                                    After closing, the restaurant day becomes CLOSED and its final closing snapshot cannot be edited or deleted.
                                </p>
                            </div>

                            <div
                                className="business-day-modal__summary"
                            >
                                <div>
                                    <span>
                                        Net Sales
                                    </span>

                                    <strong>
                                        {
                                            formatMoney(
                                                summary
                                                    .sales
                                                    .net_sales
                                            )
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Estimated Net Profit
                                    </span>

                                    <strong>
                                        {
                                            formatMoney(
                                                summary
                                                    .estimated_net_profit
                                            )
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Cash Difference
                                    </span>

                                    <strong>
                                        {
                                            formatMoney(
                                                summary
                                                    .cash_difference
                                            )
                                        }
                                    </strong>
                                </div>
                            </div>

                            <label
                                className="business-day-modal__field"
                            >
                                <span>
                                    Closing Notes
                                </span>

                                <textarea
                                    value={
                                        closingNotes
                                    }
                                    maxLength={
                                        2000
                                    }
                                    rows={
                                        5
                                    }
                                    disabled={
                                        closing
                                    }
                                    placeholder="Optional manager or owner closing notes…"
                                    onChange={
                                        event => {
                                            setClosingNotes(
                                                event
                                                    .target
                                                    .value
                                            );
                                        }
                                    }
                                />

                                <small>
                                    {
                                        closingNotes
                                            .length
                                    }
                                    /2000
                                </small>
                            </label>

                            <div
                                className="business-day-modal__footer"
                            >
                                <button
                                    type="button"
                                    className="business-day-button business-day-button--secondary"
                                    onClick={
                                        cancelClose
                                    }
                                    disabled={
                                        closing
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className="business-day-button business-day-button--danger"
                                    disabled={
                                        closing
                                    }
                                    onClick={
                                        () => {
                                            void confirmClose();
                                        }
                                    }
                                >
                                    {closing
                                        ? "Closing Restaurant Day…"
                                        : "Confirm & Close Day"}
                                </button>
                            </div>
                        </section>
                    </div>
                )
                : null}

            <footer
                className="business-day-authority-note"
            >
                Financial values shown on this page are calculated by the Laravel API. The Operations application does not write or calculate authoritative closing totals.
            </footer>
        </main>
    );
}