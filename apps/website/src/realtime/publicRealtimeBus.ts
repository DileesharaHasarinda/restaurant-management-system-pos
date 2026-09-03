"use client";

import { useEffect, useRef } from "react";

/*
|--------------------------------------------------------------------------
| Public Website Realtime Domains
|--------------------------------------------------------------------------
|
| These domains are intentionally small and public-safe.
|
| Reverb events are invalidation signals only.
|
| Actual menu / reviews / gallery data must always be fetched again from
| Laravel's authoritative public REST API.
|--------------------------------------------------------------------------
*/

export type PublicRealtimeDomain = "menu" | "reviews" | "gallery";

/*
|--------------------------------------------------------------------------
| Public Realtime Invalidation
|--------------------------------------------------------------------------
*/

export interface PublicRealtimeInvalidation {
  domain: PublicRealtimeDomain;

  action: string;

  eventId: string | null;

  occurredAt: string | null;
}

/*
|--------------------------------------------------------------------------
| Browser Event Names
|--------------------------------------------------------------------------
*/

const PUBLIC_REALTIME_UPDATE_EVENT = "restaurant:website-realtime-update";

const PUBLIC_REALTIME_RECONNECT_EVENT = "restaurant:website-realtime-reconnect";

/*
|--------------------------------------------------------------------------
| Refresh Callback
|--------------------------------------------------------------------------
*/

type RefreshCallback = () => Promise<void> | void;

/*
|--------------------------------------------------------------------------
| Publishers
|--------------------------------------------------------------------------
|
| WebsiteRealtimeProvider owns the single Echo / Reverb connection.
|
| It publishes small browser events here so individual client components
| never create their own WebSocket connection.
|--------------------------------------------------------------------------
*/

export function publishPublicRealtime(
  payload: PublicRealtimeInvalidation
): void {
  window.dispatchEvent(
    new CustomEvent<PublicRealtimeInvalidation>(PUBLIC_REALTIME_UPDATE_EVENT, {
      detail: payload,
    })
  );
}

export function publishPublicRealtimeReconnect(): void {
  window.dispatchEvent(new Event(PUBLIC_REALTIME_RECONNECT_EVENT));
}

/*
|--------------------------------------------------------------------------
| Public Realtime Refresh Hook
|--------------------------------------------------------------------------
|
| Individual website client components can subscribe to one or more public
| realtime domains.
|
| Example:
|
| usePublicRealtimeRefresh(
|   ["menu"],
|   async () => {
|     await refreshMenu();
|   }
| );
|
| Multiple broadcasts created by one backend transaction are collapsed into
| one REST reconciliation using a small debounce window.
|--------------------------------------------------------------------------
*/

export function usePublicRealtimeRefresh(
  domains: readonly PublicRealtimeDomain[],

  refresh: RefreshCallback,

  debounceMs = 200
): void {
  /*
  |--------------------------------------------------------------------------
  | Latest Refresh Callback
  |--------------------------------------------------------------------------
  |
  | Do not mutate refs during render.
  |
  | Keeping the latest callback in an effect also keeps this compatible with
  | React 19 / React Compiler's refs rules.
  |--------------------------------------------------------------------------
  */

  const refreshRef = useRef<RefreshCallback>(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  /*
  |--------------------------------------------------------------------------
  | Stable Domain Dependency
  |--------------------------------------------------------------------------
  |
  | Consumers can safely provide:
  |
  | [
  |   "menu",
  |   "reviews",
  | ]
  |
  | inline without forcing the subscription effect to restart on every
  | render.
  |--------------------------------------------------------------------------
  */

  const domainKey = domains.join("|");

  /*
  |--------------------------------------------------------------------------
  | Browser Event Subscription
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const allowedDomains = new Set<PublicRealtimeDomain>(
      domainKey.split("|").filter(Boolean) as PublicRealtimeDomain[]
    );

    let timeout: number | null = null;

    let disposed = false;

    /*
      |--------------------------------------------------------------------------
      | Run REST Reconciliation
      |--------------------------------------------------------------------------
      */

    const run = (): void => {
      timeout = null;

      if (disposed) {
        return;
      }

      Promise.resolve(refreshRef.current()).catch((exception) => {
        /*
         * A failed background synchronization must never destroy
         * the usable public website.
         *
         * A later event, reconnect, navigation or manual reload can
         * reconcile again.
         */
        console.error("Public realtime REST reconciliation failed.", exception);
      });
    };

    /*
      |--------------------------------------------------------------------------
      | Debounce
      |--------------------------------------------------------------------------
      */

    const schedule = (): void => {
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }

      timeout = window.setTimeout(run, debounceMs);
    };

    /*
      |--------------------------------------------------------------------------
      | Realtime Update
      |--------------------------------------------------------------------------
      */

    const handleUpdate = (event: Event): void => {
      const realtimeEvent = event as CustomEvent<PublicRealtimeInvalidation>;

      if (
        !realtimeEvent.detail ||
        !allowedDomains.has(realtimeEvent.detail.domain)
      ) {
        return;
      }

      schedule();
    };

    /*
      |--------------------------------------------------------------------------
      | Reverb Reconnect
      |--------------------------------------------------------------------------
      |
      | The browser may have missed events while the socket was disconnected.
      |
      | Every mounted consumer therefore reconciles its authoritative REST
      | state when Reverb reconnects.
      |--------------------------------------------------------------------------
      */

    const handleReconnect = (): void => {
      schedule();
    };

    /*
      |--------------------------------------------------------------------------
      | Subscribe
      |--------------------------------------------------------------------------
      */

    window.addEventListener(PUBLIC_REALTIME_UPDATE_EVENT, handleUpdate);

    window.addEventListener(PUBLIC_REALTIME_RECONNECT_EVENT, handleReconnect);

    /*
      |--------------------------------------------------------------------------
      | Cleanup
      |--------------------------------------------------------------------------
      */

    return () => {
      disposed = true;

      if (timeout !== null) {
        window.clearTimeout(timeout);

        timeout = null;
      }

      window.removeEventListener(PUBLIC_REALTIME_UPDATE_EVENT, handleUpdate);

      window.removeEventListener(
        PUBLIC_REALTIME_RECONNECT_EVENT,
        handleReconnect
      );
    };
  }, [debounceMs, domainKey]);
}
