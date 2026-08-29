import {
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    NavLink,
    Outlet,
    useLocation,
    useNavigate,
} from 'react-router-dom';

import OperationsIcon
    from '../components/OperationsIcon';

import {
    navigationForUser,
} from '../navigation/navigation';

import {
    useAuth,
} from '../auth/useAuth';

import {
    authTokenStorage,
} from '../lib/api';

import {
    connectStaffRealtime,
} from '../realtime/staffRealtime';

import {
    publishRealtimeReconnect,
    publishStaffRealtime,
} from '../realtime/realtimeBus';

/*
|--------------------------------------------------------------------------
| Page Titles
|--------------------------------------------------------------------------
*/

const PAGE_TITLES:
    Record<
        string,
        string
    > = {
    '/dashboard':
        'Dashboard',

    '/tables':
        'Tables',

    '/orders':
        'Orders',

    '/menu':
        'Menu Management',

    '/inventory':
        'Inventory',

    '/ingredients':
        'Ingredients',

    '/stock-adjustments':
        'Stock Adjustments',

    '/wastage':
        'Wastage',

    '/recipes':
        'Recipes',

    '/suppliers':
        'Suppliers',

    '/purchases':
        'Purchases',

    '/supplier-payments':
        'Supplier Payments',

    '/expenses':
        'Expenses',

    '/business-day':
        'Business Day',

    '/reports':
        'Reports',

    '/users':
        'Users & Roles',

    '/restaurant-settings':
        'Restaurant Settings',

    '/website':
        'Website & Reviews',

    '/audit-logs':
        'Audit Logs',
};

/*
|--------------------------------------------------------------------------
| Layout
|--------------------------------------------------------------------------
*/

