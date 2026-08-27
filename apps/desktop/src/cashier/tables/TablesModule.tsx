import {
    useMemo,
    useState,
} from 'react';

import type {
    CashierTable,
    CashierTableStatusFilter,
} from './types';

import './TablesModule.css';

/*
|--------------------------------------------------------------------------
| Props
|--------------------------------------------------------------------------
*/

interface TablesModuleProps {
    tables:
    CashierTable[];

    loading?:
    boolean;
}

/*
|--------------------------------------------------------------------------
| Status Filter Values
|--------------------------------------------------------------------------
*/

const TABLE_STATUS_FILTER_VALUES =
    new Set<string>([
        'ALL',
        'AVAILABLE',
        'OCCUPIED',
        'RESERVED',
        'CLEANING',
        'OUT_OF_SERVICE',
    ]);

function isCashierTableStatusFilter(
    value:
        string,
): value is CashierTableStatusFilter {
    return TABLE_STATUS_FILTER_VALUES.has(
        value,
    );
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function formatStatus(
    status:
        string,
): string {
    return status
        .replace(
            /_/g,
            ' ',
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            (
                character,
            ) =>
                character.toUpperCase(),
        );
}

function statusClass(
    status:
        string,
): string {
    return status
        .trim()
        .toLowerCase()
        .replace(
            /_/g,
            '-',
        );
}

function formatDateTime(
    value:
        string | null,
): string {
    if (!value) {
        return 'Not available';
    }

    const date =
        new Date(
            value,
        );

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        'en-LK',
        {
            day:
                '2-digit',

            month:
                'short',

            year:
                'numeric',

            hour:
                '2-digit',

            minute:
                '2-digit',
        },
    ).format(
        date,
    );
}

/*
|--------------------------------------------------------------------------
| Tables Module
|--------------------------------------------------------------------------
*/

