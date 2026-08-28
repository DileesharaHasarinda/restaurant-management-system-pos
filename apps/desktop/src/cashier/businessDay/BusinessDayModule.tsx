import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import {
    ApiError,
} from '../../api';

import {
    closeBusinessDay,
    getBusinessDayClosing,
    getBusinessDayPreview,
    getCurrentBusinessDay,
    openBusinessDay,
} from './businessDayService';

import type {
    BusinessDayClosing,
    BusinessDayPaymentBreakdown,
    BusinessDayPreview,
} from './types';

import './BusinessDayModule.css';

interface BusinessDayModuleProps {
    permissions:
    string[];

    onSessionExpired?:
    () => void;
}

type BusinessDaySection =
    | 'overview'
    | 'checks'
    | 'financials'
    | 'cash';

const LAST_CLOSING_KEY =
    'restaurant-pos-last-business-day-closing-id';

const EMPTY_PAYMENTS:
    BusinessDayPaymentBreakdown = {
    cash: 0,
    card: 0,
    qr: 0,
    bank_transfer: 0,
    other: 0,
};

const moneyFormatter =
    new Intl.NumberFormat(
        'en-LK',
        {
            style:
                'currency',

            currency:
                'LKR',

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2,
        },
    );

const dateFormatter =
    new Intl.DateTimeFormat(
        'en-LK',
        {
            year:
                'numeric',

            month:
                'short',

            day:
                '2-digit',
        },
    );

const dateTimeFormatter =
    new Intl.DateTimeFormat(
        'en-LK',
        {
            year:
                'numeric',

            month:
                'short',

            day:
                '2-digit',

            hour:
                '2-digit',

            minute:
                '2-digit',
        },
    );

function formatMoney(
    value:
        number
        | null
        | undefined,
): string {
    const amount =
        Number(
            value
            ??
            0,
        );

    return moneyFormatter.format(
        Number.isFinite(
            amount,
        )
            ? amount
            : 0,
    );
}

function formatDate(
    value:
        string
        | null
        | undefined,
): string {
    if (
        !value
    ) {
        return '—';
    }

    const parsed =
        new Date(
            `${value}T00:00:00`,
        );

    if (
        Number.isNaN(
            parsed.getTime(),
        )
    ) {
        return value;
    }

    return dateFormatter.format(
        parsed,
    );
}

function formatDateTime(
    value:
        string
        | null
        | undefined,
): string {
    if (
        !value
    ) {
        return '—';
    }

    const parsed =
        new Date(
            value,
        );

    if (
        Number.isNaN(
            parsed.getTime(),
        )
    ) {
        return value;
    }

    return dateTimeFormatter.format(
        parsed,
    );
}

function makeUuid(): string {
    if (
        typeof crypto
        !==
        'undefined'
        &&
        typeof crypto.randomUUID
        ===
        'function'
    ) {
        return crypto.randomUUID();
    }

    if (
        typeof crypto
        !==
        'undefined'
        &&
        typeof crypto.getRandomValues
        ===
        'function'
    ) {
        const bytes =
            new Uint8Array(
                16,
            );

        crypto.getRandomValues(
            bytes,
        );

        bytes[6] =
            (bytes[6] & 0x0f)
            |
            0x40;

        bytes[8] =
            (bytes[8] & 0x3f)
            |
            0x80;

        const hex =
            Array.from(
                bytes,
                value =>
                    value
                        .toString(16)
                        .padStart(
                            2,
                            '0',
                        ),
            );

        return [
            hex.slice(0, 4).join(''),
            hex.slice(4, 6).join(''),
            hex.slice(6, 8).join(''),
            hex.slice(8, 10).join(''),
            hex.slice(10, 16).join(''),
        ].join('-');
    }

    throw new Error(
        'This device cannot generate a secure request UUID.',
    );
}

function getErrorMessage(
    exception:
        unknown,
): string {
    if (
        exception instanceof Error
        &&
        exception.message
    ) {
        return exception.message;
    }

    return 'The business day operation could not be completed.';
}

function TouchKpiCard(
    {
        label,
        value,
        hint,
        tone = 'neutral',
    }: {
        label:
        string;

        value:
        string;

        hint?:
        string;

        tone?:
        'neutral'
        | 'primary'
        | 'positive'
        | 'warning';
    },
) {
    return (
        <article
            className={
                `bd-touch-kpi ${tone}`
            }
        >
            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>

            {
                hint
                    ? (
                        <small>
                            {hint}
                        </small>
                    )
                    : null
            }
        </article>
    );
}

