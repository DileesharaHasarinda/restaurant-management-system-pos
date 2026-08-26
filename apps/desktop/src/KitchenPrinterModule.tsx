import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    getKitchenPrintJobs,
    reprintKitchenPrintJob,
    retryKitchenPrintJob,
} from "./kitchenPrintClient";

import type {
    KitchenPrintJobRecord,
} from "./kitchenPrintClient";

import type {
    KitchenPrinterSettings,
} from "./kitchenPrinterTypes";

const DEFAULT_SETTINGS:
    KitchenPrinterSettings = {
    printerName:
        "Kitchen Printer",

    host:
        "",

    port:
        9100,

    paperWidthMm:
        80,

    autoPrint:
        false,

    connectTimeoutMs:
        4000,
};

const styles = `
.kitchen-printer-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
}

.kitchen-printer-header h1 {
    margin: 0;
    font-size: 28px;
}

.kitchen-printer-header p {
    margin: 6px 0 0;
    color: #64748b;
}

.kitchen-printer-grid {
    display: grid;
    grid-template-columns: minmax(340px, 0.8fr) minmax(500px, 1.2fr);
    gap: 20px;
}

.kitchen-card {
    padding: 22px;
    background: #ffffff;
    border: 1px solid #dbe2ea;
    border-radius: 16px;
    box-shadow: 0 6px 22px rgba(15, 23, 42, .05);
}

.kitchen-card h2 {
    margin: 0 0 18px;
    font-size: 21px;
}

.kitchen-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.kitchen-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.kitchen-field span {
    font-weight: 700;
    color: #334155;
}

.kitchen-field input {
    min-height: 48px;
    padding: 0 14px;
    font-size: 16px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
}

.kitchen-checkbox {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    font-weight: 700;
}

.kitchen-checkbox input {
    width: 22px;
    height: 22px;
}

.kitchen-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.kitchen-button {
    min-height: 46px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
}

.kitchen-button:disabled {
    opacity: .55;
    cursor: not-allowed;
}

.kitchen-primary {
    color: #ffffff;
    background: #2563eb;
}

.kitchen-success {
    color: #ffffff;
    background: #15803d;
}

.kitchen-secondary {
    color: #0f172a;
    background: #e2e8f0;
}

.kitchen-danger {
    color: #ffffff;
    background: #b91c1c;
}

.kitchen-message {
    padding: 12px 14px;
    border-radius: 10px;
    font-weight: 700;
}

.kitchen-message.success {
    color: #166534;
    background: #dcfce7;
}

.kitchen-message.error {
    color: #991b1b;
    background: #fee2e2;
}

.kitchen-history {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 620px;
    overflow-y: auto;
}

.kitchen-job {
    padding: 14px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
}

.kitchen-job-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}

.kitchen-job strong {
    font-size: 16px;
}

.kitchen-job-meta {
    margin-top: 7px;
    color: #64748b;
    font-size: 14px;
}

.kitchen-job-error {
    margin-top: 8px;
    padding: 9px;
    color: #991b1b;
    background: #fef2f2;
    border-radius: 8px;
}

.kitchen-status {
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
}

.kitchen-status.PRINTED {
    color: #166534;
    background: #dcfce7;
}

.kitchen-status.FAILED {
    color: #991b1b;
    background: #fee2e2;
}

.kitchen-status.PENDING {
    color: #92400e;
    background: #fef3c7;
}

.kitchen-status.PROCESSING {
    color: #1d4ed8;
    background: #dbeafe;
}

.kitchen-job-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}

@media (max-width: 1000px) {
    .kitchen-printer-grid {
        grid-template-columns: 1fr;
    }
}
`;

