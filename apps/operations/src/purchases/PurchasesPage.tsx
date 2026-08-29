import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import {
    useStaffRealtimeRefresh,
} from '../realtime/realtimeBus';

import {
    useAuth,
} from "../auth/useAuth";

import type {
    Supplier,
} from "../suppliers/types";

import {
    cancelPurchase,
    completePurchase,
    createPurchase,
    getPurchase,
    getPurchaseIngredientOptions,
    getPurchases,
    getPurchaseSupplierOptions,
    getPurchaseUnitOptions,
    updatePurchase,
} from "./purchaseService";

import PurchaseDetailsModal
    from "./PurchaseDetailsModal";

import PurchaseFormModal
    from "./PurchaseFormModal";

import type {
    Purchase,
    PurchaseIngredientOption,
    PurchasePagination,
    PurchasePayload,
    PurchaseStatus,
    PurchaseUnitOption,
} from "./types";

import "./PurchasesPage.css";

const EMPTY_PAGINATION:
    PurchasePagination = {
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

    status: "" | PurchaseStatus;

    dateFrom: string;

    dateTo: string;
}

const EMPTY_FILTERS:
    FilterState = {
    search:
        "",

    supplierId:
        "",

    status:
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

    return "The purchase operation could not be completed.";
}

function statusClass(
    status: PurchaseStatus
): string {
    if (
        status === "COMPLETED"
    ) {
        return "purchases-badge purchases-badge-success";
    }

    if (
        status === "CANCELLED"
    ) {
        return "purchases-badge purchases-badge-danger";
    }

    return "purchases-badge purchases-badge-warning";
}

function paymentClass(
    status: Purchase["payment_status"]
): string {
    if (
        status === "PAID"
    ) {
        return "purchases-badge purchases-badge-success";
    }

    if (
        status === "PARTIALLY_PAID"
    ) {
        return "purchases-badge purchases-badge-warning";
    }

    return "purchases-badge purchases-badge-muted";
}