export default function OperationsLayout() {
    const {
        user,
        logout,
        refreshUser,
    } =
        useAuth();

    const location =
        useLocation();

    const navigate =
        useNavigate();

    const [
        sidebarOpen,
        setSidebarOpen,
    ] =
        useState(
            false,
        );

    const [
        loggingOut,
        setLoggingOut,
    ] =
        useState(
            false,
        );

    const [
        realtimeState,
        setRealtimeState,
    ] =
        useState(
            'initialized',
        );

    /*
    |--------------------------------------------------------------------------
    | Navigation
    |--------------------------------------------------------------------------
    */

    const navigation =
        useMemo(
            () =>
                user
                    ? navigationForUser(
                        user,
                    )
                    : [],
            [
                user,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Reverb
    |--------------------------------------------------------------------------
    |
    | Exactly one Operations Reverb connection.
    |
    | Pages do NOT create their own Echo connection.
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            if (
                !user
            ) {
                return;
            }

            const token =
                authTokenStorage.get();

            if (
                !token
            ) {
                return;
            }

            let disposed =
                false;

            const disconnect =
                connectStaffRealtime({
                    token,

                    /*
                     * Orders are also represented through the generic
                     * staff invalidation stream.
                     *
                     * Rich order events remain available for notifications,
                     * but Operations does not need duplicate data fetching
                     * from this callback.
                     */
                    onOrder:
                        () => {
                            //
                        },

                    onStaffUpdate:
                        (
                            payload,
                        ) => {
                            if (
                                disposed
                            ) {
                                return;
                            }

                            publishStaffRealtime(
                                payload,
                            );

                            /*
                             * Role / permission / user-status changes can
                             * affect the currently logged-in Operations user.
                             */
                            if (
                                payload.domain
                                ===
                                'users'
                            ) {
                                void refreshUser();
                            }
                        },

                    onReconnect:
                        () => {
                            if (
                                disposed
                            ) {
                                return;
                            }

                            publishRealtimeReconnect();

                            /*
                             * Authentication/permissions may also have
                             * changed while disconnected.
                             */
                            void refreshUser();
                        },

                    onStateChange:
                        (
                            state,
                        ) => {
                            if (
                                disposed
                            ) {
                                return;
                            }

                            setRealtimeState(
                                state,
                            );
                        },
                });

            return () => {
                disposed =
                    true;

                disconnect();
            };
        },
        [
            refreshUser,
            user,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | ProtectedRoute Normally Prevents This
    |--------------------------------------------------------------------------
    */

    if (
        !user
    ) {
        return null;
    }

    const pageTitle =
        PAGE_TITLES[
        location.pathname
        ]
        ??
        'Operations';

    const roleName =
        user.role
            ?.name
        ??
        'Staff';

    const initials =
        user.name
            .trim()
            .split(
                /\s+/,
            )
            .slice(
                0,
                2,
            )
            .map(
                (
                    value,
                ) =>
                    value[0]
                    ??
                    '',
            )
            .join(
                '',
            )
            .toUpperCase();

    const realtimeLabel =
        realtimeState
            ===
            'connected'
            ? 'Realtime Live'
            : realtimeState
                ===
                'connecting'
                ||
                realtimeState
                ===
                'initialized'
                ? 'Connecting'
                : 'Reconnecting';

    const handleLogout =
        async (): Promise<void> => {
            if (
                loggingOut
            ) {
                return;
            }

            setLoggingOut(
                true,
            );

            await logout();

            navigate(
                '/login',
                {
                    replace:
                        true,
                },
            );
        };

    return (
        <div className="ops-shell">
            {
                sidebarOpen
                    ? (
                        <button
                            type="button"
                            className="ops-sidebar-backdrop"
                            aria-label="Close navigation"
                            onClick={
                                () =>
                                    setSidebarOpen(
                                        false,
                                    )
                            }
                        />
                    )
                    : null
            }

            <aside
                className={
                    sidebarOpen
                        ? 'ops-sidebar open'
                        : 'ops-sidebar'
                }
            >
                <header className="ops-brand">
                    <div className="ops-brand-mark">
                        RM
                    </div>

                    <div>
                        <strong>
                            Restaurant
                        </strong>

                        <span>
                            Management System
                        </span>
                    </div>

                    <button
                        type="button"
                        className="ops-sidebar-close"
                        aria-label="Close navigation"
                        onClick={
                            () =>
                                setSidebarOpen(
                                    false,
                                )
                        }
                    >
                        ×
                    </button>
                </header>

                <section className="ops-sidebar-user">
                    <div className="ops-user-avatar">
                        {
                            initials
                        }
                    </div>

                    <div>
                        <strong>
                            {
                                user.name
                            }
                        </strong>

                        <span>
                            {
                                roleName
                            }
                        </span>
                    </div>
                </section>

                <nav
                    className="ops-navigation"
                    aria-label="Operations navigation"
                >
                    {
                        navigation.map(
                            (
                                section,
                            ) => (
                                <section
                                    className="ops-navigation-section"
                                    key={
                                        section.title
                                    }
                                >
                                    <h2>
                                        {
                                            section.title
                                        }
                                    </h2>

                                    <div>
                                        {
                                            section.items.map(
                                                (
                                                    item,
                                                ) => (
                                                    <NavLink
                                                        key={
                                                            item.path
                                                        }
                                                        to={
                                                            item.path
                                                        }
                                                        className={
                                                            (
                                                                {
                                                                    isActive,
                                                                },
                                                            ) =>
                                                                isActive
                                                                    ? 'ops-nav-link active'
                                                                    : 'ops-nav-link'
                                                        }
                                                        onClick={
                                                            () =>
                                                                setSidebarOpen(
                                                                    false,
                                                                )
                                                        }
                                                    >
                                                        <OperationsIcon
                                                            name={
                                                                item.icon
                                                            }
                                                        />

                                                        <span>
                                                            {
                                                                item.label
                                                            }
                                                        </span>

                                                        <span className="ops-nav-arrow">
                                                            ›
                                                        </span>
                                                    </NavLink>
                                                ),
                                            )
                                        }
                                    </div>
                                </section>
                            ),
                        )
                    }
                </nav>

                <footer className="ops-sidebar-footer">
                    <button
                        type="button"
                        disabled={
                            loggingOut
                        }
                        onClick={
                            () => {
                                void handleLogout();
                            }
                        }
                    >
                        {
                            loggingOut
                                ? 'Signing Out...'
                                : 'Sign Out'
                        }
                    </button>

                    <small>
                        Secure Operations Portal
                    </small>
                </footer>
            </aside>

            <div className="ops-main">
                <header className="ops-topbar">
                    <div className="ops-topbar-left">
                        <button
                            type="button"
                            className="ops-menu-button"
                            aria-label="Open navigation"
                            onClick={
                                () =>
                                    setSidebarOpen(
                                        true,
                                    )
                            }
                        >
                            ☰
                        </button>

                        <div>
                            <span>
                                OPERATIONS
                            </span>

                            <h1>
                                {
                                    pageTitle
                                }
                            </h1>
                        </div>
                    </div>

                    <div className="ops-topbar-user">
                        <div>
                            <strong>
                                {
                                    realtimeLabel
                                }
                            </strong>

                            <span>
                                {
                                    user.name
                                }
                                {' • '}
                                {
                                    roleName
                                }
                            </span>
                        </div>

                        <div className="ops-topbar-avatar">
                            {
                                initials
                            }
                        </div>
                    </div>
                </header>

                <main className="ops-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}