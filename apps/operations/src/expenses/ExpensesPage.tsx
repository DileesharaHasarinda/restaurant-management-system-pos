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

import ExpenseDetailsModal
    from "./ExpenseDetailsModal";

import ExpenseFormModal
    from "./ExpenseFormModal";

import {
    createExpense,
    downloadExpenseReceipt,
    getExpense,
    getExpenseCategories,
    getExpensePaymentMethods,
    getExpenses,
    removeExpenseReceipt,
    updateExpense,
    uploadExpenseReceipt,
} from "./expenseService";

import type {
    CreateExpensePayload,
    Expense,
    ExpenseCategory,
    ExpensePagination,
    ExpensePaymentMethod,
    ExpensePaymentMethodOption,
    ExpenseStatus,
    UpdateExpensePayload,
} from "./types";

import "./ExpensesPage.css";

/*
|--------------------------------------------------------------------------
| Filter State
|--------------------------------------------------------------------------
*/

interface FilterState {
    search:
    string;

    categoryId:
    string;

    paymentMethod:
    ""
    | ExpensePaymentMethod;

    status:
    ""
    | ExpenseStatus;

    dateFrom:
    string;

    dateTo:
    string;
}

const EMPTY_FILTERS:
    FilterState = {
    search:
        "",

    categoryId:
        "",

    paymentMethod:
        "",

    status:
        "",

    dateFrom:
        "",

    dateTo:
        "",
};

const EMPTY_PAGINATION:
    ExpensePagination = {
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

    return "The expense operation could not be completed.";
}