export default function TablesModule(
    {
        tables,
        loading = false,
    }: TablesModuleProps,
) {
    const [
        search,
        setSearch,
    ] =
        useState('');

    const [
        statusFilter,
        setStatusFilter,
    ] =
        useState<CashierTableStatusFilter>(
            'ALL',
        );

    /*
    |--------------------------------------------------------------------------
    | Summary
    |--------------------------------------------------------------------------
    */

    const summary =
        useMemo(
            () => {
                const available =
                    tables.filter(
                        (
                            table,
                        ) =>
                            table.status
                            ===
                            'AVAILABLE',
                    ).length;

                const occupied =
                    tables.filter(
                        (
                            table,
                        ) =>
                            table.status
                            ===
                            'OCCUPIED',
                    ).length;

                const reserved =
                    tables.filter(
                        (
                            table,
                        ) =>
                            table.status
                            ===
                            'RESERVED',
                    ).length;

                const unavailable =
                    tables.filter(
                        (
                            table,
                        ) =>
                            [
                                'CLEANING',
                                'OUT_OF_SERVICE',
                            ].includes(
                                table.status,
                            ),
                    ).length;

                return {
                    available,
                    occupied,
                    reserved,
                    unavailable,
                };
            },
            [
                tables,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Filtered Tables
    |--------------------------------------------------------------------------
    */

    const filteredTables =
        useMemo(
            () => {
                const query =
                    search
                        .trim()
                        .toLowerCase();

                return tables
                    .filter(
                        (
                            table,
                        ) =>
                            statusFilter
                            ===
                            'ALL'
                            ||
                            table.status
                            ===
                            statusFilter,
                    )
                    .filter(
                        (
                            table,
                        ) => {
                            if (
                                query
                                ===
                                ''
                            ) {
                                return true;
                            }

                            return [
                                table.name,
                                table.code,
                                table.table_number,
                                table.area
                                ??
                                '',
                            ]
                                .join(
                                    ' ',
                                )
                                .toLowerCase()
                                .includes(
                                    query,
                                );
                        },
                    )
                    .sort(
                        (
                            left,
                            right,
                        ) =>
                            left.sort_order
                            -
                            right.sort_order
                            ||
                            left.table_number
                            -
                            right.table_number,
                    );
            },
            [
                search,
                statusFilter,
                tables,
            ],
        );

    return (
        <div className="cashier-tables-module">
            <header className="ctm-header">
                <div>
                    <p className="ctm-eyebrow">
                        RESTAURANT FLOOR
                    </p>

                    <h2>
                        Tables
                    </h2>

                    <p className="ctm-subtitle">
                        View live table availability,
                        guest sessions and QR ordering
                        status.
                    </p>
                </div>

                <div className="ctm-total-badge">
                    <strong>
                        {
                            tables.length
                        }
                    </strong>

                    <span>
                        {
                            tables.length
                                ===
                                1
                                ? 'Table'
                                : 'Tables'
                        }
                    </span>
                </div>
            </header>

            <section className="ctm-summary-grid">
                <article className="ctm-summary-card available">
                    <span className="ctm-summary-icon">
                        ✓
                    </span>

                    <div>
                        <span>
                            Available
                        </span>

                        <strong>
                            {
                                summary.available
                            }
                        </strong>
                    </div>
                </article>

                <article className="ctm-summary-card occupied">
                    <span className="ctm-summary-icon">
                        ●
                    </span>

                    <div>
                        <span>
                            Occupied
                        </span>

                        <strong>
                            {
                                summary.occupied
                            }
                        </strong>
                    </div>
                </article>

                <article className="ctm-summary-card reserved">
                    <span className="ctm-summary-icon">
                        R
                    </span>

                    <div>
                        <span>
                            Reserved
                        </span>

                        <strong>
                            {
                                summary.reserved
                            }
                        </strong>
                    </div>
                </article>

                <article className="ctm-summary-card unavailable">
                    <span className="ctm-summary-icon">
                        !
                    </span>

                    <div>
                        <span>
                            Unavailable
                        </span>

                        <strong>
                            {
                                summary.unavailable
                            }
                        </strong>
                    </div>
                </article>
            </section>

            <section className="ctm-toolbar">
                <label className="ctm-search">
                    <span>
                        Search
                    </span>

                    <input
                        type="search"
                        value={
                            search
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setSearch(
                                    event.currentTarget.value,
                                )
                        }
                        placeholder="Table name, number, code or area..."
                    />
                </label>

                <label className="ctm-filter">
                    <span>
                        Status
                    </span>

                    <select
                        value={
                            statusFilter
                        }
                        onChange={
                            (
                                event,
                            ) => {
                                const value =
                                    event.currentTarget.value;

                                if (
                                    isCashierTableStatusFilter(
                                        value,
                                    )
                                ) {
                                    setStatusFilter(
                                        value,
                                    );
                                }
                            }
                        }
                    >
                        <option value="ALL">
                            All Tables
                        </option>

                        <option value="AVAILABLE">
                            Available
                        </option>

                        <option value="OCCUPIED">
                            Occupied
                        </option>

                        <option value="RESERVED">
                            Reserved
                        </option>

                        <option value="CLEANING">
                            Cleaning
                        </option>

                        <option value="OUT_OF_SERVICE">
                            Out of Service
                        </option>
                    </select>
                </label>
            </section>

            {
                loading
                    &&
                    tables.length
                    ===
                    0
                    ? (
                        <div className="ctm-state">
                            <div className="ctm-spinner" />

                            <strong>
                                Loading tables...
                            </strong>

                            <span>
                                Retrieving the current
                                restaurant floor status.
                            </span>
                        </div>
                    )
                    : null
            }

            {
                !loading
                    &&
                    tables.length
                    ===
                    0
                    ? (
                        <div className="ctm-state">
                            <div className="ctm-state-icon">
                                TB
                            </div>

                            <strong>
                                No tables found
                            </strong>

                            <span>
                                No restaurant tables were
                                returned by the API.
                            </span>
                        </div>
                    )
                    : null
            }

            {
                !loading
                    &&
                    tables.length
                    >
                    0
                    &&
                    filteredTables.length
                    ===
                    0
                    ? (
                        <div className="ctm-state">
                            <div className="ctm-state-icon">
                                ?
                            </div>

                            <strong>
                                No matching tables
                            </strong>

                            <span>
                                Change the search or status
                                filter to see more tables.
                            </span>
                        </div>
                    )
                    : null
            }

            {
                filteredTables.length
                    >
                    0
                    ? (
                        <section className="ctm-table-grid">
                            {
                                filteredTables.map(
                                    (
                                        table,
                                    ) => {
                                        const session =
                                            table.current_session;

                                        const isOccupied =
                                            table.status
                                            ===
                                            'OCCUPIED';

                                        return (
                                            <article
                                                key={
                                                    table.id
                                                }
                                                className={
                                                    [
                                                        'ctm-table-card',

                                                        `status-${statusClass(
                                                            table.status,
                                                        )}`,

                                                        !table.is_active
                                                            ? 'is-inactive'
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
                                                <div className="ctm-card-header">
                                                    <div className="ctm-table-identity">
                                                        <span className="ctm-table-number">
                                                            {
                                                                String(
                                                                    table.table_number,
                                                                )
                                                                    .padStart(
                                                                        2,
                                                                        '0',
                                                                    )
                                                            }
                                                        </span>

                                                        <div>
                                                            <h3>
                                                                {
                                                                    table.name
                                                                }
                                                            </h3>

                                                            <span className="ctm-table-code">
                                                                {
                                                                    table.code
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <span
                                                        className={
                                                            `ctm-status status-${statusClass(
                                                                table.status,
                                                            )}`
                                                        }
                                                    >
                                                        {
                                                            formatStatus(
                                                                table.status,
                                                            )
                                                        }
                                                    </span>
                                                </div>

                                                <div className="ctm-details-grid">
                                                    <div>
                                                        <span>
                                                            Capacity
                                                        </span>

                                                        <strong>
                                                            {
                                                                table.capacity
                                                            }
                                                            {' '}
                                                            guests
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Area
                                                        </span>

                                                        <strong>
                                                            {
                                                                table.area
                                                                ??
                                                                'Main'
                                                            }
                                                        </strong>
                                                    </div>
                                                </div>

                                                {
                                                    session
                                                        ? (
                                                            <section className="ctm-session-panel">
                                                                <div className="ctm-session-heading">
                                                                    <div>
                                                                        <span className="ctm-session-dot" />

                                                                        <strong>
                                                                            Active Session
                                                                        </strong>
                                                                    </div>

                                                                    <span>
                                                                        {
                                                                            formatStatus(
                                                                                session.status,
                                                                            )
                                                                        }
                                                                    </span>
                                                                </div>

                                                                <div className="ctm-session-grid">
                                                                    <div>
                                                                        <span>
                                                                            Session
                                                                        </span>

                                                                        <strong>
                                                                            {
                                                                                session.session_number
                                                                            }
                                                                        </strong>
                                                                    </div>

                                                                    <div>
                                                                        <span>
                                                                            Guests
                                                                        </span>

                                                                        <strong>
                                                                            {
                                                                                session.guest_count
                                                                            }
                                                                        </strong>
                                                                    </div>

                                                                    <div>
                                                                        <span>
                                                                            Opened By
                                                                        </span>

                                                                        <strong>
                                                                            {
                                                                                formatStatus(
                                                                                    session.opened_source,
                                                                                )
                                                                            }
                                                                        </strong>
                                                                    </div>

                                                                    <div>
                                                                        <span>
                                                                            Started
                                                                        </span>

                                                                        <strong>
                                                                            {
                                                                                formatDateTime(
                                                                                    session.opened_at,
                                                                                )
                                                                            }
                                                                        </strong>
                                                                    </div>
                                                                </div>
                                                            </section>
                                                        )
                                                        : (
                                                            <section className="ctm-no-session">
                                                                <span className="ctm-no-session-icon">
                                                                    {
                                                                        isOccupied
                                                                            ? '!'
                                                                            : '✓'
                                                                    }
                                                                </span>

                                                                <div>
                                                                    <strong>
                                                                        {
                                                                            isOccupied
                                                                                ? 'Session information unavailable'
                                                                                : 'No active session'
                                                                        }
                                                                    </strong>

                                                                    <span>
                                                                        {
                                                                            isOccupied
                                                                                ? 'The table is marked occupied but no active session was returned.'
                                                                                : 'This table currently has no open dining session.'
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </section>
                                                        )
                                                }

                                                <footer className="ctm-card-footer">
                                                    <span
                                                        className={
                                                            table.qr_ordering_enabled
                                                                ? 'ctm-chip enabled'
                                                                : 'ctm-chip disabled'
                                                        }
                                                    >
                                                        QR
                                                        {' '}
                                                        {
                                                            table.qr_ordering_enabled
                                                                ? 'Enabled'
                                                                : 'Disabled'
                                                        }
                                                    </span>

                                                    <span
                                                        className={
                                                            table.is_active
                                                                ? 'ctm-chip active'
                                                                : 'ctm-chip inactive'
                                                        }
                                                    >
                                                        {
                                                            table.is_active
                                                                ? 'Active Table'
                                                                : 'Inactive Table'
                                                        }
                                                    </span>
                                                </footer>

                                                {
                                                    table.notes
                                                        ? (
                                                            <div className="ctm-notes">
                                                                <span>
                                                                    Notes
                                                                </span>

                                                                <p>
                                                                    {
                                                                        table.notes
                                                                    }
                                                                </p>
                                                            </div>
                                                        )
                                                        : null
                                                }
                                            </article>
                                        );
                                    },
                                )
                            }
                        </section>
                    )
                    : null
            }
        </div>
    );
}
