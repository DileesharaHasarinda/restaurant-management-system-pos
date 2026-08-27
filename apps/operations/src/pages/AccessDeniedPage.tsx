import {
    Navigate,
} from 'react-router-dom';

import {
    useAuth,
} from '../auth/useAuth';

export default function AccessDeniedPage() {
    const {
        user,
        logout,
    } =
        useAuth();

    if (
        !user
    ) {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    return (
        <main className="ops-denied-page">
            <section>
                <div className="ops-denied-icon">
                    !
                </div>

                <span>
                    ACCESS RESTRICTED
                </span>

                <h1>
                    Operations access unavailable
                </h1>

                <p>
                    Your current account is not authorised
                    to access the restaurant Operations
                    application.
                </p>

                <strong>
                    Current role:
                    {' '}
                    {
                        user.role
                            ?.name
                        ??
                        'Unknown'
                    }
                </strong>

                <button
                    type="button"
                    onClick={
                        () => {
                            void logout();
                        }
                    }
                >
                    Sign Out
                </button>
            </section>
        </main>
    );
}