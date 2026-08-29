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
    createTable,
    downloadTableQr,
    getMergeHistory,
    getTable,
    getTableQr,
    getTableQrSvg,
    getTables,
    getTransferHistory,
    mergeTables,
    printTableQr,
    regenerateTableQr,
    setTableActive,
    transferTable,
    updateQrOrdering,
    updateTable,
    updateTableStatus,
} from "./tableService";

import type {
    ManualTableStatus,
    RestaurantTable,
    TableFormValues,
    TableMerge,
    TableQrToken,
    TableStatus,
    TableTransfer,
} from "./types";

import "./TablesPage.css";

type ViewMode =
    | "GRID"
    | "LIST";

type FormMode =
    | "CREATE"
    | "EDIT";

const EMPTY_FORM:
    TableFormValues = {
    table_number:
        1,

    name:
        "",

    area:
        "",

    capacity:
        4,

    qr_ordering_enabled:
        true,

    is_active:
        true,

    notes:
        "",
};

const MANUAL_STATUSES:
    ManualTableStatus[] = [
        "AVAILABLE",
        "RESERVED",
        "CLEANING",
        "OUT_OF_SERVICE",
    ];

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

    return "The requested table operation could not be completed.";
}

function tableLabel(
    table:
        RestaurantTable
): string {
    return table.name
        ?.trim()
        ||
        `Table ${table.table_number}`;
}

