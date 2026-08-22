import type {
  AppendQrOrderPayload,
  MenuAddon,
  MenuCategory,
  MenuItem,
  MenuVariant,
  PublicOrder,
  PublicTable,
  SubmitQrOrderPayload,
} from "@/types/public-ordering";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as UnknownRecord;
  }

  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
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

function unwrapData(payload: unknown): unknown {
  const record = asRecord(payload);

  return Object.prototype.hasOwnProperty.call(record, "data")
    ? record.data
    : payload;
}

function assetUrl(value: unknown): string | null {
  const path = asNullableString(value);

  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base = (process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "").replace(
    /\/+$/,
    ""
  );

  if (!base) {
    return path;
  }

  return `${base}/${path.replace(/^\/+/, "")}`;
}

/*
|--------------------------------------------------------------------------
| Public API Error
|--------------------------------------------------------------------------
*/

export class PublicApiError extends Error {
  public readonly code: string;

  public readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);

    this.name = "PublicApiError";

    this.code = code;

    this.status = status;
  }
}

/*
|--------------------------------------------------------------------------
| Base Request
|--------------------------------------------------------------------------
*/

async function requestJson(
  url: string,
  init: RequestInit = {}
): Promise<unknown> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (init.body !== undefined && init.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,

      headers,

      cache: "no-store",
    });
  } catch {
    throw new PublicApiError(
      "Unable to connect to the restaurant. Please check your internet connection and try again.",
      "NETWORK_ERROR",
      0
    );
  }

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const root = asRecord(payload);

    const error = asRecord(root.error);

    throw new PublicApiError(
      asString(
        root.message,
        asString(error.message, "The request could not be completed.")
      ),

      asString(root.code, asString(error.code, "REQUEST_FAILED")),

      response.status
    );
  }

  return payload;
}

/*
|--------------------------------------------------------------------------
| Table
|--------------------------------------------------------------------------
*/

function normalizeTable(payload: unknown): PublicTable {
  const data = asRecord(unwrapData(payload));

  const table = asRecord(
    data.table ?? data.restaurant_table ?? data.restaurantTable ?? data
  );

  return {
    id: asNumber(table.id),

    name: asString(table.name, "Restaurant Table"),

    code: asNullableString(table.code),

    area: asNullableString(table.area),

    capacity: table.capacity === undefined ? null : asNumber(table.capacity),

    status: asNullableString(table.status),

    qrOrderingEnabled: asBoolean(
      table.qr_ordering_enabled ?? table.qrOrderingEnabled,
      true
    ),
  };
}

/*
|--------------------------------------------------------------------------
| Menu Variant
|--------------------------------------------------------------------------
*/

function normalizeVariant(value: unknown): MenuVariant {
  const variant = asRecord(value);

  return {
    id: asNumber(variant.id),

    name: asString(variant.name, "Variant"),

    sku: asNullableString(variant.sku),

    price: asNumber(variant.price),

    isDefault: asBoolean(variant.is_default ?? variant.isDefault),

    isAvailable: asBoolean(variant.is_available ?? variant.isAvailable, true),
  };
}

/*
|--------------------------------------------------------------------------
| Menu Add-on
|--------------------------------------------------------------------------
*/

function normalizeAddon(value: unknown): MenuAddon {
  const addon = asRecord(value);

  const pivot = asRecord(addon.pivot);

  const priceOverride = pivot.price_override ?? addon.price_override;

  const price =
    priceOverride !== null && priceOverride !== undefined
      ? asNumber(priceOverride)
      : asNumber(addon.price);

  return {
    id: asNumber(addon.id),

    name: asString(addon.name, "Add-on"),

    sku: asNullableString(addon.sku),

    price,

    consumesInventory: asBoolean(
      addon.consumes_inventory ?? addon.consumesInventory
    ),

    isAvailable: asBoolean(addon.is_available ?? addon.isAvailable, true),
  };
}

/*
|--------------------------------------------------------------------------
| Menu Item
|--------------------------------------------------------------------------
*/

function normalizeItem(value: unknown): MenuItem {
  const item = asRecord(value);

  const variants = asArray(item.variants)
    .map(normalizeVariant)
    .filter((variant) => variant.id > 0 && variant.isAvailable);

  const addons = asArray(item.addons)
    .map(normalizeAddon)
    .filter((addon) => addon.id > 0 && addon.isAvailable);

  return {
    id: asNumber(item.id),

    name: asString(item.name, "Menu Item"),

    sku: asNullableString(item.sku),

    description: asNullableString(item.description),

    price: asNumber(item.price ?? item.base_price),

    imageUrl: assetUrl(
      item.image_url ?? item.photo_url ?? item.image ?? item.image_path
    ),

    hasVariants: asBoolean(
      item.has_variants ?? item.hasVariants,
      variants.length > 0
    ),

    isAvailable: asBoolean(item.is_available ?? item.isAvailable, true),

    variants,

    addons,
  };
}

/*
|--------------------------------------------------------------------------
| Public Menu
|--------------------------------------------------------------------------
*/

