import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import {
    Link,
} from "react-router-dom";

import {
    useAuth,
} from "../auth/useAuth";

import {
    ApiError,
} from "../lib/api";

import IngredientFormModal
    from "./IngredientFormModal";

import {
    createIngredient,
    getIngredients,
    getUnits,
    updateIngredient,
    updateIngredientStatus,
} from "./ingredientService";

import type {
    Ingredient,
    IngredientEditorSubmission,
    IngredientPagination,
    IngredientUnit,
} from "./types";

import "./IngredientsPage.css";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const EMPTY_PAGINATION:
    IngredientPagination = {
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

const quantity =
    new Intl.NumberFormat(
        "en-LK",
        {
            minimumFractionDigits:
                0,

            maximumFractionDigits:
                4,
        }
    );

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function IngredientsPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canManage =
        hasPermission(
            "inventory.manage"
        );

    const [
        ingredients,
        setIngredients,
    ] =
        useState<
            Ingredient[]
        >(
            []
        );

    const [
        units,
        setUnits,
    ] =
        useState<
            IngredientUnit[]
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
        baseUnitId,
        setBaseUnitId,
    ] =
        useState<
            number
            |
            null
        >(
            null
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

    const [
        lowStockOnly,
        setLowStockOnly,
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
        busy,
        setBusy,
    ] =
        useState(
            false
        );

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(
            false
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

    const [
        editingIngredient,
        setEditingIngredient,
    ] =
        useState<
            Ingredient
            |
            null
            |
            undefined
        >(
            undefined
        );

    /*
    |--------------------------------------------------------------------------
    | Error Handling
    |--------------------------------------------------------------------------
    */

    const showError =
        useCallback(
            (
                exception: unknown
            ): void => {
                if (
                    exception
                    instanceof
                    ApiError
                ) {
                    const validation =
                        Object
                            .values(
                                exception.errors
                            )
                            .flat()[0];

                    setError(
                        validation
                        ??
                        exception.message
                    );

                    return;
                }

                setError(
                    "Unable to complete the ingredient request."
                );
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Load Units
    |--------------------------------------------------------------------------
    */

    const loadUnits =
        useCallback(
            async (): Promise<void> => {
                const result =
                    await getUnits();

                setUnits(
                    result
                );
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Load Ingredients
    |--------------------------------------------------------------------------
    */

    const loadIngredients =
        useCallback(
            async (): Promise<void> => {
                const result =
                    await getIngredients({
                        page,

                        search,

                        baseUnitId,

                        isActive:
                            activeFilter,

                        lowStock:
                            lowStockOnly,

                        perPage:
                            30,
                    });

                setIngredients(
                    result.ingredients
                );

                setPagination(
                    result.pagination
                );
            },
            [
                page,
                search,
                baseUnitId,
                activeFilter,
                lowStockOnly,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Initial / Filter Loading
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const loadInitial =
                async (): Promise<void> => {
                    try {
                        await Promise.all([
                            loadUnits(),
                            loadIngredients(),
                        ]);
                    } catch (
                    exception
                    ) {
                        showError(
                            exception
                        );
                    } finally {
                        setLoading(
                            false
                        );
                    }
                };

            void loadInitial();
        },
        [
            loadUnits,
            loadIngredients,
            showError,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Derived Summary
    |--------------------------------------------------------------------------
    */

    const summary =
        useMemo(
            () => {
                const active =
                    ingredients.filter(
                        (
                            ingredient
                        ) =>
                            ingredient.is_active
                    ).length;

                const low =
                    ingredients.filter(
                        (
                            ingredient
                        ) =>
                            ingredient.is_low_stock
                    ).length;

                const out =
                    ingredients.filter(
                        (
                            ingredient
                        ) =>
                            ingredient.is_out_of_stock
                    ).length;

                return {
                    active,
                    low,
                    out,
                };
            },
            [
                ingredients,
            ]
        );

    const rootUnits =
        useMemo(
            () =>
                units.filter(
                    (
                        unit
                    ) =>
                        unit.is_root_unit
                ),
            [
                units,
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
                FormEvent<HTMLFormElement>
        ): void => {
            event.preventDefault();

            setPage(
                1
            );

            setSearch(
                searchDraft.trim()
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Save Ingredient
    |--------------------------------------------------------------------------
    */

    const saveIngredient =
        async (
            submission:
                IngredientEditorSubmission
        ): Promise<void> => {
            setBusy(
                true
            );

            setError(
                ""
            );

            setMessage(
                ""
            );

            try {
                if (
                    editingIngredient
                ) {
                    let updated =
                        await updateIngredient(
                            editingIngredient.id,

                            {
                                name:
                                    submission.name,

                                base_unit_id:
                                    submission.base_unit_id,

                                minimum_stock:
                                    submission.minimum_stock,

                                storage_location:
                                    submission.storage_location,
                            }
                        );

                    if (
                        updated.is_active
                        !==
                        submission.is_active
                    ) {
                        updated =
                            await updateIngredientStatus(
                                updated.id,

                                {
                                    is_active:
                                        submission.is_active,
                                }
                            );
                    }

                    setMessage(
                        `Ingredient "${updated.name}" updated successfully.`
                    );
                } else {
                    const created =
                        await createIngredient({
                            name:
                                submission.name,

                            base_unit_id:
                                submission.base_unit_id,

                            minimum_stock:
                                submission.minimum_stock,

                            storage_location:
                                submission.storage_location,

                            is_active:
                                submission.is_active,
                        });

                    setMessage(
                        `Ingredient "${created.name}" created successfully.`
                    );
                }

                setEditingIngredient(
                    undefined
                );

                await loadIngredients();
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Status
    |--------------------------------------------------------------------------
    */

    const toggleStatus =
        async (
            ingredient:
                Ingredient
        ): Promise<void> => {
            if (
                !canManage
            ) {
                return;
            }

            const next =
                !ingredient.is_active;

            const confirmation =
                next
                    ? `Activate "${ingredient.name}"?`
                    : `Deactivate "${ingredient.name}"?`;

            if (
                !window.confirm(
                    confirmation
                )
            ) {
                return;
            }

            setBusy(
                true
            );

            setError(
                ""
            );

            try {
                await updateIngredientStatus(
                    ingredient.id,

                    {
                        is_active:
                            next,
                    }
                );

                setMessage(
                    next
                        ? "Ingredient activated successfully."
                        : "Ingredient deactivated successfully."
                );

                await loadIngredients();
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Refresh
    |--------------------------------------------------------------------------
    */

    const refresh =
        async (): Promise<void> => {
            setRefreshing(
                true
            );

            setError(
                ""
            );

            try {
                await Promise.all([
                    loadUnits(),
                    loadIngredients(),
                ]);
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setRefreshing(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Loading
    |--------------------------------------------------------------------------
    */

    if (
        loading
    ) {
        return (
            <section className="ops-ingredients-page">
                <div className="ops-ingredients-loading">
                    <span />

                    <strong>
                        Loading Ingredients
                    </strong>

                    <p>
                        Retrieving ingredient configuration.
                    </p>
                </div>
            </section>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <section className="ops-ingredients-page">
            <header className="ops-ingredients-header">
                <div>
                    <span>
                        INVENTORY CONFIGURATION
                    </span>

                    <h2>
                        Ingredients
                    </h2>

                    <p>
                        Manage restaurant ingredients, base units,
                        reorder levels and storage locations.
                    </p>
                </div>

                <div className="ops-ingredients-header-actions">
                    <Link
                        to="/inventory"
                    >
                        Stock Overview
                    </Link>

                    <Link
                        to="/stock-adjustments"
                    >
                        Stock Adjustments
                    </Link>

                    <button
                        type="button"
                        className="secondary"
                        disabled={
                            refreshing
                        }
                        onClick={
                            () => {
                                void refresh();
                            }
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
                        &&
                        (
                            <button
                                type="button"
                                className="primary"
                                disabled={
                                    rootUnits.filter(
                                        (
                                            unit
                                        ) =>
                                            unit.is_active
                                    ).length
                                    ===
                                    0
                                }
                                onClick={
                                    () =>
                                        setEditingIngredient(
                                            null
                                        )
                                }
                            >
                                + New Ingredient
                            </button>
                        )
                    }
                </div>
            </header>

            {
                error
                &&
                (
                    <div
                        className="ops-ingredients-alert error"
                        role="alert"
                    >
                        {
                            error
                        }
                    </div>
                )
            }

            {
                message
                &&
                (
                    <div className="ops-ingredients-alert success">
                        {
                            message
                        }
                    </div>
                )
            }

            {/* Summary */}

            <div className="ops-ingredients-summary">
                <SummaryCard
                    label="Total Ingredients"
                    value={
                        pagination.total
                    }
                    note="Matching current filters"
                />

                <SummaryCard
                    label="Active"
                    value={
                        summary.active
                    }
                    note="Current page"
                    tone="success"
                />

                <SummaryCard
                    label="Low Stock"
                    value={
                        summary.low
                    }
                    note="Current page"
                    tone={
                        summary.low > 0
                            ? "warning"
                            : "normal"
                    }
                />

                <SummaryCard
                    label="Out of Stock"
                    value={
                        summary.out
                    }
                    note="Current page"
                    tone={
                        summary.out > 0
                            ? "danger"
                            : "normal"
                    }
                />
            </div>

            {/* Main Panel */}

            <section className="ops-ingredients-panel">
                <header className="ops-ingredients-panel-header">
                    <div>
                        <span>
                            INGREDIENT MASTER
                        </span>

                        <h3>
                            Ingredient List
                        </h3>

                        <p>
                            Stock quantity and average cost are system-controlled.
                        </p>
                    </div>

                    <strong>
                        {
                            pagination.total
                        }
                        {" "}
                        records
                    </strong>
                </header>

                <form
                    className="ops-ingredients-filters"
                    onSubmit={
                        submitSearch
                    }
                >
                    <input
                        type="search"
                        placeholder="Search name, SKU or storage location..."
                        value={
                            searchDraft
                        }
                        onChange={
                            (
                                event
                            ) =>
                                setSearchDraft(
                                    event.target.value
                                )
                        }
                    />

                    <select
                        value={
                            baseUnitId
                            ??
                            ""
                        }
                        onChange={
                            (
                                event
                            ) => {
                                setPage(
                                    1
                                );

                                setBaseUnitId(
                                    event.target.value
                                        ===
                                        ""
                                        ? null
                                        : Number(
                                            event.target.value
                                        )
                                );
                            }
                        }
                    >
                        <option value="">
                            All Base Units
                        </option>

                        {
                            rootUnits.map(
                                (
                                    unit
                                ) => (
                                    <option
                                        key={
                                            unit.id
                                        }
                                        value={
                                            unit.id
                                        }
                                    >
                                        {
                                            unit.name
                                        }
                                        {" ("}
                                        {
                                            unit.symbol
                                        }
                                        {")"}
                                    </option>
                                )
                            )
                        }
                    </select>

                    <select
                        value={
                            activeFilter
                                ===
                                null
                                ? ""
                                : activeFilter
                                    ? "1"
                                    : "0"
                        }
                        onChange={
                            (
                                event
                            ) => {
                                setPage(
                                    1
                                );

                                const value =
                                    event.target.value;

                                setActiveFilter(
                                    value
                                        ===
                                        ""
                                        ? null
                                        : value
                                        ===
                                        "1"
                                );
                            }
                        }
                    >
                        <option value="">
                            Active & Inactive
                        </option>

                        <option value="1">
                            Active
                        </option>

                        <option value="0">
                            Inactive
                        </option>
                    </select>

                    <label className="ops-ingredients-low-filter">
                        <input
                            type="checkbox"
                            checked={
                                lowStockOnly
                            }
                            onChange={
                                (
                                    event
                                ) => {
                                    setPage(
                                        1
                                    );

                                    setLowStockOnly(
                                        event.target.checked
                                    );
                                }
                            }
                        />

                        <span>
                            Low stock only
                        </span>
                    </label>

                    <button
                        type="submit"
                    >
                        Search
                    </button>
                </form>

                {
                    ingredients.length
                        ===
                        0
                        ? (
                            <div className="ops-ingredients-empty">
                                <strong>
                                    No ingredients found
                                </strong>

                                <span>
                                    Create an ingredient or change the current filters.
                                </span>
                            </div>
                        )
                        : (
                            <div className="ops-ingredients-table-wrap">
                                <table className="ops-ingredients-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                Ingredient
                                            </th>

                                            <th>
                                                Base Unit
                                            </th>

                                            <th>
                                                Current Stock
                                            </th>

                                            <th>
                                                Minimum Stock
                                            </th>

                                            <th>
                                                Average Cost
                                            </th>

                                            <th>
                                                Stock Value
                                            </th>

                                            <th>
                                                Storage
                                            </th>

                                            <th>
                                                Stock Status
                                            </th>

                                            <th>
                                                Status
                                            </th>

                                            {
                                                canManage
                                                &&
                                                (
                                                    <th>
                                                        Actions
                                                    </th>
                                                )
                                            }
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {
                                            ingredients.map(
                                                (
                                                    ingredient
                                                ) => (
                                                    <tr
                                                        key={
                                                            ingredient.id
                                                        }
                                                    >
                                                        <td>
                                                            <div className="ops-ingredients-name">
                                                                <strong>
                                                                    {
                                                                        ingredient.name
                                                                    }
                                                                </strong>

                                                                <span>
                                                                    {
                                                                        ingredient.sku
                                                                        ??
                                                                        "SKU pending"
                                                                    }
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            {
                                                                ingredient.base_unit
                                                                    ? (
                                                                        <div className="ops-ingredients-unit">
                                                                            <strong>
                                                                                {
                                                                                    ingredient
                                                                                        .base_unit
                                                                                        .symbol
                                                                                }
                                                                            </strong>

                                                                            <span>
                                                                                {
                                                                                    ingredient
                                                                                        .base_unit
                                                                                        .name
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                    : "—"
                                                            }
                                                        </td>

                                                        <td>
                                                            <strong className="ops-ingredients-stock-value">
                                                                {
                                                                    quantity.format(
                                                                        ingredient.current_stock
                                                                    )
                                                                }
                                                                {" "}
                                                                {
                                                                    ingredient
                                                                        .base_unit
                                                                        ?.symbol
                                                                    ??
                                                                    ""
                                                                }
                                                            </strong>
                                                        </td>

                                                        <td>
                                                            {
                                                                quantity.format(
                                                                    ingredient.minimum_stock
                                                                )
                                                            }
                                                            {" "}
                                                            {
                                                                ingredient
                                                                    .base_unit
                                                                    ?.symbol
                                                                ??
                                                                ""
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                money.format(
                                                                    ingredient.average_cost
                                                                )
                                                            }
                                                        </td>

                                                        <td>
                                                            <strong>
                                                                {
                                                                    money.format(
                                                                        ingredient.stock_value
                                                                    )
                                                                }
                                                            </strong>
                                                        </td>

                                                        <td>
                                                            {
                                                                ingredient.storage_location
                                                                ??
                                                                "—"
                                                            }
                                                        </td>

                                                        <td>
                                                            <StockStatusBadge
                                                                ingredient={
                                                                    ingredient
                                                                }
                                                            />
                                                        </td>

                                                        <td>
                                                            <span
                                                                className={
                                                                    ingredient.is_active
                                                                        ? "ops-ingredients-status active"
                                                                        : "ops-ingredients-status inactive"
                                                                }
                                                            >
                                                                {
                                                                    ingredient.is_active
                                                                        ? "Active"
                                                                        : "Inactive"
                                                                }
                                                            </span>
                                                        </td>

                                                        {
                                                            canManage
                                                            &&
                                                            (
                                                                <td>
                                                                    <div className="ops-ingredients-actions">
                                                                        <button
                                                                            type="button"
                                                                            disabled={
                                                                                busy
                                                                            }
                                                                            onClick={
                                                                                () =>
                                                                                    setEditingIngredient(
                                                                                        ingredient
                                                                                    )
                                                                            }
                                                                        >
                                                                            Edit
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            className={
                                                                                ingredient.is_active
                                                                                    ? "danger"
                                                                                    : "success"
                                                                            }
                                                                            disabled={
                                                                                busy
                                                                            }
                                                                            onClick={
                                                                                () => {
                                                                                    void toggleStatus(
                                                                                        ingredient
                                                                                    );
                                                                                }
                                                                            }
                                                                        >
                                                                            {
                                                                                ingredient.is_active
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

                <div className="ops-ingredients-pagination">
                    <span>
                        {
                            pagination.total
                        }
                        {" "}
                        ingredients
                    </span>

                    <div>
                        <button
                            type="button"
                            disabled={
                                page <= 1
                            }
                            onClick={
                                () =>
                                    setPage(
                                        (
                                            current
                                        ) =>
                                            Math.max(
                                                1,
                                                current - 1
                                            )
                                    )
                            }
                        >
                            Previous
                        </button>

                        <strong>
                            Page
                            {" "}
                            {
                                pagination.current_page
                            }
                            {" "}
                            of
                            {" "}
                            {
                                pagination.last_page
                            }
                        </strong>

                        <button
                            type="button"
                            disabled={
                                page
                                >=
                                pagination.last_page
                            }
                            onClick={
                                () =>
                                    setPage(
                                        (
                                            current
                                        ) =>
                                            current + 1
                                    )
                            }
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>

            {
                editingIngredient
                !==
                undefined
                &&
                (
                    <IngredientFormModal
                        key={
                            editingIngredient
                                ?.id
                            ??
                            "new-ingredient"
                        }
                        ingredient={
                            editingIngredient
                        }
                        units={
                            units
                        }
                        busy={
                            busy
                        }
                        onClose={
                            () =>
                                setEditingIngredient(
                                    undefined
                                )
                        }
                        onSave={
                            saveIngredient
                        }
                    />
                )
            }
        </section>
    );
}

/*
|--------------------------------------------------------------------------
| Summary Card
|--------------------------------------------------------------------------
*/

function SummaryCard(
    {
        label,
        value,
        note,
        tone =
        "normal",
    }: {
        label:
        string;

        value:
        number;

        note:
        string;

        tone?:
        | "normal"
        | "success"
        | "warning"
        | "danger";
    }
) {
    return (
        <article
            className={
                `ops-ingredients-summary-card ${tone}`
            }
        >
            <span>
                {
                    label
                }
            </span>

            <strong>
                {
                    value
                }
            </strong>

            <small>
                {
                    note
                }
            </small>
        </article>
    );
}

/*
|--------------------------------------------------------------------------
| Stock Status
|--------------------------------------------------------------------------
*/

function StockStatusBadge(
    {
        ingredient,
    }: {
        ingredient:
        Ingredient;
    }
) {
    if (
        ingredient.is_out_of_stock
    ) {
        return (
            <span className="ops-ingredients-stock-status out">
                Out of Stock
            </span>
        );
    }

    if (
        ingredient.is_low_stock
    ) {
        return (
            <span className="ops-ingredients-stock-status low">
                Low Stock
            </span>
        );
    }

    return (
        <span className="ops-ingredients-stock-status good">
            In Stock
        </span>
    );
}