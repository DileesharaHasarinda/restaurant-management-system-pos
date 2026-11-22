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
    const { user, loading, login } = useAuth();
    const navigate = useNavigate();

    const [loginValue, setLoginValue] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    if (!loading && user) {
        return (
            <Navigate
                to={defaultRouteForUser(user)}
                replace
            />
        );
    }

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
        event.preventDefault();

        if (submitting) return;

        setSubmitting(true);
        setError('');

        const result = await login({
            login: loginValue,
            password,
        });

        if (!result.success) {
            setError(result.message ?? 'Unable to sign in.');
            setSubmitting(false);
            return;
        }

        navigate('/', { replace: true });
    };

    return (
        <main className="ops-login-page">
            <div className="ops-login-glow" aria-hidden="true" />

            <section className="ops-login-card">
                <header className="ops-login-header">
                    <div className="ops-login-logo">P</div>

                    <span className="ops-login-eyebrow">
                        PALMYRA BY VORA
                    </span>

                    <h1>Restaurant Operations</h1>

                    <p>
                        Authentic taste, timeless experience —
                        sign in to manage your restaurant.
                    </p>
                </header>

                {error ? (
                    <div className="ops-login-error" role="alert">
                        {error}
                    </div>
                ) : null}

                <form
                    className="ops-login-form"
                    onSubmit={(event) => { void handleSubmit(event); }}
                >
                    <label>
                        <span>Username or Email</span>
                        <input
                            type="text"
                            autoComplete="username"
                            value={loginValue}
                            disabled={submitting}
                            placeholder="Enter username or email"
                            required
                            autoFocus
                            onChange={(event) => {
                                setLoginValue(event.target.value);
                                if (error) setError('');
                            }}
                        />
                    </label>

                    <label>
                        <span>Password</span>
                        <div className="ops-password-field">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={password}
                                disabled={submitting}
                                placeholder="Enter password"
                                required
                                onChange={(event) => {
                                    setPassword(event.target.value);
                                    if (error) setError('');
                                }}
                            />
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setShowPassword((c) => !c)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </label>

                    <button
                        type="submit"
                        className="ops-login-submit"
                        disabled={submitting}
                    >
                        {submitting ? 'Signing In...' : 'Sign In to Operations'}
                    </button>
                </form>

                <footer className="ops-login-footer">
                    <span className="ops-login-divider" aria-hidden="true" />
                    {/* <small>Protected by Laravel Sanctum</small> */}
                </footer>
            </section>
        </main>
    );
}