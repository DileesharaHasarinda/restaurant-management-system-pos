import {
    useState,
    type FormEvent,
} from 'react';

import {
    Navigate,
    useNavigate,
} from 'react-router-dom';

import {
    useAuth,
} from '../auth/useAuth';

import {
    defaultRouteForUser,
} from '../navigation/navigation';

export default function LoginPage() {
    const {
        user,
        loading,
        login,
    } =
        useAuth();

    const navigate =
        useNavigate();

    const [
        loginValue,
        setLoginValue,
    ] =
        useState(
            '',
        );

    const [
        password,
        setPassword,
    ] =
        useState(
            '',
        );

    const [
        submitting,
        setSubmitting,
    ] =
        useState(
            false,
        );

    const [
        error,
        setError,
    ] =
        useState(
            '',
        );

    const [
        showPassword,
        setShowPassword,
    ] =
        useState(
            false,
        );

    /*
    |--------------------------------------------------------------------------
    | Authenticated Redirect
    |--------------------------------------------------------------------------
    */

    if (
        !loading
        &&
        user
    ) {
        return (
            <Navigate
                to={
                    defaultRouteForUser(
                        user,
                    )
                }
                replace
            />
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Submit
    |--------------------------------------------------------------------------
    */

    const handleSubmit =
        async (
            event:
                FormEvent<HTMLFormElement>,
        ): Promise<void> => {
            event.preventDefault();

            if (
                submitting
            ) {
                return;
            }

            setSubmitting(
                true,
            );

            setError(
                '',
            );

            const result =
                await login({
                    login:
                        loginValue,

                    password,
                });

            if (
                !result.success
            ) {
                setError(
                    result.message
                    ??
                    'Unable to sign in.',
                );

                setSubmitting(
                    false,
                );

                return;
            }

            navigate(
                '/',
                {
                    replace:
                        true,
                },
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <main className="ops-login-page">
            <section className="ops-login-brand">
                <div className="ops-login-brand-inner">
                    <div className="ops-login-logo">
                        RM
                    </div>

                    <span className="ops-login-eyebrow">
                        RESTAURANT OPERATIONS
                    </span>

                    <h1>
                        Manage your restaurant
                        from anywhere.
                    </h1>

                    <p>
                        Secure access for owners,
                        administrators, managers and
                        restaurant staff.
                    </p>

                    <div className="ops-login-features">
                        <span>
                            ✓ Menu & Tables
                        </span>

                        <span>
                            ✓ Inventory & Recipes
                        </span>

                        <span>
                            ✓ Purchases & Expenses
                        </span>

                        <span>
                            ✓ Reports & Administration
                        </span>
                    </div>
                </div>
            </section>

            <section className="ops-login-panel">
                <form
                    className="ops-login-card"
                    onSubmit={
                        (
                            event,
                        ) => {
                            void handleSubmit(
                                event,
                            );
                        }
                    }
                >
                    <header>
                        <span>
                            SECURE SIGN IN
                        </span>

                        <h2>
                            Welcome back
                        </h2>

                        <p>
                            Sign in with your restaurant
                            operations account.
                        </p>
                    </header>

                    {
                        error
                            ? (
                                <div
                                    className="ops-login-error"
                                    role="alert"
                                >
                                    {
                                        error
                                    }
                                </div>
                            )
                            : null
                    }

                    <label>
                        <span>
                            Username or Email
                        </span>

                        <input
                            type="text"
                            autoComplete="username"
                            value={
                                loginValue
                            }
                            disabled={
                                submitting
                            }
                            placeholder="Enter username or email"
                            required
                            autoFocus
                            onChange={
                                (
                                    event,
                                ) => {
                                    setLoginValue(
                                        event.target.value,
                                    );

                                    if (
                                        error
                                    ) {
                                        setError(
                                            '',
                                        );
                                    }
                                }
                            }
                        />
                    </label>

                    <label>
                        <span>
                            Password
                        </span>

                        <div className="ops-password-field">
                            <input
                                type={
                                    showPassword
                                        ? 'text'
                                        : 'password'
                                }
                                autoComplete="current-password"
                                value={
                                    password
                                }
                                disabled={
                                    submitting
                                }
                                placeholder="Enter password"
                                required
                                onChange={
                                    (
                                        event,
                                    ) => {
                                        setPassword(
                                            event.target.value,
                                        );

                                        if (
                                            error
                                        ) {
                                            setError(
                                                '',
                                            );
                                        }
                                    }
                                }
                            />

                            <button
                                type="button"
                                disabled={
                                    submitting
                                }
                                onClick={
                                    () =>
                                        setShowPassword(
                                            (
                                                current,
                                            ) =>
                                                !current,
                                        )
                                }
                            >
                                {
                                    showPassword
                                        ? 'Hide'
                                        : 'Show'
                                }
                            </button>
                        </div>
                    </label>

                    <button
                        type="submit"
                        className="ops-login-submit"
                        disabled={
                            submitting
                        }
                    >
                        {
                            submitting
                                ? 'Signing In...'
                                : 'Sign In to Operations'
                        }
                    </button>

                    <footer>
                        Protected by Laravel Sanctum
                    </footer>
                </form>
            </section>
        </main>
    );
}