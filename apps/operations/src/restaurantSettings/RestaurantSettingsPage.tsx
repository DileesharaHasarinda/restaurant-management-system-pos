import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from "react";

import {
    ApiError,
} from "../lib/api";

import {
    useStaffRealtimeRefresh,
} from "../realtime/realtimeBus";

import {
    getRestaurantSettings,
    removeRestaurantLogo,
    updateRestaurantSettings,
    uploadRestaurantLogo,
} from "./restaurantSettingsService";

import {
    DAY_KEYS,
    type DayKey,
    type NumberingType,
    type ResetPeriod,
    type RestaurantSettingsData,
    type RestaurantSettingsForm,
    type UpdateRestaurantSettingsPayload,
} from "./types";

import "./RestaurantSettingsPage.css";

type SettingsTab =
    | "general"
    | "charges"
    | "hours"
    | "website"
    | "numbering";

const DAY_LABELS:
    Record<DayKey, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
};

const NUMBERING_LABELS:
    Record<NumberingType, string> = {
    invoice: "Invoice",
    order: "Order",
    token: "Token",
};

const RESET_OPTIONS:
    Array<{
        value: ResetPeriod;
        label: string;
    }> = [
        {
            value: "NEVER",
            label: "Never",
        },
        {
            value: "DAILY",
            label: "Daily",
        },
        {
            value: "MONTHLY",
            label: "Monthly",
        },
        {
            value: "YEARLY",
            label: "Yearly",
        },
    ];

function nullableText(
    value: string,
): string | null {
    const result =
        value.trim();

    return result.length > 0
        ? result
        : null;
}

function dataToForm(
    data: RestaurantSettingsData,
): RestaurantSettingsForm {
    const settings =
        data.settings;

    return {
        businessName:
            settings.business_name,

        legalName:
            settings.legal_name
            ??
            "",

        phone:
            settings.phone
            ??
            "",

        email:
            settings.email
            ??
            "",

        address:
            settings.address
            ??
            "",

        currency:
            settings.currency,

        timezone:
            settings.timezone,

        taxEnabled:
            settings.tax_enabled,

        defaultTaxRate:
            String(
                settings.default_tax_rate,
            ),

        serviceChargeEnabled:
            settings.service_charge_enabled,

        defaultServiceChargeRate:
            String(
                settings.default_service_charge_rate,
            ),

        receiptHeader:
            settings.receipt_header
            ??
            "",

        receiptFooter:
            settings.receipt_footer
            ??
            "",

        openingHours: {
            monday: {
                isOpen:
                    settings
                        .opening_hours
                        .monday
                        .is_open,

                open:
                    settings
                        .opening_hours
                        .monday
                        .open
                    ??
                    "",

                close:
                    settings
                        .opening_hours
                        .monday
                        .close
                    ??
                    "",
            },

            tuesday: {
                isOpen:
                    settings
                        .opening_hours
                        .tuesday
                        .is_open,

                open:
                    settings
                        .opening_hours
                        .tuesday
                        .open
                    ??
                    "",

                close:
                    settings
                        .opening_hours
                        .tuesday
                        .close
                    ??
                    "",
            },

            wednesday: {
                isOpen:
                    settings
                        .opening_hours
                        .wednesday
                        .is_open,

                open:
                    settings
                        .opening_hours
                        .wednesday
                        .open
                    ??
                    "",

                close:
                    settings
                        .opening_hours
                        .wednesday
                        .close
                    ??
                    "",
            },

            thursday: {
                isOpen:
                    settings
                        .opening_hours
                        .thursday
                        .is_open,

                open:
                    settings
                        .opening_hours
                        .thursday
                        .open
                    ??
                    "",

                close:
                    settings
                        .opening_hours
                        .thursday
                        .close
                    ??
                    "",
            },

            friday: {
                isOpen:
                    settings
                        .opening_hours
                        .friday
                        .is_open,

                open:
                    settings
                        .opening_hours
                        .friday
                        .open
                    ??
                    "",

                close:
                    settings
                        .opening_hours
                        .friday
                        .close
                    ??
                    "",
            },

            saturday: {
                isOpen:
                    settings
                        .opening_hours
                        .saturday
                        .is_open,

                open:
                    settings
                        .opening_hours
                        .saturday
                        .open
                    ??
                    "",

                close:
                    settings
                        .opening_hours
                        .saturday
                        .close
                    ??
                    "",
            },

            sunday: {
                isOpen:
                    settings
                        .opening_hours
                        .sunday
                        .is_open,

                open:
                    settings
                        .opening_hours
                        .sunday
                        .open
                    ??
                    "",

                close:
                    settings
                        .opening_hours
                        .sunday
                        .close
                    ??
                    "",
            },
        },

        socialMedia: {
            facebook:
                settings
                    .social_media
                    .facebook
                ??
                "",

            instagram:
                settings
                    .social_media
                    .instagram
                ??
                "",

            tiktok:
                settings
                    .social_media
                    .tiktok
                ??
                "",

            youtube:
                settings
                    .social_media
                    .youtube
                ??
                "",
        },

        websiteContact: {
            publicPhone:
                settings
                    .website_contact
                    .public_phone
                ??
                "",

            publicEmail:
                settings
                    .website_contact
                    .public_email
                ??
                "",

            whatsapp:
                settings
                    .website_contact
                    .whatsapp
                ??
                "",

            googleMapsUrl:
                settings
                    .website_contact
                    .google_maps_url
                ??
                "",
        },

        numbering: {
            invoice: {
                prefix:
                    data
                        .numbering
                        .invoice
                        .prefix,

                padding:
                    String(
                        data
                            .numbering
                            .invoice
                            .padding,
                    ),

                resetPeriod:
                    data
                        .numbering
                        .invoice
                        .reset_period,
            },

            order: {
                prefix:
                    data
                        .numbering
                        .order
                        .prefix,

                padding:
                    String(
                        data
                            .numbering
                            .order
                            .padding,
                    ),

                resetPeriod:
                    data
                        .numbering
                        .order
                        .reset_period,
            },

            token: {
                prefix:
                    data
                        .numbering
                        .token
                        .prefix,

                padding:
                    String(
                        data
                            .numbering
                            .token
                            .padding,
                    ),

                resetPeriod:
                    data
                        .numbering
                        .token
                        .reset_period,
            },
        },
    };
}

