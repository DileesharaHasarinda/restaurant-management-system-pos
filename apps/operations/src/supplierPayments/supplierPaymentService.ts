import { api } from "../lib/api";

import type { Purchase } from "../purchases/types";

import type { Supplier } from "../suppliers/types";

import type {
  SupplierPaymentBatch,
  SupplierPaymentFilters,
  SupplierPaymentListResult,
  SupplierPaymentPagination,
  SupplierPaymentPayload,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): SupplierPaymentPagination {
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
    current_page: numericValue(pagination.current_page, 1),

    per_page: numericValue(pagination.per_page, 30),

    total: numericValue(pagination.total, 0),

    last_page: numericValue(pagination.last_page, 1),
  };
}

export async function getSupplierPayments(
  filters: SupplierPaymentFilters
): Promise<SupplierPaymentListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage ?? 30));

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.supplierId !== null && filters.supplierId !== undefined) {
    params.set("supplier_id", String(filters.supplierId));
  }

  if (filters.purchaseId !== null && filters.purchaseId !== undefined) {
    params.set("purchase_id", String(filters.purchaseId));
  }

  if (filters.paymentMethod) {
    params.set("payment_method", filters.paymentMethod);
  }

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  const response = await api.get<SupplierPaymentBatch[]>(
    `/supplier-payments?${params.toString()}`
  );

  return {
    batches: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

export async function getSupplierPaymentBatch(
  id: number
): Promise<SupplierPaymentBatch> {
  const response = await api.get<SupplierPaymentBatch>(
    `/supplier-payment-batches/${id}`
  );

  return response.data;
}

export async function recordSupplierPayment(
  purchaseId: number,
  payload: SupplierPaymentPayload
): Promise<SupplierPaymentBatch> {
  const response = await api.post<SupplierPaymentBatch>(
    `/purchases/${purchaseId}/payments`,
    payload
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Supplier Filter Options
|--------------------------------------------------------------------------
*/

export async function getSupplierPaymentSupplierOptions(): Promise<Supplier[]> {
  const suppliers: Supplier[] = [];

  let page = 1;

  let lastPage = 1;

  do {
    const params = new URLSearchParams();

    params.set("page", String(page));

    params.set("per_page", "100");

    const response = await api.get<Supplier[]>(
      `/suppliers?${params.toString()}`
    );

    suppliers.push(...response.data);

    const pagination = paginationFromMeta(response.meta);

    lastPage = Math.max(1, pagination.last_page);

    page += 1;
  } while (page <= lastPage);

  return suppliers;
}

/*
|--------------------------------------------------------------------------
| Outstanding Completed Purchases
|--------------------------------------------------------------------------
*/

export async function getOutstandingPurchases(): Promise<Purchase[]> {
  const purchases: Purchase[] = [];

  let page = 1;

  let lastPage = 1;

  do {
    const params = new URLSearchParams();

    params.set("page", String(page));

    params.set("per_page", "100");

    params.set("status", "COMPLETED");

    const response = await api.get<Purchase[]>(
      `/purchases?${params.toString()}`
    );

    purchases.push(
      ...response.data.filter((purchase) => purchase.balance_due > 0)
    );

    const pagination = paginationFromMeta(response.meta);

    lastPage = Math.max(1, pagination.last_page);

    page += 1;
  } while (page <= lastPage);

  return purchases;
}
