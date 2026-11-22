import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import {
    useStaffRealtimeRefresh,
} from "../realtime/realtimeBus";

import {
    useAuth,
} from "../auth/useAuth";

import type {
    Supplier,
} from "../suppliers/types";

import type {
    Purchase,
} from "../purchases/types";

import SupplierPaymentDetailsModal
    from "./SupplierPaymentDetailsModal";

import SupplierPaymentModal
    from "./SupplierPaymentModal";

import {
    getOutstandingPurchases,
    getSupplierPaymentBatch,
    getSupplierPayments,
    getSupplierPaymentSupplierOptions,
    recordSupplierPayment,
} from "./supplierPaymentService";

import type {
    SupplierPaymentBatch,
    SupplierPaymentMethod,
    SupplierPaymentPagination,
    SupplierPaymentPayload,
} from "./types";

import "./SupplierPaymentsPage.css";

const EMPTY_PAGINATION: SupplierPaymentPagination = {
    current_page: 1,
    per_page: 30,
    total: 0,
    last_page: 1,
};

interface FilterState {
    search: string;
    supplierId: string;
    paymentMethod: "" | SupplierPaymentMethod;
    dateFrom: string;
    dateTo: string;
}

const EMPTY_FILTERS: FilterState = {
    search: "",
    supplierId: "",
    paymentMethod: "",
    dateFrom: "",
    dateTo: "",
};

/*
|--------------------------------------------------------------------------
| Notification auto-dismiss duration
|--------------------------------------------------------------------------
*/

const NOTIFICATION_TIMEOUT_MS = 3500;

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
| Derives a short, human-friendly supplier payment batch reference
| from the batch record:
|
|     SP-YYYYMMDD-NN
|
|     SP         → Supplier Payment prefix
|     YYYYMMDD   → Payment date (falls back to created_at)
|     NN         → Batch ID, zero-padded to at least 2 digits
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
        const rawDate =
            batch.payment_date ??
            batch.created_at ??
            null;

        if (!rawDate) {
            return batch.batch_number;
        }

        const fallback = new Date(rawDate);

        if (Number.isNaN(fallback.getTime())) {
            /* Fall back to the raw backend identifier. */
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

function toPaymentMethodFilter(
    value: string,
): FilterState["paymentMethod"] {
    switch (value) {
        case "":
            return "";
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
            return "";
    }
}

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "The supplier payment operation could not be completed.";
}

function methodLabel(method: string): string {
    return method.replaceAll("_", " ");
}

