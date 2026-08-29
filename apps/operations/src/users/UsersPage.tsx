import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";

import {
    useAuth,
} from "../auth/useAuth";

import {
    assignUserRole,
    createUser,
    getPermissions,
    getRoles,
    getUser,
    getUsers,
    getUserSessions,
    revokeAllUserSessions,
    revokeUserSession,
    updateUser,
    updateUserStatus,
} from "./userService";

import type {
    CreateUserPayload,
    Permission,
    Role,
    RoleCode,
    UpdateUserPayload,
    User,
    UserSession,
    UserStatus,
} from "./types";

import "./UsersPage.css";

type AdminTab =
    | "users"
    | "roles"
    | "permissions";

type DialogType =
    | "CREATE"
    | "DETAIL"
    | "EDIT"
    | "ROLE"
    | "STATUS"
    | "SESSIONS"
    | null;

interface FilterState {
    search: string;
    role: RoleCode | "";
    status: UserStatus | "";
}

interface CreateFormState {
    name: string;
    username: string;
    email: string;
    phone: string;
    roleId: string;
    password: string;
    passwordConfirmation: string;
}

interface EditFormState {
    name: string;
    username: string;
    email: string;
    phone: string;
}

const ROLE_FILTERS: Array<{
    value: RoleCode;
    label: string;
}> = [
        {
            value: "OWNER",
            label: "Owner",
        },
        {
            value: "ADMIN",
            label: "Admin",
        },
        {
            value: "MANAGER",
            label: "Manager",
        },
        {
            value: "CASHIER",
            label: "Cashier",
        },
        {
            value: "WAITER",
            label: "Waiter",
        },
    ];

function emptyCreateForm():
    CreateFormState {
    return {
        name: "",
        username: "",
        email: "",
        phone: "",
        roleId: "",
        password: "",
        passwordConfirmation: "",
    };
}

function formatDateTime(
    value:
        | string
        | null
        | undefined,
): string {
    if (!value) {
        return "—";
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
        "en-LK",
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Colombo",
        },
    ).format(
        date,
    );
}

function formatRole(
    roleCode:
        | string
        | null
        | undefined,
): string {
    if (!roleCode) {
        return "No Role";
    }

    return roleCode
        .replaceAll(
            "_",
            " ",
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            (
                character,
            ) =>
                character
                    .toUpperCase(),
        );
}

function errorMessage(
    error: unknown,
): string {
    if (
        error instanceof Error
    ) {
        return error.message;
    }

    return "The request could not be completed.";
}

function parseRoleCode(
    value: string,
): RoleCode | "" {
    if (
        value === "OWNER"
        ||
        value === "ADMIN"
        ||
        value === "MANAGER"
        ||
        value === "CASHIER"
        ||
        value === "WAITER"
    ) {
        return value;
    }

    return "";
}

function parseUserStatus(
    value: string,
): UserStatus | "" {
    if (
        value === "ACTIVE"
        ||
        value === "INACTIVE"
    ) {
        return value;
    }

    return "";
}

function statusClass(
    status: UserStatus,
): string {
    return status === "ACTIVE"
        ? "active"
        : "inactive";
}

interface MetricProps {
    label: string;
    value: string | number;
    hint?: string;
}