function SummaryRow(
    {
        label,
        value,
        strong = false,
        negative = false,
    }: {
        label:
        string;

        value:
        string;

        strong?:
        boolean;

        negative?:
        boolean;
    },
) {
    return (
        <div
            className={
                [
                    'bd-summary-row',

                    strong
                        ? 'strong'
                        : '',

                    negative
                        ? 'negative'
                        : '',
                ]
                    .filter(
                        Boolean,
                    )
                    .join(
                        ' ',
                    )
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

function BlockerCard(
    {
        label,
        description,
        value,
    }: {
        label:
        string;

        description:
        string;

        value:
        number;
    },
) {
    const clear =
        value === 0;

    return (
        <article
            className={
                clear
                    ? 'bd-blocker clear'
                    : 'bd-blocker blocked'
            }
        >
            <div className="bd-blocker-icon">
                {
                    clear
                        ? '✓'
                        : '!'
                }
            </div>

            <div className="bd-blocker-content">
                <div className="bd-blocker-heading">
                    <strong>
                        {label}
                    </strong>

                    <span>
                        {
                            clear
                                ? 'CLEAR'
                                : `${value} OPEN`
                        }
                    </span>
                </div>

                <p>
                    {description}
                </p>
            </div>
        </article>
    );
}

function TouchTab(
    {
        active,
        label,
        short,
        onClick,
    }: {
        active:
        boolean;

        label:
        string;

        short:
        string;

        onClick:
        () => void;
    },
) {
    return (
        <button
            type="button"
            className={
                active
                    ? 'bd-touch-tab active'
                    : 'bd-touch-tab'
            }
            onClick={
                onClick
            }
        >
            <span>
                {short}
            </span>

            <strong>
                {label}
            </strong>
        </button>
    );
}

export default function BusinessDayModule(
    {
        permissions,
        onSessionExpired,
    }: BusinessDayModuleProps,
) {
    const canView =
        permissions.includes(
            'business_day.view',
        );

    const canOpen =
        permissions.includes(
            'business_day.open',
        );

    const canClose =
        permissions.includes(
            'business_day.close',
        );

    const [
        preview,
        setPreview,
    ] =
        useState<BusinessDayPreview | null>(
            null,
        );

    const [
        historicalClosing,
        setHistoricalClosing,
    ] =
        useState<BusinessDayClosing | null>(
            null,
        );

    const [
        section,
        setSection,
    ] =
        useState<BusinessDaySection>(
            'overview',
        );

    const [
        loading,
        setLoading,
    ] =
        useState(
            true,
        );

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(
            false,
        );

    const [
        opening,
        setOpening,
    ] =
        useState(
            false,
        );

    const [
        showOpenModal,
        setShowOpenModal,
    ] =
        useState(
            false,
        );

    const [
        openingNotes,
        setOpeningNotes,
    ] =
        useState(
            '',
        );

    const [
        processingClose,
        setProcessingClose,
    ] =
        useState(
            false,
        );

    const [
        showCloseModal,
        setShowCloseModal,
    ] =
        useState(
            false,
        );

    const [
        closingNotes,
        setClosingNotes,
    ] =
        useState(
            '',
        );

    const [
        closeRequestId,
        setCloseRequestId,
    ] =
        useState<string | null>(
            null,
        );

    const [
        message,
        setMessage,
    ] =
        useState(
            '',
        );

    const [
        error,
        setError,
    ] =
        useState(
            '',
        );

    const handleError =
        useCallback(
            (
                exception:
                    unknown,
            ): void => {
                if (
                    exception instanceof ApiError
                    &&
                    exception.status
                    ===
                    401
                ) {
                    onSessionExpired?.();

                    return;
                }

                setError(
                    getErrorMessage(
                        exception,
                    ),
                );
            },
            [
                onSessionExpired,
            ],
        );

    const loadStoredClosing =
        useCallback(
            async (): Promise<void> => {
                const stored =
                    sessionStorage.getItem(
                        LAST_CLOSING_KEY,
                    );

                if (
                    !stored
                ) {
                    setHistoricalClosing(
                        null,
                    );

                    return;
                }

                const closingId =
                    Number(
                        stored,
                    );

                if (
                    !Number.isInteger(
                        closingId,
                    )
                    ||
                    closingId <= 0
                ) {
                    sessionStorage.removeItem(
                        LAST_CLOSING_KEY,
                    );

                    setHistoricalClosing(
                        null,
                    );

                    return;
                }

                try {
                    const closing =
                        await getBusinessDayClosing(
                            closingId,
                        );

                    setHistoricalClosing(
                        closing,
                    );
                } catch {
                    sessionStorage.removeItem(
                        LAST_CLOSING_KEY,
                    );

                    setHistoricalClosing(
                        null,
                    );
                }
            },
            [],
        );

    useEffect(
        () => {
            let cancelled =
                false;

            void getCurrentBusinessDay()
                .then(
                    async result => {
                        if (
                            cancelled
                        ) {
                            return;
                        }

                        setPreview(
                            result,
                        );

                        if (
                            result.business_day
                        ) {
                            setHistoricalClosing(
                                null,
                            );

                            return;
                        }

                        const stored =
                            sessionStorage.getItem(
                                LAST_CLOSING_KEY,
                            );

                        if (
                            !stored
                        ) {
                            return;
                        }

                        const closingId =
                            Number(
                                stored,
                            );

                        if (
                            !Number.isInteger(
                                closingId,
                            )
                            ||
                            closingId <= 0
                        ) {
                            sessionStorage.removeItem(
                                LAST_CLOSING_KEY,
                            );

                            return;
                        }

                        try {
                            const closing =
                                await getBusinessDayClosing(
                                    closingId,
                                );

                            if (
                                !cancelled
                            ) {
                                setHistoricalClosing(
                                    closing,
                                );
                            }
                        } catch {
                            sessionStorage.removeItem(
                                LAST_CLOSING_KEY,
                            );
                        }
                    },
                )
                .catch(
                    exception => {
                        if (
                            cancelled
                        ) {
                            return;
                        }

                        if (
                            exception instanceof ApiError
                            &&
                            exception.status
                            ===
                            401
                        ) {
                            onSessionExpired?.();

                            return;
                        }

                        setError(
                            getErrorMessage(
                                exception,
                            ),
                        );
                    },
                )
                .finally(
                    () => {
                        if (
                            !cancelled
                        ) {
                            setLoading(
                                false,
                            );
                        }
                    },
                );

            return () => {
                cancelled =
                    true;
            };
        },
        [
            onSessionExpired,
        ],
    );

    const refresh =
        async (): Promise<void> => {
            if (
                refreshing
            ) {
                return;
            }

            setRefreshing(
                true,
            );

            setError(
                '',
            );

            setMessage(
                '',
            );

            try {
                const currentBusinessDay =
                    preview
                        ?.business_day;

                if (
                    currentBusinessDay
                ) {
                    const result =
                        await getBusinessDayPreview(
                            currentBusinessDay.id,
                        );

                    setPreview(
                        result,
                    );

                    setMessage(
                        'Business day information refreshed.',
                    );

                    return;
                }

                const result =
                    await getCurrentBusinessDay();

                setPreview(
                    result,
                );

                if (
                    result.business_day
                ) {
                    setHistoricalClosing(
                        null,
                    );

                    setMessage(
                        'Open business day loaded.',
                    );

                    return;
                }

                await loadStoredClosing();

                setMessage(
                    'Business day information refreshed.',
                );
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );
            } finally {
                setRefreshing(
                    false,
                );
            }
        };

    const openBusinessDayConfirmation =
        (): void => {
            if (
                !canOpen
                ||
                opening
            ) {
                return;
            }

            setOpeningNotes(
                '',
            );

            setError(
                '',
            );

            setMessage(
                '',
            );

            setShowOpenModal(
                true,
            );
        };

    const cancelOpen =
        (): void => {
            if (
                opening
            ) {
                return;
            }

            setShowOpenModal(
                false,
            );

            setOpeningNotes(
                '',
            );
        };

    const confirmOpen =
        async (): Promise<void> => {
            if (
                opening
                ||
                !canOpen
            ) {
                return;
            }

            if (
                openingNotes.length
                >
                2000
            ) {
                setError(
                    'Opening notes cannot exceed 2,000 characters.',
                );

                return;
            }

            setOpening(
                true,
            );

            setError(
                '',
            );

            setMessage(
                '',
            );

            try {
                const result =
                    await openBusinessDay({
                        notes:
                            openingNotes
                                .trim()
                            ||
                            null,
                    });

                const current =
                    await getCurrentBusinessDay();

                setPreview(
                    current,
                );

                setHistoricalClosing(
                    null,
                );

                sessionStorage.removeItem(
                    LAST_CLOSING_KEY,
                );

                setSection(
                    'overview',
                );

                setShowOpenModal(
                    false,
                );

                setOpeningNotes(
                    '',
                );

                setMessage(
                    result.created
                        ? 'Restaurant business day opened successfully.'
                        : 'The current open business day was loaded.',
                );
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );
            } finally {
                setOpening(
                    false,
                );
            }
        };

    const openCloseConfirmation =
        (): void => {
            if (
                !preview
                    ?.business_day
                ||
                !preview
                    .blockers
                    ?.can_close
                ||
                !canClose
                ||
                processingClose
            ) {
                return;
            }

            setClosingNotes(
                '',
            );

            setCloseRequestId(
                makeUuid(),
            );

            setError(
                '',
            );

            setMessage(
                '',
            );

            setShowCloseModal(
                true,
            );
        };

    const cancelClose =
        (): void => {
            if (
                processingClose
            ) {
                return;
            }

            setShowCloseModal(
                false,
            );

            setClosingNotes(
                '',
            );

            setCloseRequestId(
                null,
            );
        };

    const confirmClose =
        async (): Promise<void> => {
            const businessDay =
                preview
                    ?.business_day;

            if (
                !businessDay
                ||
                !canClose
                ||
                processingClose
            ) {
                return;
            }

            if (
                closingNotes.length
                >
                2000
            ) {
                setError(
                    'Closing notes cannot exceed 2,000 characters.',
                );

                return;
            }

            const requestId =
                closeRequestId
                ??
                makeUuid();

            if (
                !closeRequestId
            ) {
                setCloseRequestId(
                    requestId,
                );
            }

            setProcessingClose(
                true,
            );

            setError(
                '',
            );

            setMessage(
                '',
            );

            try {
                const result =
                    await closeBusinessDay(
                        businessDay.id,
                        {
                            client_request_id:
                                requestId,

                            closing_notes:
                                closingNotes
                                    .trim()
                                ||
                                null,
                        },
                    );

                sessionStorage.setItem(
                    LAST_CLOSING_KEY,
                    String(
                        result
                            .closing
                            .id,
                    ),
                );

                setHistoricalClosing(
                    result.closing,
                );

                setPreview({
                    business_day:
                        null,

                    blockers:
                        null,

                    summary:
                        null,

                    closing:
                        result.closing,
                });

                setSection(
                    'overview',
                );

                setShowCloseModal(
                    false,
                );

                setClosingNotes(
                    '',
                );

                setCloseRequestId(
                    null,
                );

                setMessage(
                    result.closed
                        ? 'Restaurant business day closed successfully.'
                        : 'The existing business day closing was loaded.',
                );
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );

                try {
                    const refreshed =
                        await getBusinessDayPreview(
                            businessDay.id,
                        );

                    setPreview(
                        refreshed,
                    );
                } catch {
                    /* Preserve the original close error. */
                }
            } finally {
                setProcessingClose(
                    false,
                );
            }
        };

    const reconciliation =
        useMemo(
            () => {
                const difference =
                    preview
                        ?.summary
                        ?.cash_difference
                    ??
                    historicalClosing
                        ?.cash_difference
                    ??
                    0;

                if (
                    difference < 0
                ) {
                    return {
                        label:
                            'SHORTAGE',

                        className:
                            'shortage',
                    };
                }

                if (
                    difference > 0
                ) {
                    return {
                        label:
                            'EXCESS',

                        className:
                            'excess',
                    };
                }

                return {
                    label:
                        'BALANCED',

                    className:
                        'balanced',
                };
            },
            [
                historicalClosing,
                preview,
            ],
        );

    const renderOpenModal =
        (): ReactNode => {
            if (
                !showOpenModal
            ) {
                return null;
            }

            return (
                <div className="bd-modal-backdrop">
                    <section
                        className="bd-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="bd-open-title"
                    >
                        <header>
                            <div className="bd-modal-title-wrap">
                                <span className="bd-eyebrow">
                                    START OF DAY
                                </span>

                                <h2 id="bd-open-title">
                                    Start Business Day?
                                </h2>

                                <p>
                                    This enables cashier shifts, orders and payments for the restaurant.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="bd-modal-close"
                                disabled={
                                    opening
                                }
                                onClick={
                                    cancelOpen
                                }
                                aria-label="Cancel business day opening"
                            >
                                ×
                            </button>
                        </header>

                        <div className="bd-touch-confirm-card open">
                            <span className="bd-touch-confirm-icon">
                                ▶
                            </span>

                            <div>
                                <strong>
                                    Start restaurant operations
                                </strong>

                                <p>
                                    The backend will create the current OPEN business day. A closed historical day is never reopened.
                                </p>
                            </div>
                        </div>

                        <label className="bd-field">
                            <span>
                                Opening Notes
                            </span>

                            <textarea
                                rows={
                                    4
                                }
                                maxLength={
                                    2000
                                }
                                disabled={
                                    opening
                                }
                                value={
                                    openingNotes
                                }
                                placeholder="Optional opening note"
                                onChange={
                                    event => {
                                        setOpeningNotes(
                                            event
                                                .target
                                                .value,
                                        );
                                    }
                                }
                            />

                            <small>
                                {openingNotes.length}/2000
                            </small>
                        </label>

                        <footer className="bd-modal-actions">
                            <button
                                type="button"
                                className="bd-touch-button secondary"
                                disabled={
                                    opening
                                }
                                onClick={
                                    cancelOpen
                                }
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="bd-touch-button success"
                                disabled={
                                    opening
                                }
                                onClick={
                                    () => {
                                        void confirmOpen();
                                    }
                                }
                            >
                                {
                                    opening
                                        ? 'Starting...'
                                        : 'Start Business Day'
                                }
                            </button>
                        </footer>
                    </section>
                </div>
            );
        };

    const renderCloseModal =
        (): ReactNode => {
            if (
                !showCloseModal
            ) {
                return null;
            }

            const businessDay =
                preview
                    ?.business_day;

            const summary =
                preview
                    ?.summary;

            if (
                !businessDay
                ||
                !summary
            ) {
                return null;
            }

            return (
                <div className="bd-modal-backdrop">
                    <section
                        className="bd-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="bd-close-title"
                    >
                        <header>
                            <div className="bd-modal-title-wrap">
                                <span className="bd-eyebrow">
                                    END OF DAY
                                </span>

                                <h2 id="bd-close-title">
                                    Close Restaurant Day?
                                </h2>

                                <p>
                                    {formatDate(
                                        businessDay.business_date,
                                    )}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="bd-modal-close"
                                disabled={
                                    processingClose
                                }
                                onClick={
                                    cancelClose
                                }
                                aria-label="Cancel business day closing"
                            >
                                ×
                            </button>
                        </header>

                        <div className="bd-touch-confirm-card danger">
                            <span className="bd-touch-confirm-icon">
                                !
                            </span>

                            <div>
                                <strong>
                                    Final financial closing
                                </strong>

                                <p>
                                    Laravel will re-check every blocker before creating the immutable closing snapshot.
                                </p>
                            </div>
                        </div>

                        <div className="bd-modal-kpis">
                            <TouchKpiCard
                                label="Net Sales"
                                value={
                                    formatMoney(
                                        summary.sales.net_sales,
                                    )
                                }
                                tone="primary"
                            />

                            <TouchKpiCard
                                label="Net Profit"
                                value={
                                    formatMoney(
                                        summary.estimated_net_profit,
                                    )
                                }
                                tone="positive"
                            />

                            <TouchKpiCard
                                label="Cash Difference"
                                value={
                                    formatMoney(
                                        summary.cash_difference,
                                    )
                                }
                                tone={
                                    summary.cash_difference === 0
                                        ? 'positive'
                                        : 'warning'
                                }
                            />
                        </div>

                        <label className="bd-field">
                            <span>
                                Closing Notes
                            </span>

                            <textarea
                                rows={
                                    4
                                }
                                maxLength={
                                    2000
                                }
                                disabled={
                                    processingClose
                                }
                                value={
                                    closingNotes
                                }
                                placeholder="Optional closing note"
                                onChange={
                                    event => {
                                        setClosingNotes(
                                            event
                                                .target
                                                .value,
                                        );
                                    }
                                }
                            />

                            <small>
                                {closingNotes.length}/2000
                            </small>
                        </label>

                        <footer className="bd-modal-actions">
                            <button
                                type="button"
                                className="bd-touch-button secondary"
                                disabled={
                                    processingClose
                                }
                                onClick={
                                    cancelClose
                                }
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="bd-touch-button danger"
                                disabled={
                                    processingClose
                                }
                                onClick={
                                    () => {
                                        void confirmClose();
                                    }
                                }
                            >
                                {
                                    processingClose
                                        ? 'Closing Day...'
                                        : 'Confirm & Close Day'
                                }
                            </button>
                        </footer>
                    </section>
                </div>
            );
        };

    if (
        !canView
    ) {
        return (
            <section className="business-day-module bd-touch-screen">
                <div className="bd-touch-empty">
                    <div className="bd-touch-empty-icon">
                        BD
                    </div>

                    <h2>
                        Business Day
                    </h2>

                    <p>
                        Your account does not have permission to view business day information.
                    </p>
                </div>
            </section>
        );
    }

    if (
        loading
    ) {
        return (
            <section className="business-day-module bd-touch-screen">
                <div className="bd-touch-loading">
                    <div className="bd-spinner" />

                    <strong>
                        Loading Business Day
                    </strong>

                    <span>
                        Checking restaurant status and financial totals...
                    </span>
                </div>
            </section>
        );
    }

    const businessDay =
        preview
            ?.business_day
        ??
        null;

    const blockers =
        preview
            ?.blockers
        ??
        null;

    const summary =
        preview
            ?.summary
        ??
        null;

    /*
    |--------------------------------------------------------------------------
    | Closed Day - Touch Summary
    |--------------------------------------------------------------------------
    */

    if (
        !businessDay
        &&
        historicalClosing
    ) {
        const snapshot =
            historicalClosing.snapshot;

        const payments =
            historicalClosing.payments
            ??
            EMPTY_PAYMENTS;

        return (
            <section className="business-day-module bd-touch-screen">
                <header className="bd-touch-header">
                    <div>
                        <span className="bd-eyebrow">
                            BUSINESS DAY
                        </span>

                        <h1>
                            Day Closed
                        </h1>

                        <p>
                            Final restaurant closing snapshot
                        </p>
                    </div>

                    <div className="bd-touch-status closed">
                        <span />
                        CLOSED
                    </div>
                </header>

                {
                    message
                        ? (
                            <div className="bd-alert success">
                                {message}
                            </div>
                        )
                        : null
                }

                {
                    error
                        ? (
                            <div className="bd-alert error">
                                {error}
                            </div>
                        )
                        : null
                }

                <section className="bd-closed-touch-card">
                    <div className="bd-closed-touch-icon">
                        ✓
                    </div>

                    <div className="bd-closed-touch-copy">
                        <span>
                            BUSINESS DATE
                        </span>

                        <strong>
                            {
                                formatDate(
                                    historicalClosing
                                        .business_day
                                        ?.business_date
                                    ??
                                    snapshot
                                        ?.business_day
                                        ?.business_date,
                                )
                            }
                        </strong>

                        <small>
                            Closed by {
                                historicalClosing
                                    .closed_by
                                    ?.name
                                ??
                                '—'
                            } · {
                                formatDateTime(
                                    historicalClosing.closed_at,
                                )
                            }
                        </small>
                    </div>
                </section>

                <div className="bd-touch-kpi-grid">
                    <TouchKpiCard
                        label="Net Sales"
                        value={
                            formatMoney(
                                historicalClosing.total_sales,
                            )
                        }
                        tone="primary"
                    />

                    <TouchKpiCard
                        label="Gross Profit"
                        value={
                            formatMoney(
                                historicalClosing.gross_profit,
                            )
                        }
                        tone="positive"
                    />

                    <TouchKpiCard
                        label="Net Profit"
                        value={
                            formatMoney(
                                historicalClosing.estimated_net_profit,
                            )
                        }
                        tone="positive"
                    />

                    <TouchKpiCard
                        label="Cash Difference"
                        value={
                            formatMoney(
                                historicalClosing.cash_difference,
                            )
                        }
                        tone={
                            historicalClosing.cash_difference === 0
                                ? 'positive'
                                : 'warning'
                        }
                        hint={
                            reconciliation.label
                        }
                    />
                </div>

                <div className="bd-touch-closed-grid">
                    <section className="bd-touch-panel">
                        <div className="bd-panel-title">
                            <div>
                                <span>
                                    PAYMENT MIX
                                </span>

                                <h2>
                                    Final Payments
                                </h2>
                            </div>
                        </div>

                        <div className="bd-payment-tile-grid">
                            <div>
                                <span>
                                    Cash
                                </span>

                                <strong>
                                    {formatMoney(payments.cash)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Card
                                </span>

                                <strong>
                                    {formatMoney(payments.card)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    QR
                                </span>

                                <strong>
                                    {formatMoney(payments.qr)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Bank
                                </span>

                                <strong>
                                    {formatMoney(payments.bank_transfer)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Other
                                </span>

                                <strong>
                                    {formatMoney(payments.other)}
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section className="bd-touch-panel">
                        <div className="bd-panel-title">
                            <div>
                                <span>
                                    RECONCILIATION
                                </span>

                                <h2>
                                    Final Cash
                                </h2>
                            </div>

                            <span
                                className={
                                    `bd-reconciliation ${reconciliation.className}`
                                }
                            >
                                {reconciliation.label}
                            </span>
                        </div>

                        <SummaryRow
                            label="Expected Cash"
                            value={
                                formatMoney(
                                    historicalClosing.expected_cash,
                                )
                            }
                        />

                        <SummaryRow
                            label="Actual Cash"
                            value={
                                formatMoney(
                                    historicalClosing.actual_cash,
                                )
                            }
                        />

                        <SummaryRow
                            label="Difference"
                            value={
                                formatMoney(
                                    historicalClosing.cash_difference,
                                )
                            }
                            strong
                            negative={
                                historicalClosing.cash_difference < 0
                            }
                        />
                    </section>
                </div>

                {
                    historicalClosing.closing_notes
                        ? (
                            <section className="bd-touch-notes">
                                <span>
                                    Closing Notes
                                </span>

                                <p>
                                    {historicalClosing.closing_notes}
                                </p>
                            </section>
                        )
                        : null
                }

                <div className="bd-touch-bottom-actions closed-actions">
                    <button
                        type="button"
                        className="bd-touch-button secondary"
                        disabled={
                            refreshing
                            ||
                            opening
                        }
                        onClick={
                            () => {
                                void refresh();
                            }
                        }
                    >
                        <span className="bd-button-icon">
                            ↻
                        </span>

                        {
                            refreshing
                                ? 'Refreshing...'
                                : 'Refresh'
                        }
                    </button>

                    {
                        canOpen
                            ? (
                                <button
                                    type="button"
                                    className="bd-touch-button success grow"
                                    disabled={
                                        opening
                                    }
                                    onClick={
                                        openBusinessDayConfirmation
                                    }
                                >
                                    <span className="bd-button-icon">
                                        ▶
                                    </span>

                                    Start Business Day
                                </button>
                            )
                            : null
                    }
                </div>

                {renderOpenModal()}
            </section>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | No Open Business Day
    |--------------------------------------------------------------------------
    */

    if (
        !businessDay
        ||
        !blockers
        ||
        !summary
    ) {
        return (
            <section className="business-day-module bd-touch-screen">
                <header className="bd-touch-header">
                    <div>
                        <span className="bd-eyebrow">
                            BUSINESS DAY
                        </span>

                        <h1>
                            Start Restaurant Day
                        </h1>

                        <p>
                            Open the business day before starting cashier operations.
                        </p>
                    </div>

                    <div className="bd-touch-status inactive">
                        <span />
                        NOT OPEN
                    </div>
                </header>

                {
                    error
                        ? (
                            <div className="bd-alert error">
                                {error}
                            </div>
                        )
                        : null
                }

                {
                    message
                        ? (
                            <div className="bd-alert success">
                                {message}
                            </div>
                        )
                        : null
                }

                <div className="bd-touch-start-card">
                    <div className="bd-touch-start-icon">
                        BD
                    </div>

                    <span className="bd-touch-start-kicker">
                        RESTAURANT OPENING
                    </span>

                    <h2>
                        No Open Business Day
                    </h2>

                    <p>
                        Start a business day first. After that you can open the cashier shift, accept orders and process payments.
                    </p>

                    {
                        canOpen
                            ? (
                                <button
                                    type="button"
                                    className="bd-touch-start-button"
                                    disabled={
                                        opening
                                    }
                                    onClick={
                                        openBusinessDayConfirmation
                                    }
                                >
                                    <span>
                                        ▶
                                    </span>

                                    {
                                        opening
                                            ? 'Starting Business Day...'
                                            : 'Start Business Day'
                                    }
                                </button>
                            )
                            : (
                                <div className="bd-readonly">
                                    Your account can view Business Day information but cannot start a new business day.
                                </div>
                            )
                    }
                </div>

                <div className="bd-touch-bottom-actions single-action">
                    <button
                        type="button"
                        className="bd-touch-button secondary grow"
                        disabled={
                            refreshing
                        }
                        onClick={
                            () => {
                                void refresh();
                            }
                        }
                    >
                        <span className="bd-button-icon">
                            ↻
                        </span>

                        {
                            refreshing
                                ? 'Refreshing...'
                                : 'Refresh Status'
                        }
                    </button>
                </div>

                {renderOpenModal()}
            </section>
        );
    }

    const netPayments =
        summary
            .payments
            ?.net
        ??
        EMPTY_PAYMENTS;

    const activeBlockerCount =
        blockers.open_tables
        +
        blockers.active_orders
        +
        blockers.unpaid_invoices
        +
        blockers.open_cashier_shifts;

    const orderHint =
        `${summary.orders?.cancelled ?? 0} cancelled · ${summary.orders?.rejected ?? 0} rejected`;

    const renderOverview =
        (): ReactNode => (
            <div className="bd-touch-section-content">
                <div className="bd-touch-kpi-grid">
                    <TouchKpiCard
                        label="Completed Orders"
                        value={
                            String(
                                summary.orders?.completed
                                ??
                                0,
                            )
                        }
                        hint={
                            orderHint
                        }
                        tone="neutral"
                    />

                    <TouchKpiCard
                        label="Net Sales"
                        value={
                            formatMoney(
                                summary.sales.net_sales,
                            )
                        }
                        tone="primary"
                    />

                    <TouchKpiCard
                        label="Gross Profit"
                        value={
                            formatMoney(
                                summary.gross_profit,
                            )
                        }
                        tone="positive"
                    />

                    <TouchKpiCard
                        label="Estimated Net Profit"
                        value={
                            formatMoney(
                                summary.estimated_net_profit,
                            )
                        }
                        tone="positive"
                    />
                </div>

                <div className="bd-touch-overview-grid">
                    <section className="bd-touch-panel">
                        <div className="bd-panel-title">
                            <div>
                                <span>
                                    DAY INFORMATION
                                </span>

                                <h2>
                                    Current Business Day
                                </h2>
                            </div>

                            <span className="bd-live-pill">
                                LIVE
                            </span>
                        </div>

                        <div className="bd-day-info-grid">
                            <div>
                                <span>
                                    Business Date
                                </span>

                                <strong>
                                    {formatDate(businessDay.business_date)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Opened By
                                </span>

                                <strong>
                                    {businessDay.opened_by?.name ?? '—'}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Opened At
                                </span>

                                <strong>
                                    {formatDateTime(businessDay.opened_at)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Status
                                </span>

                                <strong className="bd-open-value">
                                    OPEN
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section
                        className={
                            blockers.can_close
                                ? 'bd-touch-panel bd-readiness-panel ready'
                                : 'bd-touch-panel bd-readiness-panel blocked'
                        }
                    >
                        <div className="bd-readiness-icon">
                            {
                                blockers.can_close
                                    ? '✓'
                                    : '!'
                            }
                        </div>

                        <span>
                            END-OF-DAY STATUS
                        </span>

                        <h2>
                            {
                                blockers.can_close
                                    ? 'Ready to Close'
                                    : 'Action Required'
                            }
                        </h2>

                        <p>
                            {
                                blockers.can_close
                                    ? 'All operational blockers are clear. The restaurant day can be closed.'
                                    : `${activeBlockerCount} blocker item${activeBlockerCount === 1 ? '' : 's'} must be resolved before closing.`
                            }
                        </p>

                        <button
                            type="button"
                            className="bd-readiness-button"
                            onClick={
                                () => {
                                    setSection(
                                        'checks',
                                    );
                                }
                            }
                        >
                            View Pre-Close Checks
                        </button>
                    </section>
                </div>
            </div>
        );

    const renderChecks =
        (): ReactNode => (
            <div className="bd-touch-section-content">
                <section
                    className={
                        blockers.can_close
                            ? 'bd-touch-readiness-banner ready'
                            : 'bd-touch-readiness-banner blocked'
                    }
                >
                    <div className="bd-touch-readiness-icon">
                        {
                            blockers.can_close
                                ? '✓'
                                : '!'
                        }
                    </div>

                    <div>
                        <span>
                            PRE-CLOSE CHECK
                        </span>

                        <h2>
                            {
                                blockers.can_close
                                    ? 'Everything is clear'
                                    : 'Resolve blockers before closing'
                            }
                        </h2>

                        <p>
                            Laravel will run these checks again when you confirm the final close.
                        </p>
                    </div>

                    <strong>
                        {
                            blockers.can_close
                                ? 'READY'
                                : `${activeBlockerCount} OPEN`
                        }
                    </strong>
                </section>

                <div className="bd-blocker-grid">
                    <BlockerCard
                        label="Open Tables"
                        description="Close all active table sessions."
                        value={
                            blockers.open_tables
                        }
                    />

                    <BlockerCard
                        label="Active Orders"
                        description="Finalize pending, kitchen and served orders."
                        value={
                            blockers.active_orders
                        }
                    />

                    <BlockerCard
                        label="Unpaid Bills"
                        description="Settle every unpaid or partially paid invoice."
                        value={
                            blockers.unpaid_invoices
                        }
                    />

                    <BlockerCard
                        label="Open Cashier Shifts"
                        description="Reconcile and close all cashier shifts."
                        value={
                            blockers.open_cashier_shifts
                        }
                    />
                </div>

                {
                    canClose
                        ? (
                            <button
                                type="button"
                                className={
                                    blockers.can_close
                                        ? 'bd-touch-close-wide ready'
                                        : 'bd-touch-close-wide disabled-look'
                                }
                                disabled={
                                    !blockers.can_close
                                    ||
                                    processingClose
                                }
                                onClick={
                                    openCloseConfirmation
                                }
                            >
                                <span>
                                    {
                                        blockers.can_close
                                            ? '✓'
                                            : '!'
                                    }
                                </span>

                                <div>
                                    <strong>
                                        {
                                            blockers.can_close
                                                ? 'Close Restaurant Day'
                                                : 'Resolve Blockers First'
                                        }
                                    </strong>

                                    <small>
                                        Final closing creates an immutable financial snapshot.
                                    </small>
                                </div>
                            </button>
                        )
                        : null
                }
            </div>
        );

    const renderFinancials =
        (): ReactNode => (
            <div className="bd-touch-section-content">
                <div className="bd-touch-financial-grid">
                    <section className="bd-touch-panel">
                        <div className="bd-panel-title">
                            <div>
                                <span>
                                    SALES
                                </span>

                                <h2>
                                    Sales Summary
                                </h2>
                            </div>
                        </div>

                        <SummaryRow
                            label="Subtotal"
                            value={
                                formatMoney(
                                    summary.sales.subtotal,
                                )
                            }
                        />

                        <SummaryRow
                            label="Discounts"
                            value={
                                formatMoney(
                                    summary.sales.discounts,
                                )
                            }
                            negative
                        />

                        <SummaryRow
                            label="Tax"
                            value={
                                formatMoney(
                                    summary.sales.tax,
                                )
                            }
                        />

                        <SummaryRow
                            label="Service Charge"
                            value={
                                formatMoney(
                                    summary.sales.service_charge,
                                )
                            }
                        />

                        <SummaryRow
                            label="Gross Sales"
                            value={
                                formatMoney(
                                    summary.sales.gross_invoice_sales,
                                )
                            }
                        />

                        <SummaryRow
                            label="Refunds"
                            value={
                                formatMoney(
                                    summary.sales.refunds,
                                )
                            }
                            negative
                        />

                        <SummaryRow
                            label="Net Sales"
                            value={
                                formatMoney(
                                    summary.sales.net_sales,
                                )
                            }
                            strong
                        />
                    </section>

                    <section className="bd-touch-panel bd-profit-panel">
                        <div className="bd-panel-title">
                            <div>
                                <span>
                                    PROFITABILITY
                                </span>

                                <h2>
                                    Profit Estimate
                                </h2>
                            </div>
                        </div>

                        <SummaryRow
                            label="Net Sales"
                            value={
                                formatMoney(
                                    summary.sales.net_sales,
                                )
                            }
                        />

                        <SummaryRow
                            label="COGS"
                            value={
                                formatMoney(
                                    summary.cogs,
                                )
                            }
                            negative
                        />

                        <SummaryRow
                            label="Gross Profit"
                            value={
                                formatMoney(
                                    summary.gross_profit,
                                )
                            }
                            strong
                        />

                        <SummaryRow
                            label="Expenses"
                            value={
                                formatMoney(
                                    summary.expenses,
                                )
                            }
                            negative
                        />

                        <SummaryRow
                            label="Wastage"
                            value={
                                formatMoney(
                                    summary.wastage,
                                )
                            }
                            negative
                        />

                        <div className="bd-touch-net-profit">
                            <span>
                                Estimated Net Profit
                            </span>

                            <strong>
                                {
                                    formatMoney(
                                        summary.estimated_net_profit,
                                    )
                                }
                            </strong>
                        </div>
                    </section>
                </div>

                <section className="bd-touch-panel">
                    <div className="bd-panel-title">
                        <div>
                            <span>
                                OPERATIONS
                            </span>

                            <h2>
                                Purchases & Suppliers
                            </h2>
                        </div>
                    </div>

                    <div className="bd-operation-grid">
                        <TouchKpiCard
                            label="Purchases"
                            value={
                                formatMoney(
                                    summary.purchases,
                                )
                            }
                        />

                        <TouchKpiCard
                            label="Supplier Payments"
                            value={
                                formatMoney(
                                    summary.supplier_payments,
                                )
                            }
                        />

                        <TouchKpiCard
                            label="Expenses"
                            value={
                                formatMoney(
                                    summary.expenses,
                                )
                            }
                        />

                        <TouchKpiCard
                            label="Wastage"
                            value={
                                formatMoney(
                                    summary.wastage,
                                )
                            }
                        />
                    </div>

                    <p className="bd-touch-helper-text">
                        Purchases and supplier payments are displayed for management visibility. They are not deducted again from profit when COGS is already used.
                    </p>
                </section>
            </div>
        );

    const renderCash =
        (): ReactNode => (
            <div className="bd-touch-section-content">
                <div className="bd-touch-cash-grid">
                    <section className="bd-touch-panel">
                        <div className="bd-panel-title">
                            <div>
                                <span>
                                    PAYMENTS
                                </span>

                                <h2>
                                    Net Payment Mix
                                </h2>
                            </div>
                        </div>

                        <div className="bd-payment-tile-grid">
                            <div>
                                <span>
                                    Cash
                                </span>

                                <strong>
                                    {formatMoney(netPayments.cash)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Card
                                </span>

                                <strong>
                                    {formatMoney(netPayments.card)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    QR
                                </span>

                                <strong>
                                    {formatMoney(netPayments.qr)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Bank
                                </span>

                                <strong>
                                    {formatMoney(netPayments.bank_transfer)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Other
                                </span>

                                <strong>
                                    {formatMoney(netPayments.other)}
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section className="bd-touch-panel">
                        <div className="bd-panel-title">
                            <div>
                                <span>
                                    CASH DRAWER
                                </span>

                                <h2>
                                    Reconciliation
                                </h2>
                            </div>

                            <span
                                className={
                                    `bd-reconciliation ${reconciliation.className}`
                                }
                            >
                                {reconciliation.label}
                            </span>
                        </div>

                        <div className="bd-reconciliation-touch-grid">
                            <div>
                                <span>
                                    Expected Cash
                                </span>

                                <strong>
                                    {formatMoney(summary.expected_cash)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Actual Cash
                                </span>

                                <strong>
                                    {formatMoney(summary.actual_cash)}
                                </strong>
                            </div>

                            <div
                                className={
                                    summary.cash_difference < 0
                                        ? 'difference negative'
                                        : summary.cash_difference > 0
                                            ? 'difference positive'
                                            : 'difference balanced'
                                }
                            >
                                <span>
                                    Difference
                                </span>

                                <strong>
                                    {formatMoney(summary.cash_difference)}
                                </strong>
                            </div>
                        </div>

                        {
                            blockers.open_cashier_shifts > 0
                                ? (
                                    <div className="bd-touch-warning-box">
                                        <strong>
                                            Cashier shift still open
                                        </strong>

                                        <span>
                                            Reconcile and close the cashier shift before closing the restaurant day.
                                        </span>
                                    </div>
                                )
                                : null
                        }
                    </section>
                </div>
            </div>
        );

    return (
        <section className="business-day-module bd-touch-screen">
            <header className="bd-touch-header">
                <div>
                    <span className="bd-eyebrow">
                        BUSINESS DAY
                    </span>

                    <h1>
                        Restaurant Day Control
                    </h1>

                    <p>
                        {formatDate(businessDay.business_date)} · Opened by {businessDay.opened_by?.name ?? '—'}
                    </p>
                </div>

                <div className="bd-touch-status open">
                    <span />
                    OPEN
                </div>
            </header>

            {
                message
                    ? (
                        <div className="bd-alert success">
                            {message}
                        </div>
                    )
                    : null
            }

            {
                error
                    ? (
                        <div className="bd-alert error">
                            {error}
                        </div>
                    )
                    : null
            }

            <nav className="bd-touch-tabs" aria-label="Business day sections">
                <TouchTab
                    short="OV"
                    label="Overview"
                    active={
                        section === 'overview'
                    }
                    onClick={
                        () => {
                            setSection(
                                'overview',
                            );
                        }
                    }
                />

                <TouchTab
                    short={
                        blockers.can_close
                            ? '✓'
                            : String(
                                activeBlockerCount,
                            )
                    }
                    label="Close Checks"
                    active={
                        section === 'checks'
                    }
                    onClick={
                        () => {
                            setSection(
                                'checks',
                            );
                        }
                    }
                />

                <TouchTab
                    short="Rs"
                    label="Financials"
                    active={
                        section === 'financials'
                    }
                    onClick={
                        () => {
                            setSection(
                                'financials',
                            );
                        }
                    }
                />

                <TouchTab
                    short="CA"
                    label="Cash"
                    active={
                        section === 'cash'
                    }
                    onClick={
                        () => {
                            setSection(
                                'cash',
                            );
                        }
                    }
                />
            </nav>

            {
                section === 'overview'
                    ? renderOverview()
                    : null
            }

            {
                section === 'checks'
                    ? renderChecks()
                    : null
            }

            {
                section === 'financials'
                    ? renderFinancials()
                    : null
            }

            {
                section === 'cash'
                    ? renderCash()
                    : null
            }

            <div className="bd-touch-bottom-actions">
                <button
                    type="button"
                    className="bd-touch-button secondary"
                    disabled={
                        refreshing
                        ||
                        processingClose
                    }
                    onClick={
                        () => {
                            void refresh();
                        }
                    }
                >
                    <span className="bd-button-icon">
                        ↻
                    </span>

                    {
                        refreshing
                            ? 'Refreshing...'
                            : 'Refresh'
                    }
                </button>

                {
                    canClose
                        ? (
                            <button
                                type="button"
                                className={
                                    blockers.can_close
                                        ? 'bd-touch-button danger grow'
                                        : 'bd-touch-button blocked-action grow'
                                }
                                disabled={
                                    !blockers.can_close
                                    ||
                                    processingClose
                                }
                                onClick={
                                    openCloseConfirmation
                                }
                            >
                                <span className="bd-button-icon">
                                    {
                                        blockers.can_close
                                            ? '✓'
                                            : '!'
                                    }
                                </span>

                                {
                                    blockers.can_close
                                        ? 'Close Restaurant Day'
                                        : 'Resolve Blockers First'
                                }
                            </button>
                        )
                        : (
                            <div className="bd-readonly-action grow">
                                Read-only business day access
                            </div>
                        )
                }
            </div>

            {renderCloseModal()}
        </section>
    );
}
