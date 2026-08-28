import { api } from "../lib/api";

import type {
  CreateWastagePayload,
  WastageFilters,
  WastageIngredientOption,
  WastageListResult,
  WastagePagination,
  WastageReasonCatalog,
  WastageRecord,
  WastageUnitOption,
  WastageUnitSummary,
} from "./types";

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
): WastagePagination {
  const pagination = meta?.pagination;

  if (!isRecord(pagination)) {
    return {
      current_page: 1,

      per_page: 25,

      total: 0,

      last_page: 1,
    };
  }

  return {
    current_page: numberValue(pagination.current_page, 1),

    per_page: numberValue(pagination.per_page, 25),

    total: numberValue(pagination.total, 0),

    last_page: numberValue(pagination.last_page, 1),
  };
}

function reasonCodesFromMeta(
  meta: Record<string, unknown> | undefined
): WastageReasonCatalog {
  const value = meta?.reason_codes;

  if (!isRecord(value)) {
    return {};
  }

  const result: WastageReasonCatalog = {};

  Object.entries(value).forEach(([key, label]) => {
    if (typeof label === "string") {
      result[key] = label;
    }
  });

  return result;
}

/*
|--------------------------------------------------------------------------
| List
|--------------------------------------------------------------------------
*/

export async function getWastages(
  filters: WastageFilters
): Promise<WastageListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage ?? 25));

  if (filters.ingredientId !== null && filters.ingredientId !== undefined) {
    params.set("ingredient_id", String(filters.ingredientId));
  }

  if (filters.reasonCode) {
    params.set("reason_code", filters.reasonCode);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.dateFrom) {
    params.set("from_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("to_date", filters.dateTo);
  }

  const response = await api.get<WastageRecord[]>(
    `/wastages?${params.toString()}`
  );

  return {
    records: response.data,

    pagination: paginationFromMeta(response.meta),

    reasonCodes: reasonCodesFromMeta(response.meta),
  };
}

/*
|--------------------------------------------------------------------------
| Show
|--------------------------------------------------------------------------
*/

export async function getWastage(id: number): Promise<WastageRecord> {
  const response = await api.get<WastageRecord>(`/wastages/${id}`);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Create
|--------------------------------------------------------------------------
*/

export async function createWastage(
  payload: CreateWastagePayload
): Promise<WastageRecord> {
  const response = await api.post<WastageRecord>("/wastages", payload);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Ingredient Lookup Normalization
|--------------------------------------------------------------------------
*/

function normalizeUnitSummary(value: unknown): WastageUnitSummary | null {
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

function normalizeIngredient(value: unknown): WastageIngredientOption | null {
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

export async function getWastageIngredientOptions(): Promise<
  WastageIngredientOption[]
> {
  const records: WastageIngredientOption[] = [];

  let page = 1;

  let lastPage = 1;

  do {
    const params = new URLSearchParams();

    params.set("page", String(page));

    params.set("per_page", "100");

    params.set("is_active", "1");

    const response = await api.get<unknown[]>(
      `/inventory/ingredients?${params.toString()}`
    );

    const normalized = response.data
      .map(normalizeIngredient)
      .filter(
        (ingredient): ingredient is WastageIngredientOption =>
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
| Unit Lookup Normalization
|--------------------------------------------------------------------------
*/

function normalizeUnit(value: unknown): WastageUnitOption | null {
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

export async function getWastageUnitOptions(): Promise<WastageUnitOption[]> {
  const params = new URLSearchParams();

  params.set("is_active", "1");

  const response = await api.get<unknown[]>(
    `/inventory/units?${params.toString()}`
  );

  return response.data
    .map(normalizeUnit)
    .filter(
      (unit): unit is WastageUnitOption => unit !== null && unit.is_active
    );
}