function formatDateTime(
    value:
        string | null
): string {
    if (
        !value
    ) {
        return "-";
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

    return date.toLocaleString(
        "en-LK",
        {
            dateStyle:
                "medium",

            timeStyle:
                "short",
        }
    );
}

function statusLabel(
    status:
        string
): string {
    return status
        .replace(
            /_/g,
            " "
        );
}

export default function TablesPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canView =
        hasPermission(
            "tables.view"
        );

    const canManage =
        hasPermission(
            "tables.manage"
        );

    const canTransfer =
        hasPermission(
            "tables.transfer"
        );

    const canMerge =
        hasPermission(
            "tables.merge"
        );

    const [
        tables,
        setTables,
    ] =
        useState<
            RestaurantTable[]
        >(
            []
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
        working,
        setWorking,
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
        notice,
        setNotice,
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
        areaFilter,
        setAreaFilter,
    ] =
        useState(
            "ALL"
        );

    const [
        statusFilter,
        setStatusFilter,
    ] =
        useState<
            "ALL"
            | TableStatus
        >(
            "ALL"
        );

    const [
        activeFilter,
        setActiveFilter,
    ] =
        useState<
            "ALL"
            | "ACTIVE"
            | "INACTIVE"
        >(
            "ALL"
        );

    const [
        qrFilter,
        setQrFilter,
    ] =
        useState<
            "ALL"
            | "ENABLED"
            | "DISABLED"
        >(
            "ALL"
        );

    const [
        viewMode,
        setViewMode,
    ] =
        useState<ViewMode>(
            "GRID"
        );

    const [
        selected,
        setSelected,
    ] =
        useState<
            RestaurantTable
            | null
        >(
            null
        );

    const [
        formMode,
        setFormMode,
    ] =
        useState<
            FormMode
            | null
        >(
            null
        );

    const [
        form,
        setForm,
    ] =
        useState<TableFormValues>(
            EMPTY_FORM
        );

    const [
        transferOpen,
        setTransferOpen,
    ] =
        useState(
            false
        );

    const [
        transferTarget,
        setTransferTarget,
    ] =
        useState(
            ""
        );

    const [
        transferReason,
        setTransferReason,
    ] =
        useState(
            ""
        );

    const [
        mergeOpen,
        setMergeOpen,
    ] =
        useState(
            false
        );

    const [
        mergeTarget,
        setMergeTarget,
    ] =
        useState(
            ""
        );

    const [
        mergeReason,
        setMergeReason,
    ] =
        useState(
            ""
        );

    const [
        transfers,
        setTransfers,
    ] =
        useState<
            TableTransfer[]
        >(
            []
        );

    const [
        merges,
        setMerges,
    ] =
        useState<
            TableMerge[]
        >(
            []
        );

    const [
        historyLoading,
        setHistoryLoading,
    ] =
        useState(
            false
        );

    const [
        qrOpen,
        setQrOpen,
    ] =
        useState(
            false
        );

    const [
        qrToken,
        setQrToken,
    ] =
        useState<
            TableQrToken
            | null
        >(
            null
        );

    const [
        qrSvg,
        setQrSvg,
    ] =
        useState(
            ""
        );

    const [
        qrLoading,
        setQrLoading,
    ] =
        useState(
            false
        );

    const loadTables =
        useCallback(
            async (
                refresh =
                    false
            ) => {
                if (
                    refresh
                ) {
                    setRefreshing(
                        true
                    );
                }

                try {
                    setError(
                        ""
                    );

                    const result =
                        await getTables();

                    setTables(
                        result
                    );

                    setSelected(
                        (
                            current
                        ) => {
                            if (
                                !current
                            ) {
                                return current;
                            }

                            return result.find(
                                (
                                    table
                                ) =>
                                    table.id
                                    ===
                                    current.id
                            )
                                ??
                                current;
                        }
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

                    setRefreshing(
                        false
                    );
                }
            },
            []
        );

    useEffect(
        () => {
            let cancelled =
                false;

            const loadInitialTables =
                async (): Promise<void> => {
                    try {
                        const result =
                            await getTables();

                        if (
                            cancelled
                        ) {
                            return;
                        }

                        setTables(
                            result
                        );
                    } catch (
                    caught
                    ) {
                        if (
                            cancelled
                        ) {
                            return;
                        }

                        setError(
                            errorMessage(
                                caught
                            )
                        );
                    } finally {
                        if (
                            !cancelled
                        ) {
                            setLoading(
                                false
                            );
                        }
                    }
                };

            void loadInitialTables();

            return () => {
                cancelled =
                    true;
            };
        },
        []
    );

    const areas =
        useMemo(
            () =>
                Array.from(
                    new Set(
                        tables
                            .map(
                                (
                                    table
                                ) =>
                                    table.area
                                        ?.trim()
                            )
                            .filter(
                                (
                                    value
                                ): value is string =>
                                    Boolean(
                                        value
                                    )
                            )
                    )
                )
                    .sort(
                        (
                            first,
                            second
                        ) =>
                            first.localeCompare(
                                second
                            )
                    ),
            [
                tables,
            ]
        );

    const filteredTables =
        useMemo(
            () => {
                const term =
                    search
                        .trim()
                        .toLowerCase();

                return tables.filter(
                    (
                        table
                    ) => {
                        const matchesSearch =
                            !term
                            ||
                            [
                                table.name,
                                table.code,
                                table.area,
                                String(
                                    table.table_number
                                ),
                            ]
                                .filter(
                                    Boolean
                                )
                                .some(
                                    (
                                        value
                                    ) =>
                                        String(
                                            value
                                        )
                                            .toLowerCase()
                                            .includes(
                                                term
                                            )
                                );

                        const matchesArea =
                            areaFilter
                            ===
                            "ALL"
                            ||
                            table.area
                            ===
                            areaFilter;

                        const matchesStatus =
                            statusFilter
                            ===
                            "ALL"
                            ||
                            table.status
                            ===
                            statusFilter;

                        const matchesActive =
                            activeFilter
                            ===
                            "ALL"
                            ||
                            (
                                activeFilter
                                    ===
                                    "ACTIVE"
                                    ? table.is_active
                                    : !table.is_active
                            );

                        const matchesQr =
                            qrFilter
                            ===
                            "ALL"
                            ||
                            (
                                qrFilter
                                    ===
                                    "ENABLED"
                                    ? table.qr_ordering_enabled
                                    : !table.qr_ordering_enabled
                            );

                        return matchesSearch
                            &&
                            matchesArea
                            &&
                            matchesStatus
                            &&
                            matchesActive
                            &&
                            matchesQr;
                    }
                );
            },
            [
                tables,
                search,
                areaFilter,
                statusFilter,
                activeFilter,
                qrFilter,
            ]
        );

    const summary =
        useMemo(
            () => ({
                total:
                    tables.length,

                available:
                    tables.filter(
                        (
                            table
                        ) =>
                            table.status
                            ===
                            "AVAILABLE"
                    ).length,

                occupied:
                    tables.filter(
                        (
                            table
                        ) =>
                            table.status
                            ===
                            "OCCUPIED"
                    ).length,

                reserved:
                    tables.filter(
                        (
                            table
                        ) =>
                            table.status
                            ===
                            "RESERVED"
                    ).length,

                inactive:
                    tables.filter(
                        (
                            table
                        ) =>
                            !table.is_active
                    ).length,
            }),
            [
                tables,
            ]
        );

    const replaceTable =
        (
            table:
                RestaurantTable
        ): void => {
            setTables(
                (
                    current
                ) =>
                    current.map(
                        (
                            item
                        ) =>
                            item.id
                                ===
                                table.id
                                ? table
                                : item
                    )
            );

            setSelected(
                (
                    current
                ) =>
                    current
                        ?.id
                        ===
                        table.id
                        ? table
                        : current
            );
        };

    const openDetails =
        async (
            table:
                RestaurantTable
        ): Promise<void> => {
            setSelected(
                table
            );

            setHistoryLoading(
                true
            );

            try {
                const [
                    fresh,
                    transferResult,
                    mergeResult,
                ] =
                    await Promise.all([
                        getTable(
                            table.id
                        ),

                        getTransferHistory(
                            table.id
                        ),

                        getMergeHistory(
                            table.id
                        ),
                    ]);

                setSelected(
                    fresh
                );

                replaceTable(
                    fresh
                );

                setTransfers(
                    transferResult.items
                );

                setMerges(
                    mergeResult.items
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
                setHistoryLoading(
                    false
                );
            }
        };

    const openCreate =
        (): void => {
            setForm(
                {
                    ...EMPTY_FORM,

                    table_number:
                        (
                            tables.reduce(
                                (
                                    highest,
                                    table
                                ) =>
                                    Math.max(
                                        highest,
                                        table.table_number
                                    ),
                                0
                            )
                            +
                            1
                        ),
                }
            );

            setFormMode(
                "CREATE"
            );
        };

    const openEdit =
        (
            table:
                RestaurantTable
        ): void => {
            setForm({
                table_number:
                    table.table_number,

                name:
                    table.name
                    ??
                    "",

                area:
                    table.area
                    ??
                    "",

                capacity:
                    table.capacity,

                qr_ordering_enabled:
                    table.qr_ordering_enabled,

                is_active:
                    table.is_active,

                notes:
                    table.notes
                    ??
                    "",
            });

            setFormMode(
                "EDIT"
            );

            setSelected(
                table
            );
        };

    const saveTable =
        async (
            event:
                FormEvent
        ): Promise<void> => {
            event.preventDefault();

            if (
                working
            ) {
                return;
            }

            if (
                form.table_number
                <
                1
                ||
                form.capacity
                <
                1
            ) {
                setError(
                    "Table number and capacity must be greater than zero."
                );

                return;
            }

            setWorking(
                true
            );

            setError(
                ""
            );

            try {
                let saved:
                    RestaurantTable;

                if (
                    formMode
                    ===
                    "CREATE"
                ) {
                    saved =
                        await createTable({
                            table_number:
                                form.table_number,

                            name:
                                form.name.trim()
                                ||
                                null,

                            area:
                                form.area.trim()
                                ||
                                null,

                            capacity:
                                form.capacity,

                            qr_ordering_enabled:
                                form.qr_ordering_enabled,

                            notes:
                                form.notes.trim()
                                ||
                                null,
                        });

                    setNotice(
                        "Table created successfully."
                    );
                } else {
                    if (
                        !selected
                    ) {
                        return;
                    }

                    saved =
                        await updateTable(
                            selected.id,
                            {
                                table_number:
                                    form.table_number,

                                name:
                                    form.name.trim()
                                    ||
                                    null,

                                area:
                                    form.area.trim()
                                    ||
                                    null,

                                capacity:
                                    form.capacity,

                                is_active:
                                    form.is_active,

                                notes:
                                    form.notes.trim()
                                    ||
                                    null,
                            }
                        );

                    setNotice(
                        "Table updated successfully."
                    );
                }

                replaceTable(
                    saved
                );

                setSelected(
                    saved
                );

                setFormMode(
                    null
                );

                await loadTables(
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
                setWorking(
                    false
                );
            }
        };

    const changeStatus =
        async (
            table:
                RestaurantTable,

            status:
                ManualTableStatus
        ): Promise<void> => {
            try {
                setWorking(
                    true
                );

                const updated =
                    await updateTableStatus(
                        table.id,
                        status
                    );

                replaceTable(
                    updated
                );

                setNotice(
                    "Table status updated successfully."
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
                setWorking(
                    false
                );
            }
        };

    const toggleActive =
        async (
            table:
                RestaurantTable
        ): Promise<void> => {
            try {
                setWorking(
                    true
                );

                const updated =
                    await setTableActive(
                        table,
                        !table.is_active
                    );

                replaceTable(
                    updated
                );

                setNotice(
                    updated.is_active
                        ? "Table activated successfully."
                        : "Table deactivated successfully."
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
                setWorking(
                    false
                );
            }
        };

    const toggleQr =
        async (
            table:
                RestaurantTable
        ): Promise<void> => {
            try {
                setWorking(
                    true
                );

                const updated =
                    await updateQrOrdering(
                        table.id,
                        !table.qr_ordering_enabled
                    );

                replaceTable(
                    updated
                );

                setNotice(
                    updated.qr_ordering_enabled
                        ? "QR ordering enabled."
                        : "QR ordering disabled."
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
                setWorking(
                    false
                );
            }
        };

    const openQr =
        async (
            table:
                RestaurantTable
        ): Promise<void> => {
            setSelected(
                table
            );

            setQrOpen(
                true
            );

            setQrLoading(
                true
            );

            setQrToken(
                null
            );

            setQrSvg(
                ""
            );

            try {
                const [
                    token,
                    svg,
                ] =
                    await Promise.all([
                        getTableQr(
                            table.id
                        ),

                        getTableQrSvg(
                            table.id
                        ),
                    ]);

                setQrToken(
                    token
                );

                setQrSvg(
                    svg
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
                setQrLoading(
                    false
                );
            }
        };

    const regenerateQr =
        async (): Promise<void> => {
            if (
                !selected
            ) {
                return;
            }

            const confirmed =
                window.confirm(
                    "Regenerate this table QR code?\n\nThe previous QR code will stop working."
                );

            if (
                !confirmed
            ) {
                return;
            }

            try {
                setQrLoading(
                    true
                );

                const token =
                    await regenerateTableQr(
                        selected.id
                    );

                const svg =
                    await getTableQrSvg(
                        selected.id
                    );

                setQrToken(
                    token
                );

                setQrSvg(
                    svg
                );

                setNotice(
                    "Table QR code regenerated successfully."
                );

                await loadTables(
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
                setQrLoading(
                    false
                );
            }
        };

    const availableTransferTargets =
        useMemo(
            () =>
                tables.filter(
                    (
                        table
                    ) =>
                        table.is_active
                        &&
                        table.status
                        ===
                        "AVAILABLE"
                        &&
                        !table.current_session
                        &&
                        table.id
                        !==
                        selected
                            ?.id
                ),
            [
                tables,
                selected,
            ]
        );

    const mergeTargets =
        useMemo(
            () =>
                tables.filter(
                    (
                        table
                    ) =>
                        table.is_active
                        &&
                        table.status
                        ===
                        "OCCUPIED"
                        &&
                        Boolean(
                            table.current_session
                        )
                        &&
                        table.id
                        !==
                        selected
                            ?.id
                ),
            [
                tables,
                selected,
            ]
        );

    const submitTransfer =
        async (
            event:
                FormEvent
        ): Promise<void> => {
            event.preventDefault();

            if (
                !selected
                ||
                !transferTarget
            ) {
                return;
            }

            try {
                setWorking(
                    true
                );

                await transferTable(
                    selected.id,
                    {
                        to_table_id:
                            Number(
                                transferTarget
                            ),

                        reason:
                            transferReason.trim()
                            ||
                            null,
                    }
                );

                setTransferOpen(
                    false
                );

                setTransferTarget(
                    ""
                );

                setTransferReason(
                    ""
                );

                setSelected(
                    null
                );

                setNotice(
                    "Table transferred successfully."
                );

                await loadTables(
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
                setWorking(
                    false
                );
            }
        };

    const submitMerge =
        async (
            event:
                FormEvent
        ): Promise<void> => {
            event.preventDefault();

            if (
                !selected
                ||
                !mergeTarget
            ) {
                return;
            }

            try {
                setWorking(
                    true
                );

                await mergeTables(
                    selected.id,
                    {
                        secondary_table_id:
                            Number(
                                mergeTarget
                            ),

                        reason:
                            mergeReason.trim()
                            ||
                            null,
                    }
                );

                setMergeOpen(
                    false
                );

                setMergeTarget(
                    ""
                );

                setMergeReason(
                    ""
                );

                setSelected(
                    null
                );

                setNotice(
                    "Tables merged successfully."
                );

                await loadTables(
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
                setWorking(
                    false
                );
            }
        };

    if (
        !canView
    ) {
        return (
            <section className="tables-page">
                <div className="tables-empty">
                    <h2>
                        Access Denied
                    </h2>

                    <p>
                        You do not have permission
                        to view restaurant tables.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="tables-page">
            <header className="tables-heading">
                <div>
                    <span>
                        RESTAURANT OPERATIONS
                    </span>

                    <h2>
                        Tables Management
                    </h2>

                    <p>
                        Manage restaurant tables,
                        live sessions, QR ordering,
                        transfers and merges.
                    </p>
                </div>

                <div className="tables-heading-actions">
                    <button
                        type="button"
                        className="tables-secondary-button"
                        disabled={
                            refreshing
                        }
                        onClick={
                            () => {
                                void loadTables(
                                    true
                                );
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
                            ? (
                                <button
                                    type="button"
                                    className="tables-primary-button"
                                    onClick={
                                        openCreate
                                    }
                                >
                                    + Add Table
                                </button>
                            )
                            : null
                    }
                </div>
            </header>

            {
                error
                    ? (
                        <div className="tables-alert error">
                            {error}
                        </div>
                    )
                    : null
            }

            {
                notice
                    ? (
                        <div className="tables-alert success">
                            <span>
                                {notice}
                            </span>

                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setNotice(
                                            ""
                                        )
                                }
                            >
                                ×
                            </button>
                        </div>
                    )
                    : null
            }

            <div className="tables-summary">
                <SummaryCard
                    label="Total Tables"
                    value={
                        summary.total
                    }
                />

                <SummaryCard
                    label="Available"
                    value={
                        summary.available
                    }
                    tone="available"
                />

                <SummaryCard
                    label="Occupied"
                    value={
                        summary.occupied
                    }
                    tone="occupied"
                />

                <SummaryCard
                    label="Reserved"
                    value={
                        summary.reserved
                    }
                    tone="reserved"
                />

                <SummaryCard
                    label="Inactive"
                    value={
                        summary.inactive
                    }
                    tone="inactive"
                />
            </div>

            <section className="tables-toolbar">
                <input
                    type="search"
                    placeholder="Search table, code or area..."
                    value={
                        search
                    }
                    onChange={
                        (
                            event
                        ) =>
                            setSearch(
                                event.target.value
                            )
                    }
                />

                <select
                    value={
                        areaFilter
                    }
                    onChange={
                        (
                            event
                        ) =>
                            setAreaFilter(
                                event.target.value
                            )
                    }
                >
                    <option value="ALL">
                        All Areas
                    </option>

                    {
                        areas.map(
                            (
                                area
                            ) => (
                                <option
                                    key={
                                        area
                                    }
                                    value={
                                        area
                                    }
                                >
                                    {area}
                                </option>
                            )
                        )
                    }
                </select>

                <select
                    value={
                        statusFilter
                    }
                    onChange={
                        (
                            event
                        ) =>
                            setStatusFilter(
                                event.target.value as
                                | "ALL"
                                | TableStatus
                            )
                    }
                >
                    <option value="ALL">
                        All Statuses
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

                <select
                    value={
                        activeFilter
                    }
                    onChange={
                        (
                            event
                        ) =>
                            setActiveFilter(
                                event.target.value as
                                typeof activeFilter
                            )
                    }
                >
                    <option value="ALL">
                        Active & Inactive
                    </option>

                    <option value="ACTIVE">
                        Active
                    </option>

                    <option value="INACTIVE">
                        Inactive
                    </option>
                </select>

                <select
                    value={
                        qrFilter
                    }
                    onChange={
                        (
                            event
                        ) =>
                            setQrFilter(
                                event.target.value as
                                typeof qrFilter
                            )
                    }
                >
                    <option value="ALL">
                        All QR States
                    </option>

                    <option value="ENABLED">
                        QR Enabled
                    </option>

                    <option value="DISABLED">
                        QR Disabled
                    </option>
                </select>

                <div className="tables-view-switch">
                    <button
                        type="button"
                        className={
                            viewMode
                                ===
                                "GRID"
                                ? "active"
                                : ""
                        }
                        onClick={
                            () =>
                                setViewMode(
                                    "GRID"
                                )
                        }
                    >
                        Grid
                    </button>

                    <button
                        type="button"
                        className={
                            viewMode
                                ===
                                "LIST"
                                ? "active"
                                : ""
                        }
                        onClick={
                            () =>
                                setViewMode(
                                    "LIST"
                                )
                        }
                    >
                        List
                    </button>
                </div>
            </section>

            {
                loading
                    ? (
                        <div className="tables-empty">
                            Loading restaurant tables...
                        </div>
                    )
                    : filteredTables.length
                        ===
                        0
                        ? (
                            <div className="tables-empty">
                                <h3>
                                    No tables found
                                </h3>

                                <p>
                                    Try changing the current
                                    filters or add a new table.
                                </p>
                            </div>
                        )
                        : (
                            <div
                                className={
                                    viewMode
                                        ===
                                        "GRID"
                                        ? "tables-grid"
                                        : "tables-list"
                                }
                            >
                                {
                                    filteredTables.map(
                                        (
                                            table
                                        ) => (
                                            <TableCard
                                                key={
                                                    table.id
                                                }
                                                table={
                                                    table
                                                }
                                                list={
                                                    viewMode
                                                    ===
                                                    "LIST"
                                                }
                                                onView={
                                                    () => {
                                                        void openDetails(
                                                            table
                                                        );
                                                    }
                                                }
                                                onEdit={
                                                    canManage
                                                        ? () =>
                                                            openEdit(
                                                                table
                                                            )
                                                        : undefined
                                                }
                                            />
                                        )
                                    )
                                }
                            </div>
                        )
            }

            {
                selected
                    &&
                    !formMode
                    &&
                    !qrOpen
                    &&
                    !transferOpen
                    &&
                    !mergeOpen
                    ? (
                        <div className="tables-drawer-backdrop">
                            <aside className="tables-drawer">
                                <header className="tables-drawer-header">
                                    <div>
                                        <span>
                                            TABLE DETAILS
                                        </span>

                                        <h2>
                                            {
                                                tableLabel(
                                                    selected
                                                )
                                            }
                                        </h2>

                                        <p>
                                            {
                                                selected.area
                                                ??
                                                "No area assigned"
                                            }
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            () =>
                                                setSelected(
                                                    null
                                                )
                                        }
                                    >
                                        ×
                                    </button>
                                </header>

                                <div className="tables-drawer-body">
                                    <section className="tables-detail-section">
                                        <div className="tables-detail-heading">
                                            <h3>
                                                Overview
                                            </h3>

                                            {
                                                canManage
                                                    ? (
                                                        <button
                                                            type="button"
                                                            onClick={
                                                                () =>
                                                                    openEdit(
                                                                        selected
                                                                    )
                                                            }
                                                        >
                                                            Edit
                                                        </button>
                                                    )
                                                    : null
                                            }
                                        </div>

                                        <DetailRow
                                            label="Table Number"
                                            value={
                                                String(
                                                    selected.table_number
                                                )
                                            }
                                        />

                                        <DetailRow
                                            label="Code"
                                            value={
                                                selected.code
                                                ||
                                                "-"
                                            }
                                        />

                                        <DetailRow
                                            label="Area"
                                            value={
                                                selected.area
                                                ??
                                                "-"
                                            }
                                        />

                                        <DetailRow
                                            label="Capacity"
                                            value={
                                                `${selected.capacity} seats`
                                            }
                                        />

                                        <DetailRow
                                            label="Status"
                                            value={
                                                statusLabel(
                                                    selected.status
                                                )
                                            }
                                        />

                                        <DetailRow
                                            label="Active"
                                            value={
                                                selected.is_active
                                                    ? "Yes"
                                                    : "No"
                                            }
                                        />

                                        <DetailRow
                                            label="QR Ordering"
                                            value={
                                                selected.qr_ordering_enabled
                                                    ? "Enabled"
                                                    : "Disabled"
                                            }
                                        />

                                        {
                                            selected.notes
                                                ? (
                                                    <DetailRow
                                                        label="Notes"
                                                        value={
                                                            selected.notes
                                                        }
                                                    />
                                                )
                                                : null
                                        }

                                        {
                                            canManage
                                                ? (
                                                    <div className="tables-management-actions">
                                                        {
                                                            selected.status
                                                                !==
                                                                "OCCUPIED"
                                                                ? (
                                                                    <label>
                                                                        <span>
                                                                            Operational Status
                                                                        </span>

                                                                        <select
                                                                            value={
                                                                                selected.status
                                                                            }
                                                                            disabled={
                                                                                working
                                                                            }
                                                                            onChange={
                                                                                (
                                                                                    event
                                                                                ) => {
                                                                                    void changeStatus(
                                                                                        selected,
                                                                                        event.target.value as ManualTableStatus
                                                                                    );
                                                                                }
                                                                            }
                                                                        >
                                                                            {
                                                                                MANUAL_STATUSES.map(
                                                                                    (
                                                                                        status
                                                                                    ) => (
                                                                                        <option
                                                                                            key={
                                                                                                status
                                                                                            }
                                                                                            value={
                                                                                                status
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                statusLabel(
                                                                                                    status
                                                                                                )
                                                                                            }
                                                                                        </option>
                                                                                    )
                                                                                )
                                                                            }
                                                                        </select>
                                                                    </label>
                                                                )
                                                                : (
                                                                    <div className="tables-session-controlled">
                                                                        OCCUPIED is controlled automatically by the active table session.
                                                                    </div>
                                                                )
                                                        }

                                                        <button
                                                            type="button"
                                                            className="tables-secondary-button"
                                                            disabled={
                                                                working
                                                            }
                                                            onClick={
                                                                () => {
                                                                    void toggleActive(
                                                                        selected
                                                                    );
                                                                }
                                                            }
                                                        >
                                                            {
                                                                selected.is_active
                                                                    ? "Deactivate Table"
                                                                    : "Activate Table"
                                                            }
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="tables-secondary-button"
                                                            disabled={
                                                                working
                                                            }
                                                            onClick={
                                                                () => {
                                                                    void toggleQr(
                                                                        selected
                                                                    );
                                                                }
                                                            }
                                                        >
                                                            {
                                                                selected.qr_ordering_enabled
                                                                    ? "Disable QR Ordering"
                                                                    : "Enable QR Ordering"
                                                            }
                                                        </button>
                                                    </div>
                                                )
                                                : null
                                        }
                                    </section>

                                    <section className="tables-detail-section">
                                        <div className="tables-detail-heading">
                                            <h3>
                                                Current Session
                                            </h3>

                                            <span
                                                className={
                                                    selected.current_session
                                                        ? "tables-session-live"
                                                        : "tables-session-none"
                                                }
                                            >
                                                {
                                                    selected.current_session
                                                        ? "LIVE"
                                                        : "NO SESSION"
                                                }
                                            </span>
                                        </div>

                                        {
                                            selected.current_session
                                                ? (
                                                    <>
                                                        <DetailRow
                                                            label="Session"
                                                            value={
                                                                selected.current_session.session_number
                                                            }
                                                        />

                                                        <DetailRow
                                                            label="Guests"
                                                            value={
                                                                String(
                                                                    selected.current_session.guest_count
                                                                )
                                                            }
                                                        />

                                                        <DetailRow
                                                            label="Source"
                                                            value={
                                                                statusLabel(
                                                                    selected.current_session.opened_source
                                                                )
                                                            }
                                                        />

                                                        <DetailRow
                                                            label="Opened"
                                                            value={
                                                                formatDateTime(
                                                                    selected.current_session.opened_at
                                                                )
                                                            }
                                                        />

                                                        <DetailRow
                                                            label="Last Activity"
                                                            value={
                                                                formatDateTime(
                                                                    selected.current_session.last_activity_at
                                                                )
                                                            }
                                                        />

                                                        <DetailRow
                                                            label="Business Day"
                                                            value={
                                                                `#${selected.current_session.business_day_id}`
                                                            }
                                                        />

                                                        <DetailRow
                                                            label="Bill Requested"
                                                            value={
                                                                selected.current_session.bill_requested
                                                                    ? "Yes"
                                                                    : "No"
                                                            }
                                                        />

                                                        {
                                                            selected.current_session.bill_requested_at
                                                                ? (
                                                                    <DetailRow
                                                                        label="Requested At"
                                                                        value={
                                                                            formatDateTime(
                                                                                selected.current_session.bill_requested_at
                                                                            )
                                                                        }
                                                                    />
                                                                )
                                                                : null
                                                        }

                                                        <div className="tables-session-actions">
                                                            {
                                                                canTransfer
                                                                    ? (
                                                                        <button
                                                                            type="button"
                                                                            className="tables-secondary-button"
                                                                            onClick={
                                                                                () =>
                                                                                    setTransferOpen(
                                                                                        true
                                                                                    )
                                                                            }
                                                                        >
                                                                            Transfer Table
                                                                        </button>
                                                                    )
                                                                    : null
                                                            }

                                                            {
                                                                canMerge
                                                                    ? (
                                                                        <button
                                                                            type="button"
                                                                            className="tables-secondary-button"
                                                                            onClick={
                                                                                () =>
                                                                                    setMergeOpen(
                                                                                        true
                                                                                    )
                                                                            }
                                                                        >
                                                                            Merge Tables
                                                                        </button>
                                                                    )
                                                                    : null
                                                            }
                                                        </div>
                                                    </>
                                                )
                                                : (
                                                    <p className="tables-muted">
                                                        This table has no open session.
                                                    </p>
                                                )
                                        }
                                    </section>

                                    <section className="tables-detail-section">
                                        <div className="tables-detail-heading">
                                            <h3>
                                                QR Ordering
                                            </h3>
                                        </div>

                                        <div className="tables-qr-actions">
                                            <button
                                                type="button"
                                                className="tables-primary-button"
                                                onClick={
                                                    () => {
                                                        void openQr(
                                                            selected
                                                        );
                                                    }
                                                }
                                            >
                                                View QR Code
                                            </button>

                                            <button
                                                type="button"
                                                className="tables-secondary-button"
                                                onClick={
                                                    () => {
                                                        void downloadTableQr(
                                                            selected
                                                        ).catch(
                                                            (
                                                                caught
                                                            ) =>
                                                                setError(
                                                                    errorMessage(
                                                                        caught
                                                                    )
                                                                )
                                                        );
                                                    }
                                                }
                                            >
                                                Download
                                            </button>

                                            <button
                                                type="button"
                                                className="tables-secondary-button"
                                                onClick={
                                                    () => {
                                                        void printTableQr(
                                                            selected.id
                                                        ).catch(
                                                            (
                                                                caught
                                                            ) =>
                                                                setError(
                                                                    errorMessage(
                                                                        caught
                                                                    )
                                                                )
                                                        );
                                                    }
                                                }
                                            >
                                                Print
                                            </button>
                                        </div>
                                    </section>

                                    <section className="tables-detail-section">
                                        <div className="tables-detail-heading">
                                            <h3>
                                                Transfer History
                                            </h3>

                                            <span>
                                                {transfers.length}
                                            </span>
                                        </div>

                                        {
                                            historyLoading
                                                ? (
                                                    <p className="tables-muted">
                                                        Loading history...
                                                    </p>
                                                )
                                                : transfers.length === 0
                                                    ? (
                                                        <p className="tables-muted">
                                                            No table transfers recorded.
                                                        </p>
                                                    )
                                                    : (
                                                        <div className="tables-history">
                                                            {
                                                                transfers.map(
                                                                    (
                                                                        transfer
                                                                    ) => (
                                                                        <HistoryItem
                                                                            key={
                                                                                `transfer-${transfer.id}`
                                                                            }
                                                                            title={
                                                                                (
                                                                                    transfer.from_table.name
                                                                                    ??
                                                                                    `Table ${transfer.from_table.table_number
                                                                                    ??
                                                                                    "-"
                                                                                    }`
                                                                                )
                                                                                +
                                                                                " → "
                                                                                +
                                                                                (
                                                                                    transfer.to_table.name
                                                                                    ??
                                                                                    `Table ${transfer.to_table.table_number
                                                                                    ??
                                                                                    "-"
                                                                                    }`
                                                                                )
                                                                            }
                                                                            reason={
                                                                                transfer.reason
                                                                            }
                                                                            user={
                                                                                transfer.transferred_by
                                                                                    ?.name
                                                                                ??
                                                                                null
                                                                            }
                                                                            date={
                                                                                transfer.transferred_at
                                                                            }
                                                                        />
                                                                    )
                                                                )
                                                            }
                                                        </div>
                                                    )
                                        }
                                    </section>

                                    <section className="tables-detail-section">
                                        <div className="tables-detail-heading">
                                            <h3>
                                                Merge History
                                            </h3>

                                            <span>
                                                {merges.length}
                                            </span>
                                        </div>

                                        {
                                            historyLoading
                                                ? (
                                                    <p className="tables-muted">
                                                        Loading history...
                                                    </p>
                                                )
                                                : merges.length === 0
                                                    ? (
                                                        <p className="tables-muted">
                                                            No table merges recorded.
                                                        </p>
                                                    )
                                                    : (
                                                        <div className="tables-history">
                                                            {
                                                                merges.map(
                                                                    (
                                                                        merge
                                                                    ) => (
                                                                        <HistoryItem
                                                                            key={
                                                                                `merge-${merge.id}`
                                                                            }
                                                                            title={
                                                                                (
                                                                                    merge.source_table.name
                                                                                    ??
                                                                                    `Table ${merge.source_table.table_number
                                                                                    ??
                                                                                    "-"
                                                                                    }`
                                                                                )
                                                                                +
                                                                                " → "
                                                                                +
                                                                                (
                                                                                    merge.target_table.name
                                                                                    ??
                                                                                    `Table ${merge.target_table.table_number
                                                                                    ??
                                                                                    "-"
                                                                                    }`
                                                                                )
                                                                            }
                                                                            reason={
                                                                                merge.reason
                                                                            }
                                                                            user={
                                                                                merge.merged_by
                                                                                    ?.name
                                                                                ??
                                                                                null
                                                                            }
                                                                            date={
                                                                                merge.merged_at
                                                                            }
                                                                        />
                                                                    )
                                                                )
                                                            }
                                                        </div>
                                                    )
                                        }
                                    </section>
                                </div>
                            </aside>
                        </div>
                    )
                    : null
            }

            {
                formMode
                    ? (
                        <Modal
                            title={
                                formMode
                                    ===
                                    "CREATE"
                                    ? "Add Restaurant Table"
                                    : "Edit Restaurant Table"
                            }
                            onClose={
                                () =>
                                    setFormMode(
                                        null
                                    )
                            }
                        >
                            <form
                                className="tables-form"
                                onSubmit={
                                    (
                                        event
                                    ) => {
                                        void saveTable(
                                            event
                                        );
                                    }
                                }
                            >
                                <label>
                                    <span>
                                        Table Number *
                                    </span>

                                    <input
                                        type="number"
                                        min="1"
                                        max="9999"
                                        required
                                        value={
                                            form.table_number
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setForm(
                                                    (
                                                        current
                                                    ) => ({
                                                        ...current,

                                                        table_number:
                                                            Number(
                                                                event.target.value
                                                            ),
                                                    })
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Name
                                    </span>

                                    <input
                                        type="text"
                                        maxLength={
                                            100
                                        }
                                        placeholder="e.g. Window Table"
                                        value={
                                            form.name
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setForm(
                                                    (
                                                        current
                                                    ) => ({
                                                        ...current,

                                                        name:
                                                            event.target.value,
                                                    })
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Area
                                    </span>

                                    <input
                                        type="text"
                                        maxLength={
                                            100
                                        }
                                        placeholder="e.g. Main Hall"
                                        value={
                                            form.area
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setForm(
                                                    (
                                                        current
                                                    ) => ({
                                                        ...current,

                                                        area:
                                                            event.target.value,
                                                    })
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Capacity *
                                    </span>

                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        required
                                        value={
                                            form.capacity
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setForm(
                                                    (
                                                        current
                                                    ) => ({
                                                        ...current,

                                                        capacity:
                                                            Number(
                                                                event.target.value
                                                            ),
                                                    })
                                                )
                                        }
                                    />
                                </label>

                                {
                                    formMode
                                        ===
                                        "CREATE"
                                        ? (
                                            <label className="tables-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        form.qr_ordering_enabled
                                                    }
                                                    onChange={
                                                        (
                                                            event
                                                        ) =>
                                                            setForm(
                                                                (
                                                                    current
                                                                ) => ({
                                                                    ...current,

                                                                    qr_ordering_enabled:
                                                                        event.target.checked,
                                                                })
                                                            )
                                                    }
                                                />

                                                <span>
                                                    Enable QR ordering
                                                </span>
                                            </label>
                                        )
                                        : (
                                            <label className="tables-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        form.is_active
                                                    }
                                                    onChange={
                                                        (
                                                            event
                                                        ) =>
                                                            setForm(
                                                                (
                                                                    current
                                                                ) => ({
                                                                    ...current,

                                                                    is_active:
                                                                        event.target.checked,
                                                                })
                                                            )
                                                    }
                                                />

                                                <span>
                                                    Table is active
                                                </span>
                                            </label>
                                        )
                                }

                                <label className="tables-form-wide">
                                    <span>
                                        Notes
                                    </span>

                                    <textarea
                                        rows={
                                            4
                                        }
                                        maxLength={
                                            1000
                                        }
                                        value={
                                            form.notes
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setForm(
                                                    (
                                                        current
                                                    ) => ({
                                                        ...current,

                                                        notes:
                                                            event.target.value,
                                                    })
                                                )
                                        }
                                    />
                                </label>

                                <div className="tables-modal-actions tables-form-wide">
                                    <button
                                        type="button"
                                        className="tables-secondary-button"
                                        onClick={
                                            () =>
                                                setFormMode(
                                                    null
                                                )
                                        }
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        className="tables-primary-button"
                                        disabled={
                                            working
                                        }
                                    >
                                        {
                                            working
                                                ? "Saving..."
                                                : (
                                                    formMode
                                                        ===
                                                        "CREATE"
                                                        ? "Create Table"
                                                        : "Save Changes"
                                                )
                                        }
                                    </button>
                                </div>
                            </form>
                        </Modal>
                    )
                    : null
            }

            {
                qrOpen
                    &&
                    selected
                    ? (
                        <Modal
                            title={
                                `${tableLabel(
                                    selected
                                )} QR Code`
                            }
                            onClose={
                                () =>
                                    setQrOpen(
                                        false
                                    )
                            }
                        >
                            <div className="tables-qr-modal">
                                {
                                    qrLoading
                                        ? (
                                            <div className="tables-empty">
                                                Loading QR code...
                                            </div>
                                        )
                                        : (
                                            <>
                                                <div
                                                    className="tables-qr-preview"
                                                    dangerouslySetInnerHTML={{
                                                        __html:
                                                            qrSvg,
                                                    }}
                                                />

                                                {
                                                    qrToken
                                                        ? (
                                                            <div className="tables-qr-url">
                                                                <span>
                                                                    Customer Ordering URL
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        qrToken.order_url
                                                                    }
                                                                </strong>
                                                            </div>
                                                        )
                                                        : null
                                                }

                                                <div className="tables-modal-actions">
                                                    <button
                                                        type="button"
                                                        className="tables-secondary-button"
                                                        onClick={
                                                            () => {
                                                                void downloadTableQr(
                                                                    selected
                                                                );
                                                            }
                                                        }
                                                    >
                                                        Download
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="tables-secondary-button"
                                                        onClick={
                                                            () => {
                                                                void printTableQr(
                                                                    selected.id
                                                                );
                                                            }
                                                        }
                                                    >
                                                        Print
                                                    </button>

                                                    {
                                                        canManage
                                                            ? (
                                                                <button
                                                                    type="button"
                                                                    className="tables-danger-button"
                                                                    disabled={
                                                                        qrLoading
                                                                    }
                                                                    onClick={
                                                                        () => {
                                                                            void regenerateQr();
                                                                        }
                                                                    }
                                                                >
                                                                    Regenerate QR
                                                                </button>
                                                            )
                                                            : null
                                                    }
                                                </div>
                                            </>
                                        )
                                }
                            </div>
                        </Modal>
                    )
                    : null
            }

            {
                transferOpen
                    &&
                    selected
                    ? (
                        <Modal
                            title={
                                `Transfer ${tableLabel(
                                    selected
                                )}`
                            }
                            onClose={
                                () =>
                                    setTransferOpen(
                                        false
                                    )
                            }
                        >
                            <form
                                className="tables-simple-form"
                                onSubmit={
                                    (
                                        event
                                    ) => {
                                        void submitTransfer(
                                            event
                                        );
                                    }
                                }
                            >
                                <label>
                                    <span>
                                        Destination Table *
                                    </span>

                                    <select
                                        required
                                        value={
                                            transferTarget
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setTransferTarget(
                                                    event.target.value
                                                )
                                        }
                                    >
                                        <option value="">
                                            Select available table
                                        </option>

                                        {
                                            availableTransferTargets.map(
                                                (
                                                    table
                                                ) => (
                                                    <option
                                                        key={
                                                            table.id
                                                        }
                                                        value={
                                                            table.id
                                                        }
                                                    >
                                                        {
                                                            tableLabel(
                                                                table
                                                            )
                                                        }
                                                        {" · "}
                                                        {
                                                            table.capacity
                                                        }
                                                        {" seats"}
                                                    </option>
                                                )
                                            )
                                        }
                                    </select>
                                </label>

                                <label>
                                    <span>
                                        Reason
                                    </span>

                                    <textarea
                                        rows={
                                            3
                                        }
                                        maxLength={
                                            255
                                        }
                                        value={
                                            transferReason
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setTransferReason(
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>

                                <div className="tables-modal-actions">
                                    <button
                                        type="button"
                                        className="tables-secondary-button"
                                        onClick={
                                            () =>
                                                setTransferOpen(
                                                    false
                                                )
                                        }
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        className="tables-primary-button"
                                        disabled={
                                            working
                                            ||
                                            !transferTarget
                                        }
                                    >
                                        {
                                            working
                                                ? "Transferring..."
                                                : "Transfer Table"
                                        }
                                    </button>
                                </div>
                            </form>
                        </Modal>
                    )
                    : null
            }

            {
                mergeOpen
                    &&
                    selected
                    ? (
                        <Modal
                            title={
                                `Merge Into ${tableLabel(
                                    selected
                                )}`
                            }
                            onClose={
                                () =>
                                    setMergeOpen(
                                        false
                                    )
                            }
                        >
                            <form
                                className="tables-simple-form"
                                onSubmit={
                                    (
                                        event
                                    ) => {
                                        void submitMerge(
                                            event
                                        );
                                    }
                                }
                            >
                                <p className="tables-modal-explanation">
                                    The selected table remains the
                                    primary billing table. Choose the
                                    occupied table that should be
                                    merged into it.
                                </p>

                                <label>
                                    <span>
                                        Secondary Table *
                                    </span>

                                    <select
                                        required
                                        value={
                                            mergeTarget
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setMergeTarget(
                                                    event.target.value
                                                )
                                        }
                                    >
                                        <option value="">
                                            Select occupied table
                                        </option>

                                        {
                                            mergeTargets.map(
                                                (
                                                    table
                                                ) => (
                                                    <option
                                                        key={
                                                            table.id
                                                        }
                                                        value={
                                                            table.id
                                                        }
                                                    >
                                                        {
                                                            tableLabel(
                                                                table
                                                            )
                                                        }
                                                        {" · "}
                                                        {
                                                            table.current_session
                                                                ?.guest_count
                                                            ??
                                                            0
                                                        }
                                                        {" guests"}
                                                    </option>
                                                )
                                            )
                                        }
                                    </select>
                                </label>

                                <label>
                                    <span>
                                        Reason
                                    </span>

                                    <textarea
                                        rows={
                                            3
                                        }
                                        maxLength={
                                            255
                                        }
                                        value={
                                            mergeReason
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setMergeReason(
                                                    event.target.value
                                                )
                                        }
                                    />
                                </label>

                                <div className="tables-modal-actions">
                                    <button
                                        type="button"
                                        className="tables-secondary-button"
                                        onClick={
                                            () =>
                                                setMergeOpen(
                                                    false
                                                )
                                        }
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        className="tables-primary-button"
                                        disabled={
                                            working
                                            ||
                                            !mergeTarget
                                        }
                                    >
                                        {
                                            working
                                                ? "Merging..."
                                                : "Merge Tables"
                                        }
                                    </button>
                                </div>
                            </form>
                        </Modal>
                    )
                    : null
            }
        </section>
    );
}

function SummaryCard(
    {
        label,
        value,
        tone = "",
    }: {
        label:
        string;

        value:
        number;

        tone?:
        string;
    }
) {
    return (
        <article
            className={
                `tables-summary-card ${tone}`
            }
        >
            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>
        </article>
    );
}

function TableCard(
    {
        table,
        list,
        onView,
        onEdit,
    }: {
        table:
        RestaurantTable;

        list:
        boolean;

        onView:
        () => void;

        onEdit?:
        () => void;
    }
) {
    return (
        <article
            className={
                list
                    ? "tables-card list"
                    : "tables-card"
            }
        >
            <div className="tables-card-top">
                <div>
                    <span className="tables-card-number">
                        TABLE {
                            String(
                                table.table_number
                            ).padStart(
                                2,
                                "0"
                            )
                        }
                    </span>

                    <h3>
                        {
                            tableLabel(
                                table
                            )
                        }
                    </h3>

                    <p>
                        {
                            table.area
                            ??
                            "No area"
                        }
                    </p>
                </div>

                <span
                    className={
                        `tables-status ${table.status.toLowerCase()}`
                    }
                >
                    {
                        statusLabel(
                            table.status
                        )
                    }
                </span>
            </div>

            <div className="tables-card-meta">
                <span>
                    {
                        table.capacity
                    }
                    {" "}
                    seats
                </span>

                <span
                    className={
                        table.qr_ordering_enabled
                            ? "enabled"
                            : "disabled"
                    }
                >
                    QR {
                        table.qr_ordering_enabled
                            ? "ON"
                            : "OFF"
                    }
                </span>

                {
                    !table.is_active
                        ? (
                            <span className="inactive">
                                INACTIVE
                            </span>
                        )
                        : null
                }
            </div>

            {
                table.current_session
                    ? (
                        <div className="tables-card-session">
                            <strong>
                                {
                                    table.current_session.session_number
                                }
                            </strong>

                            <span>
                                {
                                    table.current_session.guest_count
                                }
                                {" guests"}
                            </span>

                            {
                                table.current_session.bill_requested
                                    ? (
                                        <span className="bill-requested">
                                            Bill Requested
                                        </span>
                                    )
                                    : null
                            }
                        </div>
                    )
                    : null
            }

            <div className="tables-card-actions">
                <button
                    type="button"
                    className="tables-primary-button"
                    onClick={
                        onView
                    }
                >
                    View
                </button>

                {
                    onEdit
                        ? (
                            <button
                                type="button"
                                className="tables-secondary-button"
                                onClick={
                                    onEdit
                                }
                            >
                                Edit
                            </button>
                        )
                        : null
                }
            </div>
        </article>
    );
}

function DetailRow(
    {
        label,
        value,
    }: {
        label:
        string;

        value:
        string;
    }
) {
    return (
        <div className="tables-detail-row">
            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>
        </div>
    );
}

function HistoryItem(
    {
        title,
        reason,
        user,
        date,
    }: {
        title:
        string;

        reason:
        string | null;

        user:
        string | null;

        date:
        string | null;
    }
) {
    return (
        <article className="tables-history-item">
            <strong>
                {title}
            </strong>

            {
                reason
                    ? (
                        <p>
                            {reason}
                        </p>
                    )
                    : null
            }

            <span>
                {
                    user
                    ??
                    "Unknown user"
                }
                {" · "}
                {
                    formatDateTime(
                        date
                    )
                }
            </span>
        </article>
    );
}

function Modal(
    {
        title,
        children,
        onClose,
    }: {
        title:
        string;

        children:
        React.ReactNode;

        onClose:
        () => void;
    }
) {
    return (
        <div className="tables-modal-backdrop">
            <section className="tables-modal">
                <header className="tables-modal-header">
                    <h2>
                        {title}
                    </h2>

                    <button
                        type="button"
                        onClick={
                            onClose
                        }
                    >
                        ×
                    </button>
                </header>

                <div className="tables-modal-body">
                    {children}
                </div>
            </section>
        </div>
    );
}