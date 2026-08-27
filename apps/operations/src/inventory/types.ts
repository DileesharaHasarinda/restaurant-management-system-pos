/*
|--------------------------------------------------------------------------
| Inventory Units
|--------------------------------------------------------------------------
*/

export interface InventoryUnit {
  id: number;

  name: string;

  symbol: string;

  measurement_type?: string;
}

/*
  |--------------------------------------------------------------------------
  | Ingredient Stock
  |--------------------------------------------------------------------------
  */

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface InventoryIngredient {
  id: number;

  sku: string | null;

  name: string;

  base_unit: InventoryUnit | null;

  current_stock: number;

  minimum_stock: number;

  average_cost: number;

  stock_value: number;

  is_low_stock: boolean;

  is_out_of_stock: boolean;

  stock_status: StockStatus;

  track_stock: boolean;

  storage_location: string | null;

  is_active: boolean;

  created_at: string | null;

  updated_at: string | null;
}

/*
  |--------------------------------------------------------------------------
  | Inventory Valuation
  |--------------------------------------------------------------------------
  */

export interface InventoryValuation {
  total_stock_value: number;

  ingredient_count: number;

  items: InventoryIngredient[];
}

/*
  |--------------------------------------------------------------------------
  | Stock Movement
  |--------------------------------------------------------------------------
  */

export type StockMovementType =
  | "OPENING_BALANCE"
  | "PURCHASE"
  | "SALE_CONSUMPTION"
  | "WASTAGE"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "CANCELLATION_REVERSAL";

export interface StockMovementIngredient {
  id: number;

  sku: string | null;

  name: string;

  base_unit: {
    id: number;

    symbol: string;
  } | null;
}

export interface StockMovementUser {
  id: number;

  name: string;
}

export interface StockMovementSource {
  type: string | null;

  id: number | null;
}

export interface StockMovement {
  id: number;

  movement_key: string;

  ingredient: StockMovementIngredient | null;

  movement_type: StockMovementType;

  quantity_delta: number;

  balance_after: number;

  unit_cost: number;

  total_cost: number;

  reference: string | null;

  notes: string | null;

  source: StockMovementSource;

  business_day_id: number | null;

  created_by: StockMovementUser | null;

  occurred_at: string | null;
}

/*
  |--------------------------------------------------------------------------
  | Pagination
  |--------------------------------------------------------------------------
  */

export interface InventoryPagination {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

/*
  |--------------------------------------------------------------------------
  | Movement Filters
  |--------------------------------------------------------------------------
  */

export interface StockMovementFilters {
  page: number;

  ingredientId?: number | null;

  movementType?: StockMovementType | null;

  dateFrom?: string;

  dateTo?: string;

  search?: string;

  perPage?: number;
}

export interface StockMovementListResult {
  movements: StockMovement[];

  pagination: InventoryPagination;
}