function Metric({
    label,
    value,
    hint,
}: MetricProps) {
    return (
        <article
            className="users-metric"
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

export default function UsersPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canViewUsers =
        hasPermission(
            "users.view",
        );

    const canCreateUsers =
        hasPermission(
            "users.create",
        );

    const canUpdateUsers =
        hasPermission(
            "users.update",
        );

    const canUpdateStatus =
        hasPermission(
            "users.status",
        );

    const canAssignRoles =
        hasPermission(
            "users.role",
        );

    const canManageSessions =
        hasPermission(
            "users.sessions.revoke",
        );

    const canViewRoles =
        hasPermission(
            "roles.view",
        );

    const canViewPermissions =
        hasPermission(
            "permissions.view",
        );

    const [
        activeTab,
        setActiveTab,
    ] =
        useState<AdminTab>(
            "users",
        );

    const [
        users,
        setUsers,
    ] =
        useState<User[]>(
            [],
        );

    const [
        roles,
        setRoles,
    ] =
        useState<Role[]>(
            [],
        );

    const [
        permissions,
        setPermissions,
    ] =
        useState<Permission[]>(
            [],
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
        referenceLoading,
        setReferenceLoading,
    ] =
        useState(
            false,
        );

    const [
        error,
        setError,
    ] =
        useState<string | null>(
            null,
        );

    const [
        message,
        setMessage,
    ] =
        useState<string | null>(
            null,
        );

    const [
        filterDraft,
        setFilterDraft,
    ] =
        useState<FilterState>({
            search: "",
            role: "",
            status: "",
        });

    const [
        filters,
        setFilters,
    ] =
        useState<FilterState>({
            search: "",
            role: "",
            status: "",
        });

    const [
        page,
        setPage,
    ] =
        useState(
            1,
        );

    const [
        perPage,
        setPerPage,
    ] =
        useState(
            20,
        );

    const [
        pagination,
        setPagination,
    ] =
        useState({
            current_page: 1,
            per_page: 20,
            total: 0,
            last_page: 1,
        });

    const [
        dialog,
        setDialog,
    ] =
        useState<DialogType>(
            null,
        );

    const [
        targetUser,
        setTargetUser,
    ] =
        useState<User | null>(
            null,
        );

    const [
        detailLoading,
        setDetailLoading,
    ] =
        useState(
            false,
        );

    const [
        actionLoading,
        setActionLoading,
    ] =
        useState(
            false,
        );

    const [
        createForm,
        setCreateForm,
    ] =
        useState<CreateFormState>(
            emptyCreateForm(),
        );

    const [
        editForm,
        setEditForm,
    ] =
        useState<EditFormState>({
            name: "",
            username: "",
            email: "",
            phone: "",
        });

    const [
        roleId,
        setRoleId,
    ] =
        useState(
            "",
        );

    const [
        sessions,
        setSessions,
    ] =
        useState<UserSession[]>(
            [],
        );

    const [
        sessionsLoading,
        setSessionsLoading,
    ] =
        useState(
            false,
        );

    const [
        revokingSessionId,
        setRevokingSessionId,
    ] =
        useState<number | null>(
            null,
        );

    const visibleTabs =
        useMemo(
            () => {
                const tabs: Array<{
                    id: AdminTab;
                    label: string;
                }> = [];

                if (
                    canViewUsers
                ) {
                    tabs.push({
                        id: "users",
                        label: "Users",
                    });
                }

                if (
                    canViewRoles
                ) {
                    tabs.push({
                        id: "roles",
                        label: "Roles",
                    });
                }

                if (
                    canViewPermissions
                ) {
                    tabs.push({
                        id: "permissions",
                        label: "Permissions",
                    });
                }

                return tabs;
            },
            [
                canViewUsers,
                canViewRoles,
                canViewPermissions,
            ],
        );

    const effectiveTab =
        visibleTabs.some(
            (
                tab,
            ) =>
                tab.id === activeTab,
        )
            ? activeTab
            : (
                visibleTabs[0]
                    ?.id
                ?? "users"
            );

    const permissionMap =
        useMemo(
            () => {
                const map =
                    new Map<
                        string,
                        Permission
                    >();

                for (
                    const permission
                    of permissions
                ) {
                    map.set(
                        permission.code,
                        permission,
                    );
                }

                return map;
            },
            [
                permissions,
            ],
        );

    const permissionGroups =
        useMemo(
            () => {
                const groups =
                    new Map<
                        string,
                        Permission[]
                    >();

                for (
                    const permission
                    of permissions
                ) {
                    const current =
                        groups.get(
                            permission.group,
                        )
                        ?? [];

                    current.push(
                        permission,
                    );

                    groups.set(
                        permission.group,
                        current,
                    );
                }

                return Array.from(
                    groups.entries(),
                );
            },
            [
                permissions,
            ],
        );

    const activeOnPage =
        users.filter(
            (
                user,
            ) =>
                user.status
                === "ACTIVE",
        ).length;

    const inactiveOnPage =
        users.length
        -
        activeOnPage;

    const rolesOnPage =
        new Set(
            users
                .map(
                    (
                        user,
                    ) =>
                        user.role?.code
                        ?? null,
                )
                .filter(
                    (
                        role,
                    ) =>
                        role !== null,
                ),
        ).size;

    const loadUsers =
        useCallback(
            async (
                showRefreshing = false,
            ): Promise<void> => {
                if (
                    !canViewUsers
                ) {
                    setLoading(
                        false,
                    );

                    return;
                }

                if (
                    showRefreshing
                ) {
                    setRefreshing(
                        true,
                    );
                } else {
                    setLoading(
                        true,
                    );
                }

                setError(
                    null,
                );

                try {
                    const result =
                        await getUsers({
                            search:
                                filters.search,

                            role:
                                filters.role,

                            status:
                                filters.status,

                            page,

                            perPage,
                        });

                    setUsers(
                        result.users,
                    );

                    setPagination(
                        result.pagination,
                    );
                } catch (
                exception
                ) {
                    setError(
                        errorMessage(
                            exception,
                        ),
                    );
                } finally {
                    setLoading(
                        false,
                    );

                    setRefreshing(
                        false,
                    );
                }
            },
            [
                canViewUsers,
                filters,
                page,
                perPage,
            ],
        );

    const loadReferenceData =
        useCallback(
            async (): Promise<void> => {
                if (
                    !canViewRoles
                    &&
                    !canViewPermissions
                ) {
                    return;
                }

                setReferenceLoading(
                    true,
                );

                try {
                    const jobs:
                        Array<
                            Promise<void>
                        > =
                        [];

                    if (
                        canViewRoles
                    ) {
                        jobs.push(
                            getRoles()
                                .then(
                                    (
                                        result,
                                    ) => {
                                        setRoles(
                                            result,
                                        );
                                    },
                                ),
                        );
                    }

                    if (
                        canViewPermissions
                    ) {
                        jobs.push(
                            getPermissions()
                                .then(
                                    (
                                        result,
                                    ) => {
                                        setPermissions(
                                            result,
                                        );
                                    },
                                ),
                        );
                    }

                    await Promise.all(
                        jobs,
                    );
                } catch (
                exception
                ) {
                    setError(
                        errorMessage(
                            exception,
                        ),
                    );
                } finally {
                    setReferenceLoading(
                        false,
                    );
                }
            },
            [
                canViewRoles,
                canViewPermissions,
            ],
        );

    useEffect(
        () => {
            const frameId =
                window.requestAnimationFrame(
                    () => {
                        void loadUsers();
                    },
                );

            return () => {
                window.cancelAnimationFrame(
                    frameId,
                );
            };
        },
        [
            loadUsers,
        ],
    );

    useEffect(
        () => {
            const frameId =
                window.requestAnimationFrame(
                    () => {
                        void loadReferenceData();
                    },
                );

            return () => {
                window.cancelAnimationFrame(
                    frameId,
                );
            };
        },
        [
            loadReferenceData,
        ],
    );

    function closeDialog():
        void {
        if (
            actionLoading
        ) {
            return;
        }

        setDialog(
            null,
        );

        setTargetUser(
            null,
        );

        setSessions(
            [],
        );

        setRoleId(
            "",
        );
    }

    function applyFilters(
        event:
            FormEvent<HTMLFormElement>,
    ): void {
        event.preventDefault();

        setPage(
            1,
        );

        setFilters({
            ...filterDraft,
        });
    }

    function clearFilters():
        void {
        const cleared: FilterState = {
            search: "",
            role: "",
            status: "",
        };

        setFilterDraft(
            cleared,
        );

        setFilters(
            cleared,
        );

        setPage(
            1,
        );
    }

    function openCreate():
        void {
        setCreateForm(
            emptyCreateForm(),
        );

        setDialog(
            "CREATE",
        );

        setTargetUser(
            null,
        );

        setError(
            null,
        );

        setMessage(
            null,
        );
    }

    async function openDetails(
        userId: number,
    ): Promise<void> {
        setDetailLoading(
            true,
        );

        setError(
            null,
        );

        try {
            const user =
                await getUser(
                    userId,
                );

            setTargetUser(
                user,
            );

            setDialog(
                "DETAIL",
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setDetailLoading(
                false,
            );
        }
    }

    function openEdit(
        user: User,
    ): void {
        setTargetUser(
            user,
        );

        setEditForm({
            name:
                user.name,

            username:
                user.username,

            email:
                user.email
                ?? "",

            phone:
                user.phone
                ?? "",
        });

        setDialog(
            "EDIT",
        );

        setError(
            null,
        );

        setMessage(
            null,
        );
    }

    function openRole(
        user: User,
    ): void {
        setTargetUser(
            user,
        );

        setRoleId(
            user.role
                ? String(
                    user.role.id,
                )
                : "",
        );

        setDialog(
            "ROLE",
        );

        setError(
            null,
        );

        setMessage(
            null,
        );
    }

    function openStatus(
        user: User,
    ): void {
        setTargetUser(
            user,
        );

        setDialog(
            "STATUS",
        );

        setError(
            null,
        );

        setMessage(
            null,
        );
    }

    async function openSessions(
        user: User,
    ): Promise<void> {
        setTargetUser(
            user,
        );

        setSessions(
            [],
        );

        setDialog(
            "SESSIONS",
        );

        setSessionsLoading(
            true,
        );

        setError(
            null,
        );

        try {
            const result =
                await getUserSessions(
                    user.id,
                );

            setSessions(
                result,
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setSessionsLoading(
                false,
            );
        }
    }

    async function submitCreate(
        event:
            FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        const selectedRole =
            Number(
                createForm.roleId,
            );

        if (
            !Number.isInteger(
                selectedRole,
            )
            ||
            selectedRole <= 0
        ) {
            setError(
                "Select a valid role.",
            );

            return;
        }

        if (
            createForm.password
            !==
            createForm
                .passwordConfirmation
        ) {
            setError(
                "Password confirmation does not match.",
            );

            return;
        }

        const payload:
            CreateUserPayload = {
            name:
                createForm
                    .name
                    .trim(),

            username:
                createForm
                    .username
                    .trim(),

            email:
                createForm
                    .email
                    .trim()
                || null,

            phone:
                createForm
                    .phone
                    .trim()
                || null,

            role_id:
                selectedRole,

            password:
                createForm
                    .password,

            password_confirmation:
                createForm
                    .passwordConfirmation,
        };

        setActionLoading(
            true,
        );

        setError(
            null,
        );

        try {
            await createUser(
                payload,
            );

            setDialog(
                null,
            );

            setMessage(
                "User created successfully.",
            );

            setPage(
                1,
            );

            await loadUsers(
                true,
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setActionLoading(
                false,
            );
        }
    }

    async function submitEdit(
        event:
            FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        if (
            !targetUser
        ) {
            return;
        }

        const payload:
            UpdateUserPayload = {
            name:
                editForm
                    .name
                    .trim(),

            username:
                editForm
                    .username
                    .trim(),

            email:
                editForm
                    .email
                    .trim()
                || null,

            phone:
                editForm
                    .phone
                    .trim()
                || null,
        };

        setActionLoading(
            true,
        );

        setError(
            null,
        );

        try {
            await updateUser(
                targetUser.id,
                payload,
            );

            setDialog(
                null,
            );

            setTargetUser(
                null,
            );

            setMessage(
                "User details updated successfully.",
            );

            await loadUsers(
                true,
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setActionLoading(
                false,
            );
        }
    }

    async function submitRole(
        event:
            FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        if (
            !targetUser
        ) {
            return;
        }

        const selectedRole =
            Number(
                roleId,
            );

        if (
            !Number.isInteger(
                selectedRole,
            )
            ||
            selectedRole <= 0
        ) {
            setError(
                "Select a valid role.",
            );

            return;
        }

        setActionLoading(
            true,
        );

        setError(
            null,
        );

        try {
            await assignUserRole(
                targetUser.id,
                {
                    role_id:
                        selectedRole,
                },
            );

            setDialog(
                null,
            );

            setTargetUser(
                null,
            );

            setMessage(
                "User role updated successfully.",
            );

            await loadUsers(
                true,
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setActionLoading(
                false,
            );
        }
    }

    async function confirmStatus():
        Promise<void> {
        if (
            !targetUser
        ) {
            return;
        }

        const nextStatus:
            UserStatus =
            targetUser.status
                === "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE";

        setActionLoading(
            true,
        );

        setError(
            null,
        );

        try {
            await updateUserStatus(
                targetUser.id,
                {
                    status:
                        nextStatus,
                },
            );

            setDialog(
                null,
            );

            setTargetUser(
                null,
            );

            setMessage(
                nextStatus === "ACTIVE"
                    ? "User activated successfully."
                    : "User deactivated successfully.",
            );

            await loadUsers(
                true,
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setActionLoading(
                false,
            );
        }
    }

    async function revokeSession(
        session:
            UserSession,
    ): Promise<void> {
        if (
            !targetUser
        ) {
            return;
        }

        const confirmed =
            window.confirm(
                `Revoke session "${session.name}"?`,
            );

        if (
            !confirmed
        ) {
            return;
        }

        setRevokingSessionId(
            session.id,
        );

        setError(
            null,
        );

        try {
            await revokeUserSession(
                targetUser.id,
                session.id,
            );

            setSessions(
                (
                    current,
                ) =>
                    current.filter(
                        (
                            item,
                        ) =>
                            item.id
                            !==
                            session.id,
                    ),
            );

            setMessage(
                "Session revoked successfully.",
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setRevokingSessionId(
                null,
            );
        }
    }

    async function revokeAllSessions():
        Promise<void> {
        if (
            !targetUser
        ) {
            return;
        }

        const confirmed =
            window.confirm(
                `Revoke every active session for ${targetUser.name}?`,
            );

        if (
            !confirmed
        ) {
            return;
        }

        setActionLoading(
            true,
        );

        setError(
            null,
        );

        try {
            await revokeAllUserSessions(
                targetUser.id,
            );

            setSessions(
                [],
            );

            setMessage(
                "All user sessions revoked successfully.",
            );
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setActionLoading(
                false,
            );
        }
    }

    function renderUserActions(
        user: User,
    ): ReactNode {
        return (
            <div
                className="users-row-actions"
            >
                <button
                    type="button"
                    onClick={
                        () => {
                            void openDetails(
                                user.id,
                            );
                        }
                    }
                    disabled={
                        detailLoading
                    }
                >
                    View
                </button>

                {
                    canUpdateUsers
                        ? (
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        openEdit(
                                            user,
                                        )
                                }
                            >
                                Edit
                            </button>
                        )
                        : null
                }

                {
                    canAssignRoles
                        ? (
                            <button
                                type="button"
                                onClick={
                                    () =>
                                        openRole(
                                            user,
                                        )
                                }
                            >
                                Role
                            </button>
                        )
                        : null
                }

                {
                    canManageSessions
                        ? (
                            <button
                                type="button"
                                onClick={
                                    () => {
                                        void openSessions(
                                            user,
                                        );
                                    }
                                }
                            >
                                Sessions
                            </button>
                        )
                        : null
                }

                {
                    canUpdateStatus
                        ? (
                            <button
                                type="button"
                                className={
                                    user.status
                                        === "ACTIVE"
                                        ? "danger"
                                        : "success"
                                }
                                onClick={
                                    () =>
                                        openStatus(
                                            user,
                                        )
                                }
                            >
                                {
                                    user.status
                                        === "ACTIVE"
                                        ? "Deactivate"
                                        : "Activate"
                                }
                            </button>
                        )
                        : null
                }
            </div>
        );
    }

    function renderUsers():
        ReactNode {
        if (
            !canViewUsers
        ) {
            return null;
        }

        return (
            <>
                <div
                    className="users-metrics-grid"
                >
                    <Metric
                        label="Matching Users"
                        value={
                            pagination.total
                        }
                        hint="Current filters"
                    />

                    <Metric
                        label="Active on Page"
                        value={
                            activeOnPage
                        }
                    />

                    <Metric
                        label="Inactive on Page"
                        value={
                            inactiveOnPage
                        }
                    />

                    <Metric
                        label="Roles on Page"
                        value={
                            rolesOnPage
                        }
                    />
                </div>

                <form
                    className="users-filter-card"
                    onSubmit={
                        applyFilters
                    }
                >
                    <label
                        className="users-search-field"
                    >
                        <span>
                            Search
                        </span>

                        <input
                            type="search"
                            placeholder="Name, username, email or phone"
                            value={
                                filterDraft.search
                            }
                            onChange={
                                (
                                    event,
                                ) =>
                                    setFilterDraft(
                                        (
                                            current,
                                        ) => ({
                                            ...current,
                                            search:
                                                event
                                                    .target
                                                    .value,
                                        }),
                                    )
                            }
                        />
                    </label>

                    <label>
                        <span>
                            Role
                        </span>

                        <select
                            value={
                                filterDraft.role
                            }
                            onChange={
                                (
                                    event,
                                ) => {
                                    const value =
                                        parseRoleCode(
                                            event
                                                .target
                                                .value,
                                        );

                                    setFilterDraft(
                                        (
                                            current,
                                        ) => ({
                                            ...current,
                                            role:
                                                value,
                                        }),
                                    );
                                }
                            }
                        >
                            <option value="">
                                All Roles
                            </option>

                            {
                                ROLE_FILTERS.map(
                                    (
                                        role,
                                    ) => (
                                        <option
                                            key={
                                                role.value
                                            }
                                            value={
                                                role.value
                                            }
                                        >
                                            {
                                                role.label
                                            }
                                        </option>
                                    ),
                                )
                            }
                        </select>
                    </label>

                    <label>
                        <span>
                            Status
                        </span>

                        <select
                            value={
                                filterDraft.status
                            }
                            onChange={
                                (
                                    event,
                                ) => {
                                    const value =
                                        parseUserStatus(
                                            event
                                                .target
                                                .value,
                                        );

                                    setFilterDraft(
                                        (
                                            current,
                                        ) => ({
                                            ...current,
                                            status:
                                                value,
                                        }),
                                    );
                                }
                            }
                        >
                            <option value="">
                                All Statuses
                            </option>

                            <option value="ACTIVE">
                                Active
                            </option>

                            <option value="INACTIVE">
                                Inactive
                            </option>
                        </select>
                    </label>

                    <label>
                        <span>
                            Rows
                        </span>

                        <select
                            value={
                                perPage
                            }
                            onChange={
                                (
                                    event,
                                ) => {
                                    setPerPage(
                                        Number(
                                            event
                                                .target
                                                .value,
                                        ),
                                    );

                                    setPage(
                                        1,
                                    );
                                }
                            }
                        >
                            <option value={10}>
                                10
                            </option>

                            <option value={20}>
                                20
                            </option>

                            <option value={30}>
                                30
                            </option>

                            <option value={50}>
                                50
                            </option>

                            <option value={100}>
                                100
                            </option>
                        </select>
                    </label>

                    <div
                        className="users-filter-actions"
                    >
                        <button
                            type="submit"
                            className="primary"
                        >
                            Apply
                        </button>

                        <button
                            type="button"
                            onClick={
                                clearFilters
                            }
                        >
                            Clear
                        </button>
                    </div>
                </form>

                <section
                    className="users-panel"
                >
                    <header
                        className="users-panel-header"
                    >
                        <div>
                            <h2>
                                Staff Accounts
                            </h2>

                            <p>
                                Manage restaurant staff
                                identities, access and
                                sessions.
                            </p>
                        </div>

                        {
                            canCreateUsers
                                ? (
                                    <button
                                        type="button"
                                        className="users-primary-button"
                                        onClick={
                                            openCreate
                                        }
                                    >
                                        + Add User
                                    </button>
                                )
                                : null
                        }
                    </header>

                    {
                        loading
                            ? (
                                <div
                                    className="users-loading"
                                >
                                    <div
                                        className="users-spinner"
                                    />

                                    Loading users...
                                </div>
                            )
                            : users.length
                                === 0
                                ? (
                                    <div
                                        className="users-empty"
                                    >
                                        No users matched
                                        the selected filters.
                                    </div>
                                )
                                : (
                                    <div
                                        className="users-table-scroll"
                                    >
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>User</th>
                                                    <th>Contact</th>
                                                    <th>Role</th>
                                                    <th>Status</th>
                                                    <th>Last Login</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {
                                                    users.map(
                                                        (
                                                            user,
                                                        ) => (
                                                            <tr
                                                                key={
                                                                    user.id
                                                                }
                                                            >
                                                                <td>
                                                                    <div
                                                                        className="users-user-cell"
                                                                    >
                                                                        <div
                                                                            className="users-avatar"
                                                                        >
                                                                            {
                                                                                user
                                                                                    .name
                                                                                    .trim()
                                                                                    .charAt(
                                                                                        0,
                                                                                    )
                                                                                    .toUpperCase()
                                                                                || "U"
                                                                            }
                                                                        </div>

                                                                        <div>
                                                                            <strong>
                                                                                {
                                                                                    user.name
                                                                                }
                                                                            </strong>

                                                                            <span>
                                                                                @
                                                                                {
                                                                                    user.username
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td>
                                                                    <div
                                                                        className="users-contact-cell"
                                                                    >
                                                                        <span>
                                                                            {
                                                                                user.email
                                                                                ?? "No email"
                                                                            }
                                                                        </span>

                                                                        <small>
                                                                            {
                                                                                user.phone
                                                                                ?? "No phone"
                                                                            }
                                                                        </small>
                                                                    </div>
                                                                </td>

                                                                <td>
                                                                    <span
                                                                        className="users-role-badge"
                                                                    >
                                                                        {
                                                                            formatRole(
                                                                                user
                                                                                    .role
                                                                                    ?.code,
                                                                            )
                                                                        }
                                                                    </span>
                                                                </td>

                                                                <td>
                                                                    <span
                                                                        className={
                                                                            `users-status ${statusClass(
                                                                                user.status,
                                                                            )}`
                                                                        }
                                                                    >
                                                                        {
                                                                            formatRole(
                                                                                user.status,
                                                                            )
                                                                        }
                                                                    </span>
                                                                </td>

                                                                <td>
                                                                    {
                                                                        formatDateTime(
                                                                            user
                                                                                .last_login_at,
                                                                        )
                                                                    }
                                                                </td>

                                                                <td>
                                                                    {
                                                                        renderUserActions(
                                                                            user,
                                                                        )
                                                                    }
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                )
                    }

                    <footer
                        className="users-pagination"
                    >
                        <div>
                            Page{" "}
                            <strong>
                                {
                                    pagination
                                        .current_page
                                }
                            </strong>{" "}
                            of{" "}
                            <strong>
                                {
                                    Math.max(
                                        1,
                                        pagination
                                            .last_page,
                                    )
                                }
                            </strong>

                            <span>
                                {
                                    pagination.total
                                }{" "}
                                result
                                {
                                    pagination.total
                                        === 1
                                        ? ""
                                        : "s"
                                }
                            </span>
                        </div>

                        <div>
                            <button
                                type="button"
                                disabled={
                                    page <= 1
                                    ||
                                    loading
                                }
                                onClick={
                                    () =>
                                        setPage(
                                            (
                                                current,
                                            ) =>
                                                Math.max(
                                                    1,
                                                    current - 1,
                                                ),
                                        )
                                }
                            >
                                Previous
                            </button>

                            <button
                                type="button"
                                disabled={
                                    page
                                    >=
                                    pagination
                                        .last_page
                                    ||
                                    loading
                                }
                                onClick={
                                    () =>
                                        setPage(
                                            (
                                                current,
                                            ) =>
                                                current + 1,
                                        )
                                }
                            >
                                Next
                            </button>
                        </div>
                    </footer>
                </section>
            </>
        );
    }

    function renderRoles():
        ReactNode {
        if (
            !canViewRoles
        ) {
            return null;
        }

        if (
            referenceLoading
            &&
            roles.length === 0
        ) {
            return (
                <div
                    className="users-loading-card"
                >
                    Loading roles...
                </div>
            );
        }

        return (
            <section
                className="users-panel"
            >
                <header
                    className="users-panel-header"
                >
                    <div>
                        <h2>
                            Assignable Roles
                        </h2>

                        <p>
                            Roles are centrally controlled
                            by the backend role hierarchy.
                            This screen is read-only.
                        </p>
                    </div>
                </header>

                {
                    roles.length === 0
                        ? (
                            <div
                                className="users-empty"
                            >
                                No assignable roles
                                are available.
                            </div>
                        )
                        : (
                            <div
                                className="users-role-grid"
                            >
                                {
                                    roles.map(
                                        (
                                            role,
                                        ) => (
                                            <article
                                                key={
                                                    role.id
                                                }
                                                className="users-role-card"
                                            >
                                                <header>
                                                    <div>
                                                        <span>
                                                            {
                                                                role.code
                                                            }
                                                        </span>

                                                        <h3>
                                                            {
                                                                role.name
                                                            }
                                                        </h3>
                                                    </div>

                                                    <span
                                                        className={
                                                            role
                                                                .is_active
                                                                ? "users-status active"
                                                                : "users-status inactive"
                                                        }
                                                    >
                                                        {
                                                            role
                                                                .is_active
                                                                ? "Active"
                                                                : "Inactive"
                                                        }
                                                    </span>
                                                </header>

                                                <p>
                                                    {
                                                        role.description
                                                        ?? "No description provided."
                                                    }
                                                </p>

                                                <div
                                                    className="users-role-count"
                                                >
                                                    <strong>
                                                        {
                                                            role
                                                                .permissions
                                                                .length
                                                        }
                                                    </strong>

                                                    <span>
                                                        permissions
                                                    </span>
                                                </div>

                                                <div
                                                    className="users-permission-badges"
                                                >
                                                    {
                                                        role
                                                            .permissions
                                                            .map(
                                                                (
                                                                    code,
                                                                ) => (
                                                                    <span
                                                                        key={
                                                                            code
                                                                        }
                                                                    >
                                                                        {
                                                                            permissionMap
                                                                                .get(
                                                                                    code,
                                                                                )
                                                                                ?.name
                                                                            ?? code
                                                                        }
                                                                    </span>
                                                                ),
                                                            )
                                                    }
                                                </div>
                                            </article>
                                        ),
                                    )
                                }
                            </div>
                        )
                }
            </section>
        );
    }

    function renderPermissions():
        ReactNode {
        if (
            !canViewPermissions
        ) {
            return null;
        }

        if (
            referenceLoading
            &&
            permissions.length
            === 0
        ) {
            return (
                <div
                    className="users-loading-card"
                >
                    Loading permissions...
                </div>
            );
        }

        return (
            <section
                className="users-panel"
            >
                <header
                    className="users-panel-header"
                >
                    <div>
                        <h2>
                            Permission Catalog
                        </h2>

                        <p>
                            Registered permissions grouped
                            by application module.
                        </p>
                    </div>

                    <span
                        className="users-total-pill"
                    >
                        {
                            permissions.length
                        } permissions
                    </span>
                </header>

                <div
                    className="users-permission-groups"
                >
                    {
                        permissionGroups.map(
                            (
                                [
                                    group,
                                    groupPermissions,
                                ],
                            ) => (
                                <article
                                    key={
                                        group
                                    }
                                    className="users-permission-group"
                                >
                                    <header>
                                        <h3>
                                            {group}
                                        </h3>

                                        <span>
                                            {
                                                groupPermissions
                                                    .length
                                            }
                                        </span>
                                    </header>

                                    <div
                                        className="users-permission-table"
                                    >
                                        {
                                            groupPermissions.map(
                                                (
                                                    permission,
                                                ) => (
                                                    <div
                                                        key={
                                                            permission.id
                                                        }
                                                    >
                                                        <div>
                                                            <strong>
                                                                {
                                                                    permission
                                                                        .name
                                                                }
                                                            </strong>

                                                            {
                                                                permission
                                                                    .description
                                                                    ? (
                                                                        <small>
                                                                            {
                                                                                permission
                                                                                    .description
                                                                            }
                                                                        </small>
                                                                    )
                                                                    : null
                                                            }
                                                        </div>

                                                        <code>
                                                            {
                                                                permission
                                                                    .code
                                                            }
                                                        </code>
                                                    </div>
                                                ),
                                            )
                                        }
                                    </div>
                                </article>
                            ),
                        )
                    }
                </div>
            </section>
        );
    }

    function renderDialog():
        ReactNode {
        if (
            !dialog
        ) {
            return null;
        }

        if (
            dialog === "CREATE"
        ) {
            return (
                <div
                    className="users-modal-backdrop"
                    role="presentation"
                >
                    <div
                        className="users-modal users-modal-medium"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Create user"
                    >
                        <header
                            className="users-modal-header"
                        >
                            <div>
                                <span>
                                    USER MANAGEMENT
                                </span>

                                <h2>
                                    Create User
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeDialog
                                }
                            >
                                ×
                            </button>
                        </header>

                        <form
                            className="users-modal-body"
                            onSubmit={
                                submitCreate
                            }
                        >
                            <div
                                className="users-form-grid"
                            >
                                <label>
                                    <span>
                                        Full Name *
                                    </span>

                                    <input
                                        required
                                        maxLength={
                                            150
                                        }
                                        value={
                                            createForm
                                                .name
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setCreateForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        name:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Username *
                                    </span>

                                    <input
                                        required
                                        minLength={
                                            3
                                        }
                                        maxLength={
                                            100
                                        }
                                        autoCapitalize="none"
                                        value={
                                            createForm
                                                .username
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setCreateForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        username:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Email
                                    </span>

                                    <input
                                        type="email"
                                        maxLength={
                                            190
                                        }
                                        value={
                                            createForm
                                                .email
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setCreateForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        email:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Phone
                                    </span>

                                    <input
                                        maxLength={
                                            30
                                        }
                                        value={
                                            createForm
                                                .phone
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setCreateForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        phone:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Role *
                                    </span>

                                    <select
                                        required
                                        value={
                                            createForm
                                                .roleId
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setCreateForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        roleId:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    >
                                        <option value="">
                                            Select role
                                        </option>

                                        {
                                            roles.map(
                                                (
                                                    role,
                                                ) => (
                                                    <option
                                                        key={
                                                            role.id
                                                        }
                                                        value={
                                                            role.id
                                                        }
                                                    >
                                                        {
                                                            role.name
                                                        }
                                                    </option>
                                                ),
                                            )
                                        }
                                    </select>
                                </label>

                                <div />

                                <label>
                                    <span>
                                        Password *
                                    </span>

                                    <input
                                        type="password"
                                        required
                                        minLength={
                                            12
                                        }
                                        autoComplete="new-password"
                                        value={
                                            createForm
                                                .password
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setCreateForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        password:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Confirm Password *
                                    </span>

                                    <input
                                        type="password"
                                        required
                                        minLength={
                                            12
                                        }
                                        autoComplete="new-password"
                                        value={
                                            createForm
                                                .passwordConfirmation
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setCreateForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        passwordConfirmation:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>
                            </div>

                            <p
                                className="users-password-note"
                            >
                                Password must contain at least
                                12 characters with uppercase,
                                lowercase, number and symbol.
                            </p>

                            <footer
                                className="users-modal-actions"
                            >
                                <button
                                    type="button"
                                    onClick={
                                        closeDialog
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="primary"
                                    disabled={
                                        actionLoading
                                    }
                                >
                                    {
                                        actionLoading
                                            ? "Creating..."
                                            : "Create User"
                                    }
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            );
        }

        if (
            dialog === "DETAIL"
            &&
            targetUser
        ) {
            return (
                <div
                    className="users-modal-backdrop"
                    role="presentation"
                >
                    <div
                        className="users-modal users-modal-large"
                        role="dialog"
                        aria-modal="true"
                        aria-label="User details"
                    >
                        <header
                            className="users-modal-header"
                        >
                            <div>
                                <span>
                                    USER DETAILS
                                </span>

                                <h2>
                                    {
                                        targetUser.name
                                    }
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeDialog
                                }
                            >
                                ×
                            </button>
                        </header>

                        <div
                            className="users-modal-body"
                        >
                            <div
                                className="users-detail-hero"
                            >
                                <div
                                    className="users-avatar large"
                                >
                                    {
                                        targetUser
                                            .name
                                            .trim()
                                            .charAt(
                                                0,
                                            )
                                            .toUpperCase()
                                        || "U"
                                    }
                                </div>

                                <div>
                                    <h3>
                                        {
                                            targetUser.name
                                        }
                                    </h3>

                                    <p>
                                        @
                                        {
                                            targetUser
                                                .username
                                        }
                                    </p>

                                    <div>
                                        <span
                                            className="users-role-badge"
                                        >
                                            {
                                                formatRole(
                                                    targetUser
                                                        .role
                                                        ?.code,
                                                )
                                            }
                                        </span>

                                        <span
                                            className={
                                                `users-status ${statusClass(
                                                    targetUser
                                                        .status,
                                                )}`
                                            }
                                        >
                                            {
                                                formatRole(
                                                    targetUser
                                                        .status,
                                                )
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div
                                className="users-detail-grid"
                            >
                                <div>
                                    <span>
                                        Email
                                    </span>

                                    <strong>
                                        {
                                            targetUser.email
                                            ?? "—"
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Phone
                                    </span>

                                    <strong>
                                        {
                                            targetUser.phone
                                            ?? "—"
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Last Login
                                    </span>

                                    <strong>
                                        {
                                            formatDateTime(
                                                targetUser
                                                    .last_login_at,
                                            )
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Created
                                    </span>

                                    <strong>
                                        {
                                            formatDateTime(
                                                targetUser
                                                    .created_at,
                                            )
                                        }
                                    </strong>
                                </div>
                            </div>

                            <section
                                className="users-detail-section"
                            >
                                <header>
                                    <h3>
                                        Effective Permissions
                                    </h3>

                                    <span>
                                        {
                                            targetUser
                                                .permissions
                                                .length
                                        }
                                    </span>
                                </header>

                                {
                                    targetUser
                                        .permissions
                                        .length
                                        === 0
                                        ? (
                                            <p
                                                className="users-empty-inline"
                                            >
                                                No effective permissions.
                                            </p>
                                        )
                                        : (
                                            <div
                                                className="users-permission-badges"
                                            >
                                                {
                                                    targetUser
                                                        .permissions
                                                        .map(
                                                            (
                                                                code,
                                                            ) => (
                                                                <span
                                                                    key={
                                                                        code
                                                                    }
                                                                    title={
                                                                        code
                                                                    }
                                                                >
                                                                    {
                                                                        permissionMap
                                                                            .get(
                                                                                code,
                                                                            )
                                                                            ?.name
                                                                        ?? code
                                                                    }
                                                                </span>
                                                            ),
                                                        )
                                                }
                                            </div>
                                        )
                                }
                            </section>

                            <footer
                                className="users-modal-actions"
                            >
                                {
                                    canManageSessions
                                        ? (
                                            <button
                                                type="button"
                                                onClick={
                                                    () => {
                                                        void openSessions(
                                                            targetUser,
                                                        );
                                                    }
                                                }
                                            >
                                                Sessions
                                            </button>
                                        )
                                        : null
                                }

                                {
                                    canAssignRoles
                                        ? (
                                            <button
                                                type="button"
                                                onClick={
                                                    () =>
                                                        openRole(
                                                            targetUser,
                                                        )
                                                }
                                            >
                                                Change Role
                                            </button>
                                        )
                                        : null
                                }

                                {
                                    canUpdateUsers
                                        ? (
                                            <button
                                                type="button"
                                                className="primary"
                                                onClick={
                                                    () =>
                                                        openEdit(
                                                            targetUser,
                                                        )
                                                }
                                            >
                                                Edit User
                                            </button>
                                        )
                                        : null
                                }
                            </footer>
                        </div>
                    </div>
                </div>
            );
        }

        if (
            dialog === "EDIT"
            &&
            targetUser
        ) {
            return (
                <div
                    className="users-modal-backdrop"
                    role="presentation"
                >
                    <div
                        className="users-modal users-modal-medium"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Edit user"
                    >
                        <header
                            className="users-modal-header"
                        >
                            <div>
                                <span>
                                    USER MANAGEMENT
                                </span>

                                <h2>
                                    Edit User
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeDialog
                                }
                            >
                                ×
                            </button>
                        </header>

                        <form
                            className="users-modal-body"
                            onSubmit={
                                submitEdit
                            }
                        >
                            <div
                                className="users-form-grid"
                            >
                                <label>
                                    <span>
                                        Full Name *
                                    </span>

                                    <input
                                        required
                                        maxLength={
                                            150
                                        }
                                        value={
                                            editForm.name
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setEditForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        name:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Username *
                                    </span>

                                    <input
                                        required
                                        minLength={
                                            3
                                        }
                                        maxLength={
                                            100
                                        }
                                        value={
                                            editForm
                                                .username
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setEditForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        username:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Email
                                    </span>

                                    <input
                                        type="email"
                                        maxLength={
                                            190
                                        }
                                        value={
                                            editForm.email
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setEditForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        email:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>

                                <label>
                                    <span>
                                        Phone
                                    </span>

                                    <input
                                        maxLength={
                                            30
                                        }
                                        value={
                                            editForm.phone
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setEditForm(
                                                    (
                                                        current,
                                                    ) => ({
                                                        ...current,
                                                        phone:
                                                            event
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                        }
                                    />
                                </label>
                            </div>

                            <p
                                className="users-password-note"
                            >
                                Role and status are managed
                                separately. Password changes
                                are not exposed by this
                                administration API.
                            </p>

                            <footer
                                className="users-modal-actions"
                            >
                                <button
                                    type="button"
                                    onClick={
                                        closeDialog
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="primary"
                                    disabled={
                                        actionLoading
                                    }
                                >
                                    {
                                        actionLoading
                                            ? "Saving..."
                                            : "Save Changes"
                                    }
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            );
        }

        if (
            dialog === "ROLE"
            &&
            targetUser
        ) {
            return (
                <div
                    className="users-modal-backdrop"
                    role="presentation"
                >
                    <div
                        className="users-modal users-modal-small"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Change role"
                    >
                        <header
                            className="users-modal-header"
                        >
                            <div>
                                <span>
                                    ACCESS CONTROL
                                </span>

                                <h2>
                                    Change Role
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeDialog
                                }
                            >
                                ×
                            </button>
                        </header>

                        <form
                            className="users-modal-body"
                            onSubmit={
                                submitRole
                            }
                        >
                            <p>
                                Assign a permitted role to{" "}
                                <strong>
                                    {
                                        targetUser.name
                                    }
                                </strong>
                                .
                            </p>

                            <label
                                className="users-full-field"
                            >
                                <span>
                                    Role *
                                </span>

                                <select
                                    required
                                    value={
                                        roleId
                                    }
                                    onChange={
                                        (
                                            event,
                                        ) =>
                                            setRoleId(
                                                event
                                                    .target
                                                    .value,
                                            )
                                    }
                                >
                                    <option value="">
                                        Select role
                                    </option>

                                    {
                                        roles.map(
                                            (
                                                role,
                                            ) => (
                                                <option
                                                    key={
                                                        role.id
                                                    }
                                                    value={
                                                        role.id
                                                    }
                                                >
                                                    {
                                                        role.name
                                                    }
                                                </option>
                                            ),
                                        )
                                    }
                                </select>
                            </label>

                            <p
                                className="users-password-note"
                            >
                                The backend role hierarchy
                                determines which roles you
                                are authorized to assign.
                            </p>

                            <footer
                                className="users-modal-actions"
                            >
                                <button
                                    type="button"
                                    onClick={
                                        closeDialog
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="primary"
                                    disabled={
                                        actionLoading
                                    }
                                >
                                    {
                                        actionLoading
                                            ? "Updating..."
                                            : "Update Role"
                                    }
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            );
        }

        if (
            dialog === "STATUS"
            &&
            targetUser
        ) {
            const activating =
                targetUser.status
                === "INACTIVE";

            return (
                <div
                    className="users-modal-backdrop"
                    role="presentation"
                >
                    <div
                        className="users-modal users-modal-small"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Update user status"
                    >
                        <header
                            className="users-modal-header"
                        >
                            <div>
                                <span>
                                    ACCOUNT STATUS
                                </span>

                                <h2>
                                    {
                                        activating
                                            ? "Activate User"
                                            : "Deactivate User"
                                    }
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeDialog
                                }
                            >
                                ×
                            </button>
                        </header>

                        <div
                            className="users-modal-body"
                        >
                            <p>
                                {
                                    activating
                                        ? "Activate"
                                        : "Deactivate"
                                }{" "}
                                <strong>
                                    {
                                        targetUser.name
                                    }
                                </strong>
                                ?
                            </p>

                            <p
                                className="users-password-note"
                            >
                                {
                                    activating
                                        ? "The account will be allowed to authenticate again according to its assigned role."
                                        : "The account will no longer pass the active-user middleware."
                                }
                            </p>

                            <footer
                                className="users-modal-actions"
                            >
                                <button
                                    type="button"
                                    onClick={
                                        closeDialog
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className={
                                        activating
                                            ? "success"
                                            : "danger"
                                    }
                                    disabled={
                                        actionLoading
                                    }
                                    onClick={
                                        () => {
                                            void confirmStatus();
                                        }
                                    }
                                >
                                    {
                                        actionLoading
                                            ? "Updating..."
                                            : activating
                                                ? "Activate"
                                                : "Deactivate"
                                    }
                                </button>
                            </footer>
                        </div>
                    </div>
                </div>
            );
        }

        if (
            dialog === "SESSIONS"
            &&
            targetUser
        ) {
            return (
                <div
                    className="users-modal-backdrop"
                    role="presentation"
                >
                    <div
                        className="users-modal users-modal-large"
                        role="dialog"
                        aria-modal="true"
                        aria-label="User sessions"
                    >
                        <header
                            className="users-modal-header"
                        >
                            <div>
                                <span>
                                    SECURITY
                                </span>

                                <h2>
                                    Active Sessions
                                </h2>

                                <p>
                                    {
                                        targetUser.name
                                    }
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeDialog
                                }
                            >
                                ×
                            </button>
                        </header>

                        <div
                            className="users-modal-body"
                        >
                            {
                                sessionsLoading
                                    ? (
                                        <div
                                            className="users-loading"
                                        >
                                            <div
                                                className="users-spinner"
                                            />

                                            Loading sessions...
                                        </div>
                                    )
                                    : sessions.length
                                        === 0
                                        ? (
                                            <div
                                                className="users-empty"
                                            >
                                                No active API sessions
                                                were found.
                                            </div>
                                        )
                                        : (
                                            <div
                                                className="users-session-list"
                                            >
                                                {
                                                    sessions.map(
                                                        (
                                                            session,
                                                        ) => (
                                                            <article
                                                                key={
                                                                    session.id
                                                                }
                                                            >
                                                                <div
                                                                    className="users-session-icon"
                                                                >
                                                                    ◉
                                                                </div>

                                                                <div
                                                                    className="users-session-info"
                                                                >
                                                                    <strong>
                                                                        {
                                                                            session.name
                                                                        }
                                                                    </strong>

                                                                    <span>
                                                                        Created{" "}
                                                                        {
                                                                            formatDateTime(
                                                                                session
                                                                                    .created_at,
                                                                            )
                                                                        }
                                                                    </span>

                                                                    <small>
                                                                        Last used:{" "}
                                                                        {
                                                                            formatDateTime(
                                                                                session
                                                                                    .last_used_at,
                                                                            )
                                                                        }
                                                                    </small>

                                                                    {
                                                                        session
                                                                            .expires_at
                                                                            ? (
                                                                                <small>
                                                                                    Expires:{" "}
                                                                                    {
                                                                                        formatDateTime(
                                                                                            session
                                                                                                .expires_at,
                                                                                        )
                                                                                    }
                                                                                </small>
                                                                            )
                                                                            : null
                                                                    }
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    className="danger-outline"
                                                                    disabled={
                                                                        revokingSessionId
                                                                        ===
                                                                        session.id
                                                                    }
                                                                    onClick={
                                                                        () => {
                                                                            void revokeSession(
                                                                                session,
                                                                            );
                                                                        }
                                                                    }
                                                                >
                                                                    {
                                                                        revokingSessionId
                                                                            ===
                                                                            session.id
                                                                            ? "Revoking..."
                                                                            : "Revoke"
                                                                    }
                                                                </button>
                                                            </article>
                                                        ),
                                                    )
                                                }
                                            </div>
                                        )
                            }

                            <footer
                                className="users-modal-actions"
                            >
                                <button
                                    type="button"
                                    onClick={
                                        closeDialog
                                    }
                                >
                                    Close
                                </button>

                                <button
                                    type="button"
                                    className="danger"
                                    disabled={
                                        actionLoading
                                        ||
                                        sessions.length
                                        === 0
                                    }
                                    onClick={
                                        () => {
                                            void revokeAllSessions();
                                        }
                                    }
                                >
                                    {
                                        actionLoading
                                            ? "Revoking..."
                                            : "Revoke All Sessions"
                                    }
                                </button>
                            </footer>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    }

    return (
        <section
            id="users-page"
        >
            <header
                className="users-page-header"
            >
                <div>
                    <span
                        className="users-eyebrow"
                    >
                        ADMINISTRATION
                    </span>

                    <h1>
                        Users & Roles
                    </h1>

                    <p>
                        Manage staff accounts,
                        authorization roles,
                        effective permissions and
                        authenticated sessions.
                    </p>
                </div>

                {
                    canViewUsers
                        ? (
                            <button
                                type="button"
                                className="users-refresh"
                                disabled={
                                    refreshing
                                }
                                onClick={
                                    () => {
                                        void loadUsers(
                                            true,
                                        );
                                    }
                                }
                            >
                                ↻{" "}
                                {
                                    refreshing
                                        ? "Refreshing..."
                                        : "Refresh"
                                }
                            </button>
                        )
                        : null
                }
            </header>

            {
                error
                    ? (
                        <div
                            className="users-alert error"
                        >
                            <span>
                                {error}
                            </span>

                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setError(
                                            null,
                                        )
                                }
                            >
                                ×
                            </button>
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div
                            className="users-alert success"
                        >
                            <span>
                                {message}
                            </span>

                            <button
                                type="button"
                                onClick={
                                    () =>
                                        setMessage(
                                            null,
                                        )
                                }
                            >
                                ×
                            </button>
                        </div>
                    )
                    : null
            }

            <nav
                className="users-tabs"
                aria-label="Users and roles sections"
            >
                {
                    visibleTabs.map(
                        (
                            tab,
                        ) => (
                            <button
                                key={
                                    tab.id
                                }
                                type="button"
                                className={
                                    effectiveTab
                                        ===
                                        tab.id
                                        ? "active"
                                        : ""
                                }
                                onClick={
                                    () =>
                                        setActiveTab(
                                            tab.id,
                                        )
                                }
                            >
                                {
                                    tab.label
                                }
                            </button>
                        ),
                    )
                }
            </nav>

            <div
                className="users-tab-content"
            >
                {
                    effectiveTab
                        === "users"
                        ? renderUsers()
                        : null
                }

                {
                    effectiveTab
                        === "roles"
                        ? renderRoles()
                        : null
                }

                {
                    effectiveTab
                        === "permissions"
                        ? renderPermissions()
                        : null
                }
            </div>

            {
                renderDialog()
            }
        </section>
    );
}