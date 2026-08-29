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
  /*
  |--------------------------------------------------------------------------
  | Latest Refresh Callback
  |--------------------------------------------------------------------------
  |
  | Keep the latest callback in a ref so the realtime event listeners do not
  | need to be recreated every time the consuming component renders.
  |
  | The ref is synchronized inside an effect rather than during render so it
  | remains compatible with React Compiler / refs lint rules.
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
  | Consumers commonly pass an inline array:
  |
  | [
  |   "billing",
  |   "orders",
  | ]
  |
  | That creates a new array during each render.
  |
  | Convert it into a primitive string so the main realtime effect only
  | restarts when the actual domain values change.
  |--------------------------------------------------------------------------
  */

  const domainKey = domains.join("|");

  /*
  |--------------------------------------------------------------------------
  | Realtime Subscription
  |--------------------------------------------------------------------------
  */

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
      |
      | Several backend mutations can broadcast multiple related events.
      |
      | Collapse the burst into one authoritative REST reconciliation.
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
      |
      | A mounted screen may have missed one or more broadcasts while Reverb
      | was disconnected.
      |
      | Reconnect therefore triggers a REST reconciliation regardless of the
      | specific domain that changed while disconnected.
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

        timeout = null;
      }

      window.removeEventListener(STAFF_UPDATE_EVENT, handleUpdate);

      window.removeEventListener(STAFF_RECONNECT_EVENT, handleReconnect);
    };
  }, [debounceMs, domainKey]);
}
