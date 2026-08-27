import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ApiError,
    api,
} from "../../api";

import type {
    CashDrawerMovement,
    CashierShift,
    CashierShiftSummary,
    CashMovementResponse,
    CurrentShiftResponse,
    ShiftMovementsResponse,
    ShiftOperationResponse,
} from "./types";

/*
|--------------------------------------------------------------------------
| Props
|--------------------------------------------------------------------------
*/

interface CashierShiftModuleProps {
    onSessionExpired?: () => void;
}

/*
|--------------------------------------------------------------------------
| Local Helpers
|--------------------------------------------------------------------------
*/

const makeUuid = (): string => {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (character) => {
            const random =
                (Math.random() * 16) | 0;

            const value =
                character === "x"
                    ? random
                    : (random & 0x3) | 0x8;

            return value.toString(16);
        }
    );
};

const money = (
    value: number | string | null | undefined
): string => {
    const amount =
        Number(value ?? 0);

    if (
        !Number.isFinite(amount)
    ) {
        return "Rs. 0.00";
    }

    return `Rs. ${amount.toLocaleString(
        "en-LK",
        {
            minimumFractionDigits: 2,

            maximumFractionDigits: 2,
        }
    )}`;
};

const dateTime = (
    value: string | null | undefined
): string => {
    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleString(
        "en-LK",
        {
            dateStyle: "medium",

            timeStyle: "short",
        }
    );
};

const movementLabel = (
    type: string
): string => {
    switch (type) {
        case "OPENING_FLOAT":
            return "Opening Cash";

        case "CASH_SALE":
            return "Cash Sale";

        case "CASH_REFUND":
            return "Cash Refund";

        case "CASH_IN":
            return "Cash In";

        case "CASH_OUT":
            return "Cash Out";

        case "MANUAL_OPEN":
            return "Manual Drawer Open";

        default:
            return type.replace(
                /_/g,
                " "
            );
    }
};

