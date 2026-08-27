import { api } from "../lib/api";

import type {
  Purchase,
  PurchaseFilters,
  PurchaseIngredientOption,
  PurchaseListResult,
  PurchasePagination,
  PurchasePayload,
  PurchaseUnitOption,
} from "./types";

import type { Supplier } from "../suppliers/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): PurchasePagination {
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

export async function getPurchases(
  filters: PurchaseFilters
): Promise<PurchaseListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage ?? 30));

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.supplierId !== null && filters.supplierId !== undefined) {
    params.set("supplier_id", String(filters.supplierId));
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  const response = await api.get<Purchase[]>(`/purchases?${params.toString()}`);

  return {
    purchases: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

export async function getPurchase(id: number): Promise<Purchase> {
  const response = await api.get<Purchase>(`/purchases/${id}`);

  return response.data;
}

export async function createPurchase(
  payload: PurchasePayload
): Promise<Purchase> {
  const response = await api.post<Purchase>("/purchases", payload);

  return response.data;
}

export async function updatePurchase(
  id: number,
  payload: PurchasePayload
): Promise<Purchase> {
  const response = await api.put<Purchase>(`/purchases/${id}`, payload);

  return response.data;
}

export async function completePurchase(id: number): Promise<Purchase> {
  const response = await api.post<Purchase>(`/purchases/${id}/complete`, {});

  return response.data;
}

export async function cancelPurchase(id: number): Promise<Purchase> {
  const response = await api.post<Purchase>(`/purchases/${id}/cancel`, {});

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Supplier Lookups
  |--------------------------------------------------------------------------
  */

export async function getPurchaseSupplierOptions(
  activeOnly: boolean
): Promise<Supplier[]> {
  const records: Supplier[] = [];

  let page = 1;

  let lastPage = 1;

  do {
    const params = new URLSearchParams();

    params.set("page", String(page));

    params.set("per_page", "100");

    if (activeOnly) {
      params.set("is_active", "1");
    }

    const response = await api.get<Supplier[]>(
      `/suppliers?${params.toString()}`
    );

    records.push(...response.data);

    const pagination = paginationFromMeta(response.meta);

    lastPage = Math.max(1, pagination.last_page);

    page += 1;
  } while (page <= lastPage);

  return records;
}

/*
  |--------------------------------------------------------------------------
  | Ingredient Lookups
  |--------------------------------------------------------------------------
  */

export async function getPurchaseIngredientOptions(): Promise<
  PurchaseIngredientOption[]
> {
  const records: PurchaseIngredientOption[] = [];

  let page = 1;

  let lastPage = 1;

  do {
    const params = new URLSearchParams();

    params.set("page", String(page));

    params.set("per_page", "100");

    params.set("is_active", "1");

    const response = await api.get<PurchaseIngredientOption[]>(
      `/inventory/ingredients?${params.toString()}`
    );

    records.push(...response.data);

    const pagination = paginationFromMeta(response.meta);

    lastPage = Math.max(1, pagination.last_page);

    page += 1;
  } while (page <= lastPage);

  return records;
}

export async function getPurchaseUnitOptions(): Promise<PurchaseUnitOption[]> {
  const response = await api.get<PurchaseUnitOption[]>("/inventory/units");

  return response.data.filter((unit) => unit.is_active);
}
