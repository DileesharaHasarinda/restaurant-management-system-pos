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
                        Manage terminal information, account security,
                        cashier receipt printing, cash drawer integration
                        and kitchen printing.
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

            {/*
            |--------------------------------------------------------------------------
            | Terminal / Account
            |--------------------------------------------------------------------------
            */}

            <div className="csm-layout">
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
            | Connection Status
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
            | Printer Settings
            |--------------------------------------------------------------------------
            */}

            <section className="csm-printer-section">
                <header className="csm-section-header">
                    <div>
                        <span className="csm-card-kicker">
                            POS HARDWARE
                        </span>

                        <h2>
                            Printer Settings
                        </h2>

                        <p>
                            Configure the cashier receipt printer,
                            connected cash drawer and dedicated
                            kitchen KOT printer.
                        </p>
                    </div>

                    <div className="csm-printer-badge">
                        POS
                    </div>
                </header>

                {/*
                |--------------------------------------------------------------------------
                | Cashier Printer + Cash Drawer
                |--------------------------------------------------------------------------
                */}

                <div className="csm-layout">
                    <section className="csm-card">
                        <div className="csm-card-header">
                            <div>
                                <span className="csm-card-kicker">
                                    CASHIER HARDWARE
                                </span>

                                <h2>
                                    Receipt Printer
                                </h2>

                                <p>
                                    The cashier receipt printer handles
                                    customer receipts and provides the
                                    hardware pulse used to open the
                                    cash drawer.
                                </p>
                            </div>

                            <div className="csm-card-icon">
                                RP
                            </div>
                        </div>

                        <div className="csm-information-list">
                            <InformationRow
                                label="Printer Purpose"
                                value="Customer Receipts"
                            />

                            <InformationRow
                                label="Connection"
                                value="USB / LAN"
                            />

                            <InformationRow
                                label="Paper Width"
                                value="80mm"
                            />

                            <InformationRow
                                label="Print Protocol"
                                value="ESC/POS"
                            />

                            <InformationRow
                                label="Cash Drawer Port"
                                value="DK / CASH DRAWER"
                                status="good"
                            />

                            <InformationRow
                                label="Drawer Control"
                                value="Through Receipt Printer"
                                status="good"
                            />
                        </div>

                        <div className="csm-security-note">
                            <div className="csm-security-note-icon">
                                ✓
                            </div>

                            <div>
                                <strong>
                                    Recommended connection
                                </strong>

                                <span>
                                    Connect the receipt printer directly
                                    to the cashier PC using USB or LAN.
                                    The POS sends ESC/POS printing and
                                    drawer commands to this printer.
                                </span>
                            </div>
                        </div>
                    </section>

                    {/*
                    |--------------------------------------------------------------------------
                    | Cash Drawer
                    |--------------------------------------------------------------------------
                    */}

                    <section className="csm-card">
                        <div className="csm-card-header">
                            <div>
                                <span className="csm-card-kicker">
                                    CASH DRAWER
                                </span>

                                <h2>
                                    Printer-Controlled Drawer
                                </h2>

                                <p>
                                    The cash drawer connects to the
                                    dedicated drawer port on the
                                    cashier receipt printer.
                                </p>
                            </div>

                            <div className="csm-card-icon user">
                                CD
                            </div>
                        </div>

                        <div className="csm-information-list">
                            <InformationRow
                                label="Drawer Cable"
                                value="RJ11 / RJ12"
                            />

                            <InformationRow
                                label="Connect To"
                                value="Receipt Printer DK Port"
                                status="good"
                            />

                            <InformationRow
                                label="Direct PC Connection"
                                value="Not Required"
                            />

                            <InformationRow
                                label="Open Method"
                                value="ESC/POS Drawer Pulse"
                            />

                            <InformationRow
                                label="Automatic Open"
                                value="Cash Payments"
                                status="good"
                            />
                        </div>

                        <div className="csm-security-note">
                            <div className="csm-security-note-icon">
                                !
                            </div>

                            <div>
                                <strong>
                                    Do not connect to LAN
                                </strong>

                                <span>
                                    Although the drawer plug looks similar
                                    to a network or telephone connector,
                                    it must only be connected to the
                                    printer's dedicated DK / CASH DRAWER
                                    socket.
                                </span>
                            </div>
                        </div>
                    </section>
                </div>

                {/*
                |--------------------------------------------------------------------------
                | Physical Connection Diagram
                |--------------------------------------------------------------------------
                */}

                <div className="csm-printer-container">
                    <section className="csm-hardware-info">
                        <div>
                            <span className="csm-hardware-dot receipt" />

                            <div>
                                <strong>
                                    1. Cash Drawer
                                </strong>

                                <span>
                                    RJ11 / RJ12 drawer cable connects
                                    directly to the cashier receipt
                                    printer DK port.
                                </span>
                            </div>
                        </div>

                        <div>
                            <span className="csm-hardware-dot receipt" />

                            <div>
                                <strong>
                                    2. Cashier Receipt Printer
                                </strong>

                                <span>
                                    Connect the printer to the cashier
                                    computer using USB or LAN.
                                </span>
                            </div>
                        </div>

                        <div>
                            <span className="csm-hardware-dot security" />

                            <div>
                                <strong>
                                    3. POS Drawer Command
                                </strong>

                                <span>
                                    After an authorized cash transaction,
                                    the POS sends an ESC/POS drawer pulse
                                    through the receipt printer.
                                </span>
                            </div>
                        </div>
                    </section>
                </div>

                {/*
                |--------------------------------------------------------------------------
                | Kitchen Printer
                |--------------------------------------------------------------------------
                |
                | IMPORTANT:
                |
                | Reuse the existing known-good KitchenPrinterModule.
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

                <div className="csm-printer-container">
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
                            Cashier Printer
                        </strong>

                        <span>
                            Prints customer receipts and controls
                            the physical cash drawer through its
                            DK port.
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
                            Prints kitchen KOT tickets using
                            its own independent LAN printer
                            configuration.
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
                            Receipt printing and drawer pulses
                            remain separate from kitchen KOT
                            printing.
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
        | 'good'
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