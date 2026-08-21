export default function App() {
    return (
        <main className="app-shell">
            <section className="welcome-card">
                <div className="status-badge">
                    PHASE 1 READY
                </div>

                <h1>
                    Restaurant POS
                </h1>

                <p className="subtitle">
                    Cashier Desktop Application
                </p>

                <div className="system-grid">
                    <div className="system-card">
                        <span className="system-card__label">
                            Application
                        </span>

                        <strong>
                            Electron + React
                        </strong>
                    </div>

                    <div className="system-card">
                        <span className="system-card__label">
                            Language
                        </span>

                        <strong>
                            TypeScript
                        </strong>
                    </div>

                    <div className="system-card">
                        <span className="system-card__label">
                            Backend
                        </span>

                        <strong>
                            Laravel API
                        </strong>
                    </div>

                    <div className="system-card">
                        <span className="system-card__label">
                            Status
                        </span>

                        <strong>
                            Development
                        </strong>
                    </div>
                </div>

                <div className="notice">
                    Project structure initialized successfully.
                    Restaurant modules will be implemented in
                    the following phases.
                </div>
            </section>
        </main>
    );
}