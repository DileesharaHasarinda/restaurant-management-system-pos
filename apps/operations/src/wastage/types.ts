export type WastageReasonCode =
  | "EXPIRED"
  | "SPOILED"
  | "DAMAGED"
  | "COOKING_ERROR"
  | "DROPPED"
  | "OVERPRODUCTION"
  | "STAFF_MEAL"
  | "OTHER";

export type WastageStatus = "POSTED";

export interface WastageUnitSummary {
  id: number;
  name: string;
  symbol: string;
}

export interface WastageIngredientSummary {
  id: number;
  sku: string | null;
  name: string;

  current_stock: number;

  base_unit: WastageUnitSummary | null;
}

export interface WastageEnteredQuantity {
  quantity: number;

  unit: WastageUnitSummary | null;
}

export interface WastageCreatedBy {
  id: number;
  name: string;
}

export interface WastageRecord {
  id: number;

  client_request_id: string | null;

  wastage_number: string;

  wastage_type: string;

  status: WastageStatus;

  business_day_id: number;

  ingredient: WastageIngredientSummary | null;

  entered_quantity: WastageEnteredQuantity;

  base_quantity: number;

  reason_code: WastageReasonCode;

  reason_label: string;

  reason: string | null;

  estimated_cost: number;

  created_by: WastageCreatedBy | null;

  wasted_at: string | null;

  created_at: string | null;
}

export interface WastagePagination {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

export type WastageReasonCatalog = Record<string, string>;

export interface WastageFilters {
  page: number;

  ingredientId?: number | null;

  reasonCode?: WastageReasonCode | null;

  status?: WastageStatus | null;

  dateFrom?: string;

  dateTo?: string;

  perPage?: number;
}

export interface WastageListResult {
  records: WastageRecord[];

  pagination: WastagePagination;

  reasonCodes: WastageReasonCatalog;
}

export interface CreateWastagePayload {
  client_request_id: string;

  ingredient_id: number;

  quantity: number;

  unit_id: number;

  reason_code: WastageReasonCode;

  reason: string | null;
}

/*
|--------------------------------------------------------------------------
| Ingredient Lookup
|--------------------------------------------------------------------------
*/

export interface WastageIngredientOption {
  id: number;

  sku: string | null;

  name: string;

  current_stock: number;

  is_active: boolean;

  track_stock: boolean;

  base_unit: WastageUnitSummary | null;
}

/*
|--------------------------------------------------------------------------
| Unit Lookup
|--------------------------------------------------------------------------
*/

export interface WastageUnitOption {
  id: number;

  name: string;

  symbol: string;

  unit_type: string | null;

  base_unit_id: number | null;

  conversion_factor: number;

  is_active: boolean;
}
