import { api } from "../lib/api";

import type {
  CancelOrderPayload,
  Order,
  OrderFilters,
  OrderListResult,
  OrderPagination,
  OrderTransitionPayload,
  RejectOrderPayload,
} from "./types";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): OrderPagination {
  const pagination = meta?.pagination;

  if (!isRecord(pagination)) {
    return {
      current_page: 1,

      per_page: 30,

      total: 0,

      last_page: 1,
    };
  }

  return {
    current_page: numberValue(pagination.current_page, 1),

    per_page: numberValue(pagination.per_page, 30),

    total: numberValue(pagination.total, 0),

    last_page: numberValue(pagination.last_page, 1),
  };
}

/*
|--------------------------------------------------------------------------
| List Orders
|--------------------------------------------------------------------------
*/

export async function getOrders(
  filters: OrderFilters
): Promise<OrderListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage));

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.orderType) {
    params.set("order_type", filters.orderType);
  }

  if (filters.orderSource) {
    params.set("order_source", filters.orderSource);
  }

  if (filters.tableId !== null && filters.tableId !== undefined) {
    params.set("table_id", String(filters.tableId));
  }

  const response = await api.get<Order[]>(`/orders?${params.toString()}`);

  return {
    orders: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

/*
|--------------------------------------------------------------------------
| Order Details
|--------------------------------------------------------------------------
*/

export async function getOrder(orderId: number): Promise<Order> {
  const response = await api.get<Order>(`/orders/${orderId}`);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Confirm
|--------------------------------------------------------------------------
*/

export async function confirmOrder(
  orderId: number,
  payload: OrderTransitionPayload = {}
): Promise<Order> {
  const response = await api.post<Order>(`/orders/${orderId}/confirm`, payload);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Reject
|--------------------------------------------------------------------------
*/

export async function rejectOrder(
  orderId: number,
  payload: RejectOrderPayload
): Promise<Order> {
  const response = await api.post<Order>(`/orders/${orderId}/reject`, payload);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Send To Kitchen
|--------------------------------------------------------------------------
*/

export async function sendOrderToKitchen(
  orderId: number,
  payload: OrderTransitionPayload = {}
): Promise<Order> {
  const response = await api.post<Order>(
    `/orders/${orderId}/send-to-kitchen`,
    payload
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Serve
|--------------------------------------------------------------------------
*/

export async function serveOrder(
  orderId: number,
  payload: OrderTransitionPayload = {}
): Promise<Order> {
  const response = await api.post<Order>(`/orders/${orderId}/serve`, payload);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Complete
|--------------------------------------------------------------------------
*/

export async function completeOrder(
  orderId: number,
  payload: OrderTransitionPayload = {}
): Promise<Order> {
  const response = await api.post<Order>(
    `/orders/${orderId}/complete`,
    payload
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Cancel
|--------------------------------------------------------------------------
*/

export async function cancelOrder(
  orderId: number,
  payload: CancelOrderPayload
): Promise<Order> {
  const response = await api.post<Order>(`/orders/${orderId}/cancel`, payload);

  return response.data;
}
