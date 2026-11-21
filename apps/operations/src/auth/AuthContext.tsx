import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import {
    ApiError,
    api,
    authTokenStorage,
} from '../lib/api';

import type {
    AuthUser,
    LoginResponseData,
} from '../types/auth';

import {
    AuthContext,
    type AuthContextValue,
    type LoginInput,
    type LoginResult,
} from './auth-context';

/*
|--------------------------------------------------------------------------
| Provider
|--------------------------------------------------------------------------
*/

export function AuthProvider(
    {
        children,
    }: {
        children:
        ReactNode;
    },
) {
    const [
        user,
        setUser,
    ] =
        useState<AuthUser | null>(
            null,
        );

    const [
        loading,
        setLoading,
    ] =
        useState(
            true,
        );

    /*
    |--------------------------------------------------------------------------
    | Refresh Current User
    |--------------------------------------------------------------------------
    */

    const refreshUser =
        useCallback(
            async (): Promise<void> => {
                const token =
                    authTokenStorage.get();

                if (
                    !token
                ) {
                    setUser(
                        null,
                    );

                    return;
                }

                try {
                    const response =
                        await api.get<AuthUser>(
                            '/auth/me',
                        );

                    setUser(
                        response.data,
                    );
                } catch (
                error
                ) {
                    if (
                        error instanceof ApiError
                        &&
                        (
                            error.status
                            ===
                            401
                            ||
                            error.status
                            ===
                            403
                        )
                    ) {
                        authTokenStorage.clear();

                        setUser(
                            null,
                        );

                        return;
                    }

                    throw error;
                }
            },
            [],
        );

    /*
    |--------------------------------------------------------------------------
    | Restore Existing Session
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const restoreSession =
                async (): Promise<void> => {
                    try {
                        await refreshUser();
                    } catch {
                        /*
                         * A temporary backend/network failure should
                         * not crash the Operations application.
                         */
                    } finally {
                        setLoading(
                            false,
                        );
                    }
                };

            void restoreSession();
        },
        [
            refreshUser,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Login
    |--------------------------------------------------------------------------
    */

    const login =
        useCallback(
            async (
                input:
                    LoginInput,
            ): Promise<LoginResult> => {
                try {
                    const response =
                        await api.post<LoginResponseData>(
                            '/auth/login',

                            {
                                login:
                                    input.login
                                        .trim()
                                        .toLowerCase(),

                                password:
                                    input.password,

                                device_name:
                                    'Restaurant Operations Web',
                            },

                            false,
                        );

                    authTokenStorage.set();

                    setUser(
                        response
                            .data
                            .user,
                    );

                    return {
                        success:
                            true,
                    };
                } catch (
                error
                ) {
                    if (
                        error instanceof ApiError
                    ) {
                        const firstValidationError =
                            Object
                                .values(
                                    error.errors,
                                )
                                .flat()[0];

                        return {
                            success:
                                false,

                            message:
                                firstValidationError
                                ??
                                error.message,
                        };
                    }

                    return {
                        success:
                            false,

                        message:
                            'Unable to sign in.',
                    };
                }
            },
            [],
        );

    /*
    |--------------------------------------------------------------------------
    | Logout
    |--------------------------------------------------------------------------
    */

    const logout =
        useCallback(
            async (): Promise<void> => {
                try {
                    if (
                        authTokenStorage.get()
                    ) {
                        await api.post<null>(
                            '/auth/logout',
                            {},
                        );
                    }
                } catch {
                    /*
                     * Local logout must still succeed if the
                     * server cannot currently be reached.
                     */
                } finally {
                    authTokenStorage.clear();

                    setUser(
                        null,
                    );
                }
            },
            [],
        );

    /*
    |--------------------------------------------------------------------------
    | Permissions
    |--------------------------------------------------------------------------
    */

    const hasPermission =
        useCallback(
            (
                permission:
                    string,
            ): boolean =>
                Boolean(
                    user
                        ?.permissions
                        .includes(
                            permission,
                        ),
                ),
            [
                user,
            ],
        );

    const hasAnyPermission =
        useCallback(
            (
                permissions:
                    string[],
            ): boolean =>
                permissions.some(
                    (
                        permission,
                    ) =>
                        hasPermission(
                            permission,
                        ),
                ),
            [
                hasPermission,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Context Value
    |--------------------------------------------------------------------------
    */

    const value =
        useMemo<AuthContextValue>(
            () => ({
                user,

                loading,

                authenticated:
                    user !== null,

                login,

                logout,

                refreshUser,

                hasPermission,

                hasAnyPermission,
            }),
            [
                user,
                loading,
                login,
                logout,
                refreshUser,
                hasPermission,
                hasAnyPermission,
            ],
        );

    return (
        <AuthContext.Provider
            value={
                value
            }
        >
            {
                children
            }
        </AuthContext.Provider>
    );
}