export default function PurchasesPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canCreate =
        hasPermission(
            "purchases.create"
        );

    const canManage =
        hasPermission(
            "purchases.manage"
        );

    const [
        purchases,
        setPurchases,
    ] =
        useState<Purchase[]>(
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
        supplierFilters,
        setSupplierFilters,
    ] =
        useState<Supplier[]>(
            []
        );

    const [
        editorSuppliers,
        setEditorSuppliers,
    ] =
        useState<Supplier[]>(
            []
        );

    const [
        editorIngredients,
        setEditorIngredients,
    ] =
        useState<
            PurchaseIngredientOption[]
        >(
            []
        );

    const [
        editorUnits,
        setEditorUnits,
    ] =
        useState<
            PurchaseUnitOption[]
        >(
            []
        );

    const [
        editorLookupsReady,
        setEditorLookupsReady,
    ] =
        useState(
            false
        );

    const [
        lookupLoading,
        setLookupLoading,
    ] =
        useState(
            false
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
        busyPurchaseId,
        setBusyPurchaseId,
    ] =
        useState<number | null>(
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
     * undefined = closed
     * null      = new purchase
     * Purchase  = edit draft
     */
    const [
        editingPurchase,
        setEditingPurchase,
    ] =
        useState<
            Purchase
            | null
            | undefined
        >(
            undefined
        );

    const [
        selectedPurchase,
        setSelectedPurchase,
    ] =
        useState<
            Purchase
            | undefined
        >(
            undefined
        );

    const loadPurchases =
        useCallback(
            async () => {
                try {
                    const result =
                        await getPurchases({
                            page,

                            search:
                                filters.search,

                            supplierId:
                                filters.supplierId
                                    ? Number(
                                        filters.supplierId
                                    )
                                    : null,

                            status:
                                filters.status
                                || null,

                            dateFrom:
                                filters.dateFrom,

                            dateTo:
                                filters.dateTo,

                            perPage:
                                30,
                        });

                    setPurchases(
                        result.purchases
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
                        void loadPurchases();
                    },
                    0
                );

            return () =>
                window.clearTimeout(
                    timeoutId
                );
        },
        [
            loadPurchases,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Supplier Filter Lookups
    |--------------------------------------------------------------------------
    */

    const loadSupplierFilters =
        useCallback(
            async (): Promise<void> => {
                try {
                    const suppliers =
                        await getPurchaseSupplierOptions(
                            false
                        );

                    setSupplierFilters(
                        suppliers
                    );
                } catch {
                    /*
                     * Purchase listing remains usable
                     * even when supplier lookup access
                     * is unavailable.
                     */
                }
            },
            []
        );

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void loadSupplierFilters();
                    },
                    0
                );

            return () =>
                window.clearTimeout(
                    timeoutId
                );
        },
        [
            loadSupplierFilters,
        ]
    );

    const draftCount =
        useMemo(
            () =>
                purchases.filter(
                    (purchase) =>
                        purchase.status
                        === "DRAFT"
                ).length,
            [
                purchases,
            ]
        );

    const completedCount =
        useMemo(
            () =>
                purchases.filter(
                    (purchase) =>
                        purchase.status
                        === "COMPLETED"
                ).length,
            [
                purchases,
            ]
        );

    const visibleTotal =
        useMemo(
            () =>
                purchases.reduce(
                    (
                        total,
                        purchase
                    ) =>
                        total
                        + purchase.grand_total,
                    0
                ),
            [
                purchases,
            ]
        );

    const visibleBalance =
        useMemo(
            () =>
                purchases.reduce(
                    (
                        total,
                        purchase
                    ) =>
                        total
                        + purchase.balance_due,
                    0
                ),
            [
                purchases,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Purchase Editor Lookups
    |--------------------------------------------------------------------------
    */

    const loadEditorLookups =
        useCallback(
            async (): Promise<void> => {
                const [
                    suppliers,
                    ingredients,
                    units,
                ] =
                    await Promise.all([
                        getPurchaseSupplierOptions(
                            true
                        ),

                        getPurchaseIngredientOptions(),

                        getPurchaseUnitOptions(),
                    ]);

                setEditorSuppliers(
                    suppliers
                );

                setEditorIngredients(
                    ingredients
                );

                setEditorUnits(
                    units
                );

                setEditorLookupsReady(
                    true
                );
            },
            []
        );

    const ensureEditorLookups =
        async (): Promise<void> => {
            if (
                editorLookupsReady
            ) {
                return;
            }

            if (
                lookupLoading
            ) {
                return;
            }

            setLookupLoading(
                true
            );

            try {
                await loadEditorLookups();
            } finally {
                setLookupLoading(
                    false
                );
            }
        };

    const openCreate =
        async () => {
            setError(
                ""
            );

            setMessage(
                ""
            );

            try {
                await ensureEditorLookups();

                setEditingPurchase(
                    null
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            }
        };

    const openEdit =
        async (
            purchase: Purchase
        ) => {
            if (
                purchase.status
                !== "DRAFT"
            ) {
                return;
            }

            setError(
                ""
            );

            setSelectedPurchase(
                undefined
            );

            try {
                await ensureEditorLookups();

                setEditingPurchase(
                    purchase
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            }
        };

    const savePurchase =
        async (
            payload: PurchasePayload
        ) => {
            if (
                editingPurchase
                === undefined
            ) {
                throw new Error(
                    "No purchase editor is open."
                );
            }

            setError(
                ""
            );

            setMessage(
                ""
            );

            if (
                editingPurchase
                === null
            ) {
                const created =
                    await createPurchase(
                        payload
                    );

                setEditingPurchase(
                    undefined
                );

                setMessage(
                    `${created.purchase_number} created as draft.`
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
                    await loadPurchases();
                }

                return;
            }

            const updated =
                await updatePurchase(
                    editingPurchase.id,
                    payload
                );

            setEditingPurchase(
                undefined
            );

            setMessage(
                `${updated.purchase_number} updated successfully.`
            );

            await loadPurchases();
        };

    const viewPurchase =
        async (
            purchase: Purchase
        ) => {
            setBusyPurchaseId(
                purchase.id
            );

            setError(
                ""
            );

            try {
                const current =
                    await getPurchase(
                        purchase.id
                    );

                setSelectedPurchase(
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
                setBusyPurchaseId(
                    null
                );
            }
        };

    const completePurchaseAction =
        async (
            purchase: Purchase
        ) => {
            if (
                !canManage
                || purchase.status
                !== "DRAFT"
            ) {
                return;
            }

            const confirmed =
                window.confirm(
                    `Complete ${purchase.purchase_number}?\n\n`
                    + "This will receive the purchase into inventory, "
                    + "update weighted-average ingredient costs and "
                    + "increase the supplier outstanding balance."
                );

            if (!confirmed) {
                return;
            }

            setBusyPurchaseId(
                purchase.id
            );

            setError(
                ""
            );

            setMessage(
                ""
            );

            try {
                const completed =
                    await completePurchase(
                        purchase.id
                    );

                setMessage(
                    `${completed.purchase_number} completed and inventory received successfully.`
                );

                if (
                    selectedPurchase?.id
                    === completed.id
                ) {
                    setSelectedPurchase(
                        completed
                    );
                }

                await loadPurchases();
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setBusyPurchaseId(
                    null
                );
            }
        };

    const cancelPurchaseAction =
        async (
            purchase: Purchase
        ) => {
            if (
                !canManage
                || purchase.status
                !== "DRAFT"
            ) {
                return;
            }

            const confirmed =
                window.confirm(
                    `Cancel draft purchase ${purchase.purchase_number}?\n\n`
                    + "A cancelled draft cannot be completed."
                );

            if (!confirmed) {
                return;
            }

            setBusyPurchaseId(
                purchase.id
            );

            setError(
                ""
            );

            setMessage(
                ""
            );

            try {
                const cancelled =
                    await cancelPurchase(
                        purchase.id
                    );

                setMessage(
                    `${cancelled.purchase_number} cancelled successfully.`
                );

                if (
                    selectedPurchase?.id
                    === cancelled.id
                ) {
                    setSelectedPurchase(
                        cancelled
                    );
                }

                await loadPurchases();
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setBusyPurchaseId(
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
                await loadPurchases();
            } finally {
                setRefreshing(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation Helpers
    |--------------------------------------------------------------------------
    |
    | Reverb is used only as an invalidation signal.
    | Laravel REST remains authoritative.
    |
    | Realtime refreshes are intentionally silent:
    | - no page reload
    | - no manual Refresh click
    | - no full loading-state flash
    |--------------------------------------------------------------------------
    */

    const refreshSelectedPurchase =
        useCallback(
            async (): Promise<void> => {
                if (
                    !selectedPurchase
                ) {
                    return;
                }

                const purchaseId =
                    selectedPurchase.id;

                try {
                    const current =
                        await getPurchase(
                            purchaseId
                        );

                    setSelectedPurchase(
                        (
                            existing
                        ) => {
                            if (
                                !existing
                                || existing.id
                                !== purchaseId
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
                        "Unable to reconcile realtime purchase details.",
                        caught
                    );
                }
            },
            [
                selectedPurchase,
            ]
        );

    const refreshEditorLookupsFromRealtime =
        useCallback(
            async (): Promise<void> => {
                /*
                 * Always mark cached editor catalogs as stale.
                 *
                 * If no editor is open, the next New/Edit action
                 * reloads them before allowing the user to work.
                 */
                setEditorLookupsReady(
                    false
                );

                if (
                    editingPurchase
                    === undefined
                    || lookupLoading
                ) {
                    return;
                }

                setLookupLoading(
                    true
                );

                try {
                    await loadEditorLookups();
                } catch (
                caught
                ) {
                    console.error(
                        "Unable to reconcile realtime purchase editor lookups.",
                        caught
                    );
                } finally {
                    setLookupLoading(
                        false
                    );
                }
            },
            [
                editingPurchase,
                loadEditorLookups,
                lookupLoading,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Purchases + Supplier Payments
    |--------------------------------------------------------------------------
    |
    | Purchase writes and supplier-payment writes can change:
    | - purchase status
    | - payment status
    | - balance due
    | - visible totals
    | - selected purchase details
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "purchases",
            "supplier_payments",
        ],
        async () => {
            await Promise.all([
                loadPurchases(),
                refreshSelectedPurchase(),
            ]);
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Suppliers
    |--------------------------------------------------------------------------
    |
    | Supplier edits can change supplier names/codes shown in the
    | purchase list, filters, details and purchase editor.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "suppliers",
        ],
        async () => {
            await Promise.all([
                loadPurchases(),
                loadSupplierFilters(),
                refreshSelectedPurchase(),
                refreshEditorLookupsFromRealtime(),
            ]);
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Inventory / Ingredient / Unit Changes
    |--------------------------------------------------------------------------
    |
    | The purchase editor depends on ingredient and unit catalogs.
    | Inventory-domain changes invalidate those cached lookups.
    |
    | We do NOT reload the purchase list for every stock movement.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "inventory",
        ],
        () =>
            refreshEditorLookupsFromRealtime()
    );

    return (
        <div className="purchases-page">
            <header className="purchases-page-header">
                <div>
                    <div className="purchases-eyebrow">
                        Purchasing & Inventory
                    </div>

                    <h1>
                        Purchases
                    </h1>

                    <p>
                        Create supplier purchase drafts, review costs and receive
                        completed purchases into inventory.
                    </p>
                </div>

                <div className="purchases-header-actions">
                    <button
                        type="button"
                        className="purchases-button purchases-button-secondary"
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
                        canCreate
                        && (
                            <button
                                type="button"
                                className="purchases-button purchases-button-primary"
                                disabled={lookupLoading}
                                onClick={
                                    () =>
                                        void openCreate()
                                }
                            >
                                {
                                    lookupLoading
                                        ? "Loading..."
                                        : "+ New Purchase"
                                }
                            </button>
                        )
                    }
                </div>
            </header>

            {
                error
                && (
                    <div className="purchases-alert purchases-alert-error">
                        {error}
                    </div>
                )
            }

            {
                message
                && (
                    <div className="purchases-alert purchases-alert-success">
                        {message}
                    </div>
                )
            }

            <section className="purchases-summary-grid">
                <article>
                    <span>
                        Purchases
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
                        Drafts on Page
                    </span>

                    <strong>
                        {draftCount}
                    </strong>

                    <small>
                        Not yet received into stock
                    </small>
                </article>

                <article>
                    <span>
                        Completed on Page
                    </span>

                    <strong>
                        {completedCount}
                    </strong>

                    <small>
                        Inventory already received
                    </small>
                </article>

                <article>
                    <span>
                        Visible Purchase Total
                    </span>

                    <strong className="purchases-summary-money">
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
                        Visible Balance Due
                    </span>

                    <strong className="purchases-summary-money">
                        {
                            money.format(
                                visibleBalance
                            )
                        }
                    </strong>

                    <small>
                        Payment handling is in Supplier Payments
                    </small>
                </article>
            </section>

            <section className="purchases-panel">
                <form
                    className="purchases-filters"
                    onSubmit={submitFilters}
                >
                    <div className="purchases-filter-field purchases-filter-search">
                        <span>
                            Search
                        </span>

                        <input
                            type="search"
                            maxLength={150}
                            placeholder="Purchase no, invoice or supplier..."
                            value={filterDraft.search}
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
                    </div>

                    <label className="purchases-filter-field">
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
                                supplierFilters.map(
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

                    <label className="purchases-filter-field">
                        <span>
                            Status
                        </span>

                        <select
                            value={filterDraft.status}
                            onChange={
                                (
                                    event
                                ) =>
                                    setFilterDraft(
                                        (
                                            current
                                        ) => ({
                                            ...current,

                                            status:
                                                event.target.value as FilterState["status"],
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All Statuses
                            </option>

                            <option value="DRAFT">
                                Draft
                            </option>

                            <option value="COMPLETED">
                                Completed
                            </option>

                            <option value="CANCELLED">
                                Cancelled
                            </option>
                        </select>
                    </label>

                    <label className="purchases-filter-field">
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

                    <label className="purchases-filter-field">
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

                    <div className="purchases-filter-actions">
                        <button
                            type="submit"
                            className="purchases-button purchases-button-primary"
                        >
                            Apply
                        </button>

                        <button
                            type="button"
                            className="purchases-button purchases-button-secondary"
                            onClick={clearFilters}
                        >
                            Clear
                        </button>
                    </div>
                </form>

                {
                    loading
                        ? (
                            <div className="purchases-loading">
                                Loading purchases...
                            </div>
                        )
                        : purchases.length === 0
                            ? (
                                <div className="purchases-empty">
                                    <strong>
                                        No purchases found
                                    </strong>

                                    <p>
                                        Change the filters or create a new purchase draft.
                                    </p>
                                </div>
                            )
                            : (
                                <div className="purchases-table-wrap">
                                    <table className="purchases-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Purchase
                                                </th>

                                                <th>
                                                    Supplier
                                                </th>

                                                <th>
                                                    Date
                                                </th>

                                                <th>
                                                    Invoice
                                                </th>

                                                <th>
                                                    Items
                                                </th>

                                                <th>
                                                    Total
                                                </th>

                                                <th>
                                                    Balance
                                                </th>

                                                <th>
                                                    Purchase Status
                                                </th>

                                                <th>
                                                    Payment
                                                </th>

                                                <th>
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {
                                                purchases.map(
                                                    (
                                                        purchase
                                                    ) => (
                                                        <tr
                                                            key={purchase.id}
                                                        >
                                                            <td>
                                                                <strong>
                                                                    {
                                                                        purchase.purchase_number
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                <div className="purchases-supplier-cell">
                                                                    <strong>
                                                                        {
                                                                            purchase.supplier?.name
                                                                            ?? "—"
                                                                        }
                                                                    </strong>

                                                                    <span>
                                                                        {
                                                                            purchase.supplier
                                                                                ?.supplier_code
                                                                            ?? ""
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            <td>
                                                                {
                                                                    purchase.purchase_date
                                                                    ?? "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    purchase
                                                                        .supplier_invoice_number
                                                                    ?? "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    purchase.items.length
                                                                }
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        money.format(
                                                                            purchase.grand_total
                                                                        )
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                <strong
                                                                    className={
                                                                        purchase.balance_due > 0
                                                                            ? "purchases-due"
                                                                            : ""
                                                                    }
                                                                >
                                                                    {
                                                                        money.format(
                                                                            purchase.balance_due
                                                                        )
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={
                                                                        statusClass(
                                                                            purchase.status
                                                                        )
                                                                    }
                                                                >
                                                                    {
                                                                        purchase.status
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={
                                                                        paymentClass(
                                                                            purchase.payment_status
                                                                        )
                                                                    }
                                                                >
                                                                    {
                                                                        purchase.payment_status
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <div className="purchases-row-actions">
                                                                    <button
                                                                        type="button"
                                                                        className="purchases-small-button"
                                                                        disabled={
                                                                            busyPurchaseId
                                                                            !== null
                                                                        }
                                                                        onClick={
                                                                            () =>
                                                                                void viewPurchase(
                                                                                    purchase
                                                                                )
                                                                        }
                                                                    >
                                                                        {
                                                                            busyPurchaseId
                                                                                === purchase.id
                                                                                ? "Loading..."
                                                                                : "View"
                                                                        }
                                                                    </button>

                                                                    {
                                                                        canManage
                                                                        && purchase.status
                                                                        === "DRAFT"
                                                                        && (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    className="purchases-small-button"
                                                                                    disabled={
                                                                                        busyPurchaseId
                                                                                        !== null
                                                                                    }
                                                                                    onClick={
                                                                                        () =>
                                                                                            void openEdit(
                                                                                                purchase
                                                                                            )
                                                                                    }
                                                                                >
                                                                                    Edit
                                                                                </button>

                                                                                <button
                                                                                    type="button"
                                                                                    className="purchases-small-button purchases-small-button-success"
                                                                                    disabled={
                                                                                        busyPurchaseId
                                                                                        !== null
                                                                                    }
                                                                                    onClick={
                                                                                        () =>
                                                                                            void completePurchaseAction(
                                                                                                purchase
                                                                                            )
                                                                                    }
                                                                                >
                                                                                    Complete
                                                                                </button>
                                                                            </>
                                                                        )
                                                                    }
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
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
                        <div className="purchases-pagination">
                            <span>
                                {
                                    pagination.total
                                }
                                {" purchases"}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    className="purchases-button purchases-button-secondary"
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
                                    className="purchases-button purchases-button-secondary"
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
                editingPurchase
                !== undefined
                && (
                    <PurchaseFormModal
                        purchase={editingPurchase}
                        suppliers={editorSuppliers}
                        ingredients={editorIngredients}
                        units={editorUnits}
                        onClose={
                            () =>
                                setEditingPurchase(
                                    undefined
                                )
                        }
                        onSubmit={savePurchase}
                    />
                )
            }

            {
                selectedPurchase
                && (
                    <PurchaseDetailsModal
                        purchase={selectedPurchase}
                        canManage={canManage}
                        busy={
                            busyPurchaseId
                            === selectedPurchase.id
                        }
                        onClose={
                            () =>
                                setSelectedPurchase(
                                    undefined
                                )
                        }
                        onEdit={
                            (
                                purchase
                            ) =>
                                void openEdit(
                                    purchase
                                )
                        }
                        onComplete={
                            (
                                purchase
                            ) =>
                                void completePurchaseAction(
                                    purchase
                                )
                        }
                        onCancel={
                            (
                                purchase
                            ) =>
                                void cancelPurchaseAction(
                                    purchase
                                )
                        }
                    />
                )
            }
        </div>
    );
}