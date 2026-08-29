import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
} from "react";

import {
    useStaffRealtimeRefresh,
} from '../realtime/realtimeBus';

import {
    Link,
} from "react-router-dom";

import {
    ApiError,
} from "../lib/api";

import {
    getCurrentStock,
    getIngredientStockHistory,
    getLowStock,
    getOutOfStock,
    getStockMovements,
    getStockValuation,
} from "./inventoryService";

import type {
    InventoryIngredient,
    InventoryPagination,
    StockMovement,
    StockMovementFilters,
    StockMovementType,
    StockStatus,
} from "./types";

import "./InventoryPage.css";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const EMPTY_PAGINATION:
    InventoryPagination = {
    current_page:
        1,

    per_page:
        30,

    total:
        0,

    last_page:
        1,
};

const MOVEMENT_TYPES:
    StockMovementType[] = [
        "OPENING_BALANCE",
        "PURCHASE",
        "SALE_CONSUMPTION",
        "WASTAGE",
        "ADJUSTMENT_IN",
        "ADJUSTMENT_OUT",
        "CANCELLATION_REVERSAL",
    ];

type StockFilter =
    | "ALL"
    | StockStatus;

type ActiveFilter =
    | "ALL"
    | "ACTIVE"
    | "INACTIVE";

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

function humanize(
    value: string
): string {
    return value
        .toLowerCase()
        .replaceAll(
            "_",
            " "
        )
        .replace(
            /\b\w/g,
            (
                character
            ) =>
                character
                    .toUpperCase()
        );
}

