import {
    Navigate,
    Outlet,
    useLocation,
} from 'react-router-dom';

import {
    useAuth,
} from './useAuth';

/*
|--------------------------------------------------------------------------
| Allowed Operations Roles
|--------------------------------------------------------------------------
|
| Cashier users use the Electron Cashier POS.
|
| Operations Web is available to:
|
| OWNER
| ADMIN
| MANAGER
| WAITER
|--------------------------------------------------------------------------
*/

const OPERATIONS_ROLES = [
    'OWNER',
    'ADMIN',
    'MANAGER',
    'WAITER',
] as const;

/*
|--------------------------------------------------------------------------
| Role Check
|--------------------------------------------------------------------------
*/

function isOperationsRole(
    roleCode:
        string,
): boolean {
    return OPERATIONS_ROLES.some(
        (
            allowedRole,
        ) =>
            allowedRole
            ===
            roleCode,
    );
}

/*
|--------------------------------------------------------------------------
| Protected Route
|--------------------------------------------------------------------------
*/

export default function ProtectedRoute() {
    const {
        user,
        loading,
    } =
        useAuth();

    const location =
        useLocation();

    /*
    |--------------------------------------------------------------------------
    | Loading
    |--------------------------------------------------------------------------
    */

    if (
        loading
    ) {
        return (
            <main className="app-loading-screen">
                <div className="app-loading-spinner" />

                <strong>
                    Loading Operations
                </strong>

                <span>
                    Restoring your secure session...
                </span>
            </main>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Not Authenticated
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Check Role
    |--------------------------------------------------------------------------
    */

    const roleCode =
        user.role
            ?.code
        ??
        '';

    if (
        !isOperationsRole(
            roleCode,
        )
    ) {
        return (
            <Navigate
                to="/access-denied"
                replace
            />
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Authorized
    |--------------------------------------------------------------------------
    */

    return (
        <Outlet />
    );
}