import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

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

const EMPTY_PAGINATION:
    SupplierPaymentPagination = {
    current_page:
        1,

    per_page:
        30,

    total:
        0,

    last_page:
        1,
};

interface FilterState {
    search: string;

    supplierId: string;

    paymentMethod:
    "" | SupplierPaymentMethod;

    dateFrom: string;

    dateTo: string;
}

function toPaymentMethodFilter(
    value: string
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

const EMPTY_FILTERS:
    FilterState = {
    search:
        "",

    supplierId:
        "",

    paymentMethod:
        "",

    dateFrom:
        "",

    dateTo:
        "",
};

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

function errorMessage(
    error: unknown
): string {
    if (
        error instanceof Error
        && error.message
    ) {
        return error.message;
    }

    return "The supplier payment operation could not be completed.";
}

function methodLabel(
    method: string
): string {
    return method.replaceAll(
        "_",
        " "
    );
}

export default function SupplierPaymentsPage() {
    const {
        user,
        hasPermission,
    } =
        useAuth();

    const canPay =
        hasPermission(
            "purchases.pay"
        );

    const allowCash =
        user?.role?.code
        === "CASHIER";

    const [
        batches,
        setBatches,
    ] =
        useState<
            SupplierPaymentBatch[]
        >(
            []
        );

    const [
        pagination,
        setPagination,
    ] =
        useState(
            EMPTY_PAGINATION
        );

    const [
        page,
        setPage,
    ] =
        useState(
            1
        );

    const [
        filterDraft,
        setFilterDraft,
    ] =
        useState<FilterState>(
            EMPTY_FILTERS
        );

    const [
        filters,
        setFilters,
    ] =
        useState<FilterState>(
            EMPTY_FILTERS
        );

    const [
        suppliers,
        setSuppliers,
    ] =
        useState<Supplier[]>(
            []
        );

    const [
        outstandingPurchases,
        setOutstandingPurchases,
    ] =
        useState<Purchase[]>(
            []
        );

    const [
        paymentModalOpen,
        setPaymentModalOpen,
    ] =
        useState(
            false
        );

    const [
        selectedBatch,
        setSelectedBatch,
    ] =
        useState<
            SupplierPaymentBatch
            | undefined
        >(
            undefined
        );

    const [
        loading,
        setLoading,
    ] =
        useState(
            true
        );

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(
            false
        );

    const [
        optionsLoading,
        setOptionsLoading,
    ] =
        useState(
            false
        );

    const [
        busyBatchId,
        setBusyBatchId,
    ] =
        useState<
            number | null
        >(
            null
        );

    const [
        error,
        setError,
    ] =
        useState(
            ""
        );

    const [
        message,
        setMessage,
    ] =
        useState(
            ""
        );

    const loadPayments =
        useCallback(
            async () => {
                try {
                    const result =
                        await getSupplierPayments({
                            page,

                            search:
                                filters.search,

                            supplierId:
                                filters.supplierId
                                    ? Number(
                                        filters.supplierId
                                    )
                                    : null,

                            paymentMethod:
                                filters.paymentMethod
                                || null,

                            dateFrom:
                                filters.dateFrom,

                            dateTo:
                                filters.dateTo,

                            perPage:
                                30,
                        });

                    setBatches(
                        result.batches
                    );

                    setPagination(
                        result.pagination
                    );
                } catch (
                caught
                ) {
                    setError(
                        errorMessage(
                            caught
                        )
                    );
                } finally {
                    setLoading(
                        false
                    );
                }
            },
            [
                page,
                filters,
            ]
        );

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void loadPayments();
                    },
                    0
                );

            return () =>
                window.clearTimeout(
                    timeoutId
                );
        },
        [
            loadPayments,
        ]
    );

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void getSupplierPaymentSupplierOptions()
                            .then(
                                (
                                    records
                                ) =>
                                    setSuppliers(
                                        records
                                    )
                            )
                            .catch(
                                () => {
                                    /*
                                     * Supplier filter is optional.
                                     * The page remains usable even if
                                     * this lookup is unavailable.
                                     */
                                }
                            );
                    },
                    0
                );

            return () =>
                window.clearTimeout(
                    timeoutId
                );
        },
        []
    );

    const visibleTotal =
        useMemo(
            () =>
                batches.reduce(
                    (
                        total,
                        batch
                    ) =>
                        total
                        + batch.total_amount,
                    0
                ),
            [
                batches,
            ]
        );

    const visibleCash =
        useMemo(
            () =>
                batches.reduce(
                    (
                        batchTotal,
                        batch
                    ) =>
                        batchTotal
                        + batch.payments.reduce(
                            (
                                paymentTotal,
                                payment
                            ) =>
                                payment.payment_method
                                    === "CASH"
                                    ? paymentTotal
                                    + payment.amount
                                    : paymentTotal,
                            0
                        ),
                    0
                ),
            [
                batches,
            ]
        );

    const visibleNonCash =
        visibleTotal
        - visibleCash;

    const openPaymentModal =
        async () => {
            if (
                optionsLoading
            ) {
                return;
            }

            setOptionsLoading(
                true
            );

            setError(
                ""
            );

            setMessage(
                ""
            );

            try {
                const purchases =
                    await getOutstandingPurchases();

                setOutstandingPurchases(
                    purchases
                );

                setPaymentModalOpen(
                    true
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setOptionsLoading(
                    false
                );
            }
        };

    const submitPayment =
        async (
            purchaseId: number,
            payload: SupplierPaymentPayload
        ) => {
            const batch =
                await recordSupplierPayment(
                    purchaseId,
                    payload
                );

            setPaymentModalOpen(
                false
            );

            setOutstandingPurchases(
                []
            );

            setMessage(
                `${batch.batch_number} recorded successfully.`
            );

            if (
                page !== 1
            ) {
                setLoading(
                    true
                );

                setPage(
                    1
                );
            } else {
                await loadPayments();
            }
        };

    const viewBatch =
        async (
            batch: SupplierPaymentBatch
        ) => {
            setBusyBatchId(
                batch.id
            );

            setError(
                ""
            );

            try {
                const current =
                    await getSupplierPaymentBatch(
                        batch.id
                    );

                setSelectedBatch(
                    current
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setBusyBatchId(
                    null
                );
            }
        };

    const submitFilters =
        (
            event: FormEvent
        ) => {
            event.preventDefault();

            if (
                filterDraft.dateFrom
                && filterDraft.dateTo
                && filterDraft.dateTo
                < filterDraft.dateFrom
            ) {
                setError(
                    "Date To cannot be earlier than Date From."
                );

                return;
            }

            setError(
                ""
            );

            setMessage(
                ""
            );

            setLoading(
                true
            );

            setPage(
                1
            );

            setFilters({
                ...filterDraft,

                search:
                    filterDraft.search.trim(),
            });
        };

    const clearFilters =
        () => {
            setFilterDraft(
                EMPTY_FILTERS
            );

            setFilters(
                EMPTY_FILTERS
            );

            setError(
                ""
            );

            setMessage(
                ""
            );

            setLoading(
                true
            );

            setPage(
                1
            );
        };

    const refresh =
        async () => {
            if (
                refreshing
            ) {
                return;
            }

            setRefreshing(
                true
            );

            setError(
                ""
            );

            try {
                await loadPayments();
            } finally {
                setRefreshing(
                    false
                );
            }
        };

    return (
        <div className="supplier-payments-page">
            <header className="supplier-payments-page-header">
                <div>
                    <div className="supplier-payments-eyebrow">
                        Accounts Payable
                    </div>

                    <h1>
                        Supplier Payments
                    </h1>

                    <p>
                        Record partial, full and split payments against
                        completed supplier purchases and review payment
                        history.
                    </p>
                </div>

                <div className="supplier-payments-header-actions">
                    <button
                        type="button"
                        className="supplier-payments-button supplier-payments-button-secondary"
                        disabled={refreshing}
                        onClick={
                            () =>
                                void refresh()
                        }
                    >
                        {
                            refreshing
                                ? "Refreshing..."
                                : "Refresh"
                        }
                    </button>

                    {
                        canPay
                        && (
                            <button
                                type="button"
                                className="supplier-payments-button supplier-payments-button-primary"
                                disabled={optionsLoading}
                                onClick={
                                    () =>
                                        void openPaymentModal()
                                }
                            >
                                {
                                    optionsLoading
                                        ? "Loading..."
                                        : "+ Record Payment"
                                }
                            </button>
                        )
                    }
                </div>
            </header>

            {
                error
                && (
                    <div className="supplier-payments-alert supplier-payments-alert-error">
                        {error}
                    </div>
                )
            }

            {
                message
                && (
                    <div className="supplier-payments-alert supplier-payments-alert-success">
                        {message}
                    </div>
                )
            }

            <section className="supplier-payments-summary-grid">
                <article>
                    <span>
                        Payment Batches
                    </span>

                    <strong>
                        {
                            pagination.total
                        }
                    </strong>

                    <small>
                        Matching current filters
                    </small>
                </article>

                <article>
                    <span>
                        Paid on Page
                    </span>

                    <strong>
                        {
                            money.format(
                                visibleTotal
                            )
                        }
                    </strong>

                    <small>
                        Current page only
                    </small>
                </article>

                <article>
                    <span>
                        Cash on Page
                    </span>

                    <strong>
                        {
                            money.format(
                                visibleCash
                            )
                        }
                    </strong>

                    <small>
                        Physical drawer cash-out
                    </small>
                </article>

                <article>
                    <span>
                        Non-Cash on Page
                    </span>

                    <strong>
                        {
                            money.format(
                                visibleNonCash
                            )
                        }
                    </strong>

                    <small>
                        Card, bank, cheque and other
                    </small>
                </article>
            </section>

            <section className="supplier-payments-panel">
                <form
                    className="supplier-payments-filters"
                    onSubmit={submitFilters}
                >
                    <label className="supplier-payments-filter-field supplier-payments-filter-search">
                        <span>
                            Search
                        </span>

                        <input
                            type="search"
                            maxLength={150}
                            value={filterDraft.search}
                            placeholder="Batch, supplier, purchase or reference..."
                            onChange={
                                (
                                    event
                                ) =>
                                    setFilterDraft(
                                        (
                                            current
                                        ) => ({
                                            ...current,

                                            search:
                                                event.target.value,
                                        })
                                    )
                            }
                        />
                    </label>

                    <label className="supplier-payments-filter-field">
                        <span>
                            Supplier
                        </span>

                        <select
                            value={filterDraft.supplierId}
                            onChange={
                                (
                                    event
                                ) =>
                                    setFilterDraft(
                                        (
                                            current
                                        ) => ({
                                            ...current,

                                            supplierId:
                                                event.target.value,
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All Suppliers
                            </option>

                            {
                                suppliers.map(
                                    (
                                        supplier
                                    ) => (
                                        <option
                                            key={supplier.id}
                                            value={supplier.id}
                                        >
                                            {
                                                supplier.supplier_code
                                            }
                                            {" — "}
                                            {
                                                supplier.name
                                            }
                                        </option>
                                    )
                                )
                            }
                        </select>
                    </label>

                    <label className="supplier-payments-filter-field">
                        <span>
                            Method
                        </span>

                        <select
                            value={filterDraft.paymentMethod}
                            onChange={
                                (
                                    event
                                ) =>
                                    setFilterDraft(
                                        (
                                            current
                                        ) => ({
                                            ...current,

                                            paymentMethod:
                                                toPaymentMethodFilter(
                                                    event.target.value
                                                ),
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All Methods
                            </option>

                            <option value="CASH">
                                Cash
                            </option>

                            <option value="CARD">
                                Card
                            </option>

                            <option value="BANK_TRANSFER">
                                Bank Transfer
                            </option>

                            <option value="CHEQUE">
                                Cheque
                            </option>

                            <option value="OTHER">
                                Other
                            </option>
                        </select>
                    </label>

                    <label className="supplier-payments-filter-field">
                        <span>
                            Date From
                        </span>

                        <input
                            type="date"
                            value={filterDraft.dateFrom}
                            onChange={
                                (
                                    event
                                ) =>
                                    setFilterDraft(
                                        (
                                            current
                                        ) => ({
                                            ...current,

                                            dateFrom:
                                                event.target.value,
                                        })
                                    )
                            }
                        />
                    </label>

                    <label className="supplier-payments-filter-field">
                        <span>
                            Date To
                        </span>

                        <input
                            type="date"
                            value={filterDraft.dateTo}
                            onChange={
                                (
                                    event
                                ) =>
                                    setFilterDraft(
                                        (
                                            current
                                        ) => ({
                                            ...current,

                                            dateTo:
                                                event.target.value,
                                        })
                                    )
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

                {
                    loading
                        ? (
                            <div className="supplier-payments-loading">
                                Loading supplier payments...
                            </div>
                        )
                        : batches.length === 0
                            ? (
                                <div className="supplier-payments-empty">
                                    <strong>
                                        No supplier payments found
                                    </strong>

                                    <p>
                                        Record a payment or change the current filters.
                                    </p>
                                </div>
                            )
                            : (
                                <div className="supplier-payments-table-wrap">
                                    <table className="supplier-payments-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Batch
                                                </th>

                                                <th>
                                                    Date
                                                </th>

                                                <th>
                                                    Supplier
                                                </th>

                                                <th>
                                                    Purchase
                                                </th>

                                                <th>
                                                    Methods
                                                </th>

                                                <th>
                                                    Amount
                                                </th>

                                                <th>
                                                    Current Balance
                                                </th>

                                                <th>
                                                    Recorded By
                                                </th>

                                                <th>
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {
                                                batches.map(
                                                    (
                                                        batch
                                                    ) => {
                                                        const methods =
                                                            Array.from(
                                                                new Set(
                                                                    batch.payments.map(
                                                                        (
                                                                            payment
                                                                        ) =>
                                                                            payment.payment_method
                                                                    )
                                                                )
                                                            );

                                                        return (
                                                            <tr key={batch.id}>
                                                                <td>
                                                                    <strong>
                                                                        {
                                                                            batch.batch_number
                                                                        }
                                                                    </strong>
                                                                </td>

                                                                <td>
                                                                    {
                                                                        batch.payment_date
                                                                        ?? "—"
                                                                    }
                                                                </td>

                                                                <td>
                                                                    <strong>
                                                                        {
                                                                            batch.supplier?.name
                                                                            ?? "—"
                                                                        }
                                                                    </strong>
                                                                </td>

                                                                <td>
                                                                    {
                                                                        batch.purchase?.purchase_number
                                                                        ?? "—"
                                                                    }
                                                                </td>

                                                                <td>
                                                                    <div className="supplier-payments-methods">
                                                                        {
                                                                            methods.map(
                                                                                (
                                                                                    method
                                                                                ) => (
                                                                                    <span
                                                                                        key={method}
                                                                                        className="supplier-payments-method-badge"
                                                                                    >
                                                                                        {
                                                                                            methodLabel(
                                                                                                method
                                                                                            )
                                                                                        }
                                                                                    </span>
                                                                                )
                                                                            )
                                                                        }
                                                                    </div>
                                                                </td>

                                                                <td>
                                                                    <strong>
                                                                        {
                                                                            money.format(
                                                                                batch.total_amount
                                                                            )
                                                                        }
                                                                    </strong>
                                                                </td>

                                                                <td>
                                                                    {
                                                                        batch.purchase
                                                                            ? money.format(
                                                                                batch.purchase.balance_due
                                                                            )
                                                                            : "—"
                                                                    }
                                                                </td>

                                                                <td>
                                                                    {
                                                                        batch.created_by?.name
                                                                        ?? "—"
                                                                    }
                                                                </td>

                                                                <td>
                                                                    <button
                                                                        type="button"
                                                                        className="supplier-payments-small-button"
                                                                        disabled={
                                                                            busyBatchId
                                                                            !== null
                                                                        }
                                                                        onClick={
                                                                            () =>
                                                                                void viewBatch(
                                                                                    batch
                                                                                )
                                                                        }
                                                                    >
                                                                        {
                                                                            busyBatchId
                                                                                === batch.id
                                                                                ? "Loading..."
                                                                                : "View"
                                                                        }
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }
                                                )
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            )
                }

                {
                    pagination.last_page > 1
                    && (
                        <div className="supplier-payments-pagination">
                            <span>
                                {
                                    pagination.total
                                }
                                {" payment batches"}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    className="supplier-payments-button supplier-payments-button-secondary"
                                    disabled={
                                        loading
                                        || pagination.current_page <= 1
                                    }
                                    onClick={
                                        () => {
                                            setLoading(
                                                true
                                            );

                                            setPage(
                                                (
                                                    current
                                                ) =>
                                                    Math.max(
                                                        1,
                                                        current - 1
                                                    )
                                            );
                                        }
                                    }
                                >
                                    Previous
                                </button>

                                <span>
                                    Page
                                    {" "}
                                    {
                                        pagination.current_page
                                    }
                                    {" of "}
                                    {
                                        pagination.last_page
                                    }
                                </span>

                                <button
                                    type="button"
                                    className="supplier-payments-button supplier-payments-button-secondary"
                                    disabled={
                                        loading
                                        || pagination.current_page
                                        >= pagination.last_page
                                    }
                                    onClick={
                                        () => {
                                            setLoading(
                                                true
                                            );

                                            setPage(
                                                (
                                                    current
                                                ) =>
                                                    current + 1
                                            );
                                        }
                                    }
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )
                }
            </section>

            {
                paymentModalOpen
                && (
                    <SupplierPaymentModal
                        purchases={
                            outstandingPurchases
                        }
                        allowCash={
                            allowCash
                        }
                        onClose={
                            () =>
                                setPaymentModalOpen(
                                    false
                                )
                        }
                        onSubmit={
                            submitPayment
                        }
                    />
                )
            }

            {
                selectedBatch
                && (
                    <SupplierPaymentDetailsModal
                        batch={selectedBatch}
                        onClose={
                            () =>
                                setSelectedBatch(
                                    undefined
                                )
                        }
                    />
                )
            }
        </div>
    );
}