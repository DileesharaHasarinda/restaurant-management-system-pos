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

import {
    createWastage,
    getWastage,
    getWastageIngredientOptions,
    getWastages,
    getWastageUnitOptions,
} from "./wastageService";

import WastageDetailsModal
    from "./WastageDetailsModal";

import WastageFormModal
    from "./WastageFormModal";

import type {
    CreateWastagePayload,
    WastageIngredientOption,
    WastagePagination,
    WastageReasonCatalog,
    WastageReasonCode,
    WastageRecord,
    WastageUnitOption,
} from "./types";

import "./WastagePage.css";

/*
|--------------------------------------------------------------------------
| Filter State
|--------------------------------------------------------------------------
*/

interface FilterState {
    ingredientId:
    string;

    reasonCode:
    ""
    | WastageReasonCode;

    status:
    ""
    | "POSTED";

    dateFrom:
    string;

    dateTo:
    string;
}

const EMPTY_FILTERS:
    FilterState = {
    ingredientId:
        "",

    reasonCode:
        "",

    status:
        "",

    dateFrom:
        "",

    dateTo:
        "",
};

const EMPTY_PAGINATION:
    WastagePagination = {
    current_page:
        1,

    per_page:
        25,

    total:
        0,

    last_page:
        1,
};

const DEFAULT_REASONS:
    WastageReasonCatalog = {
    EXPIRED:
        "Expired",

    SPOILED:
        "Spoiled",

    DAMAGED:
        "Damaged",

    COOKING_ERROR:
        "Cooking Error",

    DROPPED:
        "Dropped",

    OVERPRODUCTION:
        "Overproduction",

    STAFF_MEAL:
        "Staff Meal",

    OTHER:
        "Other",
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

    return "The wastage operation could not be completed.";
}

function toReasonCode(
    value:
        string
): FilterState["reasonCode"] {
    switch (
    value
    ) {
        case "":
            return "";

        case "EXPIRED":
            return "EXPIRED";

        case "SPOILED":
            return "SPOILED";

        case "DAMAGED":
            return "DAMAGED";

        case "COOKING_ERROR":
            return "COOKING_ERROR";

        case "DROPPED":
            return "DROPPED";

        case "OVERPRODUCTION":
            return "OVERPRODUCTION";

        case "STAFF_MEAL":
            return "STAFF_MEAL";

        case "OTHER":
            return "OTHER";

        default:
            return "";
    }
}