function normalizeMenu(payload: unknown): MenuCategory[] {
  return asArray(unwrapData(payload))
    .map((value): MenuCategory => {
      const category = asRecord(value);

      return {
        id: asNumber(category.id),

        name: asString(category.name, "Menu"),

        slug: asNullableString(category.slug),

        description: asNullableString(category.description),

        items: asArray(category.items)
          .map(normalizeItem)
          .filter((item) => item.id > 0 && item.isAvailable),
      };
    })
    .filter((category) => category.items.length > 0);
}

/*
|--------------------------------------------------------------------------
| Public Order
|--------------------------------------------------------------------------
*/

function normalizeOrder(payload: unknown): PublicOrder {
  const order = asRecord(unwrapData(payload));

  const table = asRecord(order.table);

  return {
    orderNumber: asString(order.order_number ?? order.orderNumber),

    statusToken: asString(order.status_token ?? order.statusToken),

    status: asString(order.status, "PENDING"),

    customerStatus: asString(
      order.customer_status ?? order.customerStatus,
      "AWAITING_APPROVAL"
    ),

    table: {
      id: asNumber(table.id),

      name: asString(table.name, "Table"),
    },

    orderType: asString(order.order_type ?? order.orderType, "DINE_IN"),

    subtotal: asNumber(order.subtotal),

    discountTotal: asNumber(order.discount_total ?? order.discountTotal),

    taxTotal: asNumber(order.tax_total ?? order.taxTotal),

    serviceChargeTotal: asNumber(
      order.service_charge_total ?? order.serviceChargeTotal
    ),

    grandTotal: asNumber(order.grand_total ?? order.grandTotal),

    customerNotes: asNullableString(
      order.customer_notes ?? order.customerNotes
    ),

    items: asArray(order.items).map((itemValue) => {
      const item = asRecord(itemValue);

      return {
        id: asNumber(item.id),

        name: asString(item.name),

        variant: asNullableString(item.variant),

        quantity: asNumber(item.quantity),

        unitPrice: asNumber(item.unit_price ?? item.unitPrice),

        lineTotal: asNumber(item.line_total ?? item.lineTotal),

        status: asString(item.status, "ACTIVE"),

        kitchenStatus: asString(
          item.kitchen_status ?? item.kitchenStatus,
          "NOT_SENT_TO_KITCHEN"
        ),

        sentToKitchenAt: asNullableString(
          item.sent_to_kitchen_at ?? item.sentToKitchenAt
        ),

        specialNotes: asNullableString(item.special_notes ?? item.specialNotes),

        addons: asArray(item.addons).map((addonValue) => {
          const addon = asRecord(addonValue);

          return {
            name: asString(addon.name),

            quantity: asNumber(addon.quantity),

            unitPrice: asNumber(addon.unit_price ?? addon.unitPrice),

            lineTotal: asNumber(addon.line_total ?? addon.lineTotal),
          };
        }),
      };
    }),

    submittedAt: asNullableString(order.submitted_at ?? order.submittedAt),

    updatedAt: asNullableString(order.updated_at ?? order.updatedAt),
  };
}

/*
|--------------------------------------------------------------------------
| Resolve Table QR
|--------------------------------------------------------------------------
*/

export async function resolveTableQr(token: string): Promise<PublicTable> {
  const payload = await requestJson(
    `/api/public/table-qr/${encodeURIComponent(token)}`
  );

  return normalizeTable(payload);
}

/*
|--------------------------------------------------------------------------
| Open / Reuse Table Session
|--------------------------------------------------------------------------
*/

export async function openTableSession(token: string): Promise<void> {
  await requestJson(
    `/api/public/table-qr/${encodeURIComponent(token)}/session`,
    {
      method: "POST",

      body: JSON.stringify({
        guest_count: 1,
      }),
    }
  );
}

/*
|--------------------------------------------------------------------------
| Get QR Menu
|--------------------------------------------------------------------------
*/

export async function getQrMenu(): Promise<MenuCategory[]> {
  const payload = await requestJson("/api/public/menu/qr");

  return normalizeMenu(payload);
}

/*
|--------------------------------------------------------------------------
| Submit First QR Order
|--------------------------------------------------------------------------
*/

export async function submitQrOrder(
  token: string,
  payload: SubmitQrOrderPayload
): Promise<PublicOrder> {
  const response = await requestJson(
    `/api/public/table-qr/${encodeURIComponent(token)}/orders`,
    {
      method: "POST",

      body: JSON.stringify(payload),
    }
  );

  return normalizeOrder(response);
}

/*
|--------------------------------------------------------------------------
| Append Items To Existing QR Order
|--------------------------------------------------------------------------
|
| This endpoint does NOT create another order.
|
| New items are appended to the same existing order.
|
|--------------------------------------------------------------------------
*/

export async function appendQrOrderItems(
  statusToken: string,
  payload: AppendQrOrderPayload
): Promise<PublicOrder> {
  const response = await requestJson(
    `/api/public/orders/${encodeURIComponent(statusToken)}/items`,
    {
      method: "POST",

      body: JSON.stringify(payload),
    }
  );

  return normalizeOrder(response);
}

/*
|--------------------------------------------------------------------------
| Get Cumulative Order Status
|--------------------------------------------------------------------------
*/

export async function getPublicOrderStatus(
  statusToken: string
): Promise<PublicOrder> {
  const response = await requestJson(
    `/api/public/orders/${encodeURIComponent(statusToken)}`
  );

  return normalizeOrder(response);
}
