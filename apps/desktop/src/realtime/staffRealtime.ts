import Echo from "laravel-echo";
import Pusher from "pusher-js";

/*
|--------------------------------------------------------------------------
| Order Notification Payload
|--------------------------------------------------------------------------
*/

export interface OrderRealtimePayload {
  event_id: string;

  action: "CREATED" | "ITEMS_ADDED" | "STATUS_CHANGED";

  order_id: number;

  order_number: string;

  order_source: string;

  order_type: string;

  status: string;

  table_id: number | null;

  table_name: string | null;

  occurred_at: string;
}

/*
|--------------------------------------------------------------------------
| Universal Staff Invalidation Payload
|--------------------------------------------------------------------------
*/

export type StaffRealtimeDomain =
  | "orders"
  | "tables"
  | "menu"
  | "inventory"
  | "recipes"
  | "suppliers"
  | "purchases"
  | "supplier_payments"
  | "wastage"
  | "expenses"
  | "billing"
  | "cash"
  | "business_day"
  | "users"
  | "settings"
  | "website"
  | string;

export interface StaffRealtimePayload {
  event_id: string;

  domain: StaffRealtimeDomain;

  resource: string;

  action:
    "CREATED" | "UPDATED" | "DELETED" | "RESTORED" | "FORCE_DELETED" | string;

  entity_id: number | string | null;

  occurred_at: string;
}

export type RealtimeConnectionState =
  | "initialized"
  | "connecting"
  | "connected"
  | "unavailable"
  | "failed"
  | "disconnected"
  | string;

/*
|--------------------------------------------------------------------------
| Internal Types
|--------------------------------------------------------------------------
*/

interface ConnectionStateChange {
  previous: string;

  current: string;
}

interface StaffRealtimeOptions {
  token: string;

  onOrder?: (payload: OrderRealtimePayload) => void;

  onStaffUpdate?: (payload: StaffRealtimePayload) => void;

  onReconnect: () => void;

  onStateChange?: (state: RealtimeConnectionState) => void;
}

interface RealtimeConnection {
  bind(
    eventName: string,

    callback: (change: ConnectionStateChange) => void
  ): void;

  unbind(
    eventName: string,

    callback: (change: ConnectionStateChange) => void
  ): void;

  state?: string;
}

interface RealtimePusher {
  connection: RealtimeConnection;
}

interface PusherConnector {
  pusher: RealtimePusher;
}

/*
|--------------------------------------------------------------------------
| Environment
|--------------------------------------------------------------------------
*/

function apiBaseUrl(): string {
  const value =
    import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

  return value.replace(/\/+$/, "");
}

function reverbKey(): string {
  return (import.meta.env.VITE_REVERB_APP_KEY ?? "").trim();
}

function reverbHost(): string {
  return (import.meta.env.VITE_REVERB_HOST ?? "").trim();
}

function reverbPort(): number {
  const value = Number(import.meta.env.VITE_REVERB_PORT ?? 8080);

  if (!Number.isFinite(value) || value <= 0) {
    return 8080;
  }

  return value;
}

function reverbScheme(): "http" | "https" {
  return import.meta.env.VITE_REVERB_SCHEME === "https" ? "https" : "http";
}

/*
|--------------------------------------------------------------------------
| Connection
|--------------------------------------------------------------------------
*/

export function connectStaffRealtime({
  token,
  onOrder,
  onStaffUpdate,
  onReconnect,
  onStateChange,
}: StaffRealtimeOptions): () => void {
  const key = reverbKey();

  const host = reverbHost();

  const port = reverbPort();

  const scheme = reverbScheme();

  const normalizedToken = token.trim();

  if (!key || !host || !normalizedToken) {
    console.warn(
      "Realtime connection skipped because Reverb configuration is incomplete."
    );

    onStateChange?.("disconnected");

    return () => {
      //
    };
  }

  Object.assign(window, {
    Pusher,
  });

  const echo = new Echo({
    broadcaster: "reverb",

    key,

    wsHost: host,

    wsPort: port,

    wssPort: port,

    forceTLS: scheme === "https",

    enabledTransports: ["ws", "wss"],

    authEndpoint: `${apiBaseUrl()}/broadcasting/auth`,

    auth: {
      headers: {
        Accept: "application/json",

        Authorization: `Bearer ${normalizedToken}`,
      },
    },
  });

  /*
    |--------------------------------------------------------------------------
    | Rich Order Notifications
    |--------------------------------------------------------------------------
    */

  echo
    .private("restaurant.orders")
    .listen(".order.updated", (payload: OrderRealtimePayload) => {
      onOrder?.(payload);
    });

  /*
    |--------------------------------------------------------------------------
    | Universal Staff Invalidations
    |--------------------------------------------------------------------------
    */

  echo
    .private("restaurant.staff")
    .listen(".staff.updated", (payload: StaffRealtimePayload) => {
      onStaffUpdate?.(payload);
    });

  const connector = echo.connector as unknown as PusherConnector;

  const connection = connector.pusher.connection;

  let hasConnectedOnce = connection.state === "connected";

  let wasDisconnectedAfterConnection = false;

  const handleStateChange = (change: ConnectionStateChange): void => {
    const current = change.current;

    onStateChange?.(current);

    if (hasConnectedOnce && current !== "connected") {
      wasDisconnectedAfterConnection = true;

      return;
    }

    if (current !== "connected") {
      return;
    }

    if (!hasConnectedOnce) {
      hasConnectedOnce = true;

      return;
    }

    if (wasDisconnectedAfterConnection) {
      wasDisconnectedAfterConnection = false;

      onReconnect();
    }
  };

  connection.bind("state_change", handleStateChange);

  return () => {
    connection.unbind("state_change", handleStateChange);

    echo.leave("restaurant.orders");

    echo.leave("restaurant.staff");

    echo.disconnect();

    onStateChange?.("disconnected");
  };
}