function toStatus(
    value:
        string
): FilterState["status"] {
    return value
        ===
        "POSTED"
        ? "POSTED"
        : "";
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

function quantityText(
    value:
        number
): string {
    return value.toLocaleString(
        "en-LK",
        {
            maximumFractionDigits:
                4,
        }
    );
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function WastagePage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canCreate =
        hasPermission(
            "wastage.create"
        );

    /*
    |--------------------------------------------------------------------------
    | Records
    |--------------------------------------------------------------------------
    */

    const [
        records,
        setRecords,
    ] =
        useState<
            WastageRecord[]
        >(
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Form / Filter Lookups
    |--------------------------------------------------------------------------
    */

    const [
        ingredients,
        setIngredients,
    ] =
        useState<
            WastageIngredientOption[]
        >(
            []
        );

    const [
        units,
        setUnits,
    ] =
        useState<
            WastageUnitOption[]
        >(
            []
        );

    const [
        reasonCodes,
        setReasonCodes,
    ] =
        useState<
            WastageReasonCatalog
        >(
            DEFAULT_REASONS
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
    | Modals
    |--------------------------------------------------------------------------
    */

    const [
        selectedWastage,
        setSelectedWastage,
    ] =
        useState<
            WastageRecord
            | undefined
        >(
            undefined
        );

    const [
        createOpen,
        setCreateOpen,
    ] =
        useState(
            false
        );

    /*
    |--------------------------------------------------------------------------
    | State
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
        formLoading,
        setFormLoading,
    ] =
        useState(
            false
        );

    const [
        busyRecordId,
        setBusyRecordId,
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
    | Load Wastage Records
    |--------------------------------------------------------------------------
    */

    const loadRecords =
        useCallback(
            async (): Promise<void> => {
                try {
                    const result =
                        await getWastages({
                            page,

                            ingredientId:
                                filters.ingredientId
                                    ? Number(
                                        filters.ingredientId
                                    )
                                    : null,

                            reasonCode:
                                filters.reasonCode
                                || null,

                            status:
                                filters.status
                                || null,

                            dateFrom:
                                filters.dateFrom,

                            dateTo:
                                filters.dateTo,

                            perPage:
                                25,
                        });

                    setRecords(
                        result.records
                    );

                    setPagination(
                        result.pagination
                    );

                    if (
                        Object.keys(
                            result.reasonCodes
                        ).length
                        >
                        0
                    ) {
                        setReasonCodes(
                            result.reasonCodes
                        );
                    }
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

    /*
    |--------------------------------------------------------------------------
    | Load Ingredient Options
    |--------------------------------------------------------------------------
    */

    const loadIngredientOptions =
        useCallback(
            async (): Promise<
                WastageIngredientOption[]
            > => {
                const result =
                    await getWastageIngredientOptions();

                setIngredients(
                    result
                );

                return result;
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Load Unit Options
    |--------------------------------------------------------------------------
    */

    const loadUnitOptions =
        useCallback(
            async (): Promise<
                WastageUnitOption[]
            > => {
                const result =
                    await getWastageUnitOptions();

                setUnits(
                    result
                );

                return result;
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Initial / Filter Record Loading
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void loadRecords();
                    },
                    0
                );

            return () =>
                window.clearTimeout(
                    timeoutId
                );
        },
        [
            loadRecords,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Initial Ingredient Options
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void loadIngredientOptions()
                            .catch(
                                () => {
                                    /*
                                     * Wastage history remains usable if
                                     * ingredient lookup loading fails.
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
            loadIngredientOptions,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Summary
    |--------------------------------------------------------------------------
    */

    const pageEstimatedCost =
        useMemo(
            () =>
                records.reduce(
                    (
                        total,
                        record
                    ) =>
                        total
                        +
                        record.estimated_cost,
                    0
                ),
            [
                records,
            ]
        );

    const postedOnPage =
        useMemo(
            () =>
                records.filter(
                    (
                        record
                    ) =>
                        record.status
                        ===
                        "POSTED"
                ).length,
            [
                records,
            ]
        );

    const reasonTypesOnPage =
        useMemo(
            () =>
                new Set(
                    records.map(
                        (
                            record
                        ) =>
                            record.reason_code
                    )
                ).size,
            [
                records,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Open Create Modal
    |--------------------------------------------------------------------------
    */

    const openCreateModal =
        async (): Promise<void> => {
            if (
                formLoading
            ) {
                return;
            }

            setFormLoading(
                true
            );

            setError(
                ""
            );

            setMessage(
                ""
            );

            try {
                await Promise.all([
                    loadIngredientOptions(),
                    loadUnitOptions(),
                ]);

                setCreateOpen(
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
                setFormLoading(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Submit Create
    |--------------------------------------------------------------------------
    */

    const submitCreate =
        async (
            payload:
                CreateWastagePayload
        ): Promise<void> => {
            const wastage =
                await createWastage(
                    payload
                );

            setCreateOpen(
                false
            );

            setMessage(
                `${wastage.wastage_number} recorded successfully.`
            );

            /*
             * Return to the first page so a newly created wastage record can
             * be visible immediately.
             */
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
                await loadRecords();
            }

            /*
             * Wastage reduces inventory immediately.
             *
             * Refresh the ingredient/current-stock options so the next form
             * uses fresh authoritative stock values.
             *
             * The wastage itself has already succeeded, therefore lookup
             * failure must not turn this into a false operation failure.
             */
            try {
                await loadIngredientOptions();
            } catch {
                /*
                 * A later realtime event/reconnect can reconcile this.
                 */
            }
        };

    /*
    |--------------------------------------------------------------------------
    | View Record
    |--------------------------------------------------------------------------
    */

    const viewRecord =
        async (
            record:
                WastageRecord
        ): Promise<void> => {
            setBusyRecordId(
                record.id
            );

            setError(
                ""
            );

            try {
                const current =
                    await getWastage(
                        record.id
                    );

                setSelectedWastage(
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
                setBusyRecordId(
                    null
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Refresh Selected Wastage
    |--------------------------------------------------------------------------
    |
    | Keep an already-open details modal synchronized.
    |
    | Functional state replacement protects against a race where the manager
    | closes the modal or opens another record while the REST request is
    | still running.
    |--------------------------------------------------------------------------
    */

    const refreshSelectedWastage =
        useCallback(
            async (): Promise<void> => {
                if (
                    !selectedWastage
                ) {
                    return;
                }

                const wastageId =
                    selectedWastage.id;

                try {
                    const current =
                        await getWastage(
                            wastageId
                        );

                    setSelectedWastage(
                        (
                            existing
                        ) => {
                            if (
                                !existing
                                ||
                                existing.id
                                !==
                                wastageId
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
                        "Unable to reconcile realtime wastage details.",
                        caught
                    );
                }
            },
            [
                selectedWastage,
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
            });
        };

    const clearFilters =
        (): void => {
            setFilterDraft(
                EMPTY_FILTERS
            );

            setFilters(
                EMPTY_FILTERS
            );

            setPage(
                1
            );

            setLoading(
                true
            );

            setError(
                ""
            );

            setMessage(
                ""
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
                        loadRecords(),
                        loadIngredientOptions(),
                        refreshSelectedWastage(),
                    ];

                if (
                    createOpen
                ) {
                    jobs.push(
                        loadUnitOptions()
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
    | Wastage has two important realtime effects:
    |
    | 1. A Wastage record is created.
    | 2. Inventory is reduced through an immutable stock movement.
    |
    | Therefore this page listens to both `wastage` and `inventory`.
    |
    | Reverb remains an invalidation signal only. Laravel REST is always
    | authoritative.
    |
    | Realtime synchronization updates:
    |
    | - current filtered wastage list
    | - pagination totals
    | - page summary values
    | - reason catalog returned by the API
    | - ingredient/current-stock options
    | - open wastage details
    | - unit options while the Create Wastage modal is open
    |
    | It does not reload the browser, show the manual Refresh spinner, or
    | close the current modal.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "wastage",
            "inventory",
        ],
        async () => {
            try {
                const jobs:
                    Array<
                        Promise<unknown>
                    > = [
                        loadRecords(),
                        loadIngredientOptions(),
                        refreshSelectedWastage(),
                    ];

                /*
                 * Unit options are only needed by the creation modal.
                 *
                 * Avoid requesting them on every stock event when the modal
                 * is not open.
                 */
                if (
                    createOpen
                ) {
                    jobs.push(
                        loadUnitOptions()
                    );
                }

                await Promise.all(
                    jobs
                );
            } catch (
            caught
            ) {
                /*
                 * A realtime failure must not interrupt the manager's
                 * current workflow.
                 *
                 * A later event, reconnect, or manual Refresh can reconcile
                 * the authoritative state.
                 */
                console.error(
                    "Unable to reconcile realtime wastage data.",
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
        <div className="wastage-page">
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

            <header className="wastage-page-header">
                <div>
                    <div className="wastage-eyebrow">
                        Inventory Control
                    </div>

                    <h1>
                        Wastage
                    </h1>

                    <p>
                        Record ingredient wastage, automatically deduct
                        stock and review the value and reason for every
                        wastage transaction.
                    </p>
                </div>

                <div className="wastage-header-actions">
                    <button
                        type="button"
                        className="wastage-button wastage-button-secondary"
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
                        canCreate
                        && (
                            <button
                                type="button"
                                className="wastage-button wastage-button-primary"
                                disabled={
                                    formLoading
                                }
                                onClick={
                                    () =>
                                        void openCreateModal()
                                }
                            >
                                {
                                    formLoading
                                        ? "Loading..."
                                        : "+ Record Wastage"
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
                    <div className="wastage-alert wastage-alert-error">
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
                    <div className="wastage-alert wastage-alert-success">
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

            <section className="wastage-summary-grid">
                <article>
                    <span>
                        Total Records
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
                        Value on Page
                    </span>

                    <strong>
                        {
                            money.format(
                                pageEstimatedCost
                            )
                        }
                    </strong>

                    <small>
                        Backend-calculated inventory cost
                    </small>
                </article>

                <article>
                    <span>
                        Posted on Page
                    </span>

                    <strong>
                        {
                            postedOnPage
                        }
                    </strong>

                    <small>
                        Immutable posted records
                    </small>
                </article>

                <article>
                    <span>
                        Reason Types
                    </span>

                    <strong>
                        {
                            reasonTypesOnPage
                        }
                    </strong>

                    <small>
                        Used on current page
                    </small>
                </article>
            </section>

            {/*
            |--------------------------------------------------------------------------
            | Main Panel
            |--------------------------------------------------------------------------
            */}

            <section className="wastage-panel">
                {/*
                |--------------------------------------------------------------------------
                | Filters
                |--------------------------------------------------------------------------
                */}

                <form
                    className="wastage-filters"
                    onSubmit={
                        submitFilters
                    }
                >
                    <label className="wastage-filter-field">
                        <span>
                            Ingredient
                        </span>

                        <select
                            value={
                                filterDraft.ingredientId
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

                                            ingredientId:
                                                event.target.value,
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All Ingredients
                            </option>

                            {
                                ingredients.map(
                                    (
                                        ingredient
                                    ) => (
                                        <option
                                            key={
                                                ingredient.id
                                            }
                                            value={
                                                ingredient.id
                                            }
                                        >
                                            {
                                                ingredient.sku
                                                    ? `${ingredient.sku} — `
                                                    : ""
                                            }

                                            {
                                                ingredient.name
                                            }
                                        </option>
                                    )
                                )
                            }
                        </select>
                    </label>

                    <label className="wastage-filter-field">
                        <span>
                            Reason
                        </span>

                        <select
                            value={
                                filterDraft.reasonCode
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

                                            reasonCode:
                                                toReasonCode(
                                                    event.target.value
                                                ),
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All Reasons
                            </option>

                            {
                                Object.entries(
                                    reasonCodes
                                ).map(
                                    ([
                                        code,
                                        label,
                                    ]) => (
                                        <option
                                            key={
                                                code
                                            }
                                            value={
                                                code
                                            }
                                        >
                                            {
                                                label
                                            }
                                        </option>
                                    )
                                )
                            }
                        </select>
                    </label>

                    <label className="wastage-filter-field">
                        <span>
                            Status
                        </span>

                        <select
                            value={
                                filterDraft.status
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

                                            status:
                                                toStatus(
                                                    event.target.value
                                                ),
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All Statuses
                            </option>

                            <option value="POSTED">
                                Posted
                            </option>
                        </select>
                    </label>

                    <label className="wastage-filter-field">
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

                    <label className="wastage-filter-field">
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

                    <div className="wastage-filter-actions">
                        <button
                            type="submit"
                            className="wastage-button wastage-button-primary"
                        >
                            Apply
                        </button>

                        <button
                            type="button"
                            className="wastage-button wastage-button-secondary"
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
                            <div className="wastage-loading">
                                Loading wastage records...
                            </div>
                        )
                        : records.length
                            ===
                            0
                            ? (
                                <div className="wastage-empty">
                                    <strong>
                                        No wastage records found
                                    </strong>

                                    <p>
                                        Record wastage or adjust the
                                        current filters.
                                    </p>
                                </div>
                            )
                            : (
                                <div className="wastage-table-wrap">
                                    <table className="wastage-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Wastage
                                                </th>

                                                <th>
                                                    Date
                                                </th>

                                                <th>
                                                    Ingredient
                                                </th>

                                                <th>
                                                    Entered Qty
                                                </th>

                                                <th>
                                                    Base Qty
                                                </th>

                                                <th>
                                                    Reason
                                                </th>

                                                <th>
                                                    Value
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
                                                records.map(
                                                    (
                                                        record
                                                    ) => (
                                                        <tr
                                                            key={
                                                                record.id
                                                            }
                                                        >
                                                            <td>
                                                                <strong>
                                                                    {
                                                                        record.wastage_number
                                                                    }
                                                                </strong>

                                                                <small className="wastage-cell-meta">
                                                                    {
                                                                        record.status
                                                                    }
                                                                </small>
                                                            </td>

                                                            <td>
                                                                {
                                                                    formatDateTime(
                                                                        record.wasted_at
                                                                    )
                                                                }
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        record
                                                                            .ingredient
                                                                            ?.name
                                                                        ?? "—"
                                                                    }
                                                                </strong>

                                                                <small className="wastage-cell-meta">
                                                                    {
                                                                        record
                                                                            .ingredient
                                                                            ?.sku
                                                                        ?? ""
                                                                    }
                                                                </small>
                                                            </td>

                                                            <td>
                                                                {
                                                                    quantityText(
                                                                        record
                                                                            .entered_quantity
                                                                            .quantity
                                                                    )
                                                                }

                                                                {" "}

                                                                {
                                                                    record
                                                                        .entered_quantity
                                                                        .unit
                                                                        ?.symbol
                                                                    ?? ""
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    quantityText(
                                                                        record.base_quantity
                                                                    )
                                                                }

                                                                {" "}

                                                                {
                                                                    record
                                                                        .ingredient
                                                                        ?.base_unit
                                                                        ?.symbol
                                                                    ?? ""
                                                                }
                                                            </td>

                                                            <td>
                                                                <span className="wastage-reason-badge">
                                                                    {
                                                                        record.reason_label
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        money.format(
                                                                            record.estimated_cost
                                                                        )
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                {
                                                                    record
                                                                        .created_by
                                                                        ?.name
                                                                    ?? "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className="wastage-small-button"
                                                                    disabled={
                                                                        busyRecordId
                                                                        !==
                                                                        null
                                                                    }
                                                                    onClick={
                                                                        () =>
                                                                            void viewRecord(
                                                                                record
                                                                            )
                                                                    }
                                                                >
                                                                    {
                                                                        busyRecordId
                                                                            ===
                                                                            record.id
                                                                            ? "Loading..."
                                                                            : "View"
                                                                    }
                                                                </button>
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
                        <div className="wastage-pagination">
                            <span>
                                {
                                    pagination.total
                                }
                                {" records"}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    className="wastage-button wastage-button-secondary"
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
                                    className="wastage-button wastage-button-secondary"
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

            {/*
            |--------------------------------------------------------------------------
            | Create Wastage Modal
            |--------------------------------------------------------------------------
            */}

            {
                createOpen
                && (
                    <WastageFormModal
                        ingredients={
                            ingredients
                        }
                        units={
                            units
                        }
                        reasonCodes={
                            reasonCodes
                        }
                        onClose={
                            () =>
                                setCreateOpen(
                                    false
                                )
                        }
                        onSubmit={
                            submitCreate
                        }
                    />
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Wastage Details Modal
            |--------------------------------------------------------------------------
            */}

            {
                selectedWastage
                && (
                    <WastageDetailsModal
                        wastage={
                            selectedWastage
                        }
                        onClose={
                            () =>
                                setSelectedWastage(
                                    undefined
                                )
                        }
                    />
                )
            }
        </div>
    );
}