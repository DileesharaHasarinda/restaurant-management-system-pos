import {
    Navigate,
    Outlet,
    useLocation,
} from "react-router-dom";

import {
    useAuth,
} from "./useAuth";

import type {
    SystemRoleCode,
} from "../types/auth";

const ALLOWED_OPERATIONS_ROLES:
    readonly SystemRoleCode[] = [
        "OWNER",
        "ADMIN",
        "MANAGER",
        "WAITER",
        "CASHIER",
    ];

export default function ProtectedRoute() {
    const {
        user,
        loading,
    } =
        useAuth();

    const location =
        useLocation();

    if (
        loading
    ) {
        return (
            <main className="app-loading-screen">
                <div className="app-loading-spinner" />

                <strong>
                    Loading Operations
                </strong>
            </main>
        );
    }

    if (
        !user
    ) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    from:
                        location.pathname,
                }}
            />
        );
    }

    const roleCode =
        user.role?.code
        ?? null;

    if (
        !roleCode
        ||
        !ALLOWED_OPERATIONS_ROLES.includes(
            roleCode
        )
    ) {
        return (
            <Navigate
                to="/access-denied"
                replace
            />
        );
    }

    return (
        <Outlet />
    );
}