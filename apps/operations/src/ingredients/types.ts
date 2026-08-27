export type MeasurementType = "MASS" | "VOLUME" | "COUNT";

export type IngredientStockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

/*
|--------------------------------------------------------------------------
| Units
|--------------------------------------------------------------------------
*/

export interface IngredientUnit {
  id: number;

  name: string;

  symbol: string;

  measurement_type: MeasurementType;

  base_unit_id: number | null;

  base_unit: {
    id: number;

    name: string;

    symbol: string;
  } | null;

  conversion_factor: number;

  is_root_unit: boolean;

  is_active: boolean;
}

/*
|--------------------------------------------------------------------------
| Ingredient
|--------------------------------------------------------------------------
*/

export interface Ingredient {
  id: number;

  sku: string | null;

  name: string;

  base_unit: {
    id: number;

    name: string;

    symbol: string;

    measurement_type: MeasurementType;
  } | null;

  current_stock: number;

  minimum_stock: number;

  average_cost: number;

  stock_value: number;

  is_low_stock: boolean;

  is_out_of_stock: boolean;

  stock_status: IngredientStockStatus;

  track_stock: boolean;

  storage_location: string | null;

  is_active: boolean;

  created_at: string | null;

  updated_at: string | null;
}

/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

export interface IngredientPagination {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

/*
|--------------------------------------------------------------------------
| Filters
|--------------------------------------------------------------------------
*/

export interface IngredientFilters {
  page: number;

  search?: string;

  baseUnitId?: number | null;

  isActive?: boolean | null;

  lowStock?: boolean;

  perPage?: number;
}

export interface IngredientListResult {
  ingredients: Ingredient[];

  pagination: IngredientPagination;
}

/*
|--------------------------------------------------------------------------
| Payloads
|--------------------------------------------------------------------------
*/

export interface CreateIngredientPayload {
  name: string;

  base_unit_id: number;

  minimum_stock: number;

  storage_location: string | null;

  is_active: boolean;
}

export interface UpdateIngredientPayload {
  name: string;

  base_unit_id: number;

  minimum_stock: number;

  storage_location: string | null;
}

export interface UpdateIngredientStatusPayload {
  is_active: boolean;
}

export interface IngredientEditorSubmission {
  name: string;

  base_unit_id: number;

  minimum_stock: number;

  storage_location: string | null;

  is_active: boolean;
}