function formToPayload(
    form: RestaurantSettingsForm,
): UpdateRestaurantSettingsPayload {
    return {
        business_name:
            form.businessName.trim(),

        legal_name:
            nullableText(
                form.legalName,
            ),

        phone:
            nullableText(
                form.phone,
            ),

        email:
            nullableText(
                form.email,
            ),

        address:
            nullableText(
                form.address,
            ),

        currency:
            form.currency
                .trim()
                .toUpperCase(),

        timezone:
            form.timezone.trim(),

        tax_enabled:
            form.taxEnabled,

        default_tax_rate:
            Number(
                form.defaultTaxRate
                ||
                0,
            ),

        service_charge_enabled:
            form.serviceChargeEnabled,

        default_service_charge_rate:
            Number(
                form.defaultServiceChargeRate
                ||
                0,
            ),

        receipt_header:
            nullableText(
                form.receiptHeader,
            ),

        receipt_footer:
            nullableText(
                form.receiptFooter,
            ),

        opening_hours:
            Object.fromEntries(
                DAY_KEYS.map(
                    (
                        day,
                    ) => {
                        const schedule =
                            form
                                .openingHours[
                            day
                            ];

                        return [
                            day,
                            {
                                is_open:
                                    schedule
                                        .isOpen,

                                open:
                                    schedule
                                        .isOpen
                                        ? nullableText(
                                            schedule.open,
                                        )
                                        : null,

                                close:
                                    schedule
                                        .isOpen
                                        ? nullableText(
                                            schedule.close,
                                        )
                                        : null,
                            },
                        ];
                    },
                ),
            ) as UpdateRestaurantSettingsPayload["opening_hours"],

        social_media: {
            facebook:
                nullableText(
                    form
                        .socialMedia
                        .facebook,
                ),

            instagram:
                nullableText(
                    form
                        .socialMedia
                        .instagram,
                ),

            tiktok:
                nullableText(
                    form
                        .socialMedia
                        .tiktok,
                ),

            youtube:
                nullableText(
                    form
                        .socialMedia
                        .youtube,
                ),
        },

        website_contact: {
            public_phone:
                nullableText(
                    form
                        .websiteContact
                        .publicPhone,
                ),

            public_email:
                nullableText(
                    form
                        .websiteContact
                        .publicEmail,
                ),

            whatsapp:
                nullableText(
                    form
                        .websiteContact
                        .whatsapp,
                ),

            google_maps_url:
                nullableText(
                    form
                        .websiteContact
                        .googleMapsUrl,
                ),
        },

        numbering: {
            invoice: {
                prefix:
                    form
                        .numbering
                        .invoice
                        .prefix
                        .trim()
                        .toUpperCase(),

                padding:
                    Number(
                        form
                            .numbering
                            .invoice
                            .padding,
                    ),

                reset_period:
                    form
                        .numbering
                        .invoice
                        .resetPeriod,
            },

            order: {
                prefix:
                    form
                        .numbering
                        .order
                        .prefix
                        .trim()
                        .toUpperCase(),

                padding:
                    Number(
                        form
                            .numbering
                            .order
                            .padding,
                    ),

                reset_period:
                    form
                        .numbering
                        .order
                        .resetPeriod,
            },

            token: {
                prefix:
                    form
                        .numbering
                        .token
                        .prefix
                        .trim()
                        .toUpperCase(),

                padding:
                    Number(
                        form
                            .numbering
                            .token
                            .padding,
                    ),

                reset_period:
                    form
                        .numbering
                        .token
                        .resetPeriod,
            },
        },
    };
}

function localValidation(
    form: RestaurantSettingsForm,
): string | null {
    if (
        !form.businessName.trim()
    ) {
        return "Restaurant name is required.";
    }

    if (
        !/^[A-Za-z]{3}$/.test(
            form.currency.trim(),
        )
    ) {
        return "Currency must contain exactly 3 letters, for example LKR.";
    }

    if (
        !form.timezone.trim()
    ) {
        return "Timezone is required.";
    }

    const taxRate =
        Number(
            form.defaultTaxRate,
        );

    if (
        !Number.isFinite(
            taxRate,
        )
        ||
        taxRate < 0
        ||
        taxRate > 100
    ) {
        return "Tax rate must be between 0 and 100.";
    }

    const serviceRate =
        Number(
            form.defaultServiceChargeRate,
        );

    if (
        !Number.isFinite(
            serviceRate,
        )
        ||
        serviceRate < 0
        ||
        serviceRate > 100
    ) {
        return "Service charge rate must be between 0 and 100.";
    }

    for (
        const day
        of DAY_KEYS
    ) {
        const schedule =
            form.openingHours[
            day
            ];

        if (
            schedule.isOpen
            &&
            (
                !schedule.open
                ||
                !schedule.close
            )
        ) {
            return `${DAY_LABELS[day]} requires both opening and closing times.`;
        }
    }

    for (
        const type
        of [
            "invoice",
            "order",
            "token",
        ] as const
    ) {
        const numbering =
            form.numbering[
            type
            ];

        if (
            !/^[A-Z0-9_-]+$/i.test(
                numbering.prefix.trim(),
            )
        ) {
            return `${NUMBERING_LABELS[type]} prefix can only contain letters, numbers, hyphens and underscores.`;
        }

        const padding =
            Number(
                numbering.padding,
            );

        if (
            !Number.isInteger(
                padding,
            )
            ||
            padding < 3
            ||
            padding > 10
        ) {
            return `${NUMBERING_LABELS[type]} padding must be between 3 and 10.`;
        }
    }

    return null;
}