const movementDirection = (
    movement: CashDrawerMovement
): "positive" | "negative" | "neutral" => {
    switch (
    movement.movement_type
    ) {
        case "OPENING_FLOAT":
        case "CASH_SALE":
        case "CASH_IN":
            return "positive";

        case "CASH_REFUND":
        case "CASH_OUT":
            return "negative";

        default:
            return "neutral";
    }
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function CashierShiftModule(
    {
        onSessionExpired,
    }: CashierShiftModuleProps
) {
    const [
        shift,
        setShift,
    ] =
        useState<CashierShift | null>(
            null
        );

    const [
        summary,
        setSummary,
    ] =
        useState<CashierShiftSummary | null>(
            null
        );

    const [
        movements,
        setMovements,
    ] =
        useState<CashDrawerMovement[]>(
            []
        );

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        busy,
        setBusy,
    ] =
        useState(false);

    const [
        message,
        setMessage,
    ] =
        useState("");

    const [
        error,
        setError,
    ] =
        useState("");

    /*
    |--------------------------------------------------------------------------
    | Open Shift Form
    |--------------------------------------------------------------------------
    */

    const [
        openingCash,
        setOpeningCash,
    ] =
        useState("");

    const [
        openingNotes,
        setOpeningNotes,
    ] =
        useState("");

    /*
    |--------------------------------------------------------------------------
    | Cash Movement Form
    |--------------------------------------------------------------------------
    */

    const [
        movementMode,
        setMovementMode,
    ] =
        useState<
            "CASH_IN"
            |
            "CASH_OUT"
            |
            null
        >(null);

    const [
        movementAmount,
        setMovementAmount,
    ] =
        useState("");

    const [
        movementReason,
        setMovementReason,
    ] =
        useState("");

    /*
    |--------------------------------------------------------------------------
    | Close Shift Form
    |--------------------------------------------------------------------------
    */

    const [
        showClose,
        setShowClose,
    ] =
        useState(false);

    const [
        actualCash,
        setActualCash,
    ] =
        useState("");

    const [
        closingNotes,
        setClosingNotes,
    ] =
        useState("");

    /*
    |--------------------------------------------------------------------------
    | Error Handler
    |--------------------------------------------------------------------------
    */

    const handleError =
        useCallback(
            (
                exception: unknown
            ): void => {
                if (
                    exception instanceof ApiError &&
                    exception.status === 401
                ) {
                    onSessionExpired?.();

                    return;
                }

                setError(
                    exception instanceof Error
                        ? exception.message
                        : "Cashier shift operation failed."
                );
            },
            [
                onSessionExpired,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Load Movement History
    |--------------------------------------------------------------------------
    */

    const loadMovements =
        useCallback(
            async (
                shiftId: number
            ): Promise<void> => {
                const response =
                    await api.get<ShiftMovementsResponse>(
                        `/cashier-shifts/${shiftId}/movements`
                    );

                setMovements(
                    response.data.movements ?? []
                );
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Load Current Shift
    |--------------------------------------------------------------------------
    */

    const loadCurrentShift =
        useCallback(
            async (): Promise<void> => {
                setLoading(
                    true
                );

                setError(
                    ""
                );

                try {
                    const response =
                        await api.get<CurrentShiftResponse>(
                            "/cashier-shifts/current"
                        );

                    const currentShift =
                        response.data.shift;

                    setShift(
                        currentShift
                    );

                    setSummary(
                        response.data.summary ?? null
                    );

                    if (
                        currentShift
                    ) {
                        await loadMovements(
                            currentShift.id
                        );
                    } else {
                        setMovements(
                            []
                        );
                    }
                } catch (
                exception
                ) {
                    handleError(
                        exception
                    );
                } finally {
                    setLoading(
                        false
                    );
                }
            },
            [
                handleError,
                loadMovements,
            ]
        );

    useEffect(
        () => {
            void loadCurrentShift();
        },
        [
            loadCurrentShift,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Run Action
    |--------------------------------------------------------------------------
    */

    const runAction =
        async (
            action:
                () => Promise<void>
        ): Promise<void> => {
            if (
                busy
            ) {
                return;
            }

            setBusy(
                true
            );

            setMessage(
                ""
            );

            setError(
                ""
            );

            try {
                await action();
            } catch (
            exception
            ) {
                handleError(
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
    | Open Shift
    |--------------------------------------------------------------------------
    */

    const openShift =
        async (): Promise<void> => {
            const amount =
                Number(
                    openingCash
                );

            if (
                !Number.isFinite(
                    amount
                )
                ||
                amount < 0
            ) {
                setError(
                    "Enter a valid opening cash amount."
                );

                return;
            }

            await runAction(
                async () => {
                    const response =
                        await api.post<ShiftOperationResponse>(
                            "/cashier-shifts/open",
                            {
                                client_request_id:
                                    makeUuid(),

                                opening_cash:
                                    amount,

                                opening_notes:
                                    openingNotes.trim()
                                    ||
                                    null,
                            }
                        );

                    setShift(
                        response.data.shift
                    );

                    setSummary(
                        response.data.summary
                    );

                    setOpeningCash(
                        ""
                    );

                    setOpeningNotes(
                        ""
                    );

                    setMessage(
                        response.data.created === false
                            ? "Existing cashier shift loaded."
                            : "Cashier shift opened successfully."
                    );

                    await loadMovements(
                        response.data.shift.id
                    );
                }
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Cash In / Cash Out
    |--------------------------------------------------------------------------
    */

    const saveMovement =
        async (): Promise<void> => {
            if (
                !shift
                ||
                !movementMode
            ) {
                return;
            }

            const amount =
                Number(
                    movementAmount
                );

            if (
                !Number.isFinite(
                    amount
                )
                ||
                amount <= 0
            ) {
                setError(
                    "Enter a valid amount greater than zero."
                );

                return;
            }

            if (
                !movementReason.trim()
            ) {
                setError(
                    "Enter a reason for this cash movement."
                );

                return;
            }

            await runAction(
                async () => {
                    const endpoint =
                        movementMode === "CASH_IN"
                            ? "cash-in"
                            : "cash-out";

                    const response =
                        await api.post<CashMovementResponse>(
                            `/cashier-shifts/${shift.id}/${endpoint}`,
                            {
                                client_request_id:
                                    makeUuid(),

                                amount:
                                    amount,

                                reason:
                                    movementReason.trim(),
                            }
                        );

                    setShift(
                        response.data.shift
                    );

                    setSummary(
                        response.data.summary
                    );

                    setMovementAmount(
                        ""
                    );

                    setMovementReason(
                        ""
                    );

                    setMovementMode(
                        null
                    );

                    setMessage(
                        movementMode === "CASH_IN"
                            ? "Cash added to the drawer successfully."
                            : "Cash removed from the drawer successfully."
                    );

                    await loadMovements(
                        shift.id
                    );
                }
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Close Shift
    |--------------------------------------------------------------------------
    */

    const closeShift =
        async (): Promise<void> => {
            if (
                !shift
            ) {
                return;
            }

            const amount =
                Number(
                    actualCash
                );

            if (
                !Number.isFinite(
                    amount
                )
                ||
                amount < 0
            ) {
                setError(
                    "Enter the actual counted drawer cash."
                );

                return;
            }

            await runAction(
                async () => {
                    const response =
                        await api.post<ShiftOperationResponse>(
                            `/cashier-shifts/${shift.id}/close`,
                            {
                                client_request_id:
                                    makeUuid(),

                                actual_cash:
                                    amount,

                                closing_notes:
                                    closingNotes.trim()
                                    ||
                                    null,
                            }
                        );

                    setShift(
                        response.data.shift
                    );

                    setSummary(
                        response.data.summary
                    );

                    setShowClose(
                        false
                    );

                    setActualCash(
                        ""
                    );

                    setClosingNotes(
                        ""
                    );

                    setMessage(
                        "Cashier shift closed successfully."
                    );

                    await loadMovements(
                        shift.id
                    );
                }
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Difference Preview
    |--------------------------------------------------------------------------
    */

    const closeDifference =
        useMemo(
            () => {
                const actual =
                    Number(
                        actualCash
                    );

                const expected =
                    Number(
                        summary?.expected_cash
                        ??
                        shift?.expected_cash
                        ??
                        0
                    );

                if (
                    !actualCash
                    ||
                    !Number.isFinite(
                        actual
                    )
                ) {
                    return null;
                }

                return actual -
                    expected;
            },
            [
                actualCash,
                shift,
                summary,
            ]
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
            <div className="shift-page">
                <style>
                    {styles}
                </style>

                <div className="shift-loading">
                    Loading cashier shift...
                </div>
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | No Open Shift
    |--------------------------------------------------------------------------
    */

    if (
        !shift
    ) {
        return (
            <div className="shift-page">
                <style>
                    {styles}
                </style>

                <header className="shift-header">
                    <div>
                        <span className="shift-eyebrow">
                            CASH MANAGEMENT
                        </span>

                        <h1>
                            Cashier Shift
                        </h1>

                        <p>
                            Start your cashier session by
                            entering the opening drawer cash.
                        </p>
                    </div>

                    <div className="shift-status is-closed">
                        NO OPEN SHIFT
                    </div>
                </header>

                {
                    error
                        ? (
                            <div className="shift-alert error">
                                {error}
                            </div>
                        )
                        : null
                }

                {
                    message
                        ? (
                            <div className="shift-alert success">
                                {message}
                            </div>
                        )
                        : null
                }

                <div className="shift-empty-layout">
                    <section className="shift-card shift-open-card">
                        <div className="shift-card-heading">
                            <div>
                                <span className="shift-card-kicker">
                                    START SHIFT
                                </span>

                                <h2>
                                    Opening Cash
                                </h2>
                            </div>

                            <div className="shift-icon">
                                Rs
                            </div>
                        </div>

                        <label className="shift-field">
                            <span>
                                Opening Drawer Amount
                            </span>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                    openingCash
                                }
                                placeholder="10000.00"
                                disabled={
                                    busy
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setOpeningCash(
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <label className="shift-field">
                            <span>
                                Opening Note
                            </span>

                            <textarea
                                rows={3}
                                value={
                                    openingNotes
                                }
                                placeholder="Optional opening note..."
                                disabled={
                                    busy
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setOpeningNotes(
                                            event.target.value
                                        )
                                }
                            />
                        </label>

                        <button
                            type="button"
                            className="shift-primary-button"
                            disabled={
                                busy
                                ||
                                openingCash === ""
                            }
                            onClick={
                                () => {
                                    void openShift();
                                }
                            }
                        >
                            {
                                busy
                                    ? "Opening Shift..."
                                    : "Open Cashier Shift"
                            }
                        </button>
                    </section>

                    <section className="shift-card shift-info-card">
                        <span className="shift-card-kicker">
                            HOW IT WORKS
                        </span>

                        <h2>
                            Drawer Reconciliation
                        </h2>

                        <div className="formula-row">
                            <span>
                                Opening Cash
                            </span>

                            <strong>
                                +
                            </strong>
                        </div>

                        <div className="formula-row">
                            <span>
                                Cash Sales
                            </span>

                            <strong>
                                +
                            </strong>
                        </div>

                        <div className="formula-row">
                            <span>
                                Cash Refunds
                            </span>

                            <strong>
                                −
                            </strong>
                        </div>

                        <div className="formula-row">
                            <span>
                                Cash In
                            </span>

                            <strong>
                                +
                            </strong>
                        </div>

                        <div className="formula-row">
                            <span>
                                Cash Out
                            </span>

                            <strong>
                                −
                            </strong>
                        </div>

                        <div className="formula-total">
                            Expected Drawer Cash
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Active / Closed Shift
    |--------------------------------------------------------------------------
    */

    const isOpen =
        shift.status === "OPEN";

    return (
        <div className="shift-page">
            <style>
                {styles}
            </style>

            <header className="shift-header">
                <div>
                    <span className="shift-eyebrow">
                        CASH MANAGEMENT
                    </span>

                    <h1>
                        Cashier Shift
                    </h1>

                    <p>
                        {shift.shift_number}
                        {" • "}
                        Opened {dateTime(
                            shift.opened_at
                        )}
                    </p>
                </div>

                <div
                    className={
                        isOpen
                            ? "shift-status is-open"
                            : "shift-status is-closed"
                    }
                >
                    {shift.status}
                </div>
            </header>

            {
                error
                    ? (
                        <div className="shift-alert error">
                            {error}
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div className="shift-alert success">
                            {message}
                        </div>
                    )
                    : null
            }

            <section className="shift-summary-grid">
                <SummaryCard
                    label="Opening Cash"
                    value={
                        money(
                            summary?.opening_cash
                            ??
                            shift.opening_cash
                        )
                    }
                    tone="neutral"
                />

                <SummaryCard
                    label="Cash Sales"
                    value={
                        money(
                            summary?.cash_sales
                            ??
                            0
                        )
                    }
                    tone="positive"
                />

                <SummaryCard
                    label="Cash Refunds"
                    value={
                        money(
                            summary?.cash_refunds
                            ??
                            0
                        )
                    }
                    tone="negative"
                />

                <SummaryCard
                    label="Cash In"
                    value={
                        money(
                            summary?.cash_in
                            ??
                            0
                        )
                    }
                    tone="positive"
                />

                <SummaryCard
                    label="Cash Out"
                    value={
                        money(
                            summary?.cash_out
                            ??
                            0
                        )
                    }
                    tone="negative"
                />

                <SummaryCard
                    label="Expected Drawer"
                    value={
                        money(
                            summary?.expected_cash
                            ??
                            shift.expected_cash
                        )
                    }
                    tone="primary"
                />
            </section>

            {
                isOpen
                    ? (
                        <section className="shift-actions">
                            <button
                                type="button"
                                className="shift-action cash-in"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () => {
                                        setMovementMode(
                                            "CASH_IN"
                                        );

                                        setMovementAmount(
                                            ""
                                        );

                                        setMovementReason(
                                            ""
                                        );
                                    }
                                }
                            >
                                <span className="action-symbol">
                                    +
                                </span>

                                <span>
                                    <strong>
                                        Cash In
                                    </strong>

                                    <small>
                                        Add cash to drawer
                                    </small>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="shift-action cash-out"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () => {
                                        setMovementMode(
                                            "CASH_OUT"
                                        );

                                        setMovementAmount(
                                            ""
                                        );

                                        setMovementReason(
                                            ""
                                        );
                                    }
                                }
                            >
                                <span className="action-symbol">
                                    −
                                </span>

                                <span>
                                    <strong>
                                        Cash Out
                                    </strong>

                                    <small>
                                        Remove cash from drawer
                                    </small>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="shift-action refresh"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () => {
                                        void loadCurrentShift();
                                    }
                                }
                            >
                                <span className="action-symbol">
                                    ↻
                                </span>

                                <span>
                                    <strong>
                                        Refresh
                                    </strong>

                                    <small>
                                        Reload shift totals
                                    </small>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="shift-action close"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () => {
                                        setActualCash(
                                            String(
                                                summary?.expected_cash
                                                ??
                                                shift.expected_cash
                                            )
                                        );

                                        setShowClose(
                                            true
                                        );
                                    }
                                }
                            >
                                <span className="action-symbol">
                                    ✓
                                </span>

                                <span>
                                    <strong>
                                        Close Shift
                                    </strong>

                                    <small>
                                        Count and reconcile
                                    </small>
                                </span>
                            </button>
                        </section>
                    )
                    : (
                        <section className="closed-shift-banner">
                            <div>
                                <span>
                                    Shift Closed
                                </span>

                                <strong>
                                    Actual:
                                    {" "}
                                    {money(
                                        shift.actual_cash
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Difference
                                </span>

                                <strong
                                    className={
                                        Number(
                                            shift.cash_difference
                                            ??
                                            0
                                        ) === 0
                                            ? "difference-even"
                                            : Number(
                                                shift.cash_difference
                                                ??
                                                0
                                            ) > 0
                                                ? "difference-over"
                                                : "difference-short"
                                    }
                                >
                                    {money(
                                        shift.cash_difference
                                    )}
                                </strong>
                            </div>
                        </section>
                    )
            }

            <section className="shift-card">
                <div className="shift-section-header">
                    <div>
                        <span className="shift-card-kicker">
                            DRAWER LEDGER
                        </span>

                        <h2>
                            Cash Movements
                        </h2>
                    </div>

                    <span className="movement-count">
                        {movements.length}
                        {" "}
                        records
                    </span>
                </div>

                {
                    movements.length === 0
                        ? (
                            <div className="shift-empty">
                                No drawer movements recorded.
                            </div>
                        )
                        : (
                            <div className="movement-list">
                                {
                                    movements.map(
                                        (
                                            movement
                                        ) => {
                                            const direction =
                                                movementDirection(
                                                    movement
                                                );

                                            return (
                                                <div
                                                    className="movement-row"
                                                    key={
                                                        movement.id
                                                    }
                                                >
                                                    <div
                                                        className={
                                                            `movement-icon ${direction}`
                                                        }
                                                    >
                                                        {
                                                            direction === "positive"
                                                                ? "+"
                                                                : direction === "negative"
                                                                    ? "−"
                                                                    : "•"
                                                        }
                                                    </div>

                                                    <div className="movement-main">
                                                        <strong>
                                                            {
                                                                movementLabel(
                                                                    movement.movement_type
                                                                )
                                                            }
                                                        </strong>

                                                        <span>
                                                            {
                                                                movement.reason
                                                                ??
                                                                "No reason"
                                                            }
                                                        </span>
                                                    </div>

                                                    <div className="movement-meta">
                                                        {
                                                            movement.movement_type
                                                                !== "MANUAL_OPEN"
                                                                ? (
                                                                    <strong
                                                                        className={
                                                                            direction
                                                                        }
                                                                    >
                                                                        {
                                                                            direction === "negative"
                                                                                ? "−"
                                                                                : direction === "positive"
                                                                                    ? "+"
                                                                                    : ""
                                                                        }
                                                                        {
                                                                            money(
                                                                                movement.amount
                                                                            )
                                                                        }
                                                                    </strong>
                                                                )
                                                                : (
                                                                    <strong>
                                                                        Drawer Open
                                                                    </strong>
                                                                )
                                                        }

                                                        <span>
                                                            {
                                                                dateTime(
                                                                    movement.occurred_at
                                                                )
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )
                                }
                            </div>
                        )
                }
            </section>

            {
                movementMode
                    ? (
                        <div className="shift-modal-backdrop">
                            <section className="shift-modal">
                                <div className="shift-modal-header">
                                    <div>
                                        <span className="shift-card-kicker">
                                            DRAWER MOVEMENT
                                        </span>

                                        <h2>
                                            {
                                                movementMode === "CASH_IN"
                                                    ? "Cash In"
                                                    : "Cash Out"
                                            }
                                        </h2>
                                    </div>

                                    <button
                                        type="button"
                                        className="modal-close"
                                        disabled={
                                            busy
                                        }
                                        onClick={
                                            () =>
                                                setMovementMode(
                                                    null
                                                )
                                        }
                                    >
                                        ×
                                    </button>
                                </div>

                                <label className="shift-field">
                                    <span>
                                        Amount
                                    </span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        autoFocus
                                        value={
                                            movementAmount
                                        }
                                        placeholder="0.00"
                                        disabled={
                                            busy
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setMovementAmount(
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>

                                <label className="shift-field">
                                    <span>
                                        Reason
                                    </span>

                                    <textarea
                                        rows={3}
                                        value={
                                            movementReason
                                        }
                                        placeholder={
                                            movementMode === "CASH_IN"
                                                ? "Why is cash being added?"
                                                : "Why is cash being removed?"
                                        }
                                        disabled={
                                            busy
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setMovementReason(
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>

                                <div className="shift-modal-actions">
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        disabled={
                                            busy
                                        }
                                        onClick={
                                            () =>
                                                setMovementMode(
                                                    null
                                                )
                                        }
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            movementMode === "CASH_IN"
                                                ? "shift-primary-button"
                                                : "shift-danger-button"
                                        }
                                        disabled={
                                            busy
                                            ||
                                            !movementAmount
                                            ||
                                            !movementReason.trim()
                                        }
                                        onClick={
                                            () => {
                                                void saveMovement();
                                            }
                                        }
                                    >
                                        {
                                            busy
                                                ? "Saving..."
                                                : movementMode === "CASH_IN"
                                                    ? "Add Cash"
                                                    : "Remove Cash"
                                        }
                                    </button>
                                </div>
                            </section>
                        </div>
                    )
                    : null
            }

            {
                showClose
                    ? (
                        <div className="shift-modal-backdrop">
                            <section className="shift-modal shift-close-modal">
                                <div className="shift-modal-header">
                                    <div>
                                        <span className="shift-card-kicker">
                                            END OF SHIFT
                                        </span>

                                        <h2>
                                            Close Cashier Shift
                                        </h2>
                                    </div>

                                    <button
                                        type="button"
                                        className="modal-close"
                                        disabled={
                                            busy
                                        }
                                        onClick={
                                            () =>
                                                setShowClose(
                                                    false
                                                )
                                        }
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="close-summary">
                                    <span>
                                        Expected Drawer
                                    </span>

                                    <strong>
                                        {
                                            money(
                                                summary?.expected_cash
                                                ??
                                                shift.expected_cash
                                            )
                                        }
                                    </strong>
                                </div>

                                <label className="shift-field">
                                    <span>
                                        Actual Counted Cash
                                    </span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        autoFocus
                                        value={
                                            actualCash
                                        }
                                        disabled={
                                            busy
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setActualCash(
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>

                                {
                                    closeDifference !== null
                                        ? (
                                            <div
                                                className={
                                                    closeDifference === 0
                                                        ? "close-difference even"
                                                        : closeDifference > 0
                                                            ? "close-difference over"
                                                            : "close-difference short"
                                                }
                                            >
                                                <span>
                                                    {
                                                        closeDifference === 0
                                                            ? "Drawer Balanced"
                                                            : closeDifference > 0
                                                                ? "Cash Over"
                                                                : "Cash Short"
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        money(
                                                            closeDifference
                                                        )
                                                    }
                                                </strong>
                                            </div>
                                        )
                                        : null
                                }

                                <label className="shift-field">
                                    <span>
                                        Closing Notes
                                    </span>

                                    <textarea
                                        rows={3}
                                        value={
                                            closingNotes
                                        }
                                        placeholder="Optional closing notes..."
                                        disabled={
                                            busy
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setClosingNotes(
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>

                                <div className="shift-modal-actions">
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        disabled={
                                            busy
                                        }
                                        onClick={
                                            () =>
                                                setShowClose(
                                                    false
                                                )
                                        }
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        className="shift-danger-button"
                                        disabled={
                                            busy
                                            ||
                                            actualCash === ""
                                        }
                                        onClick={
                                            () => {
                                                void closeShift();
                                            }
                                        }
                                    >
                                        {
                                            busy
                                                ? "Closing..."
                                                : "Confirm & Close Shift"
                                        }
                                    </button>
                                </div>
                            </section>
                        </div>
                    )
                    : null
            }
        </div>
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
        tone,
    }: {
        label:
        string;

        value:
        string;

        tone:
        "neutral"
        |
        "positive"
        |
        "negative"
        |
        "primary";
    }
) {
    return (
        <div
            className={
                `shift-summary-card ${tone}`
            }
        >
            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Styles
|--------------------------------------------------------------------------
*/

const styles = `
  .shift-page {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 22px;
      color: #0f172a;
  }
  
  .shift-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
  }
  
  .shift-header h1 {
      margin: 3px 0 5px;
      font-size: 31px;
      line-height: 1.1;
      letter-spacing: -0.02em;
  }
  
  .shift-header p {
      margin: 0;
      color: #64748b;
      font-size: 15px;
  }
  
  .shift-eyebrow,
  .shift-card-kicker {
      display: block;
      color: #64748b;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .12em;
  }
  
  .shift-status {
      min-width: 116px;
      padding: 11px 18px;
      border-radius: 999px;
      text-align: center;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: .05em;
  }
  
  .shift-status.is-open {
      color: #166534;
      background: #dcfce7;
      border: 1px solid #bbf7d0;
  }
  
  .shift-status.is-closed {
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
  }
  
  .shift-alert {
      padding: 14px 16px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
  }
  
  .shift-alert.success {
      color: #166534;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
  }
  
  .shift-alert.error {
      color: #991b1b;
      background: #fef2f2;
      border: 1px solid #fecaca;
  }
  
  .shift-card {
      padding: 22px;
      background: #ffffff;
      border: 1px solid #dbe3ec;
      border-radius: 18px;
      box-shadow: 0 6px 22px rgba(15, 23, 42, .05);
  }
  
  .shift-empty-layout {
      display: grid;
      grid-template-columns: minmax(420px, 1fr) minmax(320px, .8fr);
      gap: 22px;
  }
  
  .shift-card-heading,
  .shift-section-header,
  .shift-modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
  }
  
  .shift-card-heading h2,
  .shift-section-header h2,
  .shift-modal-header h2 {
      margin: 4px 0 0;
      font-size: 22px;
  }
  
  .shift-icon {
      display: grid;
      place-items: center;
      width: 50px;
      height: 50px;
      border-radius: 14px;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 900;
  }
  
  .shift-open-card {
      display: flex;
      flex-direction: column;
      gap: 18px;
  }
  
  .shift-field {
      display: flex;
      flex-direction: column;
      gap: 7px;
  }
  
  .shift-field > span {
      color: #334155;
      font-size: 14px;
      font-weight: 800;
  }
  
  .shift-field input,
  .shift-field textarea,
  .shift-field select {
      width: 100%;
      box-sizing: border-box;
      padding: 13px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 11px;
      background: #ffffff;
      color: #0f172a;
      font: inherit;
      font-size: 16px;
      outline: none;
  }
  
  .shift-field input {
      min-height: 51px;
  }
  
  .shift-field input:focus,
  .shift-field textarea:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, .10);
  }
  
  .shift-primary-button,
  .shift-danger-button,
  .secondary-button {
      min-height: 50px;
      padding: 0 20px;
      border: 0;
      border-radius: 11px;
      font-size: 15px;
      font-weight: 900;
      cursor: pointer;
  }
  
  .shift-primary-button {
      color: #ffffff;
      background: #2563eb;
  }
  
  .shift-danger-button {
      color: #ffffff;
      background: #dc2626;
  }
  
  .secondary-button {
      color: #334155;
      background: #f1f5f9;
  }
  
  .shift-primary-button:disabled,
  .shift-danger-button:disabled,
  .secondary-button:disabled {
      opacity: .55;
      cursor: not-allowed;
  }
  
  .shift-info-card h2 {
      margin: 5px 0 20px;
  }
  
  .formula-row {
      display: flex;
      justify-content: space-between;
      padding: 11px 0;
      border-bottom: 1px solid #eef2f7;
      color: #475569;
      font-weight: 700;
  }
  
  .formula-row strong {
      color: #0f172a;
  }
  
  .formula-total {
      margin-top: 16px;
      padding: 15px;
      border-radius: 11px;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 900;
      text-align: center;
  }
  
  .shift-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
  }
  
  .shift-summary-card {
      min-height: 108px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 9px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
  }
  
  .shift-summary-card span {
      color: #64748b;
      font-size: 13px;
      font-weight: 800;
  }
  
  .shift-summary-card strong {
      font-size: 22px;
      letter-spacing: -.02em;
  }
  
  .shift-summary-card.positive {
      border-color: #bbf7d0;
      background: #f0fdf4;
  }
  
  .shift-summary-card.positive strong {
      color: #15803d;
  }
  
  .shift-summary-card.negative {
      border-color: #fecaca;
      background: #fef2f2;
  }
  
  .shift-summary-card.negative strong {
      color: #b91c1c;
  }
  
  .shift-summary-card.primary {
      border-color: #bfdbfe;
      background: #eff6ff;
  }
  
  .shift-summary-card.primary strong {
      color: #1d4ed8;
  }
  
  .shift-actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
  }
  
  .shift-action {
      min-height: 82px;
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 15px;
      background: #ffffff;
      color: #0f172a;
      text-align: left;
      cursor: pointer;
  }
  
  .shift-action:hover {
      transform: translateY(-1px);
      box-shadow: 0 5px 15px rgba(15, 23, 42, .06);
  }
  
  .action-symbol {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: #f1f5f9;
      font-size: 23px;
      font-weight: 900;
  }
  
  .shift-action strong,
  .shift-action small {
      display: block;
  }
  
  .shift-action strong {
      font-size: 15px;
  }
  
  .shift-action small {
      margin-top: 3px;
      color: #64748b;
  }
  
  .shift-action.cash-in .action-symbol {
      color: #15803d;
      background: #dcfce7;
  }
  
  .shift-action.cash-out .action-symbol,
  .shift-action.close .action-symbol {
      color: #b91c1c;
      background: #fee2e2;
  }
  
  .movement-count {
      color: #64748b;
      font-size: 13px;
      font-weight: 700;
  }
  
  .movement-list {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
  }
  
  .movement-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid #eef2f7;
  }
  
  .movement-row:last-child {
      border-bottom: 0;
  }
  
  .movement-icon {
      display: grid;
      place-items: center;
      width: 39px;
      height: 39px;
      border-radius: 11px;
      background: #f1f5f9;
      font-size: 20px;
      font-weight: 900;
  }
  
  .movement-icon.positive {
      color: #15803d;
      background: #dcfce7;
  }
  
  .movement-icon.negative {
      color: #b91c1c;
      background: #fee2e2;
  }
  
  .movement-main strong,
  .movement-main span,
  .movement-meta strong,
  .movement-meta span {
      display: block;
  }
  
  .movement-main span,
  .movement-meta span {
      margin-top: 3px;
      color: #64748b;
      font-size: 12px;
  }
  
  .movement-meta {
      text-align: right;
  }
  
  .movement-meta strong {
      font-size: 15px;
  }
  
  .movement-meta strong.positive {
      color: #15803d;
  }
  
  .movement-meta strong.negative {
      color: #b91c1c;
  }
  
  .shift-empty,
  .shift-loading {
      padding: 40px;
      text-align: center;
      color: #64748b;
  }
  
  .closed-shift-banner {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 18px 22px;
      border-radius: 15px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
  }
  
  .closed-shift-banner span,
  .closed-shift-banner strong {
      display: block;
  }
  
  .closed-shift-banner span {
      color: #64748b;
      font-size: 12px;
      font-weight: 800;
  }
  
  .closed-shift-banner strong {
      margin-top: 4px;
      font-size: 18px;
  }
  
  .difference-over {
      color: #15803d;
  }
  
  .difference-short {
      color: #b91c1c;
  }
  
  .difference-even {
      color: #2563eb;
  }
  
  .shift-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 5000;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(15, 23, 42, .58);
      backdrop-filter: blur(3px);
  }
  
  .shift-modal {
      width: min(520px, 100%);
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 30px 80px rgba(15, 23, 42, .25);
  }
  
  .modal-close {
      display: grid;
      place-items: center;
      width: 39px;
      height: 39px;
      border: 0;
      border-radius: 10px;
      background: #f1f5f9;
      color: #334155;
      font-size: 23px;
      cursor: pointer;
  }
  
  .shift-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
  }
  
  .close-summary {
      padding: 17px;
      border-radius: 13px;
      background: #eff6ff;
  }
  
  .close-summary span,
  .close-summary strong {
      display: block;
  }
  
  .close-summary span {
      color: #64748b;
      font-size: 12px;
      font-weight: 800;
  }
  
  .close-summary strong {
      margin-top: 5px;
      color: #1d4ed8;
      font-size: 24px;
  }
  
  .close-difference {
      display: flex;
      justify-content: space-between;
      padding: 14px 16px;
      border-radius: 12px;
      font-weight: 900;
  }
  
  .close-difference.even {
      color: #1d4ed8;
      background: #eff6ff;
  }
  
  .close-difference.over {
      color: #166534;
      background: #dcfce7;
  }
  
  .close-difference.short {
      color: #991b1b;
      background: #fee2e2;
  }
  
  @media (max-width: 1100px) {
      .shift-summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
      }
  
      .shift-actions {
          grid-template-columns: repeat(2, minmax(0, 1fr));
      }
  }
  
  @media (max-width: 800px) {
      .shift-empty-layout,
      .shift-summary-grid,
      .shift-actions {
          grid-template-columns: 1fr;
      }
  
      .shift-header {
          flex-direction: column;
      }
  
      .movement-row {
          grid-template-columns: auto 1fr;
      }
  
      .movement-meta {
          grid-column: 2;
          text-align: left;
      }
  }
  `;