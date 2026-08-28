export type StockAdjustmentDirection = "IN" | "OUT" | "NONE";

export type StockAdjustmentStatus = "DRAFT" | "POSTED";

export interface StockAdjustmentUnit {
  id: number;
  name: string;
  symbol: string;
}

export interface StockAdjustmentIngredient {
  id: number;

  sku: string | null;

  name: string;

  current_stock: number;

  base_unit: StockAdjustmentUnit | null;
}

export interface StockAdjustmentUser {
  id: number;
  name: string;
}

export interface StockAdjustmentMovement {
  id: number;

  movement_type: string;

  quantity_delta: number;

  balance_after: number;

  unit_cost: number;

  total_cost: number;
}

export interface StockAdjustment {
  id: number;

  client_request_id: string | null;

  adjustment_number: string;

  status: StockAdjustmentStatus;

  direction: StockAdjustmentDirection;

  business_day_id: number;

  ingredient: StockAdjustmentIngredient | null;

  count_unit: StockAdjustmentUnit | null;

  system_quantity: number;

  actual_quantity: number;

  difference_quantity: number;

  system_base_quantity: number;

  actual_base_quantity: number;

  difference_base_quantity: number;

  unit_cost_per_base_unit: number;

  adjustment_value: number;

  reason: string;

  created_by: StockAdjustmentUser | null;

  posted_at: string | null;

  stock_movement: StockAdjustmentMovement | null;

  created_at: string | null;
}

export interface StockAdjustmentPagination {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

export interface StockAdjustmentFilters {
  page: number;

  ingredientId?: number | null;

  direction?: StockAdjustmentDirection | null;

  dateFrom?: string;

  dateTo?: string;

  search?: string;

  perPage?: number;
}

export interface StockAdjustmentListResult {
  records: StockAdjustment[];

  pagination: StockAdjustmentPagination;
}

export interface PhysicalStockCountPayload {
  client_request_id: string;

  unit_id: number;

  actual_quantity: number;

  reason: string;
}

/*
|--------------------------------------------------------------------------
| Ingredient Options
|--------------------------------------------------------------------------
*/

export interface StockAdjustmentIngredientOption {
  id: number;

  sku: string | null;

  name: string;

  current_stock: number;

  is_active: boolean;

  track_stock: boolean;

  base_unit: StockAdjustmentUnit | null;
}

/*
|--------------------------------------------------------------------------
| Unit Options
|--------------------------------------------------------------------------
*/

export interface StockAdjustmentUnitOption {
  id: number;

  name: string;

  symbol: string;

  unit_type: string | null;

  base_unit_id: number | null;

  conversion_factor: number;

  is_active: boolean;
}
