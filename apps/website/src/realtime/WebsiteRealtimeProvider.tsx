"use client";

import {
    useEffect,
    type ReactNode,
} from "react";

import Echo
    from "laravel-echo";

import Pusher
    from "pusher-js";

import {
    publishPublicRealtime,
    publishPublicRealtimeReconnect,
} from "./publicRealtimeBus";

/*
|--------------------------------------------------------------------------
| Props
|--------------------------------------------------------------------------
*/

interface WebsiteRealtimeProviderProps {
    children:
    ReactNode;
}

/*
|--------------------------------------------------------------------------
| Minimal Pusher Connection Shape
|--------------------------------------------------------------------------
*/

interface PusherConnectionLike {
    bind:
    (
        event:
            string,

        callback:
            (
                ...args:
                    unknown[]
            ) => void
    ) => void;

    unbind:
    (
        event:
            string,

        callback:
            (
                ...args:
                    unknown[]
            ) => void
    ) => void;
}

interface EchoConnectorLike {
    pusher?:
    {
        connection?:
        PusherConnectionLike;
    };
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function parsePort(
    value:
        string | undefined,

    fallback:
        number
): number {
    const parsed =
        Number(
            value
        );

    if (
        !Number.isInteger(
            parsed
        )
        ||
        parsed <= 0
        ||
        parsed > 65535
    ) {
        return fallback;
    }

    return parsed;
}

function stringValue(
    value:
        unknown
): string | null {
    if (
        typeof value
        !==
        "string"
    ) {
        return null;
    }

    const trimmed =
        value.trim();

    return trimmed === ""
        ? null
        : trimmed;
}

/*
|--------------------------------------------------------------------------
| Public Realtime Payload Parser
|--------------------------------------------------------------------------
*/

function parseRealtimePayload(
    payload:
        unknown,

    fallbackAction:
        string
): {
    action:
    string;

    eventId:
    string | null;

    occurredAt:
    string | null;
} {
    let action =
        fallbackAction;

    let eventId:
        string | null =
        null;

    let occurredAt:
        string | null =
        null;

    if (
        typeof payload
        ===
        "object"
        &&
        payload !== null
        &&
        !Array.isArray(
            payload
        )
    ) {
        const record =
            payload as Record<
                string,
                unknown
            >;

        action =
            stringValue(
                record.action
            )
            ??
            action;

        eventId =
            stringValue(
                record.event_id
            );

        occurredAt =
            stringValue(
                record.occurred_at
            );
    }

    return {
        action,
        eventId,
        occurredAt,
    };
}

/*
|--------------------------------------------------------------------------
| Website Realtime Provider
|--------------------------------------------------------------------------
|
| Exactly ONE Echo/Reverb connection exists for the Website.
|
| Reverb events are invalidation signals only.
|
| Authoritative state always comes from Laravel REST.
|--------------------------------------------------------------------------
*/

export default function WebsiteRealtimeProvider(
    {
        children,
    }:
        WebsiteRealtimeProviderProps
) {
    useEffect(
        () => {
            /*
            |--------------------------------------------------------------------------
            | Environment
            |--------------------------------------------------------------------------
            */

            const appKey =
                process
                    .env
                    .NEXT_PUBLIC_REVERB_APP_KEY
                    ?.trim()
                ??
                "";

            const host =
                process
                    .env
                    .NEXT_PUBLIC_REVERB_HOST
                    ?.trim()
                ??
                "";

            const scheme =
                (
                    process
                        .env
                        .NEXT_PUBLIC_REVERB_SCHEME
                    ??
                    "https"
                )
                    .trim()
                    .toLowerCase();

            const forceTLS =
                scheme
                ===
                "https";

            const port =
                parsePort(
                    process
                        .env
                        .NEXT_PUBLIC_REVERB_PORT,

                    forceTLS
                        ? 443
                        : 8080
                );

            if (
                appKey === ""
                ||
                host === ""
            ) {
                console.warn(
                    "Website realtime is disabled because NEXT_PUBLIC_REVERB_APP_KEY or NEXT_PUBLIC_REVERB_HOST is missing."
                );

                return;
            }

            /*
            |--------------------------------------------------------------------------
            | pusher-js
            |--------------------------------------------------------------------------
            */

            (
                window as Window
                &
                {
                    Pusher?:
                    typeof Pusher;
                }
            ).Pusher =
                Pusher;

            /*
            |--------------------------------------------------------------------------
            | Single Echo Connection
            |--------------------------------------------------------------------------
            */

            const echo =
                new Echo({
                    broadcaster:
                        "reverb",

                    key:
                        appKey,

                    wsHost:
                        host,

                    wsPort:
                        port,

                    wssPort:
                        port,

                    forceTLS,

                    enabledTransports:
                        [
                            "ws",
                            "wss",
                        ],
                });

            /*
            |--------------------------------------------------------------------------
            | Reconnect Tracking
            |--------------------------------------------------------------------------
            */

            let hasConnected =
                false;

            const connector =
                echo
                    .connector as unknown as EchoConnectorLike;

            const connection =
                connector
                    .pusher
                    ?.connection;

            const handleConnected =
                (): void => {
                    if (
                        hasConnected
                    ) {
                        /*
                         * Events may have been missed while disconnected.
                         *
                         * Every mounted realtime consumer reconciles from REST.
                         */
                        publishPublicRealtimeReconnect();

                        return;
                    }

                    hasConnected =
                        true;
                };

            const handleConnectionError =
                (
                    ...args:
                        unknown[]
                ): void => {
                    console.error(
                        "Website Reverb connection error.",
                        args[0]
                    );
                };

            connection?.bind(
                "connected",
                handleConnected
            );

            connection?.bind(
                "error",
                handleConnectionError
            );

            /*
            |--------------------------------------------------------------------------
            | Menu Channel
            |--------------------------------------------------------------------------
            */

            const menuChannel =
                echo.channel(
                    "restaurant.menu"
                );

            const handleMenuUpdated =
                (
                    payload:
                        unknown
                ): void => {
                    const parsed =
                        parseRealtimePayload(
                            payload,
                            "MENU_UPDATED"
                        );

                    publishPublicRealtime({
                        domain:
                            "menu",

                        action:
                            parsed.action,

                        eventId:
                            parsed.eventId,

                        occurredAt:
                            parsed.occurredAt,
                    });
                };

            menuChannel.listen(
                ".menu.updated",
                handleMenuUpdated
            );

            /*
            |--------------------------------------------------------------------------
            | Public Website Channel
            |--------------------------------------------------------------------------
            |
            | One public channel carries Website-content invalidation events.
            |--------------------------------------------------------------------------
            */

            const websiteChannel =
                echo.channel(
                    "restaurant.website"
                );

            /*
            |--------------------------------------------------------------------------
            | Reviews
            |--------------------------------------------------------------------------
            */

            const handleReviewsUpdated =
                (
                    payload:
                        unknown
                ): void => {
                    const parsed =
                        parseRealtimePayload(
                            payload,
                            "REVIEWS_UPDATED"
                        );

                    publishPublicRealtime({
                        domain:
                            "reviews",

                        action:
                            parsed.action,

                        eventId:
                            parsed.eventId,

                        occurredAt:
                            parsed.occurredAt,
                    });
                };

            websiteChannel.listen(
                ".reviews.updated",
                handleReviewsUpdated
            );

            /*
            |--------------------------------------------------------------------------
            | Gallery
            |--------------------------------------------------------------------------
            */

            const handleGalleryUpdated =
                (
                    payload:
                        unknown
                ): void => {
                    const parsed =
                        parseRealtimePayload(
                            payload,
                            "GALLERY_UPDATED"
                        );

                    publishPublicRealtime({
                        domain:
                            "gallery",

                        action:
                            parsed.action,

                        eventId:
                            parsed.eventId,

                        occurredAt:
                            parsed.occurredAt,
                    });
                };

            websiteChannel.listen(
                ".gallery.updated",
                handleGalleryUpdated
            );

            /*
            |--------------------------------------------------------------------------
            | Cleanup
            |--------------------------------------------------------------------------
            */

            return () => {
                menuChannel.stopListening(
                    ".menu.updated"
                );

                websiteChannel.stopListening(
                    ".reviews.updated"
                );

                websiteChannel.stopListening(
                    ".gallery.updated"
                );

                connection?.unbind(
                    "connected",
                    handleConnected
                );

                connection?.unbind(
                    "error",
                    handleConnectionError
                );

                echo.leave(
                    "restaurant.menu"
                );

                echo.leave(
                    "restaurant.website"
                );

                echo.disconnect();
            };
        },
        []
    );

    return (
        <>
            {children}
        </>
    );
}