import type { Supplier } from "../suppliers/types";

export type PurchaseStatus = "DRAFT" | "COMPLETED" | "CANCELLED";

export type PurchasePaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export interface PurchaseIngredientBaseUnit {
  id: number;
  name: string;
  symbol: string;
  measurement_type: string;
}

export interface PurchaseIngredientOption {
  id: number;
  sku: string | null;
  name: string;

  base_unit: PurchaseIngredientBaseUnit | null;

  current_stock: number;
  minimum_stock: number;
  average_cost: number;

  stock_value: number;
  is_low_stock: boolean;
  is_out_of_stock: boolean;

  track_stock: boolean;
  is_active: boolean;
}

export interface PurchaseUnitOption {
  id: number;

  name: string;
  symbol: string;

  measurement_type: string;

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

export interface PurchaseItem {
  id: number;

  ingredient: {
    id: number;
    sku: string | null;
    name: string;

    base_unit: {
      id: number;
      symbol: string;
    } | null;
  } | null;

  purchase_unit: {
    id: number;
    name: string;
    symbol: string;
  } | null;

  quantity: number;
  unit_cost: number;
  line_total: number;

  base_quantity: number | null;
  base_unit_cost: number | null;
}

export interface Purchase {
  id: number;

  purchase_number: string;

  supplier: Supplier | null;

  purchase_date: string | null;

  supplier_invoice_number: string | null;

  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;

  paid_amount: number;
  balance_due: number;

  payment_status: PurchasePaymentStatus;

  status: PurchaseStatus;

  notes: string | null;

  items: PurchaseItem[];

  payment_history: unknown[];

  completed_at: string | null;

  created_at: string | null;
  updated_at: string | null;
}

export interface PurchasePagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PurchaseFilters {
  page: number;

  search?: string;

  supplierId?: number | null;

  status?: PurchaseStatus | null;

  dateFrom?: string;

  dateTo?: string;

  perPage?: number;
}

export interface PurchaseListResult {
  purchases: Purchase[];
  pagination: PurchasePagination;
}

export interface PurchaseLinePayload {
  ingredient_id: number;
  unit_id: number;
  quantity: number;
  unit_cost: number;
}

export interface PurchasePayload {
  supplier_id: number;

  purchase_date: string;

  supplier_invoice_number: string | null;

  notes: string | null;

  items: PurchaseLinePayload[];
}