export default function KitchenPrinterModule() {
    const [
        settings,
        setSettings,
    ] =
        useState<
            KitchenPrinterSettings
        >(
            DEFAULT_SETTINGS
        );

    const [
        jobs,
        setJobs,
    ] =
        useState<
            KitchenPrintJobRecord[]
        >(
            []
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

    const loadJobs =
        useCallback(
            async (): Promise<void> => {
                try {
                    const result =
                        await getKitchenPrintJobs();

                    setJobs(
                        result.jobs
                    );
                } catch (
                loadError:
                    unknown
                ) {
                    setError(
                        loadError
                            instanceof Error
                            ? loadError.message
                            : "Unable to load kitchen print history."
                    );
                }
            },
            []
        );

    useEffect(
        () => {
            void (
                async () => {
                    try {
                        const saved =
                            await window
                                .posBridge
                                .getKitchenPrinterSettings();

                        setSettings(
                            saved
                        );
                    } catch (
                    loadError:
                        unknown
                    ) {
                        setError(
                            loadError
                                instanceof Error
                                ? loadError.message
                                : "Unable to load kitchen printer settings."
                        );
                    }

                    await loadJobs();
                }
            )();
        },
        [
            loadJobs,
        ]
    );

    const runAction =
        async (
            action:
                () => Promise<void>
        ): Promise<void> => {
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
            actionError:
                unknown
            ) {
                setError(
                    actionError
                        instanceof Error
                        ? actionError.message
                        : "Kitchen printer operation failed."
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    const saveSettings =
        async (): Promise<void> => {
            await runAction(
                async () => {
                    const saved =
                        await window
                            .posBridge
                            .setKitchenPrinterSettings(
                                settings
                            );

                    setSettings(
                        saved
                    );

                    setMessage(
                        "Kitchen printer settings saved successfully."
                    );
                }
            );
        };

    const testConnection =
        async (): Promise<void> => {
            await runAction(
                async () => {
                    /*
                     * Save first so the test uses the
                     * values currently shown in the form.
                     */
                    const saved =
                        await window
                            .posBridge
                            .setKitchenPrinterSettings(
                                settings
                            );

                    setSettings(
                        saved
                    );

                    const result =
                        await window
                            .posBridge
                            .testKitchenPrinterConnection();

                    setMessage(
                        result.message
                    );
                }
            );
        };

    const testPrint =
        async (): Promise<void> => {
            await runAction(
                async () => {
                    const saved =
                        await window
                            .posBridge
                            .setKitchenPrinterSettings(
                                settings
                            );

                    setSettings(
                        saved
                    );

                    const result =
                        await window
                            .posBridge
                            .testKitchenPrinter();

                    setMessage(
                        `${result.message} ${result.bytesWritten} bytes sent.`
                    );
                }
            );
        };

    const retry =
        async (
            jobId:
                number
        ): Promise<void> => {
            await runAction(
                async () => {
                    await retryKitchenPrintJob(
                        jobId
                    );

                    setMessage(
                        "Failed kitchen print job returned to the queue."
                    );

                    await loadJobs();
                }
            );
        };

    const reprint =
        async (
            jobId:
                number
        ): Promise<void> => {
            await runAction(
                async () => {
                    await reprintKitchenPrintJob(
                        jobId
                    );

                    setMessage(
                        "Kitchen reprint queued successfully."
                    );

                    await loadJobs();
                }
            );
        };

    return (
        <div className="kitchen-printer-page">
            <style>
                {styles}
            </style>

            <header className="kitchen-printer-header">
                <h1>
                    Kitchen Printer
                </h1>

                <p>
                    Configure the 80mm LAN kitchen printer,
                    test connectivity and manage KOT print jobs.
                </p>
            </header>

            {
                message
                    ? (
                        <div className="kitchen-message success">
                            {message}
                        </div>
                    )
                    : null
            }

            {
                error
                    ? (
                        <div className="kitchen-message error">
                            {error}
                        </div>
                    )
                    : null
            }

            <div className="kitchen-printer-grid">
                <section className="kitchen-card">
                    <h2>
                        Printer Configuration
                    </h2>

                    <div className="kitchen-form">
                        <label className="kitchen-field">
                            <span>
                                Printer Name
                            </span>

                            <input
                                value={
                                    settings
                                        .printerName
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setSettings(
                                            {
                                                ...settings,

                                                printerName:
                                                    event
                                                        .target
                                                        .value,
                                            }
                                        );
                                    }
                                }
                            />
                        </label>

                        <label className="kitchen-field">
                            <span>
                                Printer IP Address
                            </span>

                            <input
                                value={
                                    settings.host
                                }
                                placeholder="192.168.1.150"
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setSettings(
                                            {
                                                ...settings,

                                                host:
                                                    event
                                                        .target
                                                        .value,
                                            }
                                        );
                                    }
                                }
                            />
                        </label>

                        <label className="kitchen-field">
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
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setSettings(
                                            {
                                                ...settings,

                                                port:
                                                    Number(
                                                        event
                                                            .target
                                                            .value
                                                    ),
                                            }
                                        );
                                    }
                                }
                            />
                        </label>

                        <label className="kitchen-field">
                            <span>
                                Paper Width
                            </span>

                            <input
                                value="80mm"
                                disabled
                            />
                        </label>

                        <label className="kitchen-checkbox">
                            <input
                                type="checkbox"
                                checked={
                                    settings
                                        .autoPrint
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setSettings(
                                            {
                                                ...settings,

                                                autoPrint:
                                                    event
                                                        .target
                                                        .checked,
                                            }
                                        );
                                    }
                                }
                            />

                            Automatically print pending KOTs
                        </label>

                        <div className="kitchen-actions">
                            <button
                                type="button"
                                className="kitchen-button kitchen-primary"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () => {
                                        void saveSettings();
                                    }
                                }
                            >
                                Save Settings
                            </button>

                            <button
                                type="button"
                                className="kitchen-button kitchen-secondary"
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
                                className="kitchen-button kitchen-success"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () => {
                                        void testPrint();
                                    }
                                }
                            >
                                Test Print
                            </button>
                        </div>
                    </div>
                </section>

                <section className="kitchen-card">
                    <div
                        style={{
                            display:
                                "flex",

                            justifyContent:
                                "space-between",

                            alignItems:
                                "center",

                            marginBottom:
                                18,
                        }}
                    >
                        <h2
                            style={{
                                margin:
                                    0,
                            }}
                        >
                            Print Job History
                        </h2>

                        <button
                            type="button"
                            className="kitchen-button kitchen-secondary"
                            disabled={
                                busy
                            }
                            onClick={
                                () => {
                                    void loadJobs();
                                }
                            }
                        >
                            Refresh
                        </button>
                    </div>

                    <div className="kitchen-history">
                        {
                            jobs.length
                                === 0
                                ? (
                                    <p>
                                        No kitchen print jobs found.
                                    </p>
                                )
                                : jobs.map(
                                    (
                                        job
                                    ) => (
                                        <article
                                            key={
                                                job.id
                                            }
                                            className="kitchen-job"
                                        >
                                            <div className="kitchen-job-top">
                                                <div>
                                                    <strong>
                                                        {
                                                            job
                                                                .job_number
                                                        }
                                                    </strong>

                                                    <div className="kitchen-job-meta">
                                                        {
                                                            job
                                                                .payload
                                                                .heading
                                                            ||
                                                            job
                                                                .job_type
                                                        }
                                                        {" • "}

                                                        {
                                                            job
                                                                .payload
                                                                .table
                                                            ||
                                                            "Takeaway"
                                                        }
                                                        {" • Attempts: "}

                                                        {
                                                            job
                                                                .attempts
                                                        }
                                                    </div>
                                                </div>

                                                <span
                                                    className={
                                                        `kitchen-status ${job.status}`
                                                    }
                                                >
                                                    {
                                                        job.status
                                                    }
                                                </span>
                                            </div>

                                            {
                                                job.last_error
                                                    ? (
                                                        <div className="kitchen-job-error">
                                                            {
                                                                job
                                                                    .last_error
                                                            }
                                                        </div>
                                                    )
                                                    : null
                                            }

                                            <div className="kitchen-job-actions">
                                                {
                                                    job.status
                                                        === "FAILED"
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="kitchen-button kitchen-danger"
                                                                disabled={
                                                                    busy
                                                                }
                                                                onClick={
                                                                    () => {
                                                                        void retry(
                                                                            job.id
                                                                        );
                                                                    }
                                                                }
                                                            >
                                                                Retry
                                                            </button>
                                                        )
                                                        : null
                                                }

                                                {
                                                    job.status
                                                        === "PRINTED"
                                                        ? (
                                                            <button
                                                                type="button"
                                                                className="kitchen-button kitchen-secondary"
                                                                disabled={
                                                                    busy
                                                                }
                                                                onClick={
                                                                    () => {
                                                                        void reprint(
                                                                            job.id
                                                                        );
                                                                    }
                                                                }
                                                            >
                                                                Reprint
                                                            </button>
                                                        )
                                                        : null
                                                }
                                            </div>
                                        </article>
                                    )
                                )
                        }
                    </div>
                </section>
            </div>
        </div>
    );
}