function requestErrorMessage(
    error: unknown,
): string {
    if (
        error instanceof ApiError
    ) {
        const firstValidationMessage =
            Object.values(
                error.errors,
            )
                .flat()
                .find(
                    Boolean,
                );

        return (
            firstValidationMessage
            ??
            error.message
        );
    }

    if (
        error instanceof Error
    ) {
        return error.message;
    }

    return "The request could not be completed.";
}

function serializeForm(
    form: RestaurantSettingsForm,
): string {
    return JSON.stringify(
        form,
    );
}

function formatNumberPreview(
    prefix: string,
    paddingValue: string,
    currentValue: number | null,
): string {
    const padding =
        Math.min(
            10,
            Math.max(
                3,
                Number(
                    paddingValue,
                )
                ||
                6,
            ),
        );

    const number =
        currentValue
        ??
        1;

    return `${prefix.trim().toUpperCase()}${String(
        number,
    ).padStart(
        padding,
        "0",
    )}`;
}

function Toggle({
    checked,
    disabled = false,
    onChange,
    label,
}: {
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            className={
                `restaurant-settings-toggle ${checked
                    ? "active"
                    : ""
                }`
            }
            aria-pressed={
                checked
            }
            disabled={
                disabled
            }
            onClick={
                () =>
                    onChange(
                        !checked,
                    )
            }
        >
            <span className="restaurant-settings-toggle-track">
                <span />
            </span>

            <strong>
                {label}
            </strong>
        </button>
    );
}

