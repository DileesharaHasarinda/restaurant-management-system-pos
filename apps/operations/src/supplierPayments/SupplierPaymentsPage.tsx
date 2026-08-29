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

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Filter State
|--------------------------------------------------------------------------
*/

interface FilterState {
    search:
    string;

    supplierId:
    string;

    paymentMethod:
    ""
    | SupplierPaymentMethod;

    dateFrom:
    string;

    dateTo:
    string;
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

/*
|--------------------------------------------------------------------------
| Formatters
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function toPaymentMethodFilter(
    value:
        string
): FilterState["paymentMethod"] {
    switch (
    value
    ) {
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

function errorMessage(
    error:
        unknown
): string {
    if (
        error instanceof Error
        &&
        error.message
    ) {
        return error.message;
    }

    return "The supplier payment operation could not be completed.";
}

function methodLabel(
    method:
        string
): string {
    return method.replaceAll(
        "_",
        " "
    );
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

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
        ===
        "CASHIER";

    /*
    |--------------------------------------------------------------------------
    | Payment Batches
    |--------------------------------------------------------------------------
    */

    const [
        batches,
        setBatches,
    ] =
        useState<
            SupplierPaymentBatch[]
        >(
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Pagination
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Supplier Options
    |--------------------------------------------------------------------------
    */

    const [
        suppliers,
        setSuppliers,
    ] =
        useState<Supplier[]>(
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Outstanding Purchases
    |--------------------------------------------------------------------------
    */

    const [
        outstandingPurchases,
        setOutstandingPurchases,
    ] =
        useState<Purchase[]>(
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Modals
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Loading / State
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Load Supplier Payments
    |--------------------------------------------------------------------------
    |
    | silent = true is used by realtime reconciliation.
    |
    | Realtime refreshes must not:
    |
    | - show the normal page loading state
    | - show the Refresh button spinner
    | - reload the browser
    | - interrupt an open payment workflow
    |--------------------------------------------------------------------------
    */

    const loadPayments =
        useCallback(
            async (
                silent:
                    boolean = false
            ): Promise<void> => {
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
                    if (
                        silent
                    ) {
                        console.error(
                            "Unable to reconcile realtime supplier payment records.",
                            caught
                        );

                        return;
                    }

                    setError(
                        errorMessage(
                            caught
                        )
                    );
                } finally {
                    if (
                        !silent
                    ) {
                        setLoading(
                            false
                        );
                    }
                }
            },
            [
                page,
                filters,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Load Supplier Options
    |--------------------------------------------------------------------------
    */

    const loadSupplierOptions =
        useCallback(
            async (): Promise<
                Supplier[]
            > => {
                const records =
                    await getSupplierPaymentSupplierOptions();

                setSuppliers(
                    records
                );

                return records;
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Load Outstanding Purchases
    |--------------------------------------------------------------------------
    |
    | Outstanding purchase balances can change when:
    |
    | - a purchase is completed
    | - another supplier payment is recorded
    | - a split payment changes the remaining balance
    |--------------------------------------------------------------------------
    */

    const loadOutstandingPurchases =
        useCallback(
            async (): Promise<
                Purchase[]
            > => {
                const purchases =
                    await getOutstandingPurchases();

                setOutstandingPurchases(
                    purchases
                );

                return purchases;
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Initial / Filter Payment Loading
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Initial Supplier Filter Options
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void loadSupplierOptions()
                            .catch(
                                () => {
                                    /*
                                     * Supplier filtering is optional.
                                     *
                                     * Payment history remains usable even
                                     * if this lookup cannot be loaded.
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
        [
            loadSupplierOptions,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Summary
    |--------------------------------------------------------------------------
    */

    const visibleTotal =
        useMemo(
            () =>
                batches.reduce(
                    (
                        total,
                        batch
                    ) =>
                        total
                        +
                        batch.total_amount,
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
                        +
                        batch.payments.reduce(
                            (
                                paymentTotal,
                                payment
                            ) =>
                                payment.payment_method
                                    ===
                                    "CASH"
                                    ? paymentTotal
                                    +
                                    payment.amount
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
        -
        visibleCash;

    /*
    |--------------------------------------------------------------------------
    | Open Payment Modal
    |--------------------------------------------------------------------------
    */

    const openPaymentModal =
        async (): Promise<void> => {
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
                await loadOutstandingPurchases();

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

    /*
    |--------------------------------------------------------------------------
    | Submit Supplier Payment
    |--------------------------------------------------------------------------
    */

    const submitPayment =
        async (
            purchaseId:
                number,

            payload:
                SupplierPaymentPayload
        ): Promise<void> => {
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

            /*
             * A new payment batch belongs at the beginning of the history.
             */
            if (
                page
                !==
                1
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

            /*
             * Supplier payment affects supplier outstanding balances.
             *
             * Refresh supplier options because some APIs may return balance
             * related supplier data used elsewhere by this page.
             *
             * The payment itself already succeeded, therefore this lookup
             * failure must not turn the completed payment into a false error.
             */
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

    const viewBatch =
        async (
            batch:
                SupplierPaymentBatch
        ): Promise<void> => {
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

    /*
    |--------------------------------------------------------------------------
    | Refresh Selected Batch
    |--------------------------------------------------------------------------
    |
    | If the details modal is open while another client changes supplier
    | payment or purchase information, reload the authoritative batch.
    |
    | The functional setter protects against a race:
    |
    | - user closes modal
    | - user opens another batch
    | - earlier REST request completes afterwards
    |
    | In those cases the old request will not reopen or overwrite the modal.
    |--------------------------------------------------------------------------
    */

    const refreshSelectedBatch =
        useCallback(
            async (): Promise<void> => {
                if (
                    !selectedBatch
                ) {
                    return;
                }

                const batchId =
                    selectedBatch.id;

                try {
                    const current =
                        await getSupplierPaymentBatch(
                            batchId
                        );

                    setSelectedBatch(
                        (
                            existing
                        ) => {
                            if (
                                !existing
                                ||
                                existing.id
                                !==
                                batchId
                            ) {
                                return existing;
                            }

                            return current;
                        }
                    );
                } catch (
                caught
                ) {
                    console.error(
                        "Unable to reconcile realtime supplier payment details.",
                        caught
                    );
                }
            },
            [
                selectedBatch,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

    const submitFilters =
        (
            event:
                FormEvent
        ): void => {
            event.preventDefault();

            if (
                filterDraft.dateFrom
                &&
                filterDraft.dateTo
                &&
                filterDraft.dateTo
                <
                filterDraft.dateFrom
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
                    filterDraft.search
                        .trim(),
            });
        };

    /*
    |--------------------------------------------------------------------------
    | Clear Filters
    |--------------------------------------------------------------------------
    */

    const clearFilters =
        (): void => {
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

    /*
    |--------------------------------------------------------------------------
    | Manual Refresh
    |--------------------------------------------------------------------------
    */

    const refresh =
        async (): Promise<void> => {
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
                const jobs:
                    Array<
                        Promise<unknown>
                    > = [
                        loadPayments(),
                        loadSupplierOptions(),
                        refreshSelectedBatch(),
                    ];

                /*
                 * If the payment modal is currently open, also reconcile its
                 * purchase/balance options.
                 */
                if (
                    paymentModalOpen
                ) {
                    jobs.push(
                        loadOutstandingPurchases()
                    );
                }

                await Promise.all(
                    jobs
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
                setRefreshing(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | This screen depends on three business domains.
    |
    | supplier_payments
    | -----------------
    | New supplier payment batches and payment records.
    |
    | purchases
    | ---------
    | Purchase balance_due/payment_status changes when supplier payments are
    | recorded. Newly completed purchases can also become payable.
    |
    | suppliers
    | ---------
    | Supplier master information and authoritative outstanding balances.
    |
    | Reverb is used only as an invalidation signal. Laravel REST remains
    | authoritative.
    |
    | Realtime refreshes:
    |
    | - payment history
    | - payment summary values
    | - supplier filter options
    | - open payment batch details
    | - outstanding purchase options if Record Payment is currently open
    |
    | Important:
    |
    | We do NOT close/remount SupplierPaymentModal. This preserves any
    | payment method/amount/reference information already being entered.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "supplier_payments",
            "purchases",
            "suppliers",
        ],
        async () => {
            try {
                const jobs:
                    Array<
                        Promise<unknown>
                    > = [
                        loadPayments(
                            true
                        ),

                        loadSupplierOptions(),

                        refreshSelectedBatch(),
                    ];

                /*
                 * Keep the payable-purchase list authoritative while the
                 * payment modal is open.
                 *
                 * This is especially important when another staff member
                 * records a payment against the same supplier/purchase.
                 */
                if (
                    paymentModalOpen
                ) {
                    jobs.push(
                        loadOutstandingPurchases()
                    );
                }

                await Promise.all(
                    jobs
                );
            } catch (
            caught
            ) {
                /*
                 * Realtime failure must not interrupt a payment form or
                 * otherwise break this screen.
                 *
                 * A later event, reconnect or manual Refresh will reconcile.
                 */
                console.error(
                    "Unable to reconcile realtime supplier payment data.",
                    caught
                );
            }
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <div className="supplier-payments-page">
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

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
                        disabled={
                            refreshing
                        }
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
                                disabled={
                                    optionsLoading
                                }
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

            {/*
            |--------------------------------------------------------------------------
            | Error
            |--------------------------------------------------------------------------
            */}

            {
                error
                && (
                    <div className="supplier-payments-alert supplier-payments-alert-error">
                        {
                            error
                        }
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Success
            |--------------------------------------------------------------------------
            */}

            {
                message
                && (
                    <div className="supplier-payments-alert supplier-payments-alert-success">
                        {
                            message
                        }
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Summary
            |--------------------------------------------------------------------------
            */}

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

            {/*
            |--------------------------------------------------------------------------
            | Payment History Panel
            |--------------------------------------------------------------------------
            */}

            <section className="supplier-payments-panel">
                {/*
                |--------------------------------------------------------------------------
                | Filters
                |--------------------------------------------------------------------------
                */}

                <form
                    className="supplier-payments-filters"
                    onSubmit={
                        submitFilters
                    }
                >
                    <label className="supplier-payments-filter-field supplier-payments-filter-search">
                        <span>
                            Search
                        </span>

                        <input
                            type="search"
                            maxLength={
                                150
                            }
                            value={
                                filterDraft.search
                            }
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
                            value={
                                filterDraft.supplierId
                            }
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
                                            key={
                                                supplier.id
                                            }
                                            value={
                                                supplier.id
                                            }
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
                            value={
                                filterDraft.paymentMethod
                            }
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
                            value={
                                filterDraft.dateFrom
                            }
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
                            value={
                                filterDraft.dateTo
                            }
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
                            onClick={
                                clearFilters
                            }
                        >
                            Clear
                        </button>
                    </div>
                </form>

                {/*
                |--------------------------------------------------------------------------
                | Records
                |--------------------------------------------------------------------------
                */}

                {
                    loading
                        ? (
                            <div className="supplier-payments-loading">
                                Loading supplier payments...
                            </div>
                        )
                        : batches.length
                            ===
                            0
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
                                                            <tr
                                                                key={
                                                                    batch.id
                                                                }
                                                            >
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
                                                                        ??
                                                                        "—"
                                                                    }
                                                                </td>

                                                                <td>
                                                                    <strong>
                                                                        {
                                                                            batch
                                                                                .supplier
                                                                                ?.name
                                                                            ??
                                                                            "—"
                                                                        }
                                                                    </strong>
                                                                </td>

                                                                <td>
                                                                    {
                                                                        batch
                                                                            .purchase
                                                                            ?.purchase_number
                                                                        ??
                                                                        "—"
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
                                                                                        key={
                                                                                            method
                                                                                        }
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
                                                                        batch
                                                                            .created_by
                                                                            ?.name
                                                                        ??
                                                                        "—"
                                                                    }
                                                                </td>

                                                                <td>
                                                                    <button
                                                                        type="button"
                                                                        className="supplier-payments-small-button"
                                                                        disabled={
                                                                            busyBatchId
                                                                            !==
                                                                            null
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
                                                                                ===
                                                                                batch.id
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

                {/*
                |--------------------------------------------------------------------------
                | Pagination
                |--------------------------------------------------------------------------
                */}

                {
                    pagination.last_page
                    >
                    1
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
                                        ||
                                        pagination.current_page
                                        <=
                                        1
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
                                        ||
                                        pagination.current_page
                                        >=
                                        pagination.last_page
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
                                                    current
                                                    +
                                                    1
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

            {/*
            |--------------------------------------------------------------------------
            | Record Supplier Payment Modal
            |--------------------------------------------------------------------------
            |
            | Realtime updates refresh outstandingPurchases while this modal
            | remains mounted. We deliberately do not close/remount it.
            |
            | Laravel must still validate the final outstanding balance when
            | the payment is submitted because the backend is authoritative.
            |--------------------------------------------------------------------------
            */}

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
                            () => {
                                setPaymentModalOpen(
                                    false
                                );

                                setOutstandingPurchases(
                                    []
                                );
                            }
                        }
                        onSubmit={
                            submitPayment
                        }
                    />
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Payment Batch Details Modal
            |--------------------------------------------------------------------------
            */}

            {
                selectedBatch
                && (
                    <SupplierPaymentDetailsModal
                        batch={
                            selectedBatch
                        }
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