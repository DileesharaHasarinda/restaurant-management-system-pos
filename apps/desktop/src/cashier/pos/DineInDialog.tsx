import {
    useMemo,
    useState,
} from 'react';

import type {
    CashierTable,
} from '../tables/types';

import type {
    DineInSubmissionData,
} from './types';

interface DineInDialogProps {
    tables: CashierTable[];

    onClose: () => void;

    onSubmit: (
        submission: DineInSubmissionData,
    ) => Promise<boolean>;
}

function createClientOrderId(): string {
    if (
        typeof crypto !== 'undefined'
        &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        .replace(
            /[xy]/g,
            (character) => {
                const random =
                    Math.floor(
                        Math.random() * 16,
                    );

                const value =
                    character === 'x'
                        ? random
                        : (random & 0x3) | 0x8;

                return value.toString(16);
            },
        );
}

export default function DineInDialog({
    tables,
    onClose,
    onSubmit,
}: DineInDialogProps) {
    /*
    |--------------------------------------------------------------------------
    | Tables
    |--------------------------------------------------------------------------
    |
    | AVAILABLE:
    | New dine-in session can be opened.
    |
    | OCCUPIED:
    | Existing table session can be reused.
    |
    | Cleaning / out-of-service tables are intentionally excluded.
    |--------------------------------------------------------------------------
    */

    const selectableTables =
        useMemo(
            () =>
                tables
                    .filter(
                        (table) =>
                            table.is_active
                            &&
                            (
                                table.status === 'AVAILABLE'
                                ||
                                table.status === 'OCCUPIED'
                            ),
                    )
                    .sort(
                        (left, right) =>
                            Number(
                                left.sort_order
                                ?? 0,
                            )
                            -
                            Number(
                                right.sort_order
                                ?? 0,
                            ),
                    ),
            [
                tables,
            ],
        );

    const [
        tableId,
        setTableId,
    ] =
        useState<number | null>(
            selectableTables[0]?.id
            ?? null,
        );

    const [
        customerName,
        setCustomerName,
    ] =
        useState(
            '',
        );

    const [
        customerPhone,
        setCustomerPhone,
    ] =
        useState(
            '',
        );

    const [
        notes,
        setNotes,
    ] =
        useState(
            '',
        );

    const [
        clientOrderId,
    ] =
        useState(
            createClientOrderId,
        );

    const [
        submitting,
        setSubmitting,
    ] =
        useState(
            false,
        );

    const [
        localError,
        setLocalError,
    ] =
        useState(
            '',
        );

    const submit =
        async (): Promise<void> => {
            if (
                tableId === null
                ||
                submitting
            ) {
                return;
            }

            setLocalError(
                '',
            );

            setSubmitting(
                true,
            );

            try {
                const success =
                    await onSubmit({
                        clientOrderId,

                        tableId,

                        /*
                         * Guest count is intentionally fixed to 1.
                         *
                         * The cashier dine-in flow no longer asks for guest count.
                         * This preserves the existing backend API contract without
                         * allowing guest count to affect ordered item quantities.
                         */
                        guestCount:
                            1,

                        customerName:
                            customerName.trim()
                            ||
                            null,

                        customerPhone:
                            customerPhone.trim()
                            ||
                            null,

                        notes:
                            notes.trim()
                            ||
                            null,
                    });

                if (
                    success
                ) {
                    onClose();
                }
            } finally {
                setSubmitting(
                    false,
                );
            }
        };

    return (
        <div
            className="pos-feature-dine-in-backdrop"
            role="presentation"
        >
            <section
                className="pos-feature-dine-in-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dine-in-title"
            >
                <header
                    className="pos-feature-dine-in-header"
                >
                    <div>
                        <span
                            className="pos-feature-kicker"
                        >
                            DINE IN
                        </span>

                        <h2
                            id="dine-in-title"
                        >
                            Select Table
                        </h2>

                        <p>
                            Choose the table for this dine-in order.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="pos-feature-dine-in-close"
                        disabled={
                            submitting
                        }
                        onClick={
                            onClose
                        }
                    >
                        ×
                    </button>
                </header>

                <div
                    className="pos-feature-dine-in-body"
                >
                    {
                        localError
                            ? (
                                <div
                                    className="pos-feature-product-warning"
                                >
                                    {
                                        localError
                                    }
                                </div>
                            )
                            : null
                    }

                    {
                        selectableTables.length
                            ===
                            0
                            ? (
                                <div
                                    className="pos-feature-dine-in-empty"
                                >
                                    <strong>
                                        No tables available
                                    </strong>

                                    <span>
                                        No available or occupied table can accept this order.
                                    </span>
                                </div>
                            )
                            : (
                                <div
                                    className="pos-feature-table-grid"
                                >
                                    {
                                        selectableTables.map(
                                            (
                                                table,
                                            ) => {
                                                const selected =
                                                    table.id
                                                    ===
                                                    tableId;

                                                return (
                                                    <button
                                                        key={
                                                            table.id
                                                        }
                                                        type="button"
                                                        className={
                                                            selected
                                                                ? 'pos-feature-table-option active'
                                                                : 'pos-feature-table-option'
                                                        }
                                                        disabled={
                                                            submitting
                                                        }
                                                        onClick={
                                                            () => {
                                                                setTableId(
                                                                    table.id,
                                                                );

                                                                setLocalError(
                                                                    '',
                                                                );
                                                            }
                                                        }
                                                    >
                                                        <div
                                                            className="pos-feature-table-number"
                                                        >
                                                            {
                                                                table.table_number
                                                            }
                                                        </div>

                                                        <strong>
                                                            {
                                                                table.name
                                                                ||
                                                                `Table ${table.table_number}`
                                                            }
                                                        </strong>

                                                        <span>
                                                            {
                                                                table.area
                                                                ||
                                                                'Dining Area'
                                                            }
                                                        </span>

                                                        <small>
                                                            Capacity {
                                                                table.capacity
                                                            }
                                                        </small>

                                                        <b
                                                            className={
                                                                table.status
                                                                    ===
                                                                    'OCCUPIED'
                                                                    ? 'occupied'
                                                                    : 'available'
                                                            }
                                                        >
                                                            {
                                                                table.status
                                                            }
                                                        </b>
                                                    </button>
                                                );
                                            },
                                        )
                                    }
                                </div>
                            )
                    }

                    <div
                        className="pos-feature-dine-in-fields"
                    >
                        <label>
                            <span>
                                Customer Name
                            </span>

                            <input
                                type="text"
                                maxLength={
                                    150
                                }
                                value={
                                    customerName
                                }
                                disabled={
                                    submitting
                                }
                                placeholder="Optional"
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setCustomerName(
                                            event
                                                .target
                                                .value,
                                        )
                                }
                            />
                        </label>

                        <label>
                            <span>
                                Customer Phone
                            </span>

                            <input
                                type="tel"
                                maxLength={
                                    50
                                }
                                value={
                                    customerPhone
                                }
                                disabled={
                                    submitting
                                }
                                placeholder="Optional"
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setCustomerPhone(
                                            event
                                                .target
                                                .value,
                                        )
                                }
                            />
                        </label>

                        <label
                            className="pos-feature-dine-in-notes"
                        >
                            <span>
                                Order Notes
                            </span>

                            <textarea
                                maxLength={
                                    2000
                                }
                                value={
                                    notes
                                }
                                disabled={
                                    submitting
                                }
                                placeholder="Optional dine-in notes..."
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setNotes(
                                            event
                                                .target
                                                .value,
                                        )
                                }
                            />
                        </label>
                    </div>
                </div>

                <footer
                    className="pos-feature-dine-in-footer"
                >
                    <button
                        type="button"
                        className="pos-feature-dine-in-cancel"
                        disabled={
                            submitting
                        }
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="pos-feature-dine-in-submit"
                        disabled={
                            submitting
                            ||
                            tableId === null
                        }
                        onClick={
                            () => {
                                void submit();
                            }
                        }
                    >
                        {
                            submitting
                                ? 'Creating Order...'
                                : 'Create Dine-In Order'
                        }
                    </button>
                </footer>
            </section>
        </div>
    );
}