import type {
  AuthUser,
  MenuAddon,
  MenuCategory,
  MenuItem,
  MenuVariant,
  OrderItemsPayload,
  WaiterOrder,
  WaiterTable,
  WaiterTableDetail,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/+$/,
  ""
);

interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
  message?: string;
  code?: string;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "REQUEST_FAILED") {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      "Unable to connect to the restaurant server.",
      0,
      "NETWORK_ERROR"
    );
  }

  let payload: ApiEnvelope<T> | null = null;

  try {
    const json: unknown = await response.json();

    payload = json as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? "The request could not be completed.",
      response.status,
      payload?.code ?? "REQUEST_FAILED"
    );
  }

  if (!payload) {
    throw new ApiError(
      "The server returned an invalid response.",
      response.status,
      "INVALID_RESPONSE"
    );
  }

  return payload.data;
}

/*
  |--------------------------------------------------------------------------
  | Authentication
  |--------------------------------------------------------------------------
  */

export async function login(
  loginValue: string,
  password: string
): Promise<{
  token: string;
  user: AuthUser;
}> {
  const data = await request<{
    token_type: string;
    access_token: string;
    expires_at: string;
    user: AuthUser;
  }>("/auth/login", {
    method: "POST",

    body: JSON.stringify({
      login: loginValue,
      password,
      device_name: "operations-waiter-web",
    }),
  });

  return {
    token: data.access_token,

    user: data.user,
  };
}

export function me(token: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/me", {}, token);
}

export async function logout(token: string): Promise<void> {
  await request<null>(
    "/auth/logout",
    {
      method: "POST",
    },
    token
  );
}

/*
  |--------------------------------------------------------------------------
  | Waiter Tables
  |--------------------------------------------------------------------------
  */

export function getWaiterTables(token: string): Promise<WaiterTable[]> {
  return request<WaiterTable[]>("/waiter/tables", {}, token);
}

export function getWaiterTable(
  token: string,
  tableId: number
): Promise<WaiterTableDetail> {
  return request<WaiterTableDetail>(`/waiter/tables/${tableId}`, {}, token);
}

export async function requestTableBill(
  token: string,
  tableId: number
): Promise<void> {
  await request<unknown>(
    `/waiter/tables/${tableId}/request-bill`,
    {
      method: "POST",
    },
    token
  );
}

/*
  |--------------------------------------------------------------------------
  | Waiter Orders
  |--------------------------------------------------------------------------
  */

export function createWaiterOrder(
  token: string,
  tableId: number,
  clientOrderId: string,
  payload: OrderItemsPayload
): Promise<WaiterOrder> {
  return request<WaiterOrder>(
    `/waiter/tables/${tableId}/orders`,
    {
      method: "POST",

      body: JSON.stringify({
        client_order_id: clientOrderId,

        ...payload,
      }),
    },
    token
  );
}

export function appendWaiterOrder(
  token: string,
  orderId: number,
  clientSubmissionId: string,
  payload: OrderItemsPayload
): Promise<WaiterOrder> {
  return request<WaiterOrder>(
    `/waiter/orders/${orderId}/items`,
    {
      method: "POST",

      body: JSON.stringify({
        client_submission_id: clientSubmissionId,

        ...payload,
      }),
    },
    token
  );
}

/*
  |--------------------------------------------------------------------------
  | Menu Normalizers
  |--------------------------------------------------------------------------
  */

type UnknownRecord = Record<string, unknown>;

function toRecord(value: unknown): UnknownRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as UnknownRecord;
  }

  return {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number {
  const result = Number(value);

  return Number.isFinite(result) ? result : 0;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNullableString(value: unknown): string | null {
  const result = toStringValue(value).trim();

  return result.length > 0 ? result : null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1") {
    return true;
  }

  if (value === 0 || value === "0") {
    return false;
  }

  return fallback;
}

function normalizeMenuVariant(value: unknown): MenuVariant {
  const variant = toRecord(value);

  return {
    id: toNumber(variant.id),

    name: toStringValue(variant.name),

    price: toNumber(variant.price),

    is_default: toBoolean(variant.is_default),

    is_available: toBoolean(variant.is_available, true),
  };
}

function normalizeMenuAddon(value: unknown): MenuAddon {
  const addon = toRecord(value);

  const pivot = toRecord(addon.pivot);

  const overridePrice =
    addon.price_override ?? addon.effective_price ?? pivot.price_override;

  return {
    id: toNumber(addon.id),

    name: toStringValue(addon.name),

    price:
      overridePrice !== null && overridePrice !== undefined
        ? toNumber(overridePrice)
        : toNumber(addon.price),

    is_available: toBoolean(addon.is_available, true),
  };
}

function normalizeMenuItem(value: unknown): MenuItem {
  const item = toRecord(value);

  return {
    id: toNumber(item.id),

    category_id: toNumber(item.category_id),

    name: toStringValue(item.name),

    description: toNullableString(item.description),

    photo_url: toNullableString(item.photo_url),

    price: toNumber(item.price),

    has_variants: toBoolean(item.has_variants),

    variants: toArray(item.variants)
      .map(normalizeMenuVariant)
      .filter((variant) => variant.is_available),

    addons: toArray(item.addons)
      .map(normalizeMenuAddon)
      .filter((addon) => addon.is_available),
  };
}

function normalizeMenuCategory(value: unknown): MenuCategory {
  const category = toRecord(value);

  /*
   * Support either:
   *
   * items
   *
   * or
   *
   * menu_items
   *
   * depending on the public menu
   * response structure.
   */
  const rawItems = category.items ?? category.menu_items;

  return {
    id: toNumber(category.id),

    name: toStringValue(category.name),

    description: toNullableString(category.description),

    items: toArray(rawItems).map(normalizeMenuItem),
  };
}

/*
  |--------------------------------------------------------------------------
  | Public Waiter Menu
  |--------------------------------------------------------------------------
  */

export async function getMenu(): Promise<MenuCategory[]> {
  const data = await request<unknown>("/public/menu/qr");

  /*
   * Some API resources may wrap the
   * categories in a "categories" property.
   */
  const dataRecord = toRecord(data);

  const rawCategories = Array.isArray(data) ? data : dataRecord.categories;

  return toArray(rawCategories)
    .map(normalizeMenuCategory)
    .filter((category) => category.items.length > 0);
}
