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

import PhysicalStockCountModal
    from "./PhysicalStockCountModal";

import StockAdjustmentDetailsModal
    from "./StockAdjustmentDetailsModal";

import {
    getStockAdjustment,
    getStockAdjustmentIngredientOptions,
    getStockAdjustments,
    getStockAdjustmentUnitOptions,
    recordPhysicalStockCount,
} from "./stockAdjustmentService";

import type {
    PhysicalStockCountPayload,
    StockAdjustment,
    StockAdjustmentDirection,
    StockAdjustmentIngredientOption,
    StockAdjustmentPagination,
    StockAdjustmentUnitOption,
} from "./types";

import "./StockAdjustmentsPage.css";

/*
|--------------------------------------------------------------------------
| Filter State
|--------------------------------------------------------------------------
*/

interface FilterState {
    search:
    string;

    ingredientId:
    string;

    direction:
    ""
    | StockAdjustmentDirection;

    dateFrom:
    string;

    dateTo:
    string;
}

const EMPTY_FILTERS:
    FilterState = {
    search:
        "",

    ingredientId:
        "",

    direction:
        "",

    dateFrom:
        "",

    dateTo:
        "",
};

const EMPTY_PAGINATION:
    StockAdjustmentPagination = {
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
| Currency
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
    error: unknown
): string {
    if (
        error instanceof Error
        &&
        error.message
    ) {
        return error.message;
    }

    return "The stock adjustment operation could not be completed.";
}

