import KitchenPrinterModule
    from '../kitchen-printer/KitchenPrinterModule';

import {
    API_BASE_URL,
} from '../../api';

import type {
    PosUser,
} from '../../types';

import './SettingsModule.css';

/*
|--------------------------------------------------------------------------
| Props
|--------------------------------------------------------------------------
*/

interface SettingsModuleProps {
    user:
    PosUser;

    online:
    boolean;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const getRoleName =
    (
        user:
            PosUser,
    ): string =>
        user.role
            ?.name
        ??
        'Unknown';

const getConnectionLabel =
    (
        online:
            boolean,
    ): string =>
        online
            ? 'Connected'
            : 'Disconnected';

/*
|--------------------------------------------------------------------------
| Settings Module
|--------------------------------------------------------------------------
*/

export default function SettingsModule(
    {
        user,
        online,
    }: SettingsModuleProps,
) {
    return (
        <div className="cashier-settings-module">
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

            <header className="csm-header">
                <div>
                    <span className="csm-eyebrow">
                        CASHIER TERMINAL
                    </span>

                    <h1>
                        Settings
                    </h1>

                    <p>
                        Review the cashier terminal connection,
                        signed-in account, security configuration
                        and kitchen printer settings.
                    </p>
                </div>

                <div
                    className={
                        online
                            ? 'csm-connection-pill online'
                            : 'csm-connection-pill offline'
                    }
                >
                    <span />

                    {
                        getConnectionLabel(
                            online,
                        )
                    }
                </div>
            </header>

            {/*
            |--------------------------------------------------------------------------
            | Overview
            |--------------------------------------------------------------------------
            */}

            <section className="csm-summary-grid">
                <SummaryCard
                    label="Connection"
                    value={
                        getConnectionLabel(
                            online,
                        )
                    }
                    tone={
                        online
                            ? 'success'
                            : 'danger'
                    }
                />

                <SummaryCard
                    label="Signed In User"
                    value={
                        user.name
                    }
                />

                <SummaryCard
                    label="Role"
                    value={
                        getRoleName(
                            user,
                        )
                    }
                    tone="primary"
                />

                <SummaryCard
                    label="Permissions"
                    value={
                        String(
                            user.permissions.length,
                        )
                    }
                />
            </section>

            <div className="csm-layout">
                {/*
                |--------------------------------------------------------------------------
                | Terminal Information
                |--------------------------------------------------------------------------
                */}

                <section className="csm-card">
                    <div className="csm-card-header">
                        <div>
                            <span className="csm-card-kicker">
                                TERMINAL
                            </span>

                            <h2>
                                System Information
                            </h2>

                            <p>
                                Current cashier application and
                                API connection information.
                            </p>
                        </div>

                        <div className="csm-card-icon">
                            PC
                        </div>
                    </div>

                    <div className="csm-information-list">
                        <InformationRow
                            label="API Server"
                            value={
                                API_BASE_URL
                            }
                            monospace
                        />

                        <InformationRow
                            label="API Status"
                            value={
                                online
                                    ? 'Online'
                                    : 'Offline'
                            }
                            status={
                                online
                                    ? 'good'
                                    : 'bad'
                            }
                        />

                        <InformationRow
                            label="Application"
                            value="Restaurant Cashier POS"
                        />

                        <InformationRow
                            label="Application Type"
                            value="Electron Desktop"
                        />

                        <InformationRow
                            label="Credential Storage"
                            value="OS Secure Storage"
                            status="good"
                        />

                        <InformationRow
                            label="Session Security"
                            value="Laravel Sanctum"
                            status="good"
                        />
                    </div>
                </section>

                {/*
                |--------------------------------------------------------------------------
                | User / Security
                |--------------------------------------------------------------------------
                */}

                <section className="csm-card">
                    <div className="csm-card-header">
                        <div>
                            <span className="csm-card-kicker">
                                ACCOUNT
                            </span>

                            <h2>
                                Cashier Account
                            </h2>

                            <p>
                                Information about the currently
                                authenticated POS user.
                            </p>
                        </div>

                        <div className="csm-card-icon user">
                            US
                        </div>
                    </div>

                    <div className="csm-user-profile">
                        <div className="csm-user-avatar">
                            {
                                user.name
                                    .trim()
                                    .slice(
                                        0,
                                        2,
                                    )
                                    .toUpperCase()
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
                                    getRoleName(
                                        user,
                                    )
                                }
                            </span>
                        </div>
                    </div>

                    <div className="csm-information-list">
                        <InformationRow
                            label="Role"
                            value={
                                getRoleName(
                                    user,
                                )
                            }
                        />

                        <InformationRow
                            label="Assigned Permissions"
                            value={
                                String(
                                    user.permissions.length,
                                )
                            }
                        />

                        <InformationRow
                            label="Authentication"
                            value="Active Session"
                            status="good"
                        />
                    </div>

                    <div className="csm-security-note">
                        <div className="csm-security-note-icon">
                            ✓
                        </div>

                        <div>
                            <strong>
                                Secure cashier session
                            </strong>

                            <span>
                                Authentication credentials are not
                                stored directly in the renderer.
                                The desktop application uses the
                                configured secure credential flow.
                            </span>
                        </div>
                    </div>
                </section>
            </div>

            {/*
            |--------------------------------------------------------------------------
            | Connection Information
            |--------------------------------------------------------------------------
            */}

            <section
                className={
                    online
                        ? 'csm-connection-card online'
                        : 'csm-connection-card offline'
                }
            >
                <div className="csm-connection-icon">
                    {
                        online
                            ? '✓'
                            : '!'
                    }
                </div>

                <div>
                    <strong>
                        {
                            online
                                ? 'Laravel API is connected'
                                : 'Laravel API connection is unavailable'
                        }
                    </strong>

                    <span>
                        {
                            online
                                ? 'The cashier terminal can currently communicate with the restaurant backend.'
                                : 'Check the backend server, network connection and API configuration before processing live transactions.'
                        }
                    </span>
                </div>
            </section>

            {/*
            |--------------------------------------------------------------------------
            | Kitchen Printer
            |--------------------------------------------------------------------------
            |
            | IMPORTANT:
            |
            | We intentionally reuse the existing known-good
            | KitchenPrinterModule.
            |
            | Do not move:
            |
            | - kitchenPrinter.ts
            | - kitchenPrintClient.ts
            | - kitchenPrintWorker.ts
            | - kitchenPrinterTypes.ts
            | - preload.ts
            | - main.ts
            |--------------------------------------------------------------------------
            */}

            <section className="csm-printer-section">
                <header className="csm-section-header">
                    <div>
                        <span className="csm-card-kicker">
                            KITCHEN HARDWARE
                        </span>

                        <h2>
                            Kitchen Printer
                        </h2>

                        <p>
                            Configure and test the dedicated
                            kitchen KOT printer.
                        </p>
                    </div>

                    <div className="csm-printer-badge">
                        KOT
                    </div>
                </header>

                <div className="csm-printer-container">
                    <KitchenPrinterModule />
                </div>
            </section>

            {/*
            |--------------------------------------------------------------------------
            | Hardware Separation
            |--------------------------------------------------------------------------
            */}

            <section className="csm-hardware-info">
                <div>
                    <span className="csm-hardware-dot receipt" />

                    <div>
                        <strong>
                            Receipt Printer
                        </strong>

                        <span>
                            Receipt printer and cash drawer
                            configuration is managed from the
                            Cash Drawer module.
                        </span>
                    </div>
                </div>

                <div>
                    <span className="csm-hardware-dot kitchen" />

                    <div>
                        <strong>
                            Kitchen Printer
                        </strong>

                        <span>
                            Kitchen KOT printing uses its own
                            separate network printer configuration.
                        </span>
                    </div>
                </div>

                <div>
                    <span className="csm-hardware-dot security" />

                    <div>
                        <strong>
                            Hardware Isolation
                        </strong>

                        <span>
                            Receipt printing, drawer pulses and
                            kitchen printing remain separate
                            hardware workflows.
                        </span>
                    </div>
                </div>
            </section>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Summary Card
|--------------------------------------------------------------------------
*/

function SummaryCard(
    {
        label,
        value,
        tone = 'neutral',
    }: {
        label:
        string;

        value:
        string;

        tone?:
        | 'neutral'
        | 'primary'
        | 'success'
        | 'danger';
    },
) {
    return (
        <article
            className={
                `csm-summary-card ${tone}`
            }
        >
            <span>
                {
                    label
                }
            </span>

            <strong>
                {
                    value
                }
            </strong>
        </article>
    );
}

/*
|--------------------------------------------------------------------------
| Information Row
|--------------------------------------------------------------------------
*/

function InformationRow(
    {
        label,
        value,
        monospace = false,
        status,
    }: {
        label:
        string;

        value:
        string;

        monospace?:
        boolean;

        status?:
        'good'
        | 'bad';
    },
) {
    return (
        <div className="csm-information-row">
            <span>
                {
                    label
                }
            </span>

            <div>
                {
                    status
                        ? (
                            <span
                                className={
                                    `csm-information-status ${status}`
                                }
                            />
                        )
                        : null
                }

                <strong
                    className={
                        monospace
                            ? 'monospace'
                            : ''
                    }
                >
                    {
                        value
                    }
                </strong>
            </div>
        </div>
    );
}