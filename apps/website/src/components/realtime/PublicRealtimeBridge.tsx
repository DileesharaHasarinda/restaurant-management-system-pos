"use client";

import {
    useCallback,
} from "react";

import {
    useRouter,
} from "next/navigation";

import {
    usePublicRealtimeRefresh,
} from "@/realtime/publicRealtimeBus";

/*
|--------------------------------------------------------------------------
| Public Realtime Bridge
|--------------------------------------------------------------------------
|
| This component NEVER creates an Echo / WebSocket connection.
|
| WebsiteRealtimeProvider owns the Website's single Reverb connection.
|
| This bridge reacts to public invalidation events by asking Next.js server
| components to fetch fresh authoritative data.
|--------------------------------------------------------------------------
*/

export default function PublicRealtimeBridge() {
    const router =
        useRouter();

    const refreshServerContent =
        useCallback(
            (): void => {
                router.refresh();
            },
            [
                router,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Public Server-rendered Website Data
    |--------------------------------------------------------------------------
    |
    | Menu:
    |     item/category/menu changes
    |
    | Reviews:
    |     approval/rejection/show/hide/delete
    |
    | Gallery:
    |     upload/edit/sort/enable/disable
    |--------------------------------------------------------------------------
    */

    usePublicRealtimeRefresh(
        [
            "menu",
            "reviews",
            "gallery",
        ],
        refreshServerContent
    );

    return null;
}