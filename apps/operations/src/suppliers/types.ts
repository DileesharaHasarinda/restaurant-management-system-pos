/*
|--------------------------------------------------------------------------
| Supplier
|--------------------------------------------------------------------------
*/

export interface Supplier {
  id: number;

  supplier_code: string;

  name: string;

  phone: string | null;

  email: string | null;

  address: string | null;

  notes: string | null;

  /*
   * Read-only authoritative balance from Laravel.
   */
  current_balance: number;

  is_active: boolean;

  created_at: string | null;

  updated_at: string | null;
}

/*
  |--------------------------------------------------------------------------
  | Pagination
  |--------------------------------------------------------------------------
  */

export interface SupplierPagination {
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

export interface SupplierFilters {
  page: number;

  search?: string;

  isActive?: boolean | null;

  perPage?: number;
}

export interface SupplierListResult {
  suppliers: Supplier[];

  pagination: SupplierPagination;
}

/*
  |--------------------------------------------------------------------------
  | Payloads
  |--------------------------------------------------------------------------
  */

export interface CreateSupplierPayload {
  name: string;

  phone: string | null;

  email: string | null;

  address: string | null;

  notes: string | null;

  is_active: boolean;
}

export interface UpdateSupplierPayload {
  name: string;

  phone: string | null;

  email: string | null;

  address: string | null;

  notes: string | null;
}

export interface UpdateSupplierStatusPayload {
  is_active: boolean;
}

export interface SupplierEditorSubmission {
  name: string;

  phone: string | null;

  email: string | null;

  address: string | null;

  notes: string | null;

  is_active: boolean;
}
