import type { Order } from "../../types";

import type {
  OrderActionPermissions,
  OrderDisplayItem,
  OrderDisplayMeta,
  OrderItemKitchenState,
} from "./types";

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

  status?: string | null;

  sent_to_kitchen_at?: string | null;

  cancelled_at?: string | null;

  addons?: RawAddon[];
}

interface RawOrderActions {
  can_confirm?: boolean;

  can_reject?: boolean;

  can_send_to_kitchen?: boolean;

  can_serve?: boolean;

  can_complete?: boolean;

  can_cancel?: boolean;
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

  pending_kitchen_item_count?: number | string;

  actions?: RawOrderActions | null;

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

const kitchenStateForItem = (item: RawOrderItem): OrderItemKitchenState => {
  if (item.status === "CANCELLED" || item.cancelled_at) {
    return "CANCELLED";
  }

  if (item.sent_to_kitchen_at) {
    return "SENT";
  }

  return "WAITING";
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

    status: item.status ?? "ACTIVE",

    sentToKitchenAt: item.sent_to_kitchen_at ?? null,

    cancelledAt: item.cancelled_at ?? null,

    kitchenState: kitchenStateForItem(item),

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

export const getOrderActions = (order: Order): OrderActionPermissions => {
  const raw = order as unknown as RawOrderMeta;

  return {
    can_confirm: Boolean(raw.actions?.can_confirm),

    can_reject: Boolean(raw.actions?.can_reject),

    can_send_to_kitchen: Boolean(raw.actions?.can_send_to_kitchen),

    can_serve: Boolean(raw.actions?.can_serve),

    can_complete: Boolean(raw.actions?.can_complete),

    can_cancel: Boolean(raw.actions?.can_cancel),
  };
};

export const getPendingKitchenItemCount = (order: Order): number => {
  const raw = order as unknown as RawOrderMeta;

  if (
    raw.pending_kitchen_item_count !== undefined &&
    raw.pending_kitchen_item_count !== null
  ) {
    return Math.max(0, numberValue(raw.pending_kitchen_item_count));
  }

  /*
   * Display-only fallback.
   *
   * Lifecycle permissions still come from
   * Laravel's actions object.
   */
  return (raw.items ?? []).filter(
    (item) => (item.status ?? "ACTIVE") === "ACTIVE" && !item.sent_to_kitchen_at
  ).length;
};
