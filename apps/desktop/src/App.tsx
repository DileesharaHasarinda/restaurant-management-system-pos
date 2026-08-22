import {
    useEffect,
    useState,
} from 'react';

import {
    ApiError,
    api,
} from './api';

import CashierWorkspace from './CashierWorkspace';
import LoginScreen from './LoginScreen';

import type {
    PosUser,
} from './types';

export default function App() {
    const [
        user,
        setUser,
    ] =
        useState<
            PosUser | null
        >(null);

    const [
        booting,
        setBooting,
    ] =
        useState(true);

    const [
        loginLoading,
        setLoginLoading,
    ] =
        useState(false);

    const [
        loginError,
        setLoginError,
    ] =
        useState<
            string | null
        >(null);

    useEffect(
        () => {
            const restoreSession =
                async () => {
                    try {
                        const token =
                            await window
                                .posBridge
                                .getAuthToken();

                        if (!token) {
                            return;
                        }

                        const response =
                            await api.get<PosUser>(
                                '/auth/me',
                            );

                        setUser(
                            response.data,
                        );
                    } catch {
                        await window
                            .posBridge
                            .clearAuthToken();
                    } finally {
                        setBooting(
                            false,
                        );
                    }
                };

            void restoreSession();
        },
        [],
    );

    const login =
        async (
            loginValue: string,
            password: string,
        ) => {
            setLoginLoading(
                true,
            );

            setLoginError(
                null,
            );

            try {
                const device =
                    await window
                        .posBridge
                        .getDeviceInfo();

                const deviceName =
                    `Restaurant POS - ${device.hostname}`;

                const response =
                    await api.login(
                        loginValue,
                        password,
                        deviceName,
                    );

                await window
                    .posBridge
                    .setAuthToken(
                        response
                            .data
                            .access_token,
                    );

                setUser(
                    response.data.user,
                );
            } catch (
            exception
            ) {
                if (
                    exception
                    instanceof ApiError
                ) {
                    setLoginError(
                        exception.message,
                    );
                } else if (
                    exception
                    instanceof Error
                ) {
                    setLoginError(
                        exception.message,
                    );
                } else {
                    setLoginError(
                        'Login could not be completed.',
                    );
                }
            } finally {
                setLoginLoading(
                    false,
                );
            }
        };

    const logout =
        async () => {
            try {
                await api.logout();
            } catch {
                /*
                 * Local logout still occurs if
                 * the API is temporarily offline.
                 */
            }

            await window
                .posBridge
                .clearAuthToken();

            setUser(
                null,
            );
        };

    const expireSession =
        () => {
            void window
                .posBridge
                .clearAuthToken();

            setUser(
                null,
            );

            setLoginError(
                'Your session has expired. Please sign in again.',
            );
        };

    if (booting) {
        return (
            <main className="boot-screen">
                <div className="boot-card">
                    <div className="boot-logo">
                        RP
                    </div>

                    <h1>
                        Restaurant POS
                    </h1>

                    <p>
                        Starting secure cashier terminal...
                    </p>
                </div>
            </main>
        );
    }

    if (!user) {
        return (
            <LoginScreen
                loading={
                    loginLoading
                }
                error={
                    loginError
                }
                onLogin={
                    login
                }
            />
        );
    }

    return (
        <CashierWorkspace
            user={
                user
            }
            onLogout={
                logout
            }
            onSessionExpired={
                expireSession
            }
        />
    );
}