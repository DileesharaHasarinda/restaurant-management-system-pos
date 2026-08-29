import { useEffect, useRef } from "react";

import type {
  StaffRealtimeDomain,
  StaffRealtimePayload,
} from "./staffRealtime";

const STAFF_UPDATE_EVENT = "restaurant:staff-realtime-update";

const STAFF_RECONNECT_EVENT = "restaurant:staff-realtime-reconnect";

type RefreshCallback = () => Promise<void> | void;

/*
  |--------------------------------------------------------------------------
  | Publishers
  |--------------------------------------------------------------------------
  */

export function publishStaffRealtime(payload: StaffRealtimePayload): void {
  window.dispatchEvent(
    new CustomEvent<StaffRealtimePayload>(STAFF_UPDATE_EVENT, {
      detail: payload,
    })
  );
}

export function publishRealtimeReconnect(): void {
  window.dispatchEvent(new Event(STAFF_RECONNECT_EVENT));
}

/*
  |--------------------------------------------------------------------------
  | Domain Refresh Hook
  |--------------------------------------------------------------------------
  |
  | One Reverb connection exists at application-shell level.
  |
  | Individual pages/modules subscribe to domains through this hook.
  |
  | Multiple events produced by one transaction are collapsed into
  | one REST reconciliation.
  |--------------------------------------------------------------------------
  */

export function useStaffRealtimeRefresh(
  domains: readonly StaffRealtimeDomain[],
  refresh: RefreshCallback,
  debounceMs = 200
): void {
  const refreshRef = useRef<RefreshCallback>(refresh);

  /*
   * Always keep the latest callback without forcing the event
   * listeners to be recreated on every component render.
   */
  refreshRef.current = refresh;

  /*
   * Convert the domain list into a stable primitive dependency.
   *
   * This prevents a newly-created array literal such as:
   *
   * [
   *   "billing",
   *   "orders",
   * ]
   *
   * from continuously recreating the effect.
   */
  const domainKey = domains.join("|");

  useEffect(() => {
    const allowedDomains = new Set<StaffRealtimeDomain>(
      domainKey.split("|").filter(Boolean) as StaffRealtimeDomain[]
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
        console.error("Realtime REST reconciliation failed.", exception);
      });
    };

    /*
        |--------------------------------------------------------------------------
        | Debounce Realtime Events
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
        | Staff Realtime Update
        |--------------------------------------------------------------------------
        */

    const handleUpdate = (event: Event): void => {
      const realtimeEvent = event as CustomEvent<StaffRealtimePayload>;

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
        */

    const handleReconnect = (): void => {
      /*
       * Any mounted screen may have missed events while
       * Reverb was unavailable.
       *
       * Reconcile authoritative Laravel REST state after
       * the connection is restored.
       */
      schedule();
    };

    /*
        |--------------------------------------------------------------------------
        | Subscribe
        |--------------------------------------------------------------------------
        */

    window.addEventListener(STAFF_UPDATE_EVENT, handleUpdate);

    window.addEventListener(STAFF_RECONNECT_EVENT, handleReconnect);

    /*
        |--------------------------------------------------------------------------
        | Cleanup
        |--------------------------------------------------------------------------
        */

    return () => {
      disposed = true;

      if (timeout !== null) {
        window.clearTimeout(timeout);
      }

      window.removeEventListener(STAFF_UPDATE_EVENT, handleUpdate);

      window.removeEventListener(STAFF_RECONNECT_EVENT, handleReconnect);
    };
  }, [debounceMs, domainKey]);
}
