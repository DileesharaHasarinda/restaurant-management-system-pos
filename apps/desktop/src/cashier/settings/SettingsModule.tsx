import {
    useState,
} from "react";

import {
    API_BASE_URL,
} from "../../api";

import type {
    PosUser,
} from "../../types";

import KitchenPrinterModule
    from "../kitchen-printer/KitchenPrinterModule";

import "./SettingsModule.css";

interface SettingsModuleProps {
    user: PosUser;

    online: boolean;
}

type SettingsTab =
    | "TERMINAL"
    | "HARDWARE";

const getRoleName = (
    user: PosUser,
): string =>
    user.role?.name
    ??
    "Unknown";

const getInitials = (
    name: string,
): string => {
    const parts =
        name
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (
        parts.length === 0
    ) {
        return "US";
    }

    if (
        parts.length === 1
    ) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0]
        +
        parts[parts.length - 1][0]
    ).toUpperCase();
};

export default function SettingsModule(
    {
        user,
        online,
    }: SettingsModuleProps,
) {
    const [
        activeTab,
        setActiveTab,
    ] =
        useState<SettingsTab>(
            "HARDWARE",
        );

    return (
        <div className="settings-page">
            <header className="settings-header">
                <div>
                    <span className="settings-eyebrow">
                        CASHIER POS
                    </span>

                    <h1>
                        Settings
                    </h1>

                    <p>
                        Terminal and POS hardware settings.
                    </p>
                </div>

                <div
                    className={
                        online
                            ? "settings-connection online"
                            : "settings-connection offline"
                    }
                >
                    <span className="settings-connection-dot" />

                    {
                        online
                            ? "Connected"
                            : "Disconnected"
                    }
                </div>
            </header>

            <nav className="settings-tabs">
                <button
                    type="button"
                    className={
                        activeTab === "TERMINAL"
                            ? "settings-tab active"
                            : "settings-tab"
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "TERMINAL",
                            )
                    }
                >
                    Terminal
                </button>

                <button
                    type="button"
                    className={
                        activeTab === "HARDWARE"
                            ? "settings-tab active"
                            : "settings-tab"
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "HARDWARE",
                            )
                    }
                >
                    Printers & Drawer
                </button>
            </nav>

            {
                activeTab === "TERMINAL"
                    ? (
                        <div className="settings-terminal-grid">
                            <section className="settings-card">
                                <div className="settings-card-title">
                                    <div className="settings-avatar">
                                        {
                                            getInitials(
                                                user.name,
                                            )
                                        }
                                    </div>

                                    <div>
                                        <span>
                                            SIGNED IN
                                        </span>

                                        <h2>
                                            {
                                                user.name
                                            }
                                        </h2>
                                    </div>
                                </div>

                                <div className="settings-info-list">
                                    <div className="settings-info-row">
                                        <span>
                                            Role
                                        </span>

                                        <strong>
                                            {
                                                getRoleName(
                                                    user,
                                                )
                                            }
                                        </strong>
                                    </div>

                                    <div className="settings-info-row">
                                        <span>
                                            Permissions
                                        </span>

                                        <strong>
                                            {
                                                user.permissions.length
                                            }
                                        </strong>
                                    </div>

                                    <div className="settings-info-row">
                                        <span>
                                            Session
                                        </span>

                                        <strong className="good">
                                            Active
                                        </strong>
                                    </div>
                                </div>
                            </section>

                            <section className="settings-card">
                                <div className="settings-card-heading">
                                    <span>
                                        TERMINAL
                                    </span>

                                    <h2>
                                        Connection
                                    </h2>
                                </div>

                                <div className="settings-info-list">
                                    <div className="settings-info-row">
                                        <span>
                                            Backend
                                        </span>

                                        <strong
                                            className={
                                                online
                                                    ? "good"
                                                    : "bad"
                                            }
                                        >
                                            {
                                                online
                                                    ? "Online"
                                                    : "Offline"
                                            }
                                        </strong>
                                    </div>

                                    <div className="settings-info-row api-row">
                                        <span>
                                            API
                                        </span>

                                        <strong>
                                            {
                                                API_BASE_URL
                                            }
                                        </strong>
                                    </div>

                                    <div className="settings-info-row">
                                        <span>
                                            Application
                                        </span>

                                        <strong>
                                            Cashier POS
                                        </strong>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )
                    : null
            }

            {
                activeTab === "HARDWARE"
                    ? (
                        <div className="settings-hardware">
                            <div className="settings-hardware-summary">
                                <section className="settings-hardware-card">
                                    <div className="settings-hardware-icon">
                                        RP
                                    </div>

                                    <div className="settings-hardware-content">
                                        <span>
                                            CASHIER
                                        </span>

                                        <h2>
                                            Receipt Printer
                                        </h2>

                                        <p>
                                            Local USB 80mm receipt printer.
                                        </p>
                                    </div>

                                    <div className="settings-hardware-status">
                                        USB
                                    </div>
                                </section>

                                <section className="settings-hardware-card">
                                    <div className="settings-hardware-icon drawer">
                                        CD
                                    </div>

                                    <div className="settings-hardware-content">
                                        <span>
                                            CASH DRAWER
                                        </span>

                                        <h2>
                                            Printer Controlled
                                        </h2>

                                        <p>
                                            Connected to the receipt printer
                                            DK / drawer port.
                                        </p>
                                    </div>

                                    <div className="settings-hardware-status">
                                        DK
                                    </div>
                                </section>
                            </div>

                            <section className="settings-connection-flow">
                                <span>
                                    Cash Drawer
                                </span>

                                <strong>
                                    →
                                </strong>

                                <span>
                                    Receipt Printer
                                </span>

                                <strong>
                                    →
                                </strong>

                                <span>
                                    USB
                                </span>

                                <strong>
                                    →
                                </strong>

                                <span>
                                    Cashier POS
                                </span>
                            </section>

                            <section className="settings-kitchen-section">
                                <KitchenPrinterModule />
                            </section>
                        </div>
                    )
                    : null
            }
        </div>
    );
}