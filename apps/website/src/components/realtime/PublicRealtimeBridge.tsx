"use client";

import {
    useEffect,
} from "react";

import Echo
    from "laravel-echo";

import Pusher
    from "pusher-js";

import {
    useRouter,
} from "next/navigation";

interface MenuRealtimePayload {
    event_id: string;

    action: string;

    item_id: number;

    is_active: boolean;

    is_available: boolean;

    is_visible_on_website: boolean;

    is_visible_on_qr: boolean;

    sort_order: number;

    occurred_at: string;
}

interface ConnectionStateChange {
    previous: string;
    current: string;
}

interface PusherConnector {
    pusher: Pusher;
}

export default function PublicRealtimeBridge() {
    const router =
        useRouter();

    useEffect(
        () => {
            const key =
                process.env
                    .NEXT_PUBLIC_REVERB_APP_KEY;

            const host =
                process.env
                    .NEXT_PUBLIC_REVERB_HOST;

            const port =
                Number(
                    process.env
                        .NEXT_PUBLIC_REVERB_PORT
                    ??
                    8080,
                );

            const scheme =
                process.env
                    .NEXT_PUBLIC_REVERB_SCHEME
                ??
                "http";

            if (
                !key
                ||
                !host
            ) {
                return;
            }

            (
                window as Window
                & {
                    Pusher?:
                    typeof Pusher;
                }
            ).Pusher =
                Pusher;

            const echo =
                new Echo({
                    broadcaster:
                        "reverb",

                    key,

                    wsHost:
                        host,

                    wsPort:
                        port,

                    wssPort:
                        port,

                    forceTLS:
                        scheme
                        === "https",

                    enabledTransports: [
                        "ws",
                        "wss",
                    ],
                });

            const refresh =
                (): void => {
                    /*
                     * Server components will
                     * refetch Laravel data.
                     */
                    router.refresh();

                    /*
                     * QR ordering is a client
                     * application, so publish
                     * an event for it as well.
                     */
                    window.dispatchEvent(
                        new CustomEvent(
                            "restaurant:menu-updated",
                        ),
                    );
                };

            echo
                .channel(
                    "restaurant.menu",
                )
                .listen(
                    ".menu.updated",
                    (
                        _payload:
                            MenuRealtimePayload,
                    ) => {
                        refresh();
                    },
                );

            const connector =
                echo.connector as unknown as PusherConnector;

            const connection =
                connector
                    .pusher
                    .connection;

            let connectedOnce =
                false;

            const handleStateChange =
                (
                    change:
                        ConnectionStateChange,
                ): void => {
                    if (
                        change.current
                        !== "connected"
                    ) {
                        return;
                    }

                    if (
                        !connectedOnce
                    ) {
                        connectedOnce =
                            true;

                        return;
                    }

                    /*
                     * Reconnected:
                     * assume events may
                     * have been missed.
                     */
                    refresh();
                };

            connection.bind(
                "state_change",
                handleStateChange,
            );

            return () => {
                connection.unbind(
                    "state_change",
                    handleStateChange,
                );

                echo.leave(
                    "restaurant.menu",
                );

                echo.disconnect();
            };
        },
        [
            router,
        ],
    );

    return null;
}