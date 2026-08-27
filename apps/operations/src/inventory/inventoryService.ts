import { api } from "../lib/api";

import type {
  InventoryIngredient,
  InventoryPagination,
  InventoryValuation,
  StockMovement,
  StockMovementFilters,
  StockMovementListResult,
} from "./types";

/*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(
  value: unknown,

  fallback: number
): number {
  return typeof value === "number" ? value : fallback;
}

function readPagination(
  meta: Record<string, unknown> | undefined
): InventoryPagination {
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
    current_page: readNumber(pagination.current_page, 1),

    per_page: readNumber(pagination.per_page, 30),

    total: readNumber(pagination.total, 0),

    last_page: readNumber(pagination.last_page, 1),
  };
}

/*
  |--------------------------------------------------------------------------
  | Current Stock
  |--------------------------------------------------------------------------
  */

export async function getCurrentStock(
  search = ""
): Promise<InventoryIngredient[]> {
  const params = new URLSearchParams();

  if (search.trim() !== "") {
    params.set("search", search.trim());
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";

  const response = await api.get<InventoryIngredient[]>(
    `/inventory/stock${suffix}`
  );

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Low Stock
  |--------------------------------------------------------------------------
  */

export async function getLowStock(): Promise<InventoryIngredient[]> {
  const response = await api.get<InventoryIngredient[]>("/inventory/stock/low");

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Out of Stock
  |--------------------------------------------------------------------------
  */

export async function getOutOfStock(): Promise<InventoryIngredient[]> {
  const response = await api.get<InventoryIngredient[]>(
    "/inventory/stock/out-of-stock"
  );

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Valuation
  |--------------------------------------------------------------------------
  */

export async function getStockValuation(): Promise<InventoryValuation> {
  const response = await api.get<InventoryValuation>(
    "/inventory/stock/valuation"
  );

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Movements
  |--------------------------------------------------------------------------
  */

export async function getStockMovements(
  filters: StockMovementFilters
): Promise<StockMovementListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage ?? 30));

  if (filters.ingredientId) {
    params.set("ingredient_id", String(filters.ingredientId));
  }

  if (filters.movementType) {
    params.set("movement_type", filters.movementType);
  }

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const response = await api.get<StockMovement[]>(
    `/inventory/stock/movements?${params.toString()}`
  );

  return {
    movements: response.data,

    pagination: readPagination(response.meta),
  };
}

/*
  |--------------------------------------------------------------------------
  | Ingredient History
  |--------------------------------------------------------------------------
  */

export async function getIngredientStockHistory(
  ingredientId: number,

  page = 1
): Promise<StockMovementListResult> {
  const params = new URLSearchParams();

  params.set("page", String(page));

  params.set("per_page", "30");

  const response = await api.get<StockMovement[]>(
    `/inventory/ingredients/${ingredientId}/stock-history?${params.toString()}`
  );

  return {
    movements: response.data,

    pagination: readPagination(response.meta),
  };
}
