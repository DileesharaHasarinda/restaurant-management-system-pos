import type { Order } from "../../types";

import type { OrderDisplayItem, OrderDisplayMeta } from "./types";

interface RawAddon {
  id?: number;

  addon_id?: number;

  name?: string;

  addon_name?: string;

  addon_name_snapshot?: string;

  quantity?: number | string;
}

interface RawOrderItem {
  id?: number;

  item_name_snapshot?: string;

  item_name?: string;

  name?: string;

  variant_name_snapshot?: string | null;

  variant_name?: string | null;

  variant?: string | null;

  quantity?: number | string;

  line_total?: number | string;

  total?: number | string;

  notes?: string | null;

  special_notes?: string | null;

  addons?: RawAddon[];
}

interface RawOrderMeta {
  table_name?: string | null;

  table_name_snapshot?: string | null;

  table?: {
    name?: string | null;
  } | null;

  token?: string | null;

  token_number?: string | number | null;

  takeaway_token?: string | null;

  order_type?: string | null;

  order_source?: string | null;

  customer_name?: string | null;

  customer_phone?: string | null;

  created_at?: string | null;

  items?: RawOrderItem[];
}

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
};

export const currentOrderMoney = (
  value: number | string | null | undefined
): string => {
  const amount = numberValue(value);

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
};

export const formatOrderDateTime = (
  value: string | null | undefined
): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-LK", {
    dateStyle: "medium",

    timeStyle: "short",
  });
};

export const orderStatusLabel = (status: string): string =>
  status.replace(/_/g, " ");

export const orderStatusClass = (status: string): string => {
  switch (status) {
    case "PENDING":
      return "pending";

    case "CONFIRMED":
      return "confirmed";

    case "SENT_TO_KITCHEN":
      return "kitchen";

    case "SERVED":
      return "served";

    case "COMPLETED":
      return "completed";

    case "CANCELLED":
    case "REJECTED":
      return "cancelled";

    default:
      return "neutral";
  }
};

export const getOrderDisplayItems = (order: Order): OrderDisplayItem[] => {
  const rawOrder = order as unknown as RawOrderMeta;

  return (rawOrder.items ?? []).map((item, index) => ({
    id: Number(item.id ?? index + 1),

    name: item.item_name_snapshot ?? item.item_name ?? item.name ?? "Item",

    variant:
      item.variant_name_snapshot ?? item.variant_name ?? item.variant ?? null,

    quantity: numberValue(item.quantity),

    lineTotal: numberValue(item.line_total ?? item.total),

    notes: item.special_notes ?? item.notes ?? null,
    
    addons: (item.addons ?? []).map((addon) => ({
      id: addon.id ?? addon.addon_id,

      name:
        addon.addon_name_snapshot ?? addon.addon_name ?? addon.name ?? "Addon",

      quantity: numberValue(addon.quantity ?? 1),
    })),
  }));
};

export const getOrderDisplayMeta = (order: Order): OrderDisplayMeta => {
  const raw = order as unknown as RawOrderMeta;

  return {
    tableName:
      raw.table_name ?? raw.table_name_snapshot ?? raw.table?.name ?? null,

    token:
      raw.takeaway_token ??
      raw.token ??
      (raw.token_number !== undefined && raw.token_number !== null
        ? String(raw.token_number)
        : null),

    orderType: raw.order_type ?? null,

    orderSource: raw.order_source ?? null,

    customerName: raw.customer_name ?? null,

    customerPhone: raw.customer_phone ?? null,

    createdAt: raw.created_at ?? null,
  };
};
