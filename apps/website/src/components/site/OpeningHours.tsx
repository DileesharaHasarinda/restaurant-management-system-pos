import type {
    DayKey,
    OpeningHours as OpeningHoursType,
} from "../../types/website";

interface OpeningHoursProps {
    hours:
    OpeningHoursType;

    timezone?:
    string;
}

const DAYS:
    Array<{
        key: DayKey;
        label: string;
    }> = [
        {
            key:
                "monday",

            label:
                "Monday",
        },
        {
            key:
                "tuesday",

            label:
                "Tuesday",
        },
        {
            key:
                "wednesday",

            label:
                "Wednesday",
        },
        {
            key:
                "thursday",

            label:
                "Thursday",
        },
        {
            key:
                "friday",

            label:
                "Friday",
        },
        {
            key:
                "saturday",

            label:
                "Saturday",
        },
        {
            key:
                "sunday",

            label:
                "Sunday",
        },
    ];

function formatTime(
    value:
        string
        | null
        | undefined,
): string {
    if (
        !value
    ) {
        return "—";
    }

    const parts =
        value.split(
            ":",
        );

    const hour =
        Number(
            parts[0],
        );

    const minute =
        Number(
            parts[1]
            ??
            "0",
        );

    if (
        !Number.isFinite(
            hour,
        )
        ||
        !Number.isFinite(
            minute,
        )
    ) {
        return value;
    }

    const suffix =
        hour >= 12
            ? "PM"
            : "AM";

    const displayHour =
        hour % 12
        || 12;

    return `${displayHour}:${String(
        minute,
    ).padStart(
        2,
        "0",
    )} ${suffix}`;
}

export default function OpeningHours({
    hours,
    timezone = "Asia/Colombo",
}: OpeningHoursProps) {
    const currentDay =
        new Intl.DateTimeFormat(
            "en-US",
            {
                weekday:
                    "long",

                timeZone:
                    timezone,
            },
        )
            .format(
                new Date(),
            )
            .toLowerCase();

    return (
        <div
            className="site-opening-hours"
        >
            {
                DAYS.map(
                    (
                        day,
                    ) => {
                        const item =
                            hours[
                            day.key
                            ];

                        const active =
                            currentDay
                            ===
                            day.key;

                        return (
                            <div
                                key={
                                    day.key
                                }
                                className={
                                    active
                                        ? "site-hours-row active"
                                        : "site-hours-row"
                                }
                            >
                                <span>
                                    {
                                        day.label
                                    }

                                    {
                                        active
                                            ? (
                                                <small>
                                                    Today
                                                </small>
                                            )
                                            : null
                                    }
                                </span>

                                <strong>
                                    {
                                        item
                                            ?.is_open
                                            ? `${formatTime(
                                                item.open,
                                            )} – ${formatTime(
                                                item.close,
                                            )}`
                                            : "Closed"
                                    }
                                </strong>
                            </div>
                        );
                    },
                )
            }
        </div>
    );
}