export default function RestaurantSettingsPage() {
    const fileInputRef =
        useRef<HTMLInputElement | null>(
            null,
        );

    const dirtyRef =
        useRef(
            false,
        );

    const [
        activeTab,
        setActiveTab,
    ] =
        useState<SettingsTab>(
            "general",
        );

    const [
        serverData,
        setServerData,
    ] =
        useState<RestaurantSettingsData | null>(
            null,
        );

    const [
        form,
        setForm,
    ] =
        useState<RestaurantSettingsForm | null>(
            null,
        );

    const [
        savedForm,
        setSavedForm,
    ] =
        useState<RestaurantSettingsForm | null>(
            null,
        );

    const [
        loading,
        setLoading,
    ] =
        useState(
            true,
        );

    const [
        saving,
        setSaving,
    ] =
        useState(
            false,
        );

    const [
        logoBusy,
        setLogoBusy,
    ] =
        useState(
            false,
        );

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(
            false,
        );

    const [
        error,
        setError,
    ] =
        useState(
            "",
        );

    const [
        message,
        setMessage,
    ] =
        useState(
            "",
        );

    const [
        remoteChanged,
        setRemoteChanged,
    ] =
        useState(
            false,
        );

    const dirty =
        useMemo(
            () => {
                if (
                    !form
                    ||
                    !savedForm
                ) {
                    return false;
                }

                return (
                    serializeForm(
                        form,
                    )
                    !==
                    serializeForm(
                        savedForm,
                    )
                );
            },
            [
                form,
                savedForm,
            ],
        );

    useEffect(
        () => {
            dirtyRef.current =
                dirty;
        },
        [
            dirty,
        ],
    );

    const loadSettings =
        useCallback(
            async (
                silent = false,
                preserveDraft = false,
            ): Promise<void> => {
                if (
                    silent
                ) {
                    setRefreshing(
                        true,
                    );
                } else {
                    setLoading(
                        true,
                    );
                }

                try {
                    const result =
                        await getRestaurantSettings();

                    setServerData(
                        result,
                    );

                    const nextForm =
                        dataToForm(
                            result,
                        );

                    if (
                        preserveDraft
                        &&
                        dirtyRef.current
                    ) {
                        setRemoteChanged(
                            true,
                        );
                    } else {
                        setForm(
                            nextForm,
                        );

                        setSavedForm(
                            nextForm,
                        );

                        dirtyRef.current =
                            false;

                        setRemoteChanged(
                            false,
                        );
                    }

                    setError(
                        "",
                    );
                } catch (
                exception
                ) {
                    setError(
                        requestErrorMessage(
                            exception,
                        ),
                    );
                } finally {
                    setLoading(
                        false,
                    );

                    setRefreshing(
                        false,
                    );
                }
            },
            [],
        );

    useEffect(
        () => {
            void loadSettings();
        },
        [
            loadSettings,
        ],
    );

    useStaffRealtimeRefresh(
        [
            "settings",
        ],
        () => {
            void loadSettings(
                true,
                true,
            );
        },
        350,
    );

    const updateForm = <
        K extends keyof RestaurantSettingsForm,
    >(
        key: K,
        value: RestaurantSettingsForm[K],
    ): void => {
        setForm(
            (
                current,
            ) =>
                current
                    ? {
                        ...current,
                        [key]:
                            value,
                    }
                    : current,
        );

        setMessage(
            "",
        );
    };

    const save =
        async (): Promise<void> => {
            if (
                !form
            ) {
                return;
            }

            const validationError =
                localValidation(
                    form,
                );

            if (
                validationError
            ) {
                setError(
                    validationError,
                );

                return;
            }

            setSaving(
                true,
            );

            setError(
                "",
            );

            setMessage(
                "",
            );

            try {
                const result =
                    await updateRestaurantSettings(
                        formToPayload(
                            form,
                        ),
                    );

                const nextForm =
                    dataToForm(
                        result,
                    );

                dirtyRef.current =
                    false;

                setServerData(
                    result,
                );

                setForm(
                    nextForm,
                );

                setSavedForm(
                    nextForm,
                );

                setRemoteChanged(
                    false,
                );

                setMessage(
                    "Restaurant settings saved successfully.",
                );
            } catch (
            exception
            ) {
                setError(
                    requestErrorMessage(
                        exception,
                    ),
                );
            } finally {
                setSaving(
                    false,
                );
            }
        };

    const reloadServerVersion =
        (): void => {
            void loadSettings(
                true,
                false,
            );
        };

    const changeLogo =
        async (
            event: ChangeEvent<HTMLInputElement>,
        ): Promise<void> => {
            const file =
                event.target.files?.[
                0
                ];

            event.target.value =
                "";

            if (
                !file
            ) {
                return;
            }

            setLogoBusy(
                true,
            );

            setError(
                "",
            );

            setMessage(
                "",
            );

            try {
                const settings =
                    await uploadRestaurantLogo(
                        file,
                    );

                setServerData(
                    (
                        current,
                    ) =>
                        current
                            ? {
                                ...current,
                                settings,
                            }
                            : current,
                );

                setMessage(
                    "Restaurant logo updated successfully.",
                );
            } catch (
            exception
            ) {
                setError(
                    requestErrorMessage(
                        exception,
                    ),
                );
            } finally {
                setLogoBusy(
                    false,
                );
            }
        };

    const removeLogo =
        async (): Promise<void> => {
            if (
                !serverData
                    ?.settings
                    .logo_url
                &&
                !serverData
                    ?.settings
                    .logo_path
            ) {
                return;
            }

            if (
                !window.confirm(
                    "Remove the current restaurant logo?",
                )
            ) {
                return;
            }

            setLogoBusy(
                true,
            );

            setError(
                "",
            );

            setMessage(
                "",
            );

            try {
                const settings =
                    await removeRestaurantLogo();

                setServerData(
                    (
                        current,
                    ) =>
                        current
                            ? {
                                ...current,
                                settings,
                            }
                            : current,
                );

                setMessage(
                    "Restaurant logo removed successfully.",
                );
            } catch (
            exception
            ) {
                setError(
                    requestErrorMessage(
                        exception,
                    ),
                );
            } finally {
                setLogoBusy(
                    false,
                );
            }
        };

    if (
        loading
        ||
        !form
        ||
        !serverData
    ) {
        return (
            <main className="restaurant-settings-page">
                <div className="restaurant-settings-loading">
                    <div className="restaurant-settings-spinner" />

                    <strong>
                        Loading restaurant settings...
                    </strong>
                </div>
            </main>
        );
    }

    const settings =
        serverData.settings;

    return (
        <main className="restaurant-settings-page">
            <header className="restaurant-settings-header">
                <div>
                    <span className="restaurant-settings-eyebrow">
                        ADMINISTRATION
                    </span>

                    <h1>
                        Restaurant Settings
                    </h1>

                    <p>
                        Manage restaurant information, billing rules, public details and document numbering.
                    </p>
                </div>

                <div className="restaurant-settings-header-actions">
                    <span
                        className={
                            `restaurant-settings-save-state ${dirty
                                ? "dirty"
                                : ""
                            }`
                        }
                    >
                        {
                            dirty
                                ? "Unsaved changes"
                                : "Saved"
                        }
                    </span>

                    <button
                        type="button"
                        className="restaurant-settings-refresh"
                        disabled={
                            refreshing
                            ||
                            saving
                        }
                        onClick={
                            () =>
                                void loadSettings(
                                    true,
                                    false,
                                )
                        }
                    >
                        {
                            refreshing
                                ? "Refreshing..."
                                : "Refresh"
                        }
                    </button>

                    <button
                        type="button"
                        className="restaurant-settings-save"
                        disabled={
                            saving
                            ||
                            !dirty
                        }
                        onClick={
                            () =>
                                void save()
                        }
                    >
                        {
                            saving
                                ? "Saving..."
                                : "Save Changes"
                        }
                    </button>
                </div>
            </header>

            {
                remoteChanged
                    ? (
                        <div className="restaurant-settings-remote-warning">
                            <div>
                                <strong>
                                    Settings changed on another device
                                </strong>

                                <span>
                                    Your unsaved changes were kept.
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    reloadServerVersion
                                }
                            >
                                Reload Server Version
                            </button>
                        </div>
                    )
                    : null
            }

            {
                error
                    ? (
                        <div className="restaurant-settings-alert error">
                            {error}
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div className="restaurant-settings-alert success">
                            {message}
                        </div>
                    )
                    : null
            }

            <nav
                className="restaurant-settings-tabs"
                aria-label="Restaurant settings sections"
            >
                <button
                    type="button"
                    className={
                        activeTab ===
                            "general"
                            ? "active"
                            : ""
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "general",
                            )
                    }
                >
                    General
                </button>

                <button
                    type="button"
                    className={
                        activeTab ===
                            "charges"
                            ? "active"
                            : ""
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "charges",
                            )
                    }
                >
                    Billing & Receipt
                </button>

                <button
                    type="button"
                    className={
                        activeTab ===
                            "hours"
                            ? "active"
                            : ""
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "hours",
                            )
                    }
                >
                    Opening Hours
                </button>

                <button
                    type="button"
                    className={
                        activeTab ===
                            "website"
                            ? "active"
                            : ""
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "website",
                            )
                    }
                >
                    Website & Contact
                </button>

                <button
                    type="button"
                    className={
                        activeTab ===
                            "numbering"
                            ? "active"
                            : ""
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "numbering",
                            )
                    }
                >
                    Numbering
                </button>
            </nav>

            {
                activeTab ===
                    "general"
                    ? (
                        <section className="restaurant-settings-section-grid">
                            <article className="restaurant-settings-card restaurant-settings-main-card">
                                <div className="restaurant-settings-card-header">
                                    <div>
                                        <h2>
                                            Restaurant Information
                                        </h2>

                                        <p>
                                            Information used throughout the POS and Operations system.
                                        </p>
                                    </div>
                                </div>

                                <div className="restaurant-settings-form-grid">
                                    <label className="restaurant-settings-field span-2">
                                        <span>
                                            Restaurant Name *
                                        </span>

                                        <input
                                            type="text"
                                            maxLength={
                                                190
                                            }
                                            value={
                                                form.businessName
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "businessName",
                                                        event.target.value,
                                                    )
                                            }
                                        />
                                    </label>

                                    <label className="restaurant-settings-field span-2">
                                        <span>
                                            Legal / Registered Name
                                        </span>

                                        <input
                                            type="text"
                                            maxLength={
                                                190
                                            }
                                            value={
                                                form.legalName
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "legalName",
                                                        event.target.value,
                                                    )
                                            }
                                        />
                                    </label>

                                    <label className="restaurant-settings-field">
                                        <span>
                                            Phone
                                        </span>

                                        <input
                                            type="tel"
                                            maxLength={
                                                50
                                            }
                                            value={
                                                form.phone
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "phone",
                                                        event.target.value,
                                                    )
                                            }
                                        />
                                    </label>

                                    <label className="restaurant-settings-field">
                                        <span>
                                            Email
                                        </span>

                                        <input
                                            type="email"
                                            maxLength={
                                                190
                                            }
                                            value={
                                                form.email
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "email",
                                                        event.target.value,
                                                    )
                                            }
                                        />
                                    </label>

                                    <label className="restaurant-settings-field">
                                        <span>
                                            Currency *
                                        </span>

                                        <input
                                            type="text"
                                            maxLength={
                                                3
                                            }
                                            value={
                                                form.currency
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "currency",
                                                        event
                                                            .target
                                                            .value
                                                            .toUpperCase(),
                                                    )
                                            }
                                        />

                                        <small>
                                            Example: LKR
                                        </small>
                                    </label>

                                    <label className="restaurant-settings-field">
                                        <span>
                                            Timezone *
                                        </span>

                                        <input
                                            type="text"
                                            value={
                                                form.timezone
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "timezone",
                                                        event.target.value,
                                                    )
                                            }
                                        />

                                        <small>
                                            Example: Asia/Colombo
                                        </small>
                                    </label>

                                    <label className="restaurant-settings-field span-2">
                                        <span>
                                            Address
                                        </span>

                                        <textarea
                                            rows={
                                                4
                                            }
                                            maxLength={
                                                1000
                                            }
                                            value={
                                                form.address
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "address",
                                                        event.target.value,
                                                    )
                                            }
                                        />
                                    </label>
                                </div>
                            </article>

                            <article className="restaurant-settings-card restaurant-settings-logo-card">
                                <div className="restaurant-settings-card-header">
                                    <div>
                                        <h2>
                                            Restaurant Logo
                                        </h2>

                                        <p>
                                            Used across restaurant branding and supported documents.
                                        </p>
                                    </div>
                                </div>

                                <div className="restaurant-settings-logo-preview">
                                    {
                                        settings.logo_url
                                            ? (
                                                <img
                                                    src={
                                                        settings.logo_url
                                                    }
                                                    alt="Restaurant logo"
                                                />
                                            )
                                            : (
                                                <div className="restaurant-settings-logo-placeholder">
                                                    <span>
                                                        {
                                                            form
                                                                .businessName
                                                                .trim()
                                                                .charAt(
                                                                    0,
                                                                )
                                                                .toUpperCase()
                                                            ||
                                                            "R"
                                                        }
                                                    </span>

                                                    <strong>
                                                        No Logo
                                                    </strong>
                                                </div>
                                            )
                                    }
                                </div>

                                <input
                                    ref={
                                        fileInputRef
                                    }
                                    className="restaurant-settings-file-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={
                                        (
                                            event,
                                        ) =>
                                            void changeLogo(
                                                event,
                                            )
                                    }
                                />

                                <div className="restaurant-settings-logo-actions">
                                    <button
                                        type="button"
                                        className="primary"
                                        disabled={
                                            logoBusy
                                        }
                                        onClick={
                                            () =>
                                                fileInputRef
                                                    .current
                                                    ?.click()
                                        }
                                    >
                                        {
                                            logoBusy
                                                ? "Working..."
                                                : settings.logo_url
                                                    ? "Change Logo"
                                                    : "Upload Logo"
                                        }
                                    </button>

                                    {
                                        settings.logo_url
                                            ||
                                            settings.logo_path
                                            ? (
                                                <button
                                                    type="button"
                                                    className="danger"
                                                    disabled={
                                                        logoBusy
                                                    }
                                                    onClick={
                                                        () =>
                                                            void removeLogo()
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            )
                                            : null
                                    }
                                </div>
                            </article>
                        </section>
                    )
                    : null
            }

            {
                activeTab ===
                    "charges"
                    ? (
                        <section className="restaurant-settings-section">
                            <div className="restaurant-settings-two-column">
                                <article className="restaurant-settings-card">
                                    <div className="restaurant-settings-card-header">
                                        <div>
                                            <h2>
                                                Taxes
                                            </h2>

                                            <p>
                                                Configure the default tax applied by the restaurant.
                                            </p>
                                        </div>
                                    </div>

                                    <Toggle
                                        checked={
                                            form.taxEnabled
                                        }
                                        label={
                                            form.taxEnabled
                                                ? "Tax Enabled"
                                                : "Tax Disabled"
                                        }
                                        onChange={
                                            (
                                                checked,
                                            ) =>
                                                updateForm(
                                                    "taxEnabled",
                                                    checked,
                                                )
                                        }
                                    />

                                    <label className="restaurant-settings-field">
                                        <span>
                                            Default Tax Rate (%)
                                        </span>

                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            disabled={
                                                !form.taxEnabled
                                            }
                                            value={
                                                form.defaultTaxRate
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "defaultTaxRate",
                                                        event.target.value,
                                                    )
                                            }
                                        />
                                    </label>
                                </article>

                                <article className="restaurant-settings-card">
                                    <div className="restaurant-settings-card-header">
                                        <div>
                                            <h2>
                                                Service Charge
                                            </h2>

                                            <p>
                                                Configure the restaurant's standard service charge.
                                            </p>
                                        </div>
                                    </div>

                                    <Toggle
                                        checked={
                                            form.serviceChargeEnabled
                                        }
                                        label={
                                            form.serviceChargeEnabled
                                                ? "Service Charge Enabled"
                                                : "Service Charge Disabled"
                                        }
                                        onChange={
                                            (
                                                checked,
                                            ) =>
                                                updateForm(
                                                    "serviceChargeEnabled",
                                                    checked,
                                                )
                                        }
                                    />

                                    <label className="restaurant-settings-field">
                                        <span>
                                            Default Service Charge (%)
                                        </span>

                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            disabled={
                                                !form.serviceChargeEnabled
                                            }
                                            value={
                                                form.defaultServiceChargeRate
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "defaultServiceChargeRate",
                                                        event.target.value,
                                                    )
                                            }
                                        />
                                    </label>
                                </article>
                            </div>

                            <article className="restaurant-settings-card">
                                <div className="restaurant-settings-card-header">
                                    <div>
                                        <h2>
                                            Receipt Content
                                        </h2>

                                        <p>
                                            Optional custom text printed at the top and bottom of receipts.
                                        </p>
                                    </div>
                                </div>

                                <div className="restaurant-settings-form-grid">
                                    <label className="restaurant-settings-field">
                                        <span>
                                            Receipt Header
                                        </span>

                                        <textarea
                                            rows={
                                                6
                                            }
                                            maxLength={
                                                2000
                                            }
                                            placeholder="Welcome to Palmyrah Hotel"
                                            value={
                                                form.receiptHeader
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "receiptHeader",
                                                        event.target.value,
                                                    )
                                            }
                                        />

                                        <small>
                                            {form.receiptHeader.length}/2000
                                        </small>
                                    </label>

                                    <label className="restaurant-settings-field">
                                        <span>
                                            Receipt Footer
                                        </span>

                                        <textarea
                                            rows={
                                                6
                                            }
                                            maxLength={
                                                3000
                                            }
                                            placeholder="Thank you. Please visit again."
                                            value={
                                                form.receiptFooter
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    updateForm(
                                                        "receiptFooter",
                                                        event.target.value,
                                                    )
                                            }
                                        />

                                        <small>
                                            {form.receiptFooter.length}/3000
                                        </small>
                                    </label>
                                </div>
                            </article>
                        </section>
                    )
                    : null
            }

            {
                activeTab ===
                    "hours"
                    ? (
                        <section className="restaurant-settings-section">
                            <article className="restaurant-settings-card">
                                <div className="restaurant-settings-card-header">
                                    <div>
                                        <h2>
                                            Opening Hours
                                        </h2>

                                        <p>
                                            Set the public opening and closing time for each day.
                                        </p>
                                    </div>
                                </div>

                                <div className="restaurant-settings-hours">
                                    {
                                        DAY_KEYS.map(
                                            (
                                                day,
                                            ) => {
                                                const schedule =
                                                    form.openingHours[
                                                    day
                                                    ];

                                                return (
                                                    <div
                                                        key={
                                                            day
                                                        }
                                                        className={
                                                            `restaurant-settings-hours-row ${schedule.isOpen
                                                                ? "open"
                                                                : "closed"
                                                            }`
                                                        }
                                                    >
                                                        <strong className="restaurant-settings-day">
                                                            {
                                                                DAY_LABELS[
                                                                day
                                                                ]
                                                            }
                                                        </strong>

                                                        <Toggle
                                                            checked={
                                                                schedule.isOpen
                                                            }
                                                            label={
                                                                schedule.isOpen
                                                                    ? "Open"
                                                                    : "Closed"
                                                            }
                                                            onChange={
                                                                (
                                                                    checked,
                                                                ) =>
                                                                    setForm(
                                                                        (
                                                                            current,
                                                                        ) =>
                                                                            current
                                                                                ? {
                                                                                    ...current,

                                                                                    openingHours: {
                                                                                        ...current.openingHours,

                                                                                        [day]: {
                                                                                            ...current.openingHours[
                                                                                            day
                                                                                            ],

                                                                                            isOpen:
                                                                                                checked,
                                                                                        },
                                                                                    },
                                                                                }
                                                                                : current,
                                                                    )
                                                            }
                                                        />

                                                        <label>
                                                            <span>
                                                                Opens
                                                            </span>

                                                            <input
                                                                type="time"
                                                                disabled={
                                                                    !schedule.isOpen
                                                                }
                                                                value={
                                                                    schedule.open
                                                                }
                                                                onChange={
                                                                    (
                                                                        event,
                                                                    ) =>
                                                                        setForm(
                                                                            (
                                                                                current,
                                                                            ) =>
                                                                                current
                                                                                    ? {
                                                                                        ...current,

                                                                                        openingHours: {
                                                                                            ...current.openingHours,

                                                                                            [day]: {
                                                                                                ...current.openingHours[
                                                                                                day
                                                                                                ],

                                                                                                open:
                                                                                                    event
                                                                                                        .target
                                                                                                        .value,
                                                                                            },
                                                                                        },
                                                                                    }
                                                                                    : current,
                                                                        )
                                                                }
                                                            />
                                                        </label>

                                                        <span className="restaurant-settings-hours-separator">
                                                            to
                                                        </span>

                                                        <label>
                                                            <span>
                                                                Closes
                                                            </span>

                                                            <input
                                                                type="time"
                                                                disabled={
                                                                    !schedule.isOpen
                                                                }
                                                                value={
                                                                    schedule.close
                                                                }
                                                                onChange={
                                                                    (
                                                                        event,
                                                                    ) =>
                                                                        setForm(
                                                                            (
                                                                                current,
                                                                            ) =>
                                                                                current
                                                                                    ? {
                                                                                        ...current,

                                                                                        openingHours: {
                                                                                            ...current.openingHours,

                                                                                            [day]: {
                                                                                                ...current.openingHours[
                                                                                                day
                                                                                                ],

                                                                                                close:
                                                                                                    event
                                                                                                        .target
                                                                                                        .value,
                                                                                            },
                                                                                        },
                                                                                    }
                                                                                    : current,
                                                                        )
                                                                }
                                                            />
                                                        </label>
                                                    </div>
                                                );
                                            },
                                        )
                                    }
                                </div>
                            </article>
                        </section>
                    )
                    : null
            }

            {
                activeTab ===
                    "website"
                    ? (
                        <section className="restaurant-settings-section">
                            <div className="restaurant-settings-two-column">
                                <article className="restaurant-settings-card">
                                    <div className="restaurant-settings-card-header">
                                        <div>
                                            <h2>
                                                Public Contact
                                            </h2>

                                            <p>
                                                Contact information shown to website visitors.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="restaurant-settings-stack">
                                        <label className="restaurant-settings-field">
                                            <span>
                                                Public Phone
                                            </span>

                                            <input
                                                type="tel"
                                                maxLength={
                                                    50
                                                }
                                                value={
                                                    form.websiteContact.publicPhone
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        updateForm(
                                                            "websiteContact",
                                                            {
                                                                ...form.websiteContact,

                                                                publicPhone:
                                                                    event.target.value,
                                                            },
                                                        )
                                                }
                                            />
                                        </label>

                                        <label className="restaurant-settings-field">
                                            <span>
                                                Public Email
                                            </span>

                                            <input
                                                type="email"
                                                maxLength={
                                                    190
                                                }
                                                value={
                                                    form.websiteContact.publicEmail
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        updateForm(
                                                            "websiteContact",
                                                            {
                                                                ...form.websiteContact,

                                                                publicEmail:
                                                                    event.target.value,
                                                            },
                                                        )
                                                }
                                            />
                                        </label>

                                        <label className="restaurant-settings-field">
                                            <span>
                                                WhatsApp
                                            </span>

                                            <input
                                                type="tel"
                                                maxLength={
                                                    50
                                                }
                                                value={
                                                    form.websiteContact.whatsapp
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        updateForm(
                                                            "websiteContact",
                                                            {
                                                                ...form.websiteContact,

                                                                whatsapp:
                                                                    event.target.value,
                                                            },
                                                        )
                                                }
                                            />
                                        </label>

                                        <label className="restaurant-settings-field">
                                            <span>
                                                Google Maps URL
                                            </span>

                                            <input
                                                type="url"
                                                maxLength={
                                                    1000
                                                }
                                                value={
                                                    form.websiteContact.googleMapsUrl
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        updateForm(
                                                            "websiteContact",
                                                            {
                                                                ...form.websiteContact,

                                                                googleMapsUrl:
                                                                    event.target.value,
                                                            },
                                                        )
                                                }
                                            />
                                        </label>
                                    </div>
                                </article>

                                <article className="restaurant-settings-card">
                                    <div className="restaurant-settings-card-header">
                                        <div>
                                            <h2>
                                                Social Media
                                            </h2>

                                            <p>
                                                Add the restaurant's official social media pages.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="restaurant-settings-stack">
                                        <label className="restaurant-settings-field">
                                            <span>
                                                Facebook URL
                                            </span>

                                            <input
                                                type="url"
                                                maxLength={
                                                    500
                                                }
                                                value={
                                                    form.socialMedia.facebook
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        updateForm(
                                                            "socialMedia",
                                                            {
                                                                ...form.socialMedia,

                                                                facebook:
                                                                    event.target.value,
                                                            },
                                                        )
                                                }
                                            />
                                        </label>

                                        <label className="restaurant-settings-field">
                                            <span>
                                                Instagram URL
                                            </span>

                                            <input
                                                type="url"
                                                maxLength={
                                                    500
                                                }
                                                value={
                                                    form.socialMedia.instagram
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        updateForm(
                                                            "socialMedia",
                                                            {
                                                                ...form.socialMedia,

                                                                instagram:
                                                                    event.target.value,
                                                            },
                                                        )
                                                }
                                            />
                                        </label>

                                        <label className="restaurant-settings-field">
                                            <span>
                                                TikTok URL
                                            </span>

                                            <input
                                                type="url"
                                                maxLength={
                                                    500
                                                }
                                                value={
                                                    form.socialMedia.tiktok
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        updateForm(
                                                            "socialMedia",
                                                            {
                                                                ...form.socialMedia,

                                                                tiktok:
                                                                    event.target.value,
                                                            },
                                                        )
                                                }
                                            />
                                        </label>

                                        <label className="restaurant-settings-field">
                                            <span>
                                                YouTube URL
                                            </span>

                                            <input
                                                type="url"
                                                maxLength={
                                                    500
                                                }
                                                value={
                                                    form.socialMedia.youtube
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        updateForm(
                                                            "socialMedia",
                                                            {
                                                                ...form.socialMedia,

                                                                youtube:
                                                                    event.target.value,
                                                            },
                                                        )
                                                }
                                            />
                                        </label>
                                    </div>
                                </article>
                            </div>
                        </section>
                    )
                    : null
            }

            {
                activeTab ===
                    "numbering"
                    ? (
                        <section className="restaurant-settings-section">
                            <article className="restaurant-settings-card">
                                <div className="restaurant-settings-card-header">
                                    <div>
                                        <h2>
                                            Document Numbering
                                        </h2>

                                        <p>
                                            Configure the identifiers used for invoices, orders and tokens.
                                        </p>
                                    </div>
                                </div>

                                <div className="restaurant-settings-numbering-grid">
                                    {
                                        (
                                            [
                                                "invoice",
                                                "order",
                                                "token",
                                            ] as const
                                        ).map(
                                            (
                                                type,
                                            ) => {
                                                const numbering =
                                                    form.numbering[
                                                    type
                                                    ];

                                                const serverSequence =
                                                    serverData
                                                        .numbering[
                                                    type
                                                    ];

                                                return (
                                                    <article
                                                        key={
                                                            type
                                                        }
                                                        className="restaurant-settings-numbering-card"
                                                    >
                                                        <div className="restaurant-settings-numbering-title">
                                                            <div>
                                                                <span>
                                                                    {
                                                                        NUMBERING_LABELS[
                                                                        type
                                                                        ]
                                                                    }
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        formatNumberPreview(
                                                                            numbering.prefix,
                                                                            numbering.padding,
                                                                            serverSequence.current_value,
                                                                        )
                                                                    }
                                                                </strong>
                                                            </div>
                                                        </div>

                                                        <label className="restaurant-settings-field">
                                                            <span>
                                                                Prefix
                                                            </span>

                                                            <input
                                                                type="text"
                                                                maxLength={
                                                                    20
                                                                }
                                                                value={
                                                                    numbering.prefix
                                                                }
                                                                onChange={
                                                                    (
                                                                        event,
                                                                    ) =>
                                                                        updateForm(
                                                                            "numbering",
                                                                            {
                                                                                ...form.numbering,

                                                                                [type]: {
                                                                                    ...numbering,

                                                                                    prefix:
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                            .toUpperCase(),
                                                                                },
                                                                            },
                                                                        )
                                                                }
                                                            />
                                                        </label>

                                                        <label className="restaurant-settings-field">
                                                            <span>
                                                                Number Padding
                                                            </span>

                                                            <input
                                                                type="number"
                                                                min="3"
                                                                max="10"
                                                                step="1"
                                                                value={
                                                                    numbering.padding
                                                                }
                                                                onChange={
                                                                    (
                                                                        event,
                                                                    ) =>
                                                                        updateForm(
                                                                            "numbering",
                                                                            {
                                                                                ...form.numbering,

                                                                                [type]: {
                                                                                    ...numbering,

                                                                                    padding:
                                                                                        event
                                                                                            .target
                                                                                            .value,
                                                                                },
                                                                            },
                                                                        )
                                                                }
                                                            />
                                                        </label>

                                                        <label className="restaurant-settings-field">
                                                            <span>
                                                                Reset Period
                                                            </span>

                                                            <select
                                                                value={
                                                                    numbering.resetPeriod
                                                                }
                                                                onChange={
                                                                    (
                                                                        event,
                                                                    ) =>
                                                                        updateForm(
                                                                            "numbering",
                                                                            {
                                                                                ...form.numbering,

                                                                                [type]: {
                                                                                    ...numbering,

                                                                                    resetPeriod:
                                                                                        event.target.value as ResetPeriod,
                                                                                },
                                                                            },
                                                                        )
                                                                }
                                                            >
                                                                {
                                                                    RESET_OPTIONS.map(
                                                                        (
                                                                            option,
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    option.value
                                                                                }
                                                                                value={
                                                                                    option.value
                                                                                }
                                                                            >
                                                                                {
                                                                                    option.label
                                                                                }
                                                                            </option>
                                                                        ),
                                                                    )
                                                                }
                                                            </select>
                                                        </label>
                                                    </article>
                                                );
                                            },
                                        )
                                    }
                                </div>

                                <div className="restaurant-settings-numbering-warning">
                                    Existing document numbers are not changed. These settings control future numbering.
                                </div>
                            </article>
                        </section>
                    )
                    : null
            }

            <footer className="restaurant-settings-mobile-save">
                <div>
                    <strong>
                        {
                            dirty
                                ? "Unsaved changes"
                                : "Settings saved"
                        }
                    </strong>

                    <span>
                        {
                            dirty
                                ? "Save before leaving this page."
                                : "Everything is up to date."
                        }
                    </span>
                </div>

                <button
                    type="button"
                    disabled={
                        saving
                        ||
                        !dirty
                    }
                    onClick={
                        () =>
                            void save()
                    }
                >
                    {
                        saving
                            ? "Saving..."
                            : "Save"
                    }
                </button>
            </footer>
        </main>
    );
}