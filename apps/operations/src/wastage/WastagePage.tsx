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

interface FilterState {
    ingredientId:
    string;

    reasonCode:
    ""
    | WastageReasonCode;

    status:
    "" | "POSTED";

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
        &&
        error.message
    ) {
        return error.message;
    }

    return "The wastage operation could not be completed.";
}

function toReasonCode(
    value: string
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
    value: string
): FilterState["status"] {
    return value
        === "POSTED"
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

export default function WastagePage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canCreate =
        hasPermission(
            "wastage.create"
        );

    const [
        records,
        setRecords,
    ] =
        useState<
            WastageRecord[]
        >(
            []
        );

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

    const loadRecords =
        useCallback(
            async () => {
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
                        > 0
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

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void getWastageIngredientOptions()
                            .then(
                                (
                                    result
                                ) =>
                                    setIngredients(
                                        result
                                    )
                            )
                            .catch(
                                () => {
                                    /*
                                     * History still works if
                                     * ingredient lookup fails.
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
                        === "POSTED"
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

    const openCreateModal =
        async () => {
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
                const [
                    ingredientOptions,
                    unitOptions,
                ] =
                    await Promise.all([
                        getWastageIngredientOptions(),
                        getWastageUnitOptions(),
                    ]);

                setIngredients(
                    ingredientOptions
                );

                setUnits(
                    unitOptions
                );

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

    const submitCreate =
        async (
            payload:
                CreateWastagePayload
        ) => {
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
             * Reload ingredients so current stock
             * shown in subsequent forms is fresh.
             */
            try {
                const currentIngredients =
                    await getWastageIngredientOptions();

                setIngredients(
                    currentIngredients
                );
            } catch {
                /*
                 * Wastage was already successfully
                 * recorded, so do not turn a lookup
                 * refresh failure into a false error.
                 */
            }
        };

    const viewRecord =
        async (
            record:
                WastageRecord
        ) => {
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

    const submitFilters =
        (
            event:
                FormEvent
        ) => {
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
        () => {
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
                await loadRecords();
            } finally {
                setRefreshing(
                    false
                );
            }
        };

    return (
        <div className="wastage-page">
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
                                className="wastage-button wastage-button-primary"
                                disabled={formLoading}
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

            {
                error
                && (
                    <div className="wastage-alert wastage-alert-error">
                        {error}
                    </div>
                )
            }

            {
                message
                && (
                    <div className="wastage-alert wastage-alert-success">
                        {message}
                    </div>
                )
            }

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

            <section className="wastage-panel">
                <form
                    className="wastage-filters"
                    onSubmit={submitFilters}
                >
                    <label className="wastage-filter-field">
                        <span>
                            Ingredient
                        </span>

                        <select
                            value={filterDraft.ingredientId}
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
                                            key={ingredient.id}
                                            value={ingredient.id}
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
                            value={filterDraft.reasonCode}
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
                                            key={code}
                                            value={code}
                                        >
                                            {label}
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

                    <label className="wastage-filter-field">
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
                            onClick={clearFilters}
                        >
                            Clear
                        </button>
                    </div>
                </form>

                {
                    loading
                        ? (
                            <div className="wastage-loading">
                                Loading wastage records...
                            </div>
                        )
                        : records.length === 0
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
                                                        <tr key={record.id}>
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
                                                                        record.ingredient?.name
                                                                        ?? "—"
                                                                    }
                                                                </strong>

                                                                <small className="wastage-cell-meta">
                                                                    {
                                                                        record.ingredient?.sku
                                                                        ?? ""
                                                                    }
                                                                </small>
                                                            </td>

                                                            <td>
                                                                {
                                                                    quantityText(
                                                                        record.entered_quantity.quantity
                                                                    )
                                                                }

                                                                {" "}

                                                                {
                                                                    record.entered_quantity.unit?.symbol
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
                                                                    record.ingredient?.base_unit?.symbol
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
                                                                    record.created_by?.name
                                                                    ?? "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className="wastage-small-button"
                                                                    disabled={
                                                                        busyRecordId
                                                                        !== null
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
                                                                            === record.id
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

                {
                    pagination.last_page > 1
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
                                        <= 1
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
                createOpen
                && (
                    <WastageFormModal
                        ingredients={ingredients}
                        units={units}
                        reasonCodes={reasonCodes}
                        onClose={
                            () =>
                                setCreateOpen(
                                    false
                                )
                        }
                        onSubmit={submitCreate}
                    />
                )
            }

            {
                selectedWastage
                && (
                    <WastageDetailsModal
                        wastage={selectedWastage}
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