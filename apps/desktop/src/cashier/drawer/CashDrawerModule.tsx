import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    useStaffRealtimeRefresh,
} from "../../realtime/realtimeBus";

import {
    ApiError,
    api,
} from "../../api";

import type {
    ReceiptPrinterSettings,
} from "../../receiptPrinterTypes";

import type {
    CurrentCashierShiftResponse,
    DrawerCashierShift,
    ManualDrawerOpenResponse,
} from "./types";

interface CashDrawerModuleProps {
    onSessionExpired?: () => void;
}

const DEFAULT_SETTINGS: ReceiptPrinterSettings = {
    printerName:
        "Cashier Receipt Printer",

    host:
        "",

    port:
        9100,

    paperWidthMm:
        80,

    connectTimeoutMs:
        4000,

    drawerPin:
        0,

    drawerPulseOnMs:
        50,

    drawerPulseOffMs:
        500,
};

const makeUuid = (): string => {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
        .replace(
            /[xy]/g,
            (character) => {
                const random =
                    (Math.random() * 16) | 0;

                const value =
                    character === "x"
                        ? random
                        : (random & 0x3) | 0x8;

                return value.toString(16);
            }
        );
};

const money = (
    value:
        number
        |
        string
        |
        null
        |
        undefined
): string => {
    const amount =
        Number(
            value ?? 0
        );

    if (
        !Number.isFinite(
            amount
        )
    ) {
        return "Rs. 0.00";
    }

    return `Rs. ${amount.toLocaleString(
        "en-LK",
        {
            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2,
        }
    )}`;
};