export default function SupplierPaymentsPage() {
    const { user, hasPermission } = useAuth();

    const canPay = hasPermission("purchases.pay");

    const allowCash = user?.role?.code === "CASHIER";

    const [batches, setBatches] =
        useState<SupplierPaymentBatch[]>([]);

    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);

    const [page, setPage] = useState(1);

    const [filterDraft, setFilterDraft] =
        useState<FilterState>(EMPTY_FILTERS);

    const [filters, setFilters] =
        useState<FilterState>(EMPTY_FILTERS);

    const [suppliers, setSuppliers] =
        useState<Supplier[]>([]);

    const [outstandingPurchases, setOutstandingPurchases] =
        useState<Purchase[]>([]);

    const [paymentModalOpen, setPaymentModalOpen] =
        useState(false);

    const [selectedBatch, setSelectedBatch] =
        useState<SupplierPaymentBatch | undefined>(undefined);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(false);

    const [busyBatchId, setBusyBatchId] =
        useState<number | null>(null);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    /*
    |--------------------------------------------------------------------------
    | Load Supplier Payments
    |--------------------------------------------------------------------------
    */

    const loadPayments = useCallback(
        async (silent: boolean = false): Promise<void> => {
            try {
                const result = await getSupplierPayments({
                    page,
                    search: filters.search,
                    supplierId: filters.supplierId
                        ? Number(filters.supplierId)
                        : null,
                    paymentMethod:
                        filters.paymentMethod || null,
                    dateFrom: filters.dateFrom,
                    dateTo: filters.dateTo,
                    perPage: 30,
                });

                setBatches(result.batches);
                setPagination(result.pagination);
            } catch (caught) {
                if (silent) {
                    console.error(
                        "Unable to reconcile realtime supplier payment records.",
                        caught,
                    );

                    return;
                }

                setError(errorMessage(caught));
            } finally {
                if (!silent) {
                    setLoading(false);
                }
            }
        },
        [page, filters],
    );

    /*
    |--------------------------------------------------------------------------
    | Load Supplier Options
    |--------------------------------------------------------------------------
    */

    const loadSupplierOptions = useCallback(
        async (): Promise<Supplier[]> => {
            const records =
                await getSupplierPaymentSupplierOptions();

            setSuppliers(records);

            return records;
        },
        [],
    );

    /*
    |--------------------------------------------------------------------------
    | Load Outstanding Purchases
    |--------------------------------------------------------------------------
    */

    const loadOutstandingPurchases = useCallback(
        async (): Promise<Purchase[]> => {
            const purchases = await getOutstandingPurchases();

            setOutstandingPurchases(purchases);

            return purchases;
        },
        [],
    );

    /*
    |--------------------------------------------------------------------------
    | Initial / Filter Payment Loading
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadPayments();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [loadPayments]);

    /*
    |--------------------------------------------------------------------------
    | Initial Supplier Filter Options
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadSupplierOptions().catch(() => {
                /*
                 * Supplier filtering is optional.
                 *
                 * Payment history remains usable even
                 * if this lookup cannot be loaded.
                 */
            });
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [loadSupplierOptions]);

    /*
    |--------------------------------------------------------------------------
    | Auto-dismiss success notification
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        if (!message) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setMessage("");
        }, NOTIFICATION_TIMEOUT_MS);

        return () => window.clearTimeout(timeoutId);
    }, [message]);

    /*
    |--------------------------------------------------------------------------
    | Auto-dismiss error notification
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        if (!error) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setError("");
        }, NOTIFICATION_TIMEOUT_MS);

        return () => window.clearTimeout(timeoutId);
    }, [error]);

    /*
    |--------------------------------------------------------------------------
    | Summary
    |--------------------------------------------------------------------------
    */

    const visibleTotal = useMemo(
        () =>
            batches.reduce(
                (total, batch) =>
                    total + batch.total_amount,
                0,
            ),
        [batches],
    );

    const visibleCash = useMemo(
        () =>
            batches.reduce(
                (batchTotal, batch) =>
                    batchTotal +
                    batch.payments.reduce(
                        (paymentTotal, payment) =>
                            payment.payment_method === "CASH"
                                ? paymentTotal + payment.amount
                                : paymentTotal,
                        0,
                    ),
                0,
            ),
        [batches],
    );

    const visibleNonCash = visibleTotal - visibleCash;

    /*
    |--------------------------------------------------------------------------
    | Open Payment Modal
    |--------------------------------------------------------------------------
    */

    const openPaymentModal = async (): Promise<void> => {
        if (optionsLoading) {
            return;
        }

        setOptionsLoading(true);
        setError("");
        setMessage("");

        try {
            await loadOutstandingPurchases();
            setPaymentModalOpen(true);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setOptionsLoading(false);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Submit Supplier Payment
    |--------------------------------------------------------------------------
    */

    const submitPayment = async (
        purchaseId: number,
        payload: SupplierPaymentPayload,
    ): Promise<void> => {
        const batch = await recordSupplierPayment(
            purchaseId,
            payload,
        );

        setPaymentModalOpen(false);
        setOutstandingPurchases([]);

        /*
         * Use the short human-friendly reference for the toast.
         */
        setMessage(
            `${formatBatchReference(batch)} recorded successfully.`,
        );

        if (page !== 1) {
            setLoading(true);
            setPage(1);
        } else {
            await loadPayments();
        }

        try {
            await loadSupplierOptions();
        } catch {
            /*
             * Realtime/reconnect can reconcile later.
             */
        }
    };

    /*
    |--------------------------------------------------------------------------
    | View Payment Batch
    |--------------------------------------------------------------------------
    */

    const viewBatch = async (
        batch: SupplierPaymentBatch,
    ): Promise<void> => {
        setBusyBatchId(batch.id);
        setError("");

        try {
            const current = await getSupplierPaymentBatch(
                batch.id,
            );

            setSelectedBatch(current);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setBusyBatchId(null);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Refresh Selected Batch
    |--------------------------------------------------------------------------
    */

    const refreshSelectedBatch = useCallback(
        async (): Promise<void> => {
            if (!selectedBatch) {
                return;
            }

            const batchId = selectedBatch.id;

            try {
                const current = await getSupplierPaymentBatch(
                    batchId,
                );

                setSelectedBatch((existing) => {
                    if (
                        !existing ||
                        existing.id !== batchId
                    ) {
                        return existing;
                    }

                    return current;
                });
            } catch (caught) {
                console.error(
                    "Unable to reconcile realtime supplier payment details.",
                    caught,
                );
            }
        },
        [selectedBatch],
    );

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

    const submitFilters = (event: FormEvent): void => {
        event.preventDefault();

        if (
            filterDraft.dateFrom &&
            filterDraft.dateTo &&
            filterDraft.dateTo < filterDraft.dateFrom
        ) {
            setError(
                "Date To cannot be earlier than Date From.",
            );

            return;
        }

        setError("");
        setMessage("");
        setLoading(true);
        setPage(1);

        setFilters({
            ...filterDraft,
            search: filterDraft.search.trim(),
        });
    };

    const clearFilters = (): void => {
        setFilterDraft(EMPTY_FILTERS);
        setFilters(EMPTY_FILTERS);
        setError("");
        setMessage("");
        setLoading(true);
        setPage(1);
    };

    /*
    |--------------------------------------------------------------------------
    | Manual Refresh
    |--------------------------------------------------------------------------
    */

    const refresh = async (): Promise<void> => {
        if (refreshing) {
            return;
        }

        setRefreshing(true);
        setError("");

        try {
            const jobs: Array<Promise<unknown>> = [
                loadPayments(),
                loadSupplierOptions(),
                refreshSelectedBatch(),
            ];

            if (paymentModalOpen) {
                jobs.push(loadOutstandingPurchases());
            }

            await Promise.all(jobs);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setRefreshing(false);
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        ["supplier_payments", "purchases", "suppliers"],
        async () => {
            try {
                const jobs: Array<Promise<unknown>> = [
                    loadPayments(true),
                    loadSupplierOptions(),
                    refreshSelectedBatch(),
                ];

                if (paymentModalOpen) {
                    jobs.push(loadOutstandingPurchases());
                }

                await Promise.all(jobs);
            } catch (caught) {
                console.error(
                    "Unable to reconcile realtime supplier payment data.",
                    caught,
                );
            }
        },
    );

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <div className="supplier-payments-page">
            <header className="supplier-payments-page-header">
                <div>
                    <div className="supplier-payments-eyebrow">
                        Accounts Payable
                    </div>

                    <h1>Supplier Payments</h1>

                    <p>
                        Record partial, full and split payments
                        against completed supplier purchases
                        and review payment history.
                    </p>
                </div>

                <div className="supplier-payments-header-actions">
                    <button
                        type="button"
                        className="supplier-payments-button supplier-payments-button-secondary"
                        disabled={refreshing}
                        onClick={() => {
                            void refresh();
                        }}
                    >
                        {refreshing
                            ? "Refreshing..."
                            : "Refresh"}
                    </button>

                    {canPay && (
                        <button
                            type="button"
                            className="supplier-payments-button supplier-payments-button-primary"
                            disabled={optionsLoading}
                            onClick={() => {
                                void openPaymentModal();
                            }}
                        >
                            {optionsLoading
                                ? "Loading..."
                                : "+ Record Payment"}
                        </button>
                    )}
                </div>
            </header>

            {error && (
                <div
                    className="supplier-payments-alert supplier-payments-alert-error supplier-payments-alert-dismissible"
                    role="alert"
                >
                    <span className="supplier-payments-alert-text">
                        {error}
                    </span>

                    <button
                        type="button"
                        className="supplier-payments-alert-close"
                        onClick={() => setError("")}
                        aria-label="Dismiss error"
                    >
                        ×
                    </button>
                </div>
            )}

            {message && (
                <div
                    className="supplier-payments-alert supplier-payments-alert-success supplier-payments-alert-dismissible"
                    role="status"
                >
                    <span className="supplier-payments-alert-text">
                        {message}
                    </span>

                    <button
                        type="button"
                        className="supplier-payments-alert-close"
                        onClick={() => setMessage("")}
                        aria-label="Dismiss message"
                    >
                        ×
                    </button>
                </div>
            )}

            <section className="supplier-payments-summary-grid">
                <article>
                    <span>Payment Batches</span>
                    <strong>{pagination.total}</strong>
                    <small>Matching current filters</small>
                </article>

                <article>
                    <span>Paid on Page</span>
                    <strong>{money.format(visibleTotal)}</strong>
                    <small>Current page only</small>
                </article>

                <article>
                    <span>Cash on Page</span>
                    <strong>{money.format(visibleCash)}</strong>
                    <small>Physical drawer cash-out</small>
                </article>

                <article>
                    <span>Non-Cash on Page</span>
                    <strong>{money.format(visibleNonCash)}</strong>
                    <small>Card, bank, cheque and other</small>
                </article>
            </section>

            <section className="supplier-payments-panel">
                <form
                    className="supplier-payments-filters"
                    onSubmit={submitFilters}
                >
                    <label className="supplier-payments-filter-field supplier-payments-filter-search">
                        <span>Search</span>

                        <input
                            type="search"
                            maxLength={150}
                            value={filterDraft.search}
                            placeholder="Batch, supplier, purchase or reference..."
                            onChange={(event) =>
                                setFilterDraft((current) => ({
                                    ...current,
                                    search: event.target.value,
                                }))
                            }
                        />
                    </label>

                    <label className="supplier-payments-filter-field">
                        <span>Supplier</span>

                        <select
                            value={filterDraft.supplierId}
                            onChange={(event) =>
                                setFilterDraft((current) => ({
                                    ...current,
                                    supplierId:
                                        event.target.value,
                                }))
                            }
                        >
                            <option value="">
                                All Suppliers
                            </option>

                            {suppliers.map((supplier) => (
                                <option
                                    key={supplier.id}
                                    value={supplier.id}
                                >
                                    {supplier.supplier_code} —{" "}
                                    {supplier.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="supplier-payments-filter-field">
                        <span>Method</span>

                        <select
                            value={filterDraft.paymentMethod}
                            onChange={(event) =>
                                setFilterDraft((current) => ({
                                    ...current,
                                    paymentMethod:
                                        toPaymentMethodFilter(
                                            event.target.value,
                                        ),
                                }))
                            }
                        >
                            <option value="">
                                All Methods
                            </option>
                            <option value="CASH">Cash</option>
                            <option value="CARD">Card</option>
                            <option value="BANK_TRANSFER">
                                Bank Transfer
                            </option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </label>

                    <label className="supplier-payments-filter-field">
                        <span>Date From</span>

                        <input
                            type="date"
                            value={filterDraft.dateFrom}
                            onChange={(event) =>
                                setFilterDraft((current) => ({
                                    ...current,
                                    dateFrom:
                                        event.target.value,
                                }))
                            }
                        />
                    </label>

                    <label className="supplier-payments-filter-field">
                        <span>Date To</span>

                        <input
                            type="date"
                            value={filterDraft.dateTo}
                            onChange={(event) =>
                                setFilterDraft((current) => ({
                                    ...current,
                                    dateTo: event.target.value,
                                }))
                            }
                        />
                    </label>

                    <div className="supplier-payments-filter-actions">
                        <button
                            type="submit"
                            className="supplier-payments-button supplier-payments-button-primary"
                        >
                            Apply
                        </button>

                        <button
                            type="button"
                            className="supplier-payments-button supplier-payments-button-secondary"
                            onClick={clearFilters}
                        >
                            Clear
                        </button>
                    </div>
                </form>

                {loading ? (
                    <div className="supplier-payments-loading">
                        Loading supplier payments...
                    </div>
                ) : batches.length === 0 ? (
                    <div className="supplier-payments-empty">
                        <strong>
                            No supplier payments found
                        </strong>

                        <p>
                            Record a payment or change the
                            current filters.
                        </p>
                    </div>
                ) : (
                    <div className="supplier-payments-table-wrap">
                        <table className="supplier-payments-table">
                            <thead>
                                <tr>
                                    <th>Batch</th>
                                    <th>Date</th>
                                    <th>Supplier</th>
                                    <th>Purchase</th>
                                    <th>Methods</th>
                                    <th>Amount</th>
                                    <th>Current Balance</th>
                                    <th>Recorded By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {batches.map((batch) => {
                                    const methods = Array.from(
                                        new Set(
                                            batch.payments.map(
                                                (payment) =>
                                                    payment.payment_method,
                                            ),
                                        ),
                                    );

                                    return (
                                        <tr key={batch.id}>
                                            <td>
                                                <strong
                                                    className="supplier-payments-batch-ref"
                                                    title={
                                                        batch.batch_number
                                                    }
                                                >
                                                    {formatBatchReference(
                                                        batch,
                                                    )}
                                                </strong>
                                            </td>

                                            <td>
                                                {batch.payment_date ??
                                                    "—"}
                                            </td>

                                            <td>
                                                <strong>
                                                    {batch.supplier
                                                        ?.name ?? "—"}
                                                </strong>
                                            </td>

                                            <td>
                                                {batch.purchase
                                                    ?.purchase_number ??
                                                    "—"}
                                            </td>

                                            <td>
                                                <div className="supplier-payments-methods">
                                                    {methods.map(
                                                        (method) => (
                                                            <span
                                                                key={
                                                                    method
                                                                }
                                                                className="supplier-payments-method-badge"
                                                            >
                                                                {methodLabel(
                                                                    method,
                                                                )}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                            </td>

                                            <td>
                                                <strong>
                                                    {money.format(
                                                        batch.total_amount,
                                                    )}
                                                </strong>
                                            </td>

                                            <td>
                                                {batch.purchase
                                                    ? money.format(
                                                        batch
                                                            .purchase
                                                            .balance_due,
                                                    )
                                                    : "—"}
                                            </td>

                                            <td>
                                                {batch.created_by
                                                    ?.name ?? "—"}
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="supplier-payments-small-button"
                                                    disabled={
                                                        busyBatchId !==
                                                        null
                                                    }
                                                    onClick={() => {
                                                        void viewBatch(
                                                            batch,
                                                        );
                                                    }}
                                                >
                                                    {busyBatchId ===
                                                        batch.id
                                                        ? "Loading..."
                                                        : "View"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination.last_page > 1 && (
                    <div className="supplier-payments-pagination">
                        <span>
                            {pagination.total} payment batches
                        </span>

                        <div>
                            <button
                                type="button"
                                className="supplier-payments-button supplier-payments-button-secondary"
                                disabled={
                                    loading ||
                                    pagination.current_page <= 1
                                }
                                onClick={() => {
                                    setLoading(true);
                                    setPage((current) =>
                                        Math.max(
                                            1,
                                            current - 1,
                                        ),
                                    );
                                }}
                            >
                                ← Previous
                            </button>

                            <span>
                                Page{" "}
                                {pagination.current_page} of{" "}
                                {pagination.last_page}
                            </span>

                            <button
                                type="button"
                                className="supplier-payments-button supplier-payments-button-secondary"
                                disabled={
                                    loading ||
                                    pagination.current_page >=
                                    pagination.last_page
                                }
                                onClick={() => {
                                    setLoading(true);
                                    setPage(
                                        (current) => current + 1,
                                    );
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {paymentModalOpen && (
                <SupplierPaymentModal
                    purchases={outstandingPurchases}
                    allowCash={allowCash}
                    onClose={() => {
                        setPaymentModalOpen(false);
                        setOutstandingPurchases([]);
                    }}
                    onSubmit={submitPayment}
                />
            )}

            {selectedBatch && (
                <SupplierPaymentDetailsModal
                    batch={selectedBatch}
                    onClose={() =>
                        setSelectedBatch(undefined)
                    }
                />
            )}
        </div>
    );
}