function formatDateTime(
    value:
        string
        |
        null
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

export default function InventoryPage() {
    /*
    |--------------------------------------------------------------------------
    | Stock
    |--------------------------------------------------------------------------
    */

    const [
        stock,
        setStock,
    ] =
        useState<
            InventoryIngredient[]
        >(
            []
        );

    const [
        lowStock,
        setLowStock,
    ] =
        useState<
            InventoryIngredient[]
        >(
            []
        );

    const [
        outOfStock,
        setOutOfStock,
    ] =
        useState<
            InventoryIngredient[]
        >(
            []
        );

    const [
        totalStockValue,
        setTotalStockValue,
    ] =
        useState(
            0
        );

    const [
        valuationIngredientCount,
        setValuationIngredientCount,
    ] =
        useState(
            0
        );

    /*
    |--------------------------------------------------------------------------
    | Movements
    |--------------------------------------------------------------------------
    */

    const [
        movements,
        setMovements,
    ] =
        useState<
            StockMovement[]
        >(
            []
        );

    const [
        movementPagination,
        setMovementPagination,
    ] =
        useState(
            EMPTY_PAGINATION
        );

    /*
    |--------------------------------------------------------------------------
    | Loading / Errors
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
        movementLoading,
        setMovementLoading,
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
        error,
        setError,
    ] =
        useState(
            ""
        );

    /*
    |--------------------------------------------------------------------------
    | Stock Filters
    |--------------------------------------------------------------------------
    */

    const [
        stockSearch,
        setStockSearch,
    ] =
        useState(
            ""
        );

    const [
        stockStatus,
        setStockStatus,
    ] =
        useState<StockFilter>(
            "ALL"
        );

    const [
        activeStatus,
        setActiveStatus,
    ] =
        useState<ActiveFilter>(
            "ALL"
        );

    /*
    |--------------------------------------------------------------------------
    | Movement Filters
    |--------------------------------------------------------------------------
    */

    const [
        movementPage,
        setMovementPage,
    ] =
        useState(
            1
        );

    const [
        movementSearchDraft,
        setMovementSearchDraft,
    ] =
        useState(
            ""
        );

    const [
        movementSearch,
        setMovementSearch,
    ] =
        useState(
            ""
        );

    const [
        movementType,
        setMovementType,
    ] =
        useState<
            StockMovementType
            |
            null
        >(
            null
        );

    const [
        movementIngredientId,
        setMovementIngredientId,
    ] =
        useState<
            number
            |
            null
        >(
            null
        );

    const [
        dateFrom,
        setDateFrom,
    ] =
        useState(
            ""
        );

    const [
        dateTo,
        setDateTo,
    ] =
        useState(
            ""
        );

    /*
    |--------------------------------------------------------------------------
    | Ingredient History
    |--------------------------------------------------------------------------
    */

    const [
        historyIngredient,
        setHistoryIngredient,
    ] =
        useState<
            InventoryIngredient
            |
            null
        >(
            null
        );

    const [
        historyMovements,
        setHistoryMovements,
    ] =
        useState<
            StockMovement[]
        >(
            []
        );

    const [
        historyPagination,
        setHistoryPagination,
    ] =
        useState(
            EMPTY_PAGINATION
        );

    const [
        historyPage,
        setHistoryPage,
    ] =
        useState(
            1
        );

    const [
        historyLoading,
        setHistoryLoading,
    ] =
        useState(
            false
        );

    /*
    |--------------------------------------------------------------------------
    | Realtime History References
    |--------------------------------------------------------------------------
    |
    | These refs let an in-flight realtime reconciliation verify that the
    | same ingredient/history page is still open before applying its result.
    |--------------------------------------------------------------------------
    */

    const historyIngredientIdRef =
        useRef<number | null>(
            null
        );

    const historyPageRef =
        useRef(
            1
        );

    useEffect(
        () => {
            historyIngredientIdRef.current =
                historyIngredient?.id
                ??
                null;
        },
        [
            historyIngredient?.id,
        ]
    );

    useEffect(
        () => {
            historyPageRef.current =
                historyPage;
        },
        [
            historyPage,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Error Handling
    |--------------------------------------------------------------------------
    */

    const showError =
        useCallback(
            (
                exception:
                    unknown
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
                    "Unable to load inventory information."
                );
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Load Stock
    |--------------------------------------------------------------------------
    */

    const loadStock =
        useCallback(
            async (): Promise<
                InventoryIngredient[]
            > => {
                const [
                    current,
                    low,
                    out,
                    valuation,
                ] =
                    await Promise.all([
                        getCurrentStock(),
                        getLowStock(),
                        getOutOfStock(),
                        getStockValuation(),
                    ]);

                setStock(
                    current
                );

                setLowStock(
                    low
                );

                setOutOfStock(
                    out
                );

                setTotalStockValue(
                    valuation
                        .total_stock_value
                );

                setValuationIngredientCount(
                    valuation
                        .ingredient_count
                );

                return current;
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Load Movements
    |--------------------------------------------------------------------------
    |
    | This function deliberately does not synchronously set loading state.
    | That keeps the React effect lint-safe.
    |--------------------------------------------------------------------------
    */

    const loadMovements =
        useCallback(
            async (): Promise<void> => {
                const filters:
                    StockMovementFilters = {
                    page:
                        movementPage,

                    ingredientId:
                        movementIngredientId,

                    movementType,

                    dateFrom:
                        dateFrom
                        ||
                        undefined,

                    dateTo:
                        dateTo
                        ||
                        undefined,

                    search:
                        movementSearch,

                    perPage:
                        30,
                };

                const result =
                    await getStockMovements(
                        filters
                    );

                setMovements(
                    result.movements
                );

                setMovementPagination(
                    result.pagination
                );
            },
            [
                movementPage,
                movementIngredientId,
                movementType,
                dateFrom,
                dateTo,
                movementSearch,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Initial Stock Load
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const loadInitialStock =
                async (): Promise<void> => {
                    try {
                        await loadStock();
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

            void loadInitialStock();
        },
        [
            loadStock,
            showError,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Movement Load
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const loadMovementData =
                async (): Promise<void> => {
                    try {
                        await loadMovements();
                    } catch (
                    exception
                    ) {
                        showError(
                            exception
                        );
                    } finally {
                        setMovementLoading(
                            false
                        );
                    }
                };

            void loadMovementData();
        },
        [
            loadMovements,
            showError,
        ]
    );

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

            setMovementLoading(
                true
            );

            setError(
                ""
            );

            try {
                await Promise.all([
                    loadStock(),
                    loadMovements(),
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

                setMovementLoading(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Derived Stock
    |--------------------------------------------------------------------------
    */

    const filteredStock =
        useMemo(
            () => {
                const normalizedSearch =
                    stockSearch
                        .trim()
                        .toLowerCase();

                return stock.filter(
                    (
                        ingredient
                    ) => {
                        const matchesSearch =
                            normalizedSearch
                            ===
                            ""
                            ||
                            ingredient
                                .name
                                .toLowerCase()
                                .includes(
                                    normalizedSearch
                                )
                            ||
                            (
                                ingredient.sku
                                ??
                                ""
                            )
                                .toLowerCase()
                                .includes(
                                    normalizedSearch
                                )
                            ||
                            (
                                ingredient
                                    .storage_location
                                ??
                                ""
                            )
                                .toLowerCase()
                                .includes(
                                    normalizedSearch
                                );

                        const matchesStock =
                            stockStatus
                            ===
                            "ALL"
                            ||
                            ingredient
                                .stock_status
                            ===
                            stockStatus;

                        const matchesActive =
                            activeStatus
                            ===
                            "ALL"
                            ||
                            (
                                activeStatus
                                ===
                                "ACTIVE"
                                &&
                                ingredient
                                    .is_active
                            )
                            ||
                            (
                                activeStatus
                                ===
                                "INACTIVE"
                                &&
                                !ingredient
                                    .is_active
                            );

                        return (
                            matchesSearch
                            &&
                            matchesStock
                            &&
                            matchesActive
                        );
                    }
                );
            },
            [
                stock,
                stockSearch,
                stockStatus,
                activeStatus,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Stock Filter Changes
    |--------------------------------------------------------------------------
    */

    const changeStockStatus =
        (
            value:
                string
        ): void => {
            setStockStatus(
                value as StockFilter
            );
        };

    const changeActiveStatus =
        (
            value:
                string
        ): void => {
            setActiveStatus(
                value as ActiveFilter
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Movement Search
    |--------------------------------------------------------------------------
    */

    const submitMovementSearch =
        (
            event:
                FormEvent<HTMLFormElement>
        ): void => {
            event.preventDefault();

            setMovementLoading(
                true
            );

            setMovementPage(
                1
            );

            setMovementSearch(
                movementSearchDraft
                    .trim()
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Movement Filter Changes
    |--------------------------------------------------------------------------
    */

    const changeMovementIngredient =
        (
            value:
                string
        ): void => {
            setMovementLoading(
                true
            );

            setMovementPage(
                1
            );

            setMovementIngredientId(
                value === ""
                    ? null
                    : Number(
                        value
                    )
            );
        };

    const changeMovementType =
        (
            value:
                string
        ): void => {
            setMovementLoading(
                true
            );

            setMovementPage(
                1
            );

            if (
                value === ""
            ) {
                setMovementType(
                    null
                );

                return;
            }

            setMovementType(
                value as StockMovementType
            );
        };

    const changeDateFrom =
        (
            value:
                string
        ): void => {
            setMovementLoading(
                true
            );

            setMovementPage(
                1
            );

            setDateFrom(
                value
            );
        };

    const changeDateTo =
        (
            value:
                string
        ): void => {
            setMovementLoading(
                true
            );

            setMovementPage(
                1
            );

            setDateTo(
                value
            );
        };

    const changeMovementPage =
        (
            targetPage:
                number
        ): void => {
            setMovementLoading(
                true
            );

            setMovementPage(
                targetPage
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Open Ingredient History
    |--------------------------------------------------------------------------
    */

    const openHistory =
        async (
            ingredient:
                InventoryIngredient
        ): Promise<void> => {
            setHistoryIngredient(
                ingredient
            );

            setHistoryPage(
                1
            );

            setHistoryLoading(
                true
            );

            setHistoryMovements(
                []
            );

            setError(
                ""
            );

            try {
                const result =
                    await getIngredientStockHistory(
                        ingredient.id,
                        1
                    );

                setHistoryMovements(
                    result.movements
                );

                setHistoryPagination(
                    result.pagination
                );
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setHistoryLoading(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Ingredient History Pagination
    |--------------------------------------------------------------------------
    */

    const loadHistoryPage =
        async (
            page:
                number
        ): Promise<void> => {
            if (
                !historyIngredient
            ) {
                return;
            }

            setHistoryLoading(
                true
            );

            setError(
                ""
            );

            try {
                const result =
                    await getIngredientStockHistory(
                        historyIngredient.id,
                        page
                    );

                setHistoryPage(
                    page
                );

                setHistoryMovements(
                    result.movements
                );

                setHistoryPagination(
                    result.pagination
                );
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setHistoryLoading(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Close History
    |--------------------------------------------------------------------------
    */

    const closeHistory =
        (): void => {
            setHistoryIngredient(
                null
            );

            setHistoryMovements(
                []
            );

            setHistoryPagination(
                EMPTY_PAGINATION
            );

            setHistoryPage(
                1
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | Reverb is an invalidation signal only. Laravel REST remains the
    | authoritative source for current stock, valuation and ledger data.
    |
    | Inventory events can be emitted by:
    |
    | - purchases being completed
    | - kitchen sale consumption
    | - wastage
    | - stock adjustments
    | - cancellation reversals
    | - ingredient/unit changes
    |
    | The shared realtime hook debounces bursts before this callback runs.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "inventory",
            "purchases",
            "wastage",
        ],
        async () => {
            try {
                const [
                    freshStock,
                ] =
                    await Promise.all([
                        loadStock(),
                        loadMovements(),
                    ]);

                const historyIngredientId =
                    historyIngredientIdRef.current;

                const currentHistoryPage =
                    historyPageRef.current;

                if (
                    historyIngredientId
                    ===
                    null
                ) {
                    return;
                }

                /*
                 * Keep the open history modal's ingredient summary current.
                 */
                const freshIngredient =
                    freshStock.find(
                        (
                            ingredient
                        ) =>
                            ingredient.id
                            ===
                            historyIngredientId
                    );

                if (
                    freshIngredient
                    &&
                    historyIngredientIdRef.current
                    ===
                    historyIngredientId
                ) {
                    setHistoryIngredient(
                        (
                            current
                        ) => {
                            if (
                                !current
                                ||
                                current.id
                                !==
                                historyIngredientId
                            ) {
                                return current;
                            }

                            return freshIngredient;
                        }
                    );
                }

                /*
                 * Reconcile the same page currently shown in the history
                 * modal. Do not show a loading overlay for background sync.
                 */
                const historyResult =
                    await getIngredientStockHistory(
                        historyIngredientId,
                        currentHistoryPage
                    );

                /*
                 * Race protection:
                 *
                 * If the user closed the modal, opened another ingredient,
                 * or changed history page while the request was in flight,
                 * ignore this stale response.
                 */
                if (
                    historyIngredientIdRef.current
                    !==
                    historyIngredientId
                    ||
                    historyPageRef.current
                    !==
                    currentHistoryPage
                ) {
                    return;
                }

                setHistoryMovements(
                    historyResult.movements
                );

                setHistoryPagination(
                    historyResult.pagination
                );
            } catch (
            exception
            ) {
                /*
                 * A realtime synchronization failure must never replace
                 * usable inventory data with a fatal page error.
                 *
                 * A later event, reconnect or manual refresh can retry.
                 */
                console.error(
                    "Unable to reconcile realtime inventory data.",
                    exception
                );
            }
        }
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
            <section className="ops-inventory-page">
                <div className="ops-inventory-loading">
                    <span />

                    <strong>
                        Loading Inventory
                    </strong>

                    <p>
                        Retrieving current stock and valuation.
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
        <section className="ops-inventory-page">
            {/* Header */}

            <header className="ops-inventory-header">
                <div>
                    <span>
                        INVENTORY CONTROL
                    </span>

                    <h2>
                        Inventory / Stock
                    </h2>

                    <p>
                        Monitor ingredient stock levels, valuation and the immutable inventory movement ledger.
                    </p>
                </div>

                <div className="ops-inventory-header-actions">
                    <Link
                        to="/ingredients"
                        className="ops-inventory-secondary-link"
                    >
                        Ingredients
                    </Link>

                    <Link
                        to="/stock-adjustments"
                        className="ops-inventory-secondary-link"
                    >
                        Adjustments
                    </Link>

                    <button
                        type="button"
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
                </div>
            </header>

            {/* Error */}

            {
                error
                &&
                (
                    <div
                        className="ops-inventory-alert"
                        role="alert"
                    >
                        {
                            error
                        }
                    </div>
                )
            }

            {/* Summary */}

            <div className="ops-inventory-summary">
                <SummaryCard
                    label="Total Stock Value"
                    value={
                        money.format(
                            totalStockValue
                        )
                    }
                    note="Active tracked ingredients"
                    tone="value"
                />

                <SummaryCard
                    label="Tracked Ingredients"
                    value={
                        String(
                            valuationIngredientCount
                        )
                    }
                    note="Active stock-controlled items"
                />

                <SummaryCard
                    label="Low Stock"
                    value={
                        String(
                            lowStock.length
                        )
                    }
                    note="At or below reorder level"
                    tone={
                        lowStock.length
                            >
                            0
                            ? "warning"
                            : "normal"
                    }
                />

                <SummaryCard
                    label="Out of Stock"
                    value={
                        String(
                            outOfStock.length
                        )
                    }
                    note="Immediate attention"
                    tone={
                        outOfStock.length
                            >
                            0
                            ? "danger"
                            : "normal"
                    }
                />
            </div>

            {/* Current Stock */}

            <section className="ops-inventory-panel">
                <header className="ops-inventory-panel-header">
                    <div>
                        <span>
                            CURRENT POSITION
                        </span>

                        <h3>
                            Current Stock
                        </h3>

                        <p>
                            Current quantities are stored in each ingredient&apos;s base unit.
                        </p>
                    </div>

                    <strong>
                        {
                            filteredStock.length
                        }
                        {" "}
                        records
                    </strong>
                </header>

                <div className="ops-inventory-stock-filters">
                    <input
                        type="search"
                        placeholder="Search ingredient, SKU or storage location..."
                        value={
                            stockSearch
                        }
                        onChange={
                            (
                                event
                            ) =>
                                setStockSearch(
                                    event
                                        .target
                                        .value
                                )
                        }
                    />

                    <select
                        value={
                            stockStatus
                        }
                        onChange={
                            (
                                event
                            ) =>
                                changeStockStatus(
                                    event
                                        .target
                                        .value
                                )
                        }
                    >
                        <option value="ALL">
                            All Stock Status
                        </option>

                        <option value="IN_STOCK">
                            In Stock
                        </option>

                        <option value="LOW_STOCK">
                            Low Stock
                        </option>

                        <option value="OUT_OF_STOCK">
                            Out of Stock
                        </option>
                    </select>

                    <select
                        value={
                            activeStatus
                        }
                        onChange={
                            (
                                event
                            ) =>
                                changeActiveStatus(
                                    event
                                        .target
                                        .value
                                )
                        }
                    >
                        <option value="ALL">
                            Active & Inactive
                        </option>

                        <option value="ACTIVE">
                            Active Only
                        </option>

                        <option value="INACTIVE">
                            Inactive Only
                        </option>
                    </select>
                </div>

                {
                    filteredStock.length
                        ===
                        0
                        ? (
                            <EmptyState
                                title="No stock records found"
                                text="Try changing the current search or status filters."
                            />
                        )
                        : (
                            <div className="ops-inventory-table-wrap">
                                <table className="ops-inventory-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                Ingredient
                                            </th>

                                            <th>
                                                Current Stock
                                            </th>

                                            <th>
                                                Reorder Level
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
                                                Status
                                            </th>

                                            <th>
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {
                                            filteredStock.map(
                                                (
                                                    ingredient
                                                ) => (
                                                    <tr
                                                        key={
                                                            ingredient.id
                                                        }
                                                    >
                                                        <td>
                                                            <div className="ops-inventory-ingredient">
                                                                <strong>
                                                                    {
                                                                        ingredient.name
                                                                    }
                                                                </strong>

                                                                <span>
                                                                    {
                                                                        ingredient.sku
                                                                        ??
                                                                        "No SKU"
                                                                    }
                                                                </span>

                                                                {
                                                                    !ingredient.is_active
                                                                    &&
                                                                    (
                                                                        <small>
                                                                            Inactive
                                                                        </small>
                                                                    )
                                                                }
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <strong className="ops-inventory-stock-quantity">
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

                                                            <span className="ops-inventory-unit-cost-label">
                                                                /
                                                                {
                                                                    ingredient
                                                                        .base_unit
                                                                        ?.symbol
                                                                    ??
                                                                    "unit"
                                                                }
                                                            </span>
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
                                                            <StockBadge
                                                                status={
                                                                    ingredient.stock_status
                                                                }
                                                            />
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="ops-inventory-history-button"
                                                                onClick={
                                                                    () => {
                                                                        void openHistory(
                                                                            ingredient
                                                                        );
                                                                    }
                                                                }
                                                            >
                                                                History
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
            </section>

            {/* Stock Movements */}

            <section className="ops-inventory-panel">
                <header className="ops-inventory-panel-header">
                    <div>
                        <span>
                            IMMUTABLE LEDGER
                        </span>

                        <h3>
                            Stock Movements
                        </h3>

                        <p>
                            Every inventory increase and decrease is preserved as an immutable ledger entry.
                        </p>
                    </div>

                    <strong>
                        {
                            movementPagination.total
                        }
                        {" "}
                        movements
                    </strong>
                </header>

                <form
                    className="ops-inventory-movement-filters"
                    onSubmit={
                        submitMovementSearch
                    }
                >
                    <input
                        type="search"
                        placeholder="Reference, notes, ingredient or SKU..."
                        value={
                            movementSearchDraft
                        }
                        onChange={
                            (
                                event
                            ) =>
                                setMovementSearchDraft(
                                    event
                                        .target
                                        .value
                                )
                        }
                    />

                    <select
                        value={
                            movementIngredientId
                            ??
                            ""
                        }
                        onChange={
                            (
                                event
                            ) =>
                                changeMovementIngredient(
                                    event
                                        .target
                                        .value
                                )
                        }
                    >
                        <option value="">
                            All Ingredients
                        </option>

                        {
                            stock.map(
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
                                            ingredient.name
                                        }
                                    </option>
                                )
                            )
                        }
                    </select>

                    <select
                        value={
                            movementType
                            ??
                            ""
                        }
                        onChange={
                            (
                                event
                            ) =>
                                changeMovementType(
                                    event
                                        .target
                                        .value
                                )
                        }
                    >
                        <option value="">
                            All Movement Types
                        </option>

                        {
                            MOVEMENT_TYPES.map(
                                (
                                    type
                                ) => (
                                    <option
                                        key={
                                            type
                                        }
                                        value={
                                            type
                                        }
                                    >
                                        {
                                            humanize(
                                                type
                                            )
                                        }
                                    </option>
                                )
                            )
                        }
                    </select>

                    <label>
                        <span>
                            From
                        </span>

                        <input
                            type="date"
                            value={
                                dateFrom
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    changeDateFrom(
                                        event
                                            .target
                                            .value
                                    )
                            }
                        />
                    </label>

                    <label>
                        <span>
                            To
                        </span>

                        <input
                            type="date"
                            value={
                                dateTo
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    changeDateTo(
                                        event
                                            .target
                                            .value
                                    )
                            }
                        />
                    </label>

                    <button
                        type="submit"
                    >
                        Search
                    </button>
                </form>

                {
                    movementLoading
                        ? (
                            <div className="ops-inventory-movement-loading">
                                Loading stock movements...
                            </div>
                        )
                        : movements.length
                            ===
                            0
                            ? (
                                <EmptyState
                                    title="No stock movements found"
                                    text="No ledger entries match the selected filters."
                                />
                            )
                            : (
                                <MovementTable
                                    movements={
                                        movements
                                    }
                                />
                            )
                }

                <Pagination
                    pagination={
                        movementPagination
                    }
                    page={
                        movementPage
                    }
                    onPage={
                        changeMovementPage
                    }
                />
            </section>

            {/* Ingredient History Modal */}

            {
                historyIngredient
                &&
                (
                    <div className="ops-inventory-modal-backdrop">
                        <section className="ops-inventory-history-modal">
                            <header>
                                <div>
                                    <span>
                                        INGREDIENT HISTORY
                                    </span>

                                    <h3>
                                        {
                                            historyIngredient.name
                                        }
                                    </h3>

                                    <p>
                                        {
                                            historyIngredient.sku
                                            ??
                                            "No SKU"
                                        }

                                        {" · Current "}

                                        {
                                            quantity.format(
                                                historyIngredient.current_stock
                                            )
                                        }

                                        {" "}

                                        {
                                            historyIngredient
                                                .base_unit
                                                ?.symbol
                                            ??
                                            ""
                                        }
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        closeHistory
                                    }
                                >
                                    ×
                                </button>
                            </header>

                            <div className="ops-inventory-history-content">
                                {
                                    historyLoading
                                        ? (
                                            <div className="ops-inventory-movement-loading">
                                                Loading history...
                                            </div>
                                        )
                                        : historyMovements.length
                                            ===
                                            0
                                            ? (
                                                <EmptyState
                                                    title="No history available"
                                                    text="No stock movements have been recorded for this ingredient."
                                                />
                                            )
                                            : (
                                                <MovementTable
                                                    movements={
                                                        historyMovements
                                                    }
                                                />
                                            )
                                }
                            </div>

                            <footer>
                                <Pagination
                                    pagination={
                                        historyPagination
                                    }
                                    page={
                                        historyPage
                                    }
                                    onPage={
                                        (
                                            target
                                        ) => {
                                            void loadHistoryPage(
                                                target
                                            );
                                        }
                                    }
                                />

                                <button
                                    type="button"
                                    className="ops-inventory-modal-close"
                                    onClick={
                                        closeHistory
                                    }
                                >
                                    Close
                                </button>
                            </footer>
                        </section>
                    </div>
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
        string;

        note:
        string;

        tone?:
        | "normal"
        | "value"
        | "warning"
        | "danger";
    }
) {
    return (
        <article
            className={
                `ops-inventory-summary-card ${tone}`
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
| Stock Badge
|--------------------------------------------------------------------------
*/

function StockBadge(
    {
        status,
    }: {
        status:
        StockStatus;
    }
) {
    const label =
        status
            ===
            "OUT_OF_STOCK"
            ? "Out of Stock"
            : status
                ===
                "LOW_STOCK"
                ? "Low Stock"
                : "In Stock";

    return (
        <span
            className={
                `ops-inventory-stock-badge ${status.toLowerCase()}`
            }
        >
            {
                label
            }
        </span>
    );
}

/*
|--------------------------------------------------------------------------
| Movement Table
|--------------------------------------------------------------------------
*/

function MovementTable(
    {
        movements,
    }: {
        movements:
        StockMovement[];
    }
) {
    return (
        <div className="ops-inventory-table-wrap">
            <table className="ops-inventory-table ops-inventory-movement-table">
                <thead>
                    <tr>
                        <th>
                            Date / Time
                        </th>

                        <th>
                            Ingredient
                        </th>

                        <th>
                            Movement
                        </th>

                        <th>
                            Quantity
                        </th>

                        <th>
                            Balance After
                        </th>

                        <th>
                            Unit Cost
                        </th>

                        <th>
                            Total Cost
                        </th>

                        <th>
                            Reference
                        </th>

                        <th>
                            User
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {
                        movements.map(
                            (
                                movement
                            ) => {
                                const positive =
                                    movement.quantity_delta
                                    >
                                    0;

                                const negative =
                                    movement.quantity_delta
                                    <
                                    0;

                                return (
                                    <tr
                                        key={
                                            movement.id
                                        }
                                    >
                                        <td>
                                            {
                                                formatDateTime(
                                                    movement.occurred_at
                                                )
                                            }
                                        </td>

                                        <td>
                                            <div className="ops-inventory-ingredient">
                                                <strong>
                                                    {
                                                        movement
                                                            .ingredient
                                                            ?.name
                                                        ??
                                                        "Unknown Ingredient"
                                                    }
                                                </strong>

                                                <span>
                                                    {
                                                        movement
                                                            .ingredient
                                                            ?.sku
                                                        ??
                                                        "No SKU"
                                                    }
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <MovementBadge
                                                type={
                                                    movement.movement_type
                                                }
                                            />
                                        </td>

                                        <td>
                                            <strong
                                                className={
                                                    positive
                                                        ? "ops-inventory-positive"
                                                        : negative
                                                            ? "ops-inventory-negative"
                                                            : ""
                                                }
                                            >
                                                {
                                                    positive
                                                        ? "+"
                                                        : ""
                                                }

                                                {
                                                    quantity.format(
                                                        movement.quantity_delta
                                                    )
                                                }

                                                {" "}

                                                {
                                                    movement
                                                        .ingredient
                                                        ?.base_unit
                                                        ?.symbol
                                                    ??
                                                    ""
                                                }
                                            </strong>
                                        </td>

                                        <td>
                                            {
                                                quantity.format(
                                                    movement.balance_after
                                                )
                                            }

                                            {" "}

                                            {
                                                movement
                                                    .ingredient
                                                    ?.base_unit
                                                    ?.symbol
                                                ??
                                                ""
                                            }
                                        </td>

                                        <td>
                                            {
                                                money.format(
                                                    movement.unit_cost
                                                )
                                            }
                                        </td>

                                        <td>
                                            {
                                                money.format(
                                                    Math.abs(
                                                        movement.total_cost
                                                    )
                                                )
                                            }
                                        </td>

                                        <td>
                                            <div className="ops-inventory-reference">
                                                <strong>
                                                    {
                                                        movement.reference
                                                        ??
                                                        "—"
                                                    }
                                                </strong>

                                                {
                                                    movement.notes
                                                    &&
                                                    (
                                                        <span>
                                                            {
                                                                movement.notes
                                                            }
                                                        </span>
                                                    )
                                                }
                                            </div>
                                        </td>

                                        <td>
                                            {
                                                movement
                                                    .created_by
                                                    ?.name
                                                ??
                                                "System"
                                            }
                                        </td>
                                    </tr>
                                );
                            }
                        )
                    }
                </tbody>
            </table>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Movement Badge
|--------------------------------------------------------------------------
*/

function MovementBadge(
    {
        type,
    }: {
        type:
        StockMovementType;
    }
) {
    return (
        <span
            className={
                `ops-inventory-movement-badge ${type.toLowerCase()}`
            }
        >
            {
                humanize(
                    type
                )
            }
        </span>
    );
}

/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

function Pagination(
    {
        pagination,
        page,
        onPage,
    }: {
        pagination:
        InventoryPagination;

        page:
        number;

        onPage:
        (
            page:
                number
        ) => void;
    }
) {
    if (
        pagination.last_page
        <=
        1
    ) {
        return null;
    }

    return (
        <div className="ops-inventory-pagination">
            <span>
                {
                    pagination.total
                }
                {" "}
                records
            </span>

            <div>
                <button
                    type="button"
                    disabled={
                        page
                        <=
                        1
                    }
                    onClick={
                        () =>
                            onPage(
                                Math.max(
                                    1,
                                    page - 1
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
                            onPage(
                                page + 1
                            )
                    }
                >
                    Next
                </button>
            </div>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Empty State
|--------------------------------------------------------------------------
*/

function EmptyState(
    {
        title,
        text,
    }: {
        title:
        string;

        text:
        string;
    }
) {
    return (
        <div className="ops-inventory-empty">
            <strong>
                {
                    title
                }
            </strong>

            <span>
                {
                    text
                }
            </span>
        </div>
    );
}