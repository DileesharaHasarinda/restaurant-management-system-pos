import { api } from "../lib/api";

import type {
  PhysicalStockCountPayload,
  StockAdjustment,
  StockAdjustmentFilters,
  StockAdjustmentIngredientOption,
  StockAdjustmentListResult,
  StockAdjustmentPagination,
  StockAdjustmentUnit,
  StockAdjustmentUnitOption,
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

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
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

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): StockAdjustmentPagination {
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
| Stock Adjustment History
|--------------------------------------------------------------------------
*/

export async function getStockAdjustments(
  filters: StockAdjustmentFilters
): Promise<StockAdjustmentListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage ?? 30));

  if (filters.ingredientId !== null && filters.ingredientId !== undefined) {
    params.set("ingredient_id", String(filters.ingredientId));
  }

  if (filters.direction) {
    params.set("direction", filters.direction);
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

  const response = await api.get<StockAdjustment[]>(
    `/inventory/stock-adjustments?${params.toString()}`
  );

  return {
    records: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

/*
|--------------------------------------------------------------------------
| Show
|--------------------------------------------------------------------------
*/

export async function getStockAdjustment(id: number): Promise<StockAdjustment> {
  const response = await api.get<StockAdjustment>(
    `/inventory/stock-adjustments/${id}`
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Physical Count
|--------------------------------------------------------------------------
*/

export async function recordPhysicalStockCount(
  ingredientId: number,
  payload: PhysicalStockCountPayload
): Promise<StockAdjustment> {
  const response = await api.post<StockAdjustment>(
    `/inventory/ingredients/${ingredientId}/physical-count`,
    payload
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Unit Normalization
|--------------------------------------------------------------------------
*/

function normalizeUnitSummary(value: unknown): StockAdjustmentUnit | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = numberValue(value.id, 0);

  if (id <= 0) {
    return null;
  }

  return {
    id,

    name: stringValue(value.name),

    symbol: stringValue(value.symbol),
  };
}

/*
|--------------------------------------------------------------------------
| Ingredient Normalization
|--------------------------------------------------------------------------
*/

function normalizeIngredient(
  value: unknown
): StockAdjustmentIngredientOption | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = numberValue(value.id, 0);

  if (id <= 0) {
    return null;
  }

  return {
    id,

    sku: typeof value.sku === "string" ? value.sku : null,

    name: stringValue(value.name, `Ingredient #${id}`),

    current_stock: numberValue(value.current_stock, 0),

    is_active: booleanValue(value.is_active, true),

    track_stock: booleanValue(value.track_stock, true),

    base_unit: normalizeUnitSummary(value.base_unit),
  };
}

/*
|--------------------------------------------------------------------------
| Ingredient Options
|--------------------------------------------------------------------------
*/

export async function getStockAdjustmentIngredientOptions(): Promise<
  StockAdjustmentIngredientOption[]
> {
  const records: StockAdjustmentIngredientOption[] = [];

  let page = 1;

  let lastPage = 1;

  do {
    const params = new URLSearchParams();

    params.set("page", String(page));

    params.set("per_page", "100");

    const response = await api.get<unknown[]>(
      `/inventory/ingredients?${params.toString()}`
    );

    const normalized = response.data
      .map(normalizeIngredient)
      .filter(
        (ingredient): ingredient is StockAdjustmentIngredientOption =>
          ingredient !== null &&
          ingredient.is_active &&
          ingredient.track_stock &&
          ingredient.base_unit !== null
      );

    records.push(...normalized);

    const pagination = paginationFromMeta(response.meta);

    lastPage = Math.max(1, pagination.last_page);

    page += 1;
  } while (page <= lastPage);

  return records;
}

/*
|--------------------------------------------------------------------------
| Unit Normalization
|--------------------------------------------------------------------------
*/

function normalizeUnit(value: unknown): StockAdjustmentUnitOption | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = numberValue(value.id, 0);

  if (id <= 0) {
    return null;
  }

  return {
    id,

    name: stringValue(value.name, `Unit #${id}`),

    symbol: stringValue(value.symbol),

    unit_type:
      typeof value.unit_type === "string"
        ? value.unit_type
        : typeof value.type === "string"
        ? value.type
        : null,

    base_unit_id:
      value.base_unit_id === null || value.base_unit_id === undefined
        ? null
        : numberValue(value.base_unit_id, 0),

    conversion_factor: numberValue(value.conversion_factor, 1),

    is_active: booleanValue(value.is_active, true),
  };
}

/*
|--------------------------------------------------------------------------
| Unit Options
|--------------------------------------------------------------------------
*/

export async function getStockAdjustmentUnitOptions(): Promise<
  StockAdjustmentUnitOption[]
> {
  const response = await api.get<unknown[]>("/inventory/units");

  return response.data
    .map(normalizeUnit)
    .filter(
      (unit): unit is StockAdjustmentUnitOption =>
        unit !== null && unit.is_active
    );
}
