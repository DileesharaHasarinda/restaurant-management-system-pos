import { api } from "../lib/api";

import type {
  CreateSupplierPayload,
  Supplier,
  SupplierFilters,
  SupplierListResult,
  SupplierPagination,
  UpdateSupplierPayload,
  UpdateSupplierStatusPayload,
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
  return typeof value === "number" ? value : fallback;
}

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): SupplierPagination {
  const raw = meta?.pagination;

  if (!isRecord(raw)) {
    return {
      current_page: 1,

      per_page: 30,

      total: 0,

      last_page: 1,
    };
  }

  return {
    current_page: numberValue(raw.current_page, 1),

    per_page: numberValue(raw.per_page, 30),

    total: numberValue(raw.total, 0),

    last_page: numberValue(raw.last_page, 1),
  };
}

/*
  |--------------------------------------------------------------------------
  | Suppliers
  |--------------------------------------------------------------------------
  */

export async function getSuppliers(
  filters: SupplierFilters
): Promise<SupplierListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage ?? 30));

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.isActive !== null && filters.isActive !== undefined) {
    params.set("is_active", filters.isActive ? "1" : "0");
  }

  const response = await api.get<Supplier[]>(`/suppliers?${params.toString()}`);

  return {
    suppliers: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

export async function getSupplier(id: number): Promise<Supplier> {
  const response = await api.get<Supplier>(`/suppliers/${id}`);

  return response.data;
}

export async function createSupplier(
  payload: CreateSupplierPayload
): Promise<Supplier> {
  const response = await api.post<Supplier>("/suppliers", payload);

  return response.data;
}

export async function updateSupplier(
  id: number,
  payload: UpdateSupplierPayload
): Promise<Supplier> {
  const response = await api.put<Supplier>(`/suppliers/${id}`, payload);

  return response.data;
}

export async function updateSupplierStatus(
  id: number,
  payload: UpdateSupplierStatusPayload
): Promise<Supplier> {
  const response = await api.patch<Supplier>(
    `/suppliers/${id}/status`,
    payload
  );

  return response.data;
}
