import { api } from "../lib/api";

import type {
  CreateIngredientPayload,
  Ingredient,
  IngredientFilters,
  IngredientListResult,
  IngredientPagination,
  IngredientUnit,
  UpdateIngredientPayload,
  UpdateIngredientStatusPayload,
} from "./types";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(
  value: unknown,

  fallback: number
): number {
  return typeof value === "number" ? value : fallback;
}

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): IngredientPagination {
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
| Ingredients
|--------------------------------------------------------------------------
*/

export async function getIngredients(
  filters: IngredientFilters
): Promise<IngredientListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage ?? 30));

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.baseUnitId) {
    params.set("base_unit_id", String(filters.baseUnitId));
  }

  if (filters.isActive !== null && filters.isActive !== undefined) {
    params.set("is_active", filters.isActive ? "1" : "0");
  }

  if (filters.lowStock) {
    params.set("low_stock", "1");
  }

  const response = await api.get<Ingredient[]>(
    `/inventory/ingredients?${params.toString()}`
  );

  return {
    ingredients: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

export async function createIngredient(
  payload: CreateIngredientPayload
): Promise<Ingredient> {
  const response = await api.post<Ingredient>(
    "/inventory/ingredients",
    payload
  );

  return response.data;
}

export async function updateIngredient(
  id: number,

  payload: UpdateIngredientPayload
): Promise<Ingredient> {
  const response = await api.put<Ingredient>(
    `/inventory/ingredients/${id}`,
    payload
  );

  return response.data;
}

export async function updateIngredientStatus(
  id: number,

  payload: UpdateIngredientStatusPayload
): Promise<Ingredient> {
  const response = await api.patch<Ingredient>(
    `/inventory/ingredients/${id}/status`,
    payload
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Units
|--------------------------------------------------------------------------
*/

export async function getUnits(): Promise<IngredientUnit[]> {
  const response = await api.get<IngredientUnit[]>("/inventory/units");

  return response.data;
}