function toPaymentMethod(
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

        case "QR":
            return "QR";

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
    switch (
    value
    ) {
        case "":
            return "";

        case "POSTED":
            return "POSTED";

        case "VOID":
            return "VOID";

        default:
            return "";
    }
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function ExpensesPage() {
    const {
        user,
        hasPermission,
    } =
        useAuth();

    const canCreate =
        hasPermission(
            "expenses.create"
        );

    const canManage =
        hasPermission(
            "expenses.manage"
        );

    /*
     * Physical drawer CASH expenses are only
     * exposed to the local CASHIER role.
     */
    const allowCash =
        user?.role?.code
        ===
        "CASHIER";

    /*
    |--------------------------------------------------------------------------
    | Expenses
    |--------------------------------------------------------------------------
    */

    const [
        expenses,
        setExpenses,
    ] =
        useState<
            Expense[]
        >(
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Lookup Data
    |--------------------------------------------------------------------------
    */

    const [
        categories,
        setCategories,
    ] =
        useState<
            ExpenseCategory[]
        >(
            []
        );

    const [
        paymentMethods,
        setPaymentMethods,
    ] =
        useState<
            ExpensePaymentMethodOption[]
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
    | Form / Details State
    |--------------------------------------------------------------------------
    */

    const [
        formOpen,
        setFormOpen,
    ] =
        useState(
            false
        );

    const [
        editingExpense,
        setEditingExpense,
    ] =
        useState<
            Expense | undefined
        >(
            undefined
        );

    const [
        selectedExpense,
        setSelectedExpense,
    ] =
        useState<
            Expense | undefined
        >(
            undefined
        );

    /*
    |--------------------------------------------------------------------------
    | Loading / UI State
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
        busyExpenseId,
        setBusyExpenseId,
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
    | Load Expenses
    |--------------------------------------------------------------------------
    |
    | silent = true is used by realtime reconciliation.
    |
    | Realtime refresh must not:
    |
    | - show the full loading state
    | - activate the manual Refresh spinner
    | - reload the browser
    | - close an open form or details modal
    |--------------------------------------------------------------------------
    */

    const loadExpenses =
        useCallback(
            async (
                silent:
                    boolean = false
            ): Promise<void> => {
                try {
                    const result =
                        await getExpenses({
                            page,

                            categoryId:
                                filters.categoryId
                                    ? Number(
                                        filters.categoryId
                                    )
                                    : null,

                            paymentMethod:
                                filters.paymentMethod
                                || null,

                            status:
                                filters.status
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

                    setExpenses(
                        result.expenses
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
                            "Unable to reconcile realtime expense records.",
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
    | Load Expense Lookups
    |--------------------------------------------------------------------------
    |
    | Expense categories are mutable business data.
    |
    | Payment methods are also loaded from Laravel so this page never assumes
    | frontend configuration is authoritative.
    |--------------------------------------------------------------------------
    */

    const loadLookups =
        useCallback(
            async (): Promise<void> => {
                const [
                    categoryResult,
                    methodResult,
                ] =
                    await Promise.all([
                        getExpenseCategories(),
                        getExpensePaymentMethods(),
                    ]);

                setCategories(
                    categoryResult
                );

                setPaymentMethods(
                    methodResult
                );
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Initial / Filter Expense Loading
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timer =
                window.setTimeout(
                    () => {
                        void loadExpenses();
                    },
                    0
                );

            return () =>
                window.clearTimeout(
                    timer
                );
        },
        [
            loadExpenses,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Initial Lookup Loading
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const timer =
                window.setTimeout(
                    () => {
                        void loadLookups()
                            .catch(
                                () => {
                                    /*
                                     * Expense history remains usable if
                                     * category/payment-method lookups fail.
                                     */
                                }
                            );
                    },
                    0
                );

            return () =>
                window.clearTimeout(
                    timer
                );
        },
        [
            loadLookups,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Derived Summary
    |--------------------------------------------------------------------------
    */

    const pageTotal =
        useMemo(
            () =>
                expenses.reduce(
                    (
                        total,
                        expense
                    ) =>
                        total
                        +
                        expense.amount,
                    0
                ),
            [
                expenses,
            ]
        );

    const pageCash =
        useMemo(
            () =>
                expenses.reduce(
                    (
                        total,
                        expense
                    ) =>
                        expense.payment_method
                            ===
                            "CASH"
                            ? total
                            +
                            expense.amount
                            : total,
                    0
                ),
            [
                expenses,
            ]
        );

    const pageNonCash =
        pageTotal
        -
        pageCash;

    const categoriesOnPage =
        useMemo(
            () =>
                new Set(
                    expenses
                        .map(
                            (
                                expense
                            ) =>
                                expense.category
                                    ?.id
                        )
                        .filter(
                            (
                                id
                            ) =>
                                id
                                !==
                                undefined
                        )
                ).size,
            [
                expenses,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Open Create
    |--------------------------------------------------------------------------
    */

    const openCreate =
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
                await loadLookups();

                setEditingExpense(
                    undefined
                );

                setFormOpen(
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
                CreateExpensePayload
        ): Promise<void> => {
            const expense =
                await createExpense(
                    payload
                );

            setFormOpen(
                false
            );

            setEditingExpense(
                undefined
            );

            setMessage(
                `${expense.expense_number} recorded successfully.`
            );

            /*
             * A newly created expense should be easy to locate.
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
                await loadExpenses();
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Submit Update
    |--------------------------------------------------------------------------
    */

    const submitUpdate =
        async (
            expenseId:
                number,

            payload:
                UpdateExpensePayload
        ): Promise<void> => {
            const expense =
                await updateExpense(
                    expenseId,
                    payload
                );

            setFormOpen(
                false
            );

            setEditingExpense(
                undefined
            );

            setSelectedExpense(
                expense
            );

            setMessage(
                `${expense.expense_number} updated successfully.`
            );

            await loadExpenses();
        };

    /*
    |--------------------------------------------------------------------------
    | View Expense
    |--------------------------------------------------------------------------
    */

    const viewExpense =
        async (
            expense:
                Expense
        ): Promise<void> => {
            setBusyExpenseId(
                expense.id
            );

            setError(
                ""
            );

            try {
                const current =
                    await getExpense(
                        expense.id
                    );

                setSelectedExpense(
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
                setBusyExpenseId(
                    null
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Refresh Selected Expense
    |--------------------------------------------------------------------------
    |
    | If the details modal is currently open, reload its authoritative
    | expense record whenever a relevant realtime event is received.
    |
    | Functional state replacement protects against asynchronous races:
    |
    | - user closes the modal before GET completes
    | - user opens another expense before GET completes
    |
    | The older request cannot reopen or overwrite the newer modal.
    |--------------------------------------------------------------------------
    */

    const refreshSelectedExpense =
        useCallback(
            async (): Promise<void> => {
                if (
                    !selectedExpense
                ) {
                    return;
                }

                const expenseId =
                    selectedExpense.id;

                try {
                    const current =
                        await getExpense(
                            expenseId
                        );

                    setSelectedExpense(
                        (
                            existing
                        ) => {
                            if (
                                !existing
                                ||
                                existing.id
                                !==
                                expenseId
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
                        "Unable to reconcile realtime expense details.",
                        caught
                    );
                }
            },
            [
                selectedExpense,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Safe Edit
    |--------------------------------------------------------------------------
    |
    | Drawer-linked CASH expense:
    |
    | - must be local cashier
    | - cashier shift must still be open
    |--------------------------------------------------------------------------
    */

    const canEditExpense =
        (
            expense:
                Expense
        ): boolean => {
            if (
                !canManage
            ) {
                return false;
            }

            if (
                expense.payment_method
                !==
                "CASH"
            ) {
                return true;
            }

            if (
                expense.cashier_shift
                ===
                null
            ) {
                return true;
            }

            return (
                allowCash
                &&
                expense.cashier_shift.status
                ===
                "OPEN"
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Start Edit
    |--------------------------------------------------------------------------
    */

    const startEdit =
        (
            expense:
                Expense
        ): void => {
            setSelectedExpense(
                undefined
            );

            setEditingExpense(
                expense
            );

            setFormOpen(
                true
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Upload Receipt
    |--------------------------------------------------------------------------
    */

    const uploadReceipt =
        async (
            expense:
                Expense,

            file:
                File
        ): Promise<void> => {
            const updated =
                await uploadExpenseReceipt(
                    expense.id,
                    file
                );

            setSelectedExpense(
                updated
            );

            setMessage(
                "Expense receipt uploaded successfully."
            );

            await loadExpenses();
        };

    /*
    |--------------------------------------------------------------------------
    | Remove Receipt
    |--------------------------------------------------------------------------
    */

    const removeReceipt =
        async (
            expense:
                Expense
        ): Promise<void> => {
            const updated =
                await removeExpenseReceipt(
                    expense.id
                );

            setSelectedExpense(
                updated
            );

            setMessage(
                "Expense receipt removed successfully."
            );

            await loadExpenses();
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

            setPage(
                1
            );

            setLoading(
                true
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
                await Promise.all([
                    loadExpenses(),
                    loadLookups(),
                    refreshSelectedExpense(),
                ]);
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
    | This page depends on:
    |
    | expenses
    | --------
    | - expense create/update/void changes
    | - receipt metadata changes
    | - expense category changes
    |
    | cash
    | ----
    | - CASH expenses are linked to cashier shifts
    | - shift state determines whether a drawer-linked expense may be edited
    | - drawer movement changes can affect related financial state
    |
    | business_day
    | ------------
    | - operational expense reporting is tied to restaurant business-day
    |   activity
    |
    | Reverb is an invalidation signal only.
    |
    | Laravel REST remains authoritative.
    |
    | Realtime synchronization updates:
    |
    | - current filtered expense list
    | - pagination
    | - page summary totals
    | - expense categories/payment-method options
    | - an open ExpenseDetailsModal
    | - cashier-shift information returned with an expense
    |
    | IMPORTANT:
    |
    | An open ExpenseFormModal is deliberately NOT replaced or remounted.
    | This protects unsaved description, amount, payment-method, date and
    | other manager/cashier input.
    |
    | The backend must still perform final validation when the form is
    | submitted, especially if a CASH cashier shift changed remotely while
    | the form was open.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "expenses",
            "cash",
            "business_day",
        ],
        async () => {
            try {
                await Promise.all([
                    loadExpenses(
                        true
                    ),

                    loadLookups(),

                    refreshSelectedExpense(),
                ]);
            } catch (
            caught
            ) {
                /*
                 * Realtime failure must never interrupt an expense workflow.
                 *
                 * A later realtime event, reconnect or manual Refresh can
                 * reconcile authoritative state.
                 */
                console.error(
                    "Unable to reconcile realtime expense data.",
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
        <div className="expenses-page">
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

            <header className="expenses-page-header">
                <div>
                    <div className="expenses-eyebrow">
                        Financial Control
                    </div>

                    <h1>
                        Expenses
                    </h1>

                    <p>
                        Record restaurant operating expenses,
                        maintain private receipts and track cash
                        and non-cash spending.
                    </p>
                </div>

                <div className="expenses-header-actions">
                    <button
                        type="button"
                        className="expenses-button expenses-button-secondary"
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
                                className="expenses-button expenses-button-primary"
                                disabled={
                                    formLoading
                                }
                                onClick={
                                    () =>
                                        void openCreate()
                                }
                            >
                                {
                                    formLoading
                                        ? "Loading..."
                                        : "+ Record Expense"
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
                    <div className="expenses-alert expenses-alert-error">
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
                    <div className="expenses-alert expenses-alert-success">
                        {
                            message
                        }
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Local Cashier Information
            |--------------------------------------------------------------------------
            */}

            {
                allowCash
                && (
                    <div className="expenses-alert expenses-alert-info">
                        <strong>
                            Local cashier mode
                        </strong>

                        <br />

                        CASH expenses automatically use your
                        currently open cashier shift when available.
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Summary
            |--------------------------------------------------------------------------
            */}

            <section className="expenses-summary-grid">
                <article>
                    <span>
                        Total Expenses
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
                                pageTotal
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
                                pageCash
                            )
                        }
                    </strong>

                    <small>
                        Physical cash spending
                    </small>
                </article>

                <article>
                    <span>
                        Non-Cash on Page
                    </span>

                    <strong>
                        {
                            money.format(
                                pageNonCash
                            )
                        }
                    </strong>

                    <small>
                        {
                            categoriesOnPage
                        }
                        {" categories"}
                    </small>
                </article>
            </section>

            {/*
            |--------------------------------------------------------------------------
            | Main Panel
            |--------------------------------------------------------------------------
            */}

            <section className="expenses-panel">
                {/*
                |--------------------------------------------------------------------------
                | Filters
                |--------------------------------------------------------------------------
                */}

                <form
                    className="expenses-filters"
                    onSubmit={
                        submitFilters
                    }
                >
                    <label className="expenses-filter-field expenses-search-field">
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
                            placeholder="Expense, description, reference..."
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

                    <label className="expenses-filter-field">
                        <span>
                            Category
                        </span>

                        <select
                            value={
                                filterDraft.categoryId
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

                                            categoryId:
                                                event.target.value,
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All Categories
                            </option>

                            {
                                categories.map(
                                    (
                                        category
                                    ) => (
                                        <option
                                            key={
                                                category.id
                                            }
                                            value={
                                                category.id
                                            }
                                        >
                                            {
                                                category.name
                                            }
                                        </option>
                                    )
                                )
                            }
                        </select>
                    </label>

                    <label className="expenses-filter-field">
                        <span>
                            Payment
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
                                                toPaymentMethod(
                                                    event.target.value
                                                ),
                                        })
                                    )
                            }
                        >
                            <option value="">
                                All Methods
                            </option>

                            {
                                paymentMethods.map(
                                    (
                                        method
                                    ) => (
                                        <option
                                            key={
                                                method.code
                                            }
                                            value={
                                                method.code
                                            }
                                        >
                                            {
                                                method.label
                                            }
                                        </option>
                                    )
                                )
                            }
                        </select>
                    </label>

                    <label className="expenses-filter-field">
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

                            <option value="VOID">
                                Void
                            </option>
                        </select>
                    </label>

                    <label className="expenses-filter-field">
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

                    <label className="expenses-filter-field">
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

                    <div className="expenses-filter-actions">
                        <button
                            type="submit"
                            className="expenses-button expenses-button-primary"
                        >
                            Apply
                        </button>

                        <button
                            type="button"
                            className="expenses-button expenses-button-secondary"
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
                            <div className="expenses-loading">
                                Loading expenses...
                            </div>
                        )
                        : expenses.length
                            ===
                            0
                            ? (
                                <div className="expenses-empty">
                                    <strong>
                                        No expenses found
                                    </strong>

                                    <p>
                                        Record an expense or
                                        change the current filters.
                                    </p>
                                </div>
                            )
                            : (
                                <div className="expenses-table-wrap">
                                    <table className="expenses-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Expense
                                                </th>

                                                <th>
                                                    Date
                                                </th>

                                                <th>
                                                    Category
                                                </th>

                                                <th>
                                                    Description
                                                </th>

                                                <th>
                                                    Payment
                                                </th>

                                                <th>
                                                    Amount
                                                </th>

                                                <th>
                                                    Receipt
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
                                                expenses.map(
                                                    (
                                                        expense
                                                    ) => (
                                                        <tr
                                                            key={
                                                                expense.id
                                                            }
                                                        >
                                                            <td>
                                                                <strong>
                                                                    {
                                                                        expense.expense_number
                                                                    }
                                                                </strong>

                                                                <small className="expenses-cell-meta">
                                                                    {
                                                                        expense.status
                                                                    }
                                                                </small>
                                                            </td>

                                                            <td>
                                                                {
                                                                    expense.expense_date
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    expense
                                                                        .category
                                                                        ?.name
                                                                    ??
                                                                    "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    expense.description
                                                                }
                                                            </td>

                                                            <td>
                                                                <span className="expenses-payment-badge">
                                                                    {
                                                                        expense.payment_method_label
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        money.format(
                                                                            expense.amount
                                                                        )
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                {
                                                                    expense.receipt
                                                                        ? (
                                                                            <span className="expenses-receipt-yes">
                                                                                Attached
                                                                            </span>
                                                                        )
                                                                        : (
                                                                            <span className="expenses-receipt-no">
                                                                                —
                                                                            </span>
                                                                        )
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    expense
                                                                        .created_by
                                                                        ?.name
                                                                    ??
                                                                    "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className="expenses-small-button"
                                                                    disabled={
                                                                        busyExpenseId
                                                                        !==
                                                                        null
                                                                    }
                                                                    onClick={
                                                                        () =>
                                                                            void viewExpense(
                                                                                expense
                                                                            )
                                                                    }
                                                                >
                                                                    {
                                                                        busyExpenseId
                                                                            ===
                                                                            expense.id
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
                        <div className="expenses-pagination">
                            <span>
                                {
                                    pagination.total
                                }
                                {" expenses"}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    className="expenses-button expenses-button-secondary"
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
                                    className="expenses-button expenses-button-secondary"
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
            | Expense Form
            |--------------------------------------------------------------------------
            |
            | Realtime events intentionally do not replace editingExpense or
            | remount this modal. Unsaved form values are preserved.
            |--------------------------------------------------------------------------
            */}

            {
                formOpen
                && (
                    <ExpenseFormModal
                        expense={
                            editingExpense
                        }
                        categories={
                            categories
                        }
                        paymentMethods={
                            paymentMethods
                        }
                        allowCash={
                            allowCash
                        }
                        onClose={
                            () => {
                                setFormOpen(
                                    false
                                );

                                setEditingExpense(
                                    undefined
                                );
                            }
                        }
                        onCreate={
                            submitCreate
                        }
                        onUpdate={
                            submitUpdate
                        }
                    />
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Expense Details
            |--------------------------------------------------------------------------
            */}

            {
                selectedExpense
                && (
                    <ExpenseDetailsModal
                        expense={
                            selectedExpense
                        }
                        canEdit={
                            canEditExpense(
                                selectedExpense
                            )
                        }
                        canManageReceipt={
                            canManage
                        }
                        onClose={
                            () =>
                                setSelectedExpense(
                                    undefined
                                )
                        }
                        onEdit={
                            () =>
                                startEdit(
                                    selectedExpense
                                )
                        }
                        onDownloadReceipt={
                            () =>
                                downloadExpenseReceipt(
                                    selectedExpense
                                )
                        }
                        onUploadReceipt={
                            (
                                file
                            ) =>
                                uploadReceipt(
                                    selectedExpense,
                                    file
                                )
                        }
                        onRemoveReceipt={
                            () =>
                                removeReceipt(
                                    selectedExpense
                                )
                        }
                    />
                )
            }
        </div>
    );
}