function toDirection(
    value: string
): FilterState["direction"] {
    switch (
    value
    ) {
        case "":
            return "";

        case "IN":
            return "IN";

        case "OUT":
            return "OUT";

        case "NONE":
            return "NONE";

        default:
            return "";
    }
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

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function StockAdjustmentsPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canAdjust =
        hasPermission(
            "inventory.adjust"
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
            StockAdjustment[]
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
    | Options
    |--------------------------------------------------------------------------
    */

    const [
        ingredients,
        setIngredients,
    ] =
        useState<
            StockAdjustmentIngredientOption[]
        >(
            []
        );

    const [
        units,
        setUnits,
    ] =
        useState<
            StockAdjustmentUnitOption[]
        >(
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Modals
    |--------------------------------------------------------------------------
    */

    const [
        createOpen,
        setCreateOpen,
    ] =
        useState(
            false
        );

    const [
        selectedAdjustment,
        setSelectedAdjustment,
    ] =
        useState<
            StockAdjustment
            | undefined
        >(
            undefined
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
        busyAdjustmentId,
        setBusyAdjustmentId,
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
    | Load
    |--------------------------------------------------------------------------
    */

    const loadRecords =
        useCallback(
            async () => {
                try {
                    const result =
                        await getStockAdjustments({
                            page,

                            ingredientId:
                                filters.ingredientId
                                    ? Number(
                                        filters.ingredientId
                                    )
                                    : null,

                            direction:
                                filters.direction
                                || null,

                            dateFrom:
                                filters.dateFrom,

                            dateTo:
                                filters.dateTo,

                            search:
                                filters.search,

                            perPage:
                                30,
                        });

                    setRecords(
                        result.records
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
    | Ingredient Filters
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void getStockAdjustmentIngredientOptions()
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
                                     * History remains usable.
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

    /*
    |--------------------------------------------------------------------------
    | Summary
    |--------------------------------------------------------------------------
    */

    const inRecords =
        useMemo(
            () =>
                records.filter(
                    (
                        record
                    ) =>
                        record.direction
                        === "IN"
                ),
            [
                records,
            ]
        );

    const outRecords =
        useMemo(
            () =>
                records.filter(
                    (
                        record
                    ) =>
                        record.direction
                        === "OUT"
                ),
            [
                records,
            ]
        );

    const noneRecords =
        useMemo(
            () =>
                records.filter(
                    (
                        record
                    ) =>
                        record.direction
                        === "NONE"
                ),
            [
                records,
            ]
        );

    const inValue =
        useMemo(
            () =>
                inRecords.reduce(
                    (
                        total,
                        record
                    ) =>
                        total
                        +
                        record.adjustment_value,
                    0
                ),
            [
                inRecords,
            ]
        );

    const outValue =
        useMemo(
            () =>
                outRecords.reduce(
                    (
                        total,
                        record
                    ) =>
                        total
                        +
                        record.adjustment_value,
                    0
                ),
            [
                outRecords,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Open Count
    |--------------------------------------------------------------------------
    */

    const openPhysicalCount =
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
                        getStockAdjustmentIngredientOptions(),
                        getStockAdjustmentUnitOptions(),
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

    /*
    |--------------------------------------------------------------------------
    | Submit Count
    |--------------------------------------------------------------------------
    */

    const submitPhysicalCount =
        async (
            ingredientId: number,
            payload:
                PhysicalStockCountPayload
        ) => {
            const adjustment =
                await recordPhysicalStockCount(
                    ingredientId,
                    payload
                );

            setCreateOpen(
                false
            );

            const directionMessage =
                adjustment.direction
                    === "IN"
                    ? "Stock increased"
                    : adjustment.direction
                        === "OUT"
                        ? "Stock reduced"
                        : "No stock difference";

            setMessage(
                `${adjustment.adjustment_number} recorded successfully. ${directionMessage}.`
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

            try {
                const current =
                    await getStockAdjustmentIngredientOptions();

                setIngredients(
                    current
                );
            } catch {
                /*
                 * Adjustment already succeeded.
                 */
            }
        };

    /*
    |--------------------------------------------------------------------------
    | View
    |--------------------------------------------------------------------------
    */

    const viewAdjustment =
        async (
            adjustment:
                StockAdjustment
        ) => {
            setBusyAdjustmentId(
                adjustment.id
            );

            setError(
                ""
            );

            try {
                const current =
                    await getStockAdjustment(
                        adjustment.id
                    );

                setSelectedAdjustment(
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
                setBusyAdjustmentId(
                    null
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

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

                search:
                    filterDraft.search
                        .trim(),
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

    /*
    |--------------------------------------------------------------------------
    | Refresh
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <div className="stock-adjustments-page">
            <header className="stock-adjustments-page-header">
                <div>
                    <div className="stock-adjustments-eyebrow">
                        Inventory Control
                    </div>

                    <h1>
                        Stock Adjustments
                    </h1>

                    <p>
                        Reconcile physical stock counts with system
                        inventory. Stock increases or reductions are
                        calculated and posted automatically.
                    </p>
                </div>

                <div className="stock-adjustments-header-actions">
                    <button
                        type="button"
                        className="stock-adjustments-button stock-adjustments-button-secondary"
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
                        canAdjust
                        && (
                            <button
                                type="button"
                                className="stock-adjustments-button stock-adjustments-button-primary"
                                disabled={formLoading}
                                onClick={
                                    () =>
                                        void openPhysicalCount()
                                }
                            >
                                {
                                    formLoading
                                        ? "Loading..."
                                        : "+ Physical Stock Count"
                                }
                            </button>
                        )
                    }
                </div>
            </header>

            {
                error
                && (
                    <div className="stock-adjustments-alert stock-adjustments-alert-error">
                        {error}
                    </div>
                )
            }

            {
                message
                && (
                    <div className="stock-adjustments-alert stock-adjustments-alert-success">
                        {message}
                    </div>
                )
            }

            <section className="stock-adjustments-summary-grid">
                <article>
                    <span>
                        Total Adjustments
                    </span>

                    <strong>
                        {
                            pagination.total
                        }
                    </strong>

                    <small>
                        Matching filters
                    </small>
                </article>

                <article>
                    <span>
                        Stock Increase
                    </span>

                    <strong>
                        {
                            inRecords.length
                        }
                    </strong>

                    <small>
                        {
                            money.format(
                                inValue
                            )
                        }
                        {" value on page"}
                    </small>
                </article>

                <article>
                    <span>
                        Stock Reduction
                    </span>

                    <strong>
                        {
                            outRecords.length
                        }
                    </strong>

                    <small>
                        {
                            money.format(
                                outValue
                            )
                        }
                        {" value on page"}
                    </small>
                </article>

                <article>
                    <span>
                        No Difference
                    </span>

                    <strong>
                        {
                            noneRecords.length
                        }
                    </strong>

                    <small>
                        Counts matching system stock
                    </small>
                </article>
            </section>

            <section className="stock-adjustments-panel">
                <form
                    className="stock-adjustments-filters"
                    onSubmit={submitFilters}
                >
                    <label className="stock-adjustments-filter-field stock-adjustments-search-field">
                        <span>
                            Search
                        </span>

                        <input
                            type="search"
                            maxLength={150}
                            value={filterDraft.search}
                            placeholder="Adjustment, ingredient, SKU or reason..."
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

                    <label className="stock-adjustments-filter-field">
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

                    <label className="stock-adjustments-filter-field">
                        <span>
                            Direction
                        </span>

                        <select
                            value={filterDraft.direction}
                            onChange={
                                (
                                    event
                                ) =>
                                    setFilterDraft(
                                        (
                                            current
                                        ) => ({
                                            ...current,

                                            direction:
                                                toDirection(
                                                    event.target.value
                                                ),
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All
                            </option>

                            <option value="IN">
                                Stock Increase
                            </option>

                            <option value="OUT">
                                Stock Reduction
                            </option>

                            <option value="NONE">
                                No Difference
                            </option>
                        </select>
                    </label>

                    <label className="stock-adjustments-filter-field">
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

                    <label className="stock-adjustments-filter-field">
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

                    <div className="stock-adjustments-filter-actions">
                        <button
                            type="submit"
                            className="stock-adjustments-button stock-adjustments-button-primary"
                        >
                            Apply
                        </button>

                        <button
                            type="button"
                            className="stock-adjustments-button stock-adjustments-button-secondary"
                            onClick={clearFilters}
                        >
                            Clear
                        </button>
                    </div>
                </form>

                {
                    loading
                        ? (
                            <div className="stock-adjustments-loading">
                                Loading stock adjustments...
                            </div>
                        )
                        : records.length === 0
                            ? (
                                <div className="stock-adjustments-empty">
                                    <strong>
                                        No stock adjustments found
                                    </strong>

                                    <p>
                                        Record a physical stock count
                                        or change the filters.
                                    </p>
                                </div>
                            )
                            : (
                                <div className="stock-adjustments-table-wrap">
                                    <table className="stock-adjustments-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Adjustment
                                                </th>

                                                <th>
                                                    Date
                                                </th>

                                                <th>
                                                    Ingredient
                                                </th>

                                                <th>
                                                    System
                                                </th>

                                                <th>
                                                    Physical
                                                </th>

                                                <th>
                                                    Difference
                                                </th>

                                                <th>
                                                    Direction
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
                                                        adjustment
                                                    ) => (
                                                        <tr
                                                            key={
                                                                adjustment.id
                                                            }
                                                        >
                                                            <td>
                                                                <strong>
                                                                    {
                                                                        adjustment.adjustment_number
                                                                    }
                                                                </strong>

                                                                <small className="stock-adjustments-cell-meta">
                                                                    {
                                                                        adjustment.status
                                                                    }
                                                                </small>
                                                            </td>

                                                            <td>
                                                                {
                                                                    formatDateTime(
                                                                        adjustment.posted_at
                                                                    )
                                                                }
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        adjustment.ingredient?.name
                                                                        ?? "—"
                                                                    }
                                                                </strong>

                                                                <small className="stock-adjustments-cell-meta">
                                                                    {
                                                                        adjustment.ingredient?.sku
                                                                        ?? ""
                                                                    }
                                                                </small>
                                                            </td>

                                                            <td>
                                                                {
                                                                    quantityText(
                                                                        adjustment.system_quantity
                                                                    )
                                                                }

                                                                {" "}

                                                                {
                                                                    adjustment.count_unit?.symbol
                                                                    ?? ""
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    quantityText(
                                                                        adjustment.actual_quantity
                                                                    )
                                                                }

                                                                {" "}

                                                                {
                                                                    adjustment.count_unit?.symbol
                                                                    ?? ""
                                                                }
                                                            </td>

                                                            <td>
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

                                                                    {
                                                                        adjustment.count_unit?.symbol
                                                                        ?? ""
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={
                                                                        `stock-adjustments-direction stock-adjustments-direction-${adjustment.direction.toLowerCase()}`
                                                                    }
                                                                >
                                                                    {
                                                                        adjustment.direction
                                                                            === "IN"
                                                                            ? "Increase"
                                                                            : adjustment.direction
                                                                                === "OUT"
                                                                                ? "Reduction"
                                                                                : "No Change"
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        money.format(
                                                                            adjustment.adjustment_value
                                                                        )
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                {
                                                                    adjustment.created_by?.name
                                                                    ?? "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className="stock-adjustments-small-button"
                                                                    disabled={
                                                                        busyAdjustmentId
                                                                        !== null
                                                                    }
                                                                    onClick={
                                                                        () =>
                                                                            void viewAdjustment(
                                                                                adjustment
                                                                            )
                                                                    }
                                                                >
                                                                    {
                                                                        busyAdjustmentId
                                                                            === adjustment.id
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
                        <div className="stock-adjustments-pagination">
                            <span>
                                {
                                    pagination.total
                                }
                                {" records"}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    className="stock-adjustments-button stock-adjustments-button-secondary"
                                    disabled={
                                        loading
                                        ||
                                        pagination.current_page <= 1
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
                                    className="stock-adjustments-button stock-adjustments-button-secondary"
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
                    <PhysicalStockCountModal
                        ingredients={ingredients}
                        units={units}
                        onClose={
                            () =>
                                setCreateOpen(
                                    false
                                )
                        }
                        onSubmit={
                            submitPhysicalCount
                        }
                    />
                )
            }

            {
                selectedAdjustment
                && (
                    <StockAdjustmentDetailsModal
                        adjustment={
                            selectedAdjustment
                        }
                        onClose={
                            () =>
                                setSelectedAdjustment(
                                    undefined
                                )
                        }
                    />
                )
            }
        </div>
    );
}