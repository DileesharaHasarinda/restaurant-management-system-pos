import {
    FormEvent,
    useState,
} from 'react';

interface LoginScreenProps {
    loading: boolean;

    error:
    string | null;

    onLogin:
    (
        login: string,
        password: string,
    ) => Promise<void>;
}

export default function LoginScreen(
    {
        loading,
        error,
        onLogin,
    }: LoginScreenProps,
) {
    const [
        login,
        setLogin,
    ] =
        useState('');

    const [
        password,
        setPassword,
    ] =
        useState('');

    const [
        showPassword,
        setShowPassword,
    ] =
        useState(false);

    const handleSubmit =
        async (
            event:
                FormEvent<HTMLFormElement>,
        ) => {
            event.preventDefault();

            if (
                loading
                ||
                !login.trim()
                ||
                !password
            ) {
                return;
            }

            await onLogin(
                login.trim(),
                password,
            );
        };

    return (
        <main className="login-screen">
            <section className="login-card">
                <div className="login-brand">
                    <div className="login-brand__mark">
                        RP
                    </div>

                    <div>
                        <p className="eyebrow">
                            CASHIER TERMINAL
                        </p>

                        <h1>
                            Restaurant POS
                        </h1>

                        <p>
                            Secure cashier access
                        </p>
                    </div>
                </div>

                <div className="login-divider" />

                <form
                    className="login-form"
                    onSubmit={
                        handleSubmit
                    }
                >
                    <div>
                        <label
                            className="field-label"
                            htmlFor="login"
                        >
                            Username or Email
                        </label>

                        <input
                            id="login"
                            className="touch-input"
                            autoFocus
                            autoComplete="username"
                            value={login}
                            onChange={
                                (
                                    event,
                                ) =>
                                    setLogin(
                                        event
                                            .target
                                            .value,
                                    )
                            }
                            placeholder="Enter username"
                        />
                    </div>

                    <div>
                        <label
                            className="field-label"
                            htmlFor="password"
                        >
                            Password
                        </label>

                        <div className="password-field">
                            <input
                                id="password"
                                className="touch-input"
                                type={
                                    showPassword
                                        ? 'text'
                                        : 'password'
                                }
                                autoComplete="current-password"
                                value={
                                    password
                                }
                                onChange={
                                    (
                                        event,
                                    ) =>
                                        setPassword(
                                            event
                                                .target
                                                .value,
                                        )
                                }
                                placeholder="Enter password"
                            />

                            <button
                                className="password-toggle"
                                type="button"
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
                    </div>

                    {
                        error
                            ? (
                                <div
                                    className="alert alert--danger"
                                    role="alert"
                                >
                                    {error}
                                </div>
                            )
                            : null
                    }

                    <button
                        className="primary-button login-button"
                        type="submit"
                        disabled={
                            loading
                            ||
                            !login.trim()
                            ||
                            !password
                        }
                    >
                        {
                            loading
                                ? 'Signing In...'
                                : 'Sign In to POS'
                        }
                    </button>
                </form>

                <div className="login-security-note">
                    <strong>
                        Secure terminal
                    </strong>

                    <span>
                        Your login token is stored using
                        the operating system secure
                        credential storage.
                    </span>
                </div>
            </section>
        </main>
    );
}