export default function CashDrawerModule(
    {
        onSessionExpired,
    }: CashDrawerModuleProps
) {
    const [
        settings,
        setSettings,
    ] =
        useState<ReceiptPrinterSettings>(
            DEFAULT_SETTINGS
        );

    const [
        shift,
        setShift,
    ] =
        useState<DrawerCashierShift | null>(
            null
        );

    const [
        loading,
        setLoading,
    ] =
        useState(
            true
        );

    const [
        busy,
        setBusy,
    ] =
        useState(
            false
        );

    const [
        message,
        setMessage,
    ] =
        useState(
            ""
        );

    const [
        error,
        setError,
    ] =
        useState(
            ""
        );

    const [
        reason,
        setReason,
    ] =
        useState(
            ""
        );

    /*
    |--------------------------------------------------------------------------
    | Manual Open Idempotency
    |--------------------------------------------------------------------------
    |
    | Keep this UUID unchanged if the API request fails because of a
    | network problem.
    |
    | If Laravel actually received the first request, retrying with the
    | same UUID will return should_open = false and protect the drawer
    | from a duplicate pulse.
    |--------------------------------------------------------------------------
    */

    const [
        manualOpenRequestId,
        setManualOpenRequestId,
    ] =
        useState(
            () =>
                makeUuid()
        );

    /*
    |--------------------------------------------------------------------------
    | Error Handling
    |--------------------------------------------------------------------------
    */

    const handleError =
        useCallback(
            (
                exception:
                    unknown
            ): void => {
                if (
                    exception instanceof ApiError
                    &&
                    exception.status === 401
                ) {
                    onSessionExpired?.();

                    return;
                }

                setError(
                    exception instanceof Error
                        ? exception.message
                        : "Cash drawer operation failed."
                );
            },
            [
                onSessionExpired,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Load Current Shift
    |--------------------------------------------------------------------------
    */

    const loadCurrentShift =
        useCallback(
            async (): Promise<void> => {
                const response =
                    await api.get<CurrentCashierShiftResponse>(
                        "/cashier-shifts/current"
                    );

                setShift(
                    response
                        .data
                        .shift
                );
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | CashierWorkspace owns the single Reverb/Echo connection.
    |
    | This module only listens to internal realtime invalidation events and
    | silently reloads the authoritative current shift from Laravel.
    |
    | No drawer hardware action, payment operation or manual-open POST is
    | repeated because of realtime.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "cash",
            "billing",
            "expenses",
        ],
        () =>
            loadCurrentShift(),
    );

    /*
    |--------------------------------------------------------------------------
    | Initial Load
    |--------------------------------------------------------------------------
    */

    const load =
        useCallback(
            async (): Promise<void> => {
                setLoading(
                    true
                );

                setError(
                    ""
                );

                try {
                    const [
                        savedSettings,
                        shiftResponse,
                    ] =
                        await Promise.all([
                            window
                                .posBridge
                                .getReceiptPrinterSettings(),

                            api.get<CurrentCashierShiftResponse>(
                                "/cashier-shifts/current"
                            ),
                        ]);

                    setSettings(
                        savedSettings
                    );

                    setShift(
                        shiftResponse
                            .data
                            .shift
                    );
                } catch (
                exception
                ) {
                    handleError(
                        exception
                    );
                } finally {
                    setLoading(
                        false
                    );
                }
            },
            [
                handleError,
            ]
        );

    useEffect(
        () => {
            void load();
        },
        [
            load,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Run Hardware Action
    |--------------------------------------------------------------------------
    */

    const runAction =
        async (
            action:
                () => Promise<void>
        ): Promise<void> => {
            if (
                busy
            ) {
                return;
            }

            setBusy(
                true
            );

            setMessage(
                ""
            );

            setError(
                ""
            );

            try {
                await action();
            } catch (
            exception
            ) {
                handleError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Save Printer Settings
    |--------------------------------------------------------------------------
    */

    const saveSettings =
        async (): Promise<void> => {
            await runAction(
                async () => {
                    const saved =
                        await window
                            .posBridge
                            .setReceiptPrinterSettings(
                                settings
                            );

                    setSettings(
                        saved
                    );

                    setMessage(
                        "Receipt printer and cash drawer settings saved successfully."
                    );
                }
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Test Printer Connection
    |--------------------------------------------------------------------------
    */

    const testConnection =
        async (): Promise<void> => {
            await runAction(
                async () => {
                    const saved =
                        await window
                            .posBridge
                            .setReceiptPrinterSettings(
                                settings
                            );

                    setSettings(
                        saved
                    );

                    const result =
                        await window
                            .posBridge
                            .testReceiptPrinterConnection();

                    setMessage(
                        result.message
                    );
                }
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Test Receipt
    |--------------------------------------------------------------------------
    */

    const testReceipt =
        async (): Promise<void> => {
            await runAction(
                async () => {
                    const saved =
                        await window
                            .posBridge
                            .setReceiptPrinterSettings(
                                settings
                            );

                    setSettings(
                        saved
                    );

                    const result =
                        await window
                            .posBridge
                            .testReceiptPrinter();

                    setMessage(
                        `${result.message} ${result.bytesWritten} bytes sent.`
                    );
                }
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Test Drawer
    |--------------------------------------------------------------------------
    |
    | Hardware-only diagnostic.
    |
    | No financial transaction or MANUAL_OPEN record is created.
    |--------------------------------------------------------------------------
    */

    const testDrawer =
        async (): Promise<void> => {
            await runAction(
                async () => {
                    const saved =
                        await window
                            .posBridge
                            .setReceiptPrinterSettings(
                                settings
                            );

                    setSettings(
                        saved
                    );

                    const result =
                        await window
                            .posBridge
                            .testCashDrawer();

                    setMessage(
                        result.message
                    );
                }
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Manual Open
    |--------------------------------------------------------------------------
    |
    | Production operational opening:
    |
    | React
    |   ↓
    | Laravel permission + ownership + shift validation
    |   ↓
    | MANUAL_OPEN audit/ledger
    |   ↓
    | should_open = true
    |   ↓
    | Electron pulse
    |--------------------------------------------------------------------------
    */

    const manualOpen =
        async (): Promise<void> => {
            if (
                !shift
            ) {
                setError(
                    "Open a cashier shift before manually opening the cash drawer."
                );

                return;
            }

            const cleanReason =
                reason.trim();

            if (
                !cleanReason
            ) {
                setError(
                    "Enter a reason for manually opening the cash drawer."
                );

                return;
            }

            await runAction(
                async () => {
                    /*
                     * IMPORTANT:
                     *
                     * Do not create another UUID here.
                     *
                     * If this request previously reached Laravel but the
                     * response was lost, retrying must use the SAME UUID.
                     */
                    const response =
                        await api.post<ManualDrawerOpenResponse>(
                            `/cashier-shifts/${shift.id}/manual-open`,
                            {
                                client_request_id:
                                    manualOpenRequestId,

                                reason:
                                    cleanReason,
                            }
                        );

                    /*
                     * At this point Laravel definitely returned a response.
                     * The request is resolved, so the next user operation
                     * should receive a new idempotency key.
                     */
                    setManualOpenRequestId(
                        makeUuid()
                    );

                    if (
                        !response
                            .data
                            .cash_drawer
                            .should_open
                    ) {
                        setMessage(
                            "This manual drawer request was already processed. No duplicate hardware pulse was sent."
                        );

                        setReason(
                            ""
                        );

                        await loadCurrentShift();

                        return;
                    }

                    /*
                     * Laravel authorized exactly one hardware pulse.
                     */
                    try {
                        const result =
                            await window
                                .posBridge
                                .openCashDrawerHardware();

                        setMessage(
                            result.message
                        );
                    } catch (
                    hardwareException
                    ) {
                        /*
                         * The backend authorization/audit already succeeded.
                         *
                         * Do not pretend the MANUAL_OPEN database operation
                         * failed just because the physical printer failed.
                         */
                        setError(
                            `Manual drawer opening was authorized and recorded, but the physical drawer did not open: ${hardwareException instanceof Error
                                ? hardwareException.message
                                : "Unknown hardware error."
                            }`
                        );
                    }

                    setReason(
                        ""
                    );

                    await loadCurrentShift();
                }
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Loading
    |--------------------------------------------------------------------------
    */

    if (
        loading
    ) {
        return (
            <div className="drawer-page">
                <style>
                    {styles}
                </style>

                <div className="drawer-loading">
                    Loading cash drawer configuration...
                </div>
            </div>
        );
    }

    return (
        <div className="drawer-page">
            <style>
                {styles}
            </style>

            <header className="drawer-header">
                <div>
                    <span className="drawer-eyebrow">
                        CASH MANAGEMENT
                    </span>

                    <h1>
                        Cash Drawer
                    </h1>

                    <p>
                        Configure the cashier receipt printer,
                        test the physical drawer and perform
                        audited manual openings.
                    </p>
                </div>

                <div
                    className={
                        shift
                            ? "drawer-shift-status is-open"
                            : "drawer-shift-status is-closed"
                    }
                >
                    {
                        shift
                            ? "SHIFT OPEN"
                            : "NO OPEN SHIFT"
                    }
                </div>
            </header>

            {
                error
                    ? (
                        <div className="drawer-alert error">
                            {error}
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div className="drawer-alert success">
                            {message}
                        </div>
                    )
                    : null
            }

            <section className="drawer-overview-grid">
                <div className="drawer-overview-card">
                    <span>
                        Current Shift
                    </span>

                    <strong>
                        {
                            shift
                                ?.shift_number
                            ??
                            "Not Open"
                        }
                    </strong>
                </div>

                <div className="drawer-overview-card">
                    <span>
                        Expected Cash
                    </span>

                    <strong>
                        {
                            money(
                                shift
                                    ?.expected_cash
                                ??
                                0
                            )
                        }
                    </strong>
                </div>

                <div className="drawer-overview-card">
                    <span>
                        Receipt Printer
                    </span>

                    <strong>
                        {
                            settings
                                .host
                                .trim()
                                ? settings.host
                                : "Not Configured"
                        }
                    </strong>
                </div>

                <div className="drawer-overview-card">
                    <span>
                        TCP Port
                    </span>

                    <strong>
                        {settings.port}
                    </strong>
                </div>
            </section>

            <div className="drawer-main-grid">
                <section className="drawer-card">
                    <div className="drawer-card-header">
                        <div>
                            <span className="drawer-card-kicker">
                                HARDWARE
                            </span>

                            <h2>
                                Receipt Printer & Drawer
                            </h2>
                        </div>

                        <div className="drawer-icon">
                            PR
                        </div>
                    </div>

                    <div className="drawer-form-grid">
                        <label className="drawer-field drawer-wide-field">
                            <span>
                                Printer Name
                            </span>

                            <input
                                value={
                                    settings
                                        .printerName
                                }
                                disabled={
                                    busy
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setSettings({
                                            ...settings,

                                            printerName:
                                                event
                                                    .target
                                                    .value,
                                        });
                                    }
                                }
                            />
                        </label>

                        <label className="drawer-field">
                            <span>
                                Printer IP Address
                            </span>

                            <input
                                value={
                                    settings.host
                                }
                                placeholder="192.168.1.150"
                                disabled={
                                    busy
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setSettings({
                                            ...settings,

                                            host:
                                                event
                                                    .target
                                                    .value,
                                        });
                                    }
                                }
                            />
                        </label>

                        <label className="drawer-field">
                            <span>
                                TCP Port
                            </span>

                            <input
                                type="number"
                                min="1"
                                max="65535"
                                value={
                                    settings.port
                                }
                                disabled={
                                    busy
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setSettings({
                                            ...settings,

                                            port:
                                                Number(
                                                    event
                                                        .target
                                                        .value
                                                ),
                                        });
                                    }
                                }
                            />
                        </label>

                        <label className="drawer-field">
                            <span>
                                Drawer Connector
                            </span>

                            <select
                                value={
                                    settings
                                        .drawerPin
                                }
                                disabled={
                                    busy
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setSettings({
                                            ...settings,

                                            drawerPin:
                                                Number(
                                                    event
                                                        .target
                                                        .value
                                                ) === 1
                                                    ? 1
                                                    : 0,
                                        });
                                    }
                                }
                            >
                                <option value={0}>
                                    Pin 2 — ESC p 0
                                </option>

                                <option value={1}>
                                    Pin 5 — ESC p 1
                                </option>
                            </select>
                        </label>

                        <label className="drawer-field">
                            <span>
                                Connection Timeout
                            </span>

                            <div className="drawer-input-suffix">
                                <input
                                    type="number"
                                    min="1000"
                                    max="30000"
                                    step="500"
                                    value={
                                        settings
                                            .connectTimeoutMs
                                    }
                                    disabled={
                                        busy
                                    }
                                    onChange={
                                        (
                                            event
                                        ) => {
                                            setSettings({
                                                ...settings,

                                                connectTimeoutMs:
                                                    Number(
                                                        event
                                                            .target
                                                            .value
                                                    ),
                                            });
                                        }
                                    }
                                />

                                <span>
                                    ms
                                </span>
                            </div>
                        </label>

                        <label className="drawer-field">
                            <span>
                                Pulse ON
                            </span>

                            <div className="drawer-input-suffix">
                                <input
                                    type="number"
                                    min="2"
                                    max="510"
                                    value={
                                        settings
                                            .drawerPulseOnMs
                                    }
                                    disabled={
                                        busy
                                    }
                                    onChange={
                                        (
                                            event
                                        ) => {
                                            setSettings({
                                                ...settings,

                                                drawerPulseOnMs:
                                                    Number(
                                                        event
                                                            .target
                                                            .value
                                                    ),
                                            });
                                        }
                                    }
                                />

                                <span>
                                    ms
                                </span>
                            </div>
                        </label>

                        <label className="drawer-field">
                            <span>
                                Pulse OFF
                            </span>

                            <div className="drawer-input-suffix">
                                <input
                                    type="number"
                                    min="2"
                                    max="510"
                                    value={
                                        settings
                                            .drawerPulseOffMs
                                    }
                                    disabled={
                                        busy
                                    }
                                    onChange={
                                        (
                                            event
                                        ) => {
                                            setSettings({
                                                ...settings,

                                                drawerPulseOffMs:
                                                    Number(
                                                        event
                                                            .target
                                                            .value
                                                    ),
                                            });
                                        }
                                    }
                                />

                                <span>
                                    ms
                                </span>
                            </div>
                        </label>
                    </div>

                    <div className="drawer-hardware-note">
                        <strong>
                            Physical connection
                        </strong>

                        <span>
                            Touchscreen PC → Receipt Printer →
                            RJ11/RJ12 → Cash Drawer
                        </span>
                    </div>

                    <div className="drawer-action-grid">
                        <button
                            type="button"
                            className="drawer-button primary"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void saveSettings();
                                }
                            }
                        >
                            {
                                busy
                                    ? "Please Wait..."
                                    : "Save Settings"
                            }
                        </button>

                        <button
                            type="button"
                            className="drawer-button"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void testConnection();
                                }
                            }
                        >
                            Test Connection
                        </button>

                        <button
                            type="button"
                            className="drawer-button"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void testReceipt();
                                }
                            }
                        >
                            Test Receipt
                        </button>

                        <button
                            type="button"
                            className="drawer-button warning"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void testDrawer();
                                }
                            }
                        >
                            Test Drawer
                        </button>
                    </div>
                </section>

                <section className="drawer-card manual-card">
                    <div className="drawer-card-header">
                        <div>
                            <span className="drawer-card-kicker">
                                OPERATIONAL
                            </span>

                            <h2>
                                Manual Drawer Open
                            </h2>
                        </div>

                        <div className="drawer-icon cash">
                            Rs
                        </div>
                    </div>

                    <div className="manual-status">
                        <span>
                            Cashier Shift
                        </span>

                        <strong>
                            {
                                shift
                                    ? shift.shift_number
                                    : "No Open Shift"
                            }
                        </strong>
                    </div>

                    <div className="manual-status">
                        <span>
                            Expected Drawer
                        </span>

                        <strong>
                            {
                                money(
                                    shift
                                        ?.expected_cash
                                    ??
                                    0
                                )
                            }
                        </strong>
                    </div>

                    <div className="drawer-security-note">
                        Manual opening is not a hardware-only
                        action. Laravel verifies permission,
                        cashier ownership and the open shift
                        before authorizing the drawer pulse.
                    </div>

                    <label className="drawer-field">
                        <span>
                            Reason for Opening
                        </span>

                        <textarea
                            rows={4}
                            value={
                                reason
                            }
                            placeholder="Example: Customer requested change"
                            disabled={
                                busy
                                ||
                                !shift
                            }
                            onChange={
                                (
                                    event
                                ) => {
                                    setReason(
                                        event
                                            .target
                                            .value
                                    );
                                }
                            }
                        />
                    </label>

                    <button
                        type="button"
                        className="manual-open-button"
                        disabled={
                            busy
                            ||
                            !shift
                            ||
                            !reason.trim()
                        }
                        onClick={
                            () => {
                                void manualOpen();
                            }
                        }
                    >
                        {
                            busy
                                ? "Authorizing..."
                                : "Manual Open Drawer"
                        }
                    </button>

                    {
                        !shift
                            ? (
                                <div className="drawer-no-shift">
                                    Open a cashier shift first to use
                                    operational Manual Open.
                                </div>
                            )
                            : null
                    }

                    <button
                        type="button"
                        className="drawer-refresh-button"
                        disabled={
                            busy
                        }
                        onClick={
                            () => {
                                void loadCurrentShift();
                            }
                        }
                    >
                        Refresh Shift
                    </button>
                </section>
            </div>

            <section className="drawer-rules">
                <div>
                    <span className="rule-indicator opens" />

                    <div>
                        <strong>
                            Drawer Opens
                        </strong>

                        <span>
                            Cash payment or mixed payment
                            containing cash.
                        </span>
                    </div>
                </div>

                <div>
                    <span className="rule-indicator closed" />

                    <div>
                        <strong>
                            Drawer Stays Closed
                        </strong>

                        <span>
                            Card-only, QR-only, bank transfer
                            and receipt reprints.
                        </span>
                    </div>
                </div>

                <div>
                    <span className="rule-indicator secure" />

                    <div>
                        <strong>
                            Retry Protected
                        </strong>

                        <span>
                            Laravel idempotency prevents duplicate
                            manual-open authorization.
                        </span>
                    </div>
                </div>
            </section>
        </div>
    );
}

const styles = `
  .drawer-page {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 22px;
      color: #0f172a;
  }
  
  .drawer-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
  }
  
  .drawer-header h1 {
      margin: 4px 0 6px;
      font-size: 31px;
      line-height: 1.1;
      letter-spacing: -.025em;
  }
  
  .drawer-header p {
      max-width: 700px;
      margin: 0;
      color: #64748b;
      font-size: 15px;
      line-height: 1.6;
  }
  
  .drawer-eyebrow,
  .drawer-card-kicker {
      display: block;
      color: #64748b;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .12em;
  }
  
  .drawer-shift-status {
      min-width: 128px;
      padding: 11px 18px;
      border-radius: 999px;
      text-align: center;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .05em;
  }
  
  .drawer-shift-status.is-open {
      color: #166534;
      background: #dcfce7;
      border: 1px solid #bbf7d0;
  }
  
  .drawer-shift-status.is-closed {
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
  }
  
  .drawer-alert {
      padding: 14px 17px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
  }
  
  .drawer-alert.success {
      color: #166534;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
  }
  
  .drawer-alert.error {
      color: #991b1b;
      background: #fef2f2;
      border: 1px solid #fecaca;
  }
  
  .drawer-overview-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
  }
  
  .drawer-overview-card {
      min-height: 92px;
      padding: 17px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 7px;
      background: #ffffff;
      border: 1px solid #dbe3ec;
      border-radius: 15px;
      box-shadow: 0 5px 18px rgba(15, 23, 42, .04);
  }
  
  .drawer-overview-card span {
      color: #64748b;
      font-size: 12px;
      font-weight: 800;
  }
  
  .drawer-overview-card strong {
      overflow: hidden;
      color: #0f172a;
      font-size: 18px;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  
  .drawer-main-grid {
      display: grid;
      grid-template-columns: minmax(560px, 1.3fr) minmax(340px, .7fr);
      gap: 20px;
      align-items: start;
  }
  
  .drawer-card {
      padding: 22px;
      background: #ffffff;
      border: 1px solid #dbe3ec;
      border-radius: 18px;
      box-shadow: 0 6px 22px rgba(15, 23, 42, .05);
  }
  
  .drawer-card-header {
      margin-bottom: 20px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
  }
  
  .drawer-card-header h2 {
      margin: 5px 0 0;
      font-size: 21px;
  }
  
  .drawer-icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      color: #1d4ed8;
      background: #eff6ff;
      font-size: 14px;
      font-weight: 900;
  }
  
  .drawer-icon.cash {
      color: #15803d;
      background: #dcfce7;
  }
  
  .drawer-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 15px;
  }
  
  .drawer-wide-field {
      grid-column: 1 / -1;
  }
  
  .drawer-field {
      display: flex;
      flex-direction: column;
      gap: 7px;
  }
  
  .drawer-field > span {
      color: #334155;
      font-size: 13px;
      font-weight: 800;
  }
  
  .drawer-field input,
  .drawer-field select,
  .drawer-field textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 12px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 11px;
      background: #ffffff;
      color: #0f172a;
      font: inherit;
      font-size: 15px;
      outline: none;
  }
  
  .drawer-field input,
  .drawer-field select {
      min-height: 49px;
  }
  
  .drawer-field textarea {
      resize: vertical;
      min-height: 108px;
  }
  
  .drawer-field input:focus,
  .drawer-field select:focus,
  .drawer-field textarea:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, .10);
  }
  
  .drawer-input-suffix {
      display: flex;
      align-items: stretch;
  }
  
  .drawer-input-suffix input {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
  }
  
  .drawer-input-suffix > span {
      min-width: 48px;
      padding: 0 10px;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      color: #64748b;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 0;
      border-radius: 0 11px 11px 0;
      font-size: 12px;
      font-weight: 800;
  }
  
  .drawer-hardware-note,
  .drawer-security-note {
      margin-top: 18px;
      padding: 14px 15px;
      border-radius: 12px;
      line-height: 1.5;
  }
  
  .drawer-hardware-note {
      color: #334155;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
  }
  
  .drawer-hardware-note strong,
  .drawer-hardware-note span {
      display: block;
  }
  
  .drawer-hardware-note span {
      margin-top: 4px;
      color: #64748b;
      font-size: 13px;
  }
  
  .drawer-security-note {
      margin: 16px 0;
      color: #1e3a8a;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      font-size: 13px;
  }
  
  .drawer-action-grid {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
  }
  
  .drawer-button,
  .manual-open-button,
  .drawer-refresh-button {
      min-height: 49px;
      padding: 0 16px;
      border-radius: 11px;
      font-size: 14px;
      font-weight: 900;
      cursor: pointer;
  }
  
  .drawer-button {
      color: #334155;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
  }
  
  .drawer-button.primary {
      color: #ffffff;
      background: #2563eb;
      border-color: #2563eb;
  }
  
  .drawer-button.warning {
      color: #92400e;
      background: #fffbeb;
      border-color: #fde68a;
  }
  
  .drawer-button:disabled,
  .manual-open-button:disabled,
  .drawer-refresh-button:disabled {
      opacity: .55;
      cursor: not-allowed;
  }
  
  .manual-card {
      display: flex;
      flex-direction: column;
  }
  
  .manual-status {
      padding: 14px 0;
      display: flex;
      justify-content: space-between;
      gap: 20px;
      border-bottom: 1px solid #eef2f7;
  }
  
  .manual-status span {
      color: #64748b;
      font-size: 13px;
      font-weight: 700;
  }
  
  .manual-status strong {
      text-align: right;
  }
  
  .manual-open-button {
      margin-top: 17px;
      color: #ffffff;
      background: #15803d;
      border: 0;
  }
  
  .drawer-refresh-button {
      margin-top: 10px;
      color: #334155;
      background: #f1f5f9;
      border: 0;
  }
  
  .drawer-no-shift {
      margin-top: 12px;
      padding: 12px;
      border-radius: 10px;
      color: #92400e;
      background: #fffbeb;
      border: 1px solid #fde68a;
      font-size: 12px;
      font-weight: 700;
  }
  
  .drawer-rules {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 13px;
  }
  
  .drawer-rules > div {
      min-height: 78px;
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
  }
  
  .drawer-rules strong,
  .drawer-rules span {
      display: block;
  }
  
  .drawer-rules strong {
      font-size: 13px;
  }
  
  .drawer-rules div div span {
      margin-top: 3px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.4;
  }
  
  .rule-indicator {
      flex: 0 0 auto;
      width: 11px;
      height: 11px;
      border-radius: 999px;
  }
  
  .rule-indicator.opens {
      background: #22c55e;
  }
  
  .rule-indicator.closed {
      background: #94a3b8;
  }
  
  .rule-indicator.secure {
      background: #2563eb;
  }
  
  .drawer-loading {
      padding: 50px;
      text-align: center;
      color: #64748b;
      font-weight: 700;
  }
  
  @media (max-width: 1150px) {
      .drawer-overview-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
      }
  
      .drawer-main-grid {
          grid-template-columns: 1fr;
      }
  }
  
  @media (max-width: 760px) {
      .drawer-header {
          flex-direction: column;
      }
  
      .drawer-overview-grid,
      .drawer-form-grid,
      .drawer-action-grid,
      .drawer-rules {
          grid-template-columns: 1fr;
      }
  
      .drawer-wide-field {
          grid-column: auto;
      }
  }
  `;