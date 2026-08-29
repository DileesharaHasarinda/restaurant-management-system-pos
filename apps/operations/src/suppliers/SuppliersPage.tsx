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

import SupplierFormModal
    from "./SupplierFormModal";

import {
    createSupplier,
    getSuppliers,
    updateSupplier,
    updateSupplierStatus,
} from "./supplierService";

import type {
    Supplier,
    SupplierEditorSubmission,
    SupplierPagination,
} from "./types";

import "./SuppliersPage.css";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const EMPTY_PAGINATION:
    SupplierPagination = {
    current_page:
        1,

    per_page:
        30,

    total:
        0,

    last_page:
        1,
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

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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

    return "The supplier operation could not be completed.";
}

function formatDate(
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
        return "—";
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
        }
    ).format(
        date
    );
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function SuppliersPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canManage =
        hasPermission(
            "suppliers.manage"
        );

    /*
    |--------------------------------------------------------------------------
    | Suppliers
    |--------------------------------------------------------------------------
    */

    const [
        suppliers,
        setSuppliers,
    ] =
        useState<
            Supplier[]
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
    | Search / Filters
    |--------------------------------------------------------------------------
    */

    const [
        searchDraft,
        setSearchDraft,
    ] =
        useState(
            ""
        );

    const [
        search,
        setSearch,
    ] =
        useState(
            ""
        );

    const [
        activeFilter,
        setActiveFilter,
    ] =
        useState<
            boolean
            |
            null
        >(
            null
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
        busySupplierId,
        setBusySupplierId,
    ] =
        useState<
            number
            |
            null
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
     * undefined = modal closed
     * null      = create
     * Supplier  = edit
     */
    const [
        editingSupplier,
        setEditingSupplier,
    ] =
        useState<
            Supplier
            |
            null
            |
            undefined
        >(
            undefined
        );

    /*
    |--------------------------------------------------------------------------
    | Data Loading
    |--------------------------------------------------------------------------
    |
    | silent = true:
    |
    | Used by realtime reconciliation.
    |
    | It keeps the existing supplier page visible and avoids interfering
    | with the normal loading state while Laravel REST is queried again.
    |--------------------------------------------------------------------------
    */

    const loadSuppliers =
        useCallback(
            async (
                silent:
                    boolean = false
            ): Promise<void> => {
                try {
                    const result =
                        await getSuppliers({
                            page,

                            search,

                            isActive:
                                activeFilter,

                            perPage:
                                30,
                        });

                    setSuppliers(
                        result.suppliers
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
                            "Unable to reconcile realtime supplier data.",
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
                search,
                activeFilter,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Initial / Filter Loading
    |--------------------------------------------------------------------------
    |
    | Deferred invocation keeps Oxlint's set-state-in-effect rule clean while
    | still synchronizing this page with the API.
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void loadSuppliers();
                    },
                    0
                );

            return () => {
                window.clearTimeout(
                    timeoutId
                );
            };
        },
        [
            loadSuppliers,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Derived Values
    |--------------------------------------------------------------------------
    */

    const activeOnPage =
        useMemo(
            () =>
                suppliers.filter(
                    (
                        supplier
                    ) =>
                        supplier.is_active
                ).length,
            [
                suppliers,
            ]
        );

    const inactiveOnPage =
        suppliers.length
        -
        activeOnPage;

    const visibleOutstanding =
        useMemo(
            () =>
                suppliers.reduce(
                    (
                        total,
                        supplier
                    ) =>
                        total
                        +
                        supplier.current_balance,
                    0
                ),
            [
                suppliers,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Search
    |--------------------------------------------------------------------------
    */

    const submitSearch =
        (
            event:
                FormEvent
        ): void => {
            event.preventDefault();

            const value =
                searchDraft.trim();

            setError(
                ""
            );

            setMessage(
                ""
            );

            setLoading(
                true
            );

            if (
                value
                ===
                search
                &&
                page
                ===
                1
            ) {
                void loadSuppliers();

                return;
            }

            setPage(
                1
            );

            setSearch(
                value
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Clear Search
    |--------------------------------------------------------------------------
    */

    const clearSearch =
        (): void => {
            setError(
                ""
            );

            setMessage(
                ""
            );

            setSearchDraft(
                ""
            );

            setLoading(
                true
            );

            if (
                search
                ===
                ""
                &&
                page
                ===
                1
            ) {
                void loadSuppliers();

                return;
            }

            setSearch(
                ""
            );

            setPage(
                1
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Active Filter
    |--------------------------------------------------------------------------
    */

    const changeActiveFilter =
        (
            value:
                boolean | null
        ): void => {
            setError(
                ""
            );

            setMessage(
                ""
            );

            setLoading(
                true
            );

            if (
                value
                ===
                activeFilter
                &&
                page
                ===
                1
            ) {
                void loadSuppliers();

                return;
            }

            setActiveFilter(
                value
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
                await loadSuppliers();
            } finally {
                setRefreshing(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Save Supplier
    |--------------------------------------------------------------------------
    */

    const saveSupplier =
        async (
            submission:
                SupplierEditorSubmission
        ): Promise<void> => {
            setError(
                ""
            );

            setMessage(
                ""
            );

            if (
                editingSupplier
                ===
                undefined
            ) {
                throw new Error(
                    "No supplier editor is currently open."
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Create
            |--------------------------------------------------------------------------
            */

            if (
                editingSupplier
                ===
                null
            ) {
                const created =
                    await createSupplier({
                        name:
                            submission.name,

                        phone:
                            submission.phone,

                        email:
                            submission.email,

                        address:
                            submission.address,

                        notes:
                            submission.notes,

                        is_active:
                            submission.is_active,
                    });

                setEditingSupplier(
                    undefined
                );

                setMessage(
                    `${created.supplier_code} — ${created.name} created successfully.`
                );

                setLoading(
                    true
                );

                /*
                 * Newly created suppliers should be easy to locate.
                 * Return to the first page.
                 */
                if (
                    page
                    !==
                    1
                ) {
                    setPage(
                        1
                    );
                } else {
                    await loadSuppliers();
                }

                return;
            }

            /*
            |--------------------------------------------------------------------------
            | Update
            |--------------------------------------------------------------------------
            */

            const updated =
                await updateSupplier(
                    editingSupplier.id,
                    {
                        name:
                            submission.name,

                        phone:
                            submission.phone,

                        email:
                            submission.email,

                        address:
                            submission.address,

                        notes:
                            submission.notes,
                    }
                );

            setEditingSupplier(
                undefined
            );

            setMessage(
                `${updated.supplier_code} — ${updated.name} updated successfully.`
            );

            setLoading(
                true
            );

            await loadSuppliers();
        };

    /*
    |--------------------------------------------------------------------------
    | Supplier Status
    |--------------------------------------------------------------------------
    */

    const toggleStatus =
        async (
            supplier:
                Supplier
        ): Promise<void> => {
            if (
                !canManage
                ||
                busySupplierId
                !==
                null
            ) {
                return;
            }

            const nextStatus =
                !supplier.is_active;

            const confirmed =
                window.confirm(
                    nextStatus
                        ? `Activate supplier "${supplier.name}"?`
                        : `Deactivate supplier "${supplier.name}"?`
                );

            if (
                !confirmed
            ) {
                return;
            }

            setBusySupplierId(
                supplier.id
            );

            setError(
                ""
            );

            setMessage(
                ""
            );

            try {
                const updated =
                    await updateSupplierStatus(
                        supplier.id,
                        {
                            is_active:
                                nextStatus,
                        }
                    );

                setMessage(
                    `${updated.supplier_code} — ${updated.name} ${updated.is_active
                        ? "activated"
                        : "deactivated"
                    } successfully.`
                );

                await loadSuppliers();
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setBusySupplierId(
                    null
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Pagination
    |--------------------------------------------------------------------------
    */

    const previousPage =
        (): void => {
            if (
                page
                <=
                1
                ||
                loading
            ) {
                return;
            }

            setLoading(
                true
            );

            setPage(
                (
                    current
                ) =>
                    Math.max(
                        1,
                        current
                        -
                        1
                    )
            );
        };

    const nextPage =
        (): void => {
            if (
                page
                >=
                pagination.last_page
                ||
                loading
            ) {
                return;
            }

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
        };

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | Supplier data can change through multiple business workflows:
    |
    | suppliers
    |   - supplier created
    |   - supplier edited
    |   - supplier activated/deactivated
    |
    | purchases
    |   - a completed purchase increases supplier outstanding balance
    |
    | supplier_payments
    |   - supplier payments reduce outstanding balance
    |
    | Reverb is used only as an invalidation signal. Laravel remains the
    | authoritative source for supplier balances and supplier master data.
    |
    | The refresh is silent:
    |
    | - no page reload
    | - no loading flash
    | - no Refresh button spinner
    | - filters stay in place
    | - pagination stays in place
    | - an open SupplierFormModal is not replaced
    |
    | Not replacing editingSupplier is intentional because automatically
    | replacing it could destroy unsaved supplier details being entered by
    | the manager.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "suppliers",
            "purchases",
            "supplier_payments",
        ],
        async () => {
            await loadSuppliers(
                true
            );
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <div className="suppliers-page">
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

            <header className="suppliers-page-header">
                <div>
                    <div className="suppliers-eyebrow">
                        Purchasing
                    </div>

                    <h1>
                        Suppliers
                    </h1>

                    <p>
                        Maintain supplier master records and monitor authoritative
                        outstanding balances used by purchasing and supplier payment
                        workflows.
                    </p>
                </div>

                <div className="suppliers-header-actions">
                    <button
                        type="button"
                        className="suppliers-button suppliers-button-secondary"
                        onClick={
                            () =>
                                void refresh()
                        }
                        disabled={
                            refreshing
                        }
                    >
                        {
                            refreshing
                                ? "Refreshing..."
                                : "Refresh"
                        }
                    </button>

                    {
                        canManage
                        && (
                            <button
                                type="button"
                                className="suppliers-button suppliers-button-primary"
                                onClick={
                                    () =>
                                        setEditingSupplier(
                                            null
                                        )
                                }
                            >
                                + Add Supplier
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
                    <div className="suppliers-alert suppliers-alert-error">
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
                    <div className="suppliers-alert suppliers-alert-success">
                        {
                            message
                        }
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Read-only Information
            |--------------------------------------------------------------------------
            */}

            {
                !canManage
                && (
                    <div className="suppliers-alert suppliers-alert-info">
                        Your account has read-only supplier access. Creating, editing,
                        activating and deactivating suppliers requires
                        <strong>
                            {" "}
                            suppliers.manage
                        </strong>
                        .
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Summary
            |--------------------------------------------------------------------------
            */}

            <section className="suppliers-summary-grid">
                <article className="suppliers-summary-card">
                    <span>
                        Suppliers
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

                <article className="suppliers-summary-card">
                    <span>
                        Active on Page
                    </span>

                    <strong>
                        {
                            activeOnPage
                        }
                    </strong>

                    <small>
                        Currently visible active records
                    </small>
                </article>

                <article className="suppliers-summary-card">
                    <span>
                        Inactive on Page
                    </span>

                    <strong>
                        {
                            inactiveOnPage
                        }
                    </strong>

                    <small>
                        Currently visible inactive records
                    </small>
                </article>

                <article className="suppliers-summary-card">
                    <span>
                        Visible Outstanding
                    </span>

                    <strong className="suppliers-summary-money">
                        {
                            money.format(
                                visibleOutstanding
                            )
                        }
                    </strong>

                    <small>
                        Balance for suppliers on this page
                    </small>
                </article>
            </section>

            {/*
            |--------------------------------------------------------------------------
            | Main Panel
            |--------------------------------------------------------------------------
            */}

            <section className="suppliers-panel">
                <div className="suppliers-panel-header">
                    {/*
                    |--------------------------------------------------------------------------
                    | Search
                    |--------------------------------------------------------------------------
                    */}

                    <form
                        className="suppliers-search"
                        onSubmit={
                            submitSearch
                        }
                    >
                        <input
                            type="search"
                            value={
                                searchDraft
                            }
                            maxLength={
                                150
                            }
                            placeholder="Search name, phone or email..."
                            onChange={
                                (
                                    event
                                ) =>
                                    setSearchDraft(
                                        event.target.value
                                    )
                            }
                        />

                        <button
                            type="submit"
                            className="suppliers-button suppliers-button-primary"
                        >
                            Search
                        </button>

                        {
                            search
                            && (
                                <button
                                    type="button"
                                    className="suppliers-button suppliers-button-secondary"
                                    onClick={
                                        clearSearch
                                    }
                                >
                                    Clear
                                </button>
                            )
                        }
                    </form>

                    {/*
                    |--------------------------------------------------------------------------
                    | Status Filters
                    |--------------------------------------------------------------------------
                    */}

                    <div className="suppliers-filter-group">
                        <button
                            type="button"
                            className={
                                activeFilter
                                    ===
                                    null
                                    ? "suppliers-filter suppliers-filter-active"
                                    : "suppliers-filter"
                            }
                            onClick={
                                () =>
                                    changeActiveFilter(
                                        null
                                    )
                            }
                        >
                            All
                        </button>

                        <button
                            type="button"
                            className={
                                activeFilter
                                    ===
                                    true
                                    ? "suppliers-filter suppliers-filter-active"
                                    : "suppliers-filter"
                            }
                            onClick={
                                () =>
                                    changeActiveFilter(
                                        true
                                    )
                            }
                        >
                            Active
                        </button>

                        <button
                            type="button"
                            className={
                                activeFilter
                                    ===
                                    false
                                    ? "suppliers-filter suppliers-filter-active"
                                    : "suppliers-filter"
                            }
                            onClick={
                                () =>
                                    changeActiveFilter(
                                        false
                                    )
                            }
                        >
                            Inactive
                        </button>
                    </div>
                </div>

                {/*
                |--------------------------------------------------------------------------
                | Supplier Records
                |--------------------------------------------------------------------------
                */}

                {
                    loading
                        ? (
                            <div className="suppliers-loading">
                                Loading suppliers...
                            </div>
                        )
                        : suppliers.length
                            ===
                            0
                            ? (
                                <div className="suppliers-empty">
                                    <strong>
                                        No suppliers found
                                    </strong>

                                    <p>
                                        Adjust the search or status filter and try again.
                                    </p>
                                </div>
                            )
                            : (
                                <div className="suppliers-table-wrap">
                                    <table className="suppliers-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Supplier
                                                </th>

                                                <th>
                                                    Contact
                                                </th>

                                                <th>
                                                    Address
                                                </th>

                                                <th>
                                                    Outstanding
                                                </th>

                                                <th>
                                                    Status
                                                </th>

                                                <th>
                                                    Updated
                                                </th>

                                                {
                                                    canManage
                                                    && (
                                                        <th className="suppliers-actions-heading">
                                                            Actions
                                                        </th>
                                                    )
                                                }
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {
                                                suppliers.map(
                                                    (
                                                        supplier
                                                    ) => (
                                                        <tr
                                                            key={
                                                                supplier.id
                                                            }
                                                        >
                                                            {/*
                                                            |--------------------------------------------------------------------------
                                                            | Supplier
                                                            |--------------------------------------------------------------------------
                                                            */}

                                                            <td>
                                                                <div className="suppliers-name-cell">
                                                                    <strong>
                                                                        {
                                                                            supplier.name
                                                                        }
                                                                    </strong>

                                                                    <span>
                                                                        {
                                                                            supplier.supplier_code
                                                                        }
                                                                    </span>

                                                                    {
                                                                        supplier.notes
                                                                        && (
                                                                            <small
                                                                                title={
                                                                                    supplier.notes
                                                                                }
                                                                            >
                                                                                {
                                                                                    supplier.notes
                                                                                }
                                                                            </small>
                                                                        )
                                                                    }
                                                                </div>
                                                            </td>

                                                            {/*
                                                            |--------------------------------------------------------------------------
                                                            | Contact
                                                            |--------------------------------------------------------------------------
                                                            */}

                                                            <td>
                                                                <div className="suppliers-contact-cell">
                                                                    {
                                                                        supplier.phone
                                                                            ? (
                                                                                <a
                                                                                    href={
                                                                                        `tel:${supplier.phone}`
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        supplier.phone
                                                                                    }
                                                                                </a>
                                                                            )
                                                                            : (
                                                                                <span>
                                                                                    No phone
                                                                                </span>
                                                                            )
                                                                    }

                                                                    {
                                                                        supplier.email
                                                                            ? (
                                                                                <a
                                                                                    href={
                                                                                        `mailto:${supplier.email}`
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        supplier.email
                                                                                    }
                                                                                </a>
                                                                            )
                                                                            : (
                                                                                <span>
                                                                                    No email
                                                                                </span>
                                                                            )
                                                                    }
                                                                </div>
                                                            </td>

                                                            {/*
                                                            |--------------------------------------------------------------------------
                                                            | Address
                                                            |--------------------------------------------------------------------------
                                                            */}

                                                            <td>
                                                                <span className="suppliers-address">
                                                                    {
                                                                        supplier.address
                                                                        ||
                                                                        "—"
                                                                    }
                                                                </span>
                                                            </td>

                                                            {/*
                                                            |--------------------------------------------------------------------------
                                                            | Outstanding Balance
                                                            |--------------------------------------------------------------------------
                                                            */}

                                                            <td>
                                                                <strong
                                                                    className={
                                                                        supplier.current_balance
                                                                            >
                                                                            0
                                                                            ? "suppliers-balance suppliers-balance-due"
                                                                            : "suppliers-balance"
                                                                    }
                                                                >
                                                                    {
                                                                        money.format(
                                                                            supplier.current_balance
                                                                        )
                                                                    }
                                                                </strong>

                                                                {
                                                                    supplier.current_balance
                                                                    >
                                                                    0
                                                                    && (
                                                                        <small className="suppliers-due-label">
                                                                            Outstanding
                                                                        </small>
                                                                    )
                                                                }
                                                            </td>

                                                            {/*
                                                            |--------------------------------------------------------------------------
                                                            | Status
                                                            |--------------------------------------------------------------------------
                                                            */}

                                                            <td>
                                                                <span
                                                                    className={
                                                                        supplier.is_active
                                                                            ? "suppliers-badge suppliers-badge-success"
                                                                            : "suppliers-badge suppliers-badge-muted"
                                                                    }
                                                                >
                                                                    {
                                                                        supplier.is_active
                                                                            ? "Active"
                                                                            : "Inactive"
                                                                    }
                                                                </span>
                                                            </td>

                                                            {/*
                                                            |--------------------------------------------------------------------------
                                                            | Updated
                                                            |--------------------------------------------------------------------------
                                                            */}

                                                            <td>
                                                                {
                                                                    formatDate(
                                                                        supplier.updated_at
                                                                    )
                                                                }
                                                            </td>

                                                            {/*
                                                            |--------------------------------------------------------------------------
                                                            | Actions
                                                            |--------------------------------------------------------------------------
                                                            */}

                                                            {
                                                                canManage
                                                                && (
                                                                    <td>
                                                                        <div className="suppliers-row-actions">
                                                                            <button
                                                                                type="button"
                                                                                className="suppliers-small-button"
                                                                                onClick={
                                                                                    () =>
                                                                                        setEditingSupplier(
                                                                                            supplier
                                                                                        )
                                                                                }
                                                                                disabled={
                                                                                    busySupplierId
                                                                                    !==
                                                                                    null
                                                                                }
                                                                            >
                                                                                Edit
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                className={
                                                                                    supplier.is_active
                                                                                        ? "suppliers-small-button suppliers-small-button-danger"
                                                                                        : "suppliers-small-button suppliers-small-button-success"
                                                                                }
                                                                                onClick={
                                                                                    () =>
                                                                                        void toggleStatus(
                                                                                            supplier
                                                                                        )
                                                                                }
                                                                                disabled={
                                                                                    busySupplierId
                                                                                    !==
                                                                                    null
                                                                                }
                                                                            >
                                                                                {
                                                                                    busySupplierId
                                                                                        ===
                                                                                        supplier.id
                                                                                        ? "Updating..."
                                                                                        : supplier.is_active
                                                                                            ? "Deactivate"
                                                                                            : "Activate"
                                                                                }
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                )
                                                            }
                                                        </tr>
                                                    )
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
                        <div className="suppliers-pagination">
                            <span>
                                {
                                    pagination.total
                                }
                                {" suppliers"}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    className="suppliers-button suppliers-button-secondary"
                                    onClick={
                                        previousPage
                                    }
                                    disabled={
                                        loading
                                        ||
                                        pagination.current_page
                                        <=
                                        1
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
                                    className="suppliers-button suppliers-button-secondary"
                                    onClick={
                                        nextPage
                                    }
                                    disabled={
                                        loading
                                        ||
                                        pagination.current_page
                                        >=
                                        pagination.last_page
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
            | Supplier Form Modal
            |--------------------------------------------------------------------------
            |
            | Realtime list updates intentionally do not replace this modal's
            | supplier object. This prevents remote activity from wiping
            | unsaved edits.
            |--------------------------------------------------------------------------
            */}

            {
                editingSupplier
                !==
                undefined
                && (
                    <SupplierFormModal
                        supplier={
                            editingSupplier
                        }
                        onClose={
                            () =>
                                setEditingSupplier(
                                    undefined
                                )
                        }
                        onSubmit={
                            saveSupplier
                        }
                    />
                )
            }
        </div>
    );
}