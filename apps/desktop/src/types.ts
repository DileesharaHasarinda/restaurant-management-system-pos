/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

export interface PosRole {
  id: number;
  name: string;
  code: string;
}

export interface PosUser {
  id: number;

  name: string;

  username: string;

  email?: string | null;

  phone?: string | null;

  status: string;

  role: PosRole | null;

  permissions: string[];

  last_login_at?: string | null;

  created_at?: string | null;

  updated_at?: string | null;
}

/*
|--------------------------------------------------------------------------
| Tables / Sessions
|--------------------------------------------------------------------------
*/

export interface TableSession {
  id: number;

  session_number?: string;

  public_token?: string;

  business_day_id?: number;

  table_id: number;

  merged_into_session_id?: number | null;

  guest_count: number;

  opened_source?: string;

  status: string;

  opened_at?: string | null;

  closed_at?: string | null;

  closed_by?: number | null;

  close_reason?: string | null;

  last_activity_at?: string | null;

  bill_requested?: boolean;

  bill_requested_at?: string | null;

  bill_requested_by?: number | null;
}

export interface RestaurantTable {
  id: number;

  table_number?: number;

  code?: string;

  name: string;

  area?: string | null;

  capacity: number;

  status: string;

  qr_ordering_enabled?: boolean;

  is_active?: boolean;

  sort_order?: number;

  notes?: string | null;

  open_session?: TableSession | null;

  openSession?: TableSession | null;

  created_at?: string | null;

  updated_at?: string | null;
}

/*
|--------------------------------------------------------------------------
| Menu Categories
|--------------------------------------------------------------------------
*/

export interface MenuCategory {
  id: number;

  name: string;

  slug: string;

  description?: string | null;

  sort_order: number;

  is_active: boolean;

  is_visible_on_website?: boolean;

  is_visible_on_qr?: boolean;

  menu_items_count?: number | null;

  created_at?: string | null;

  updated_at?: string | null;
}

/*
|--------------------------------------------------------------------------
| Menu Variants
|--------------------------------------------------------------------------
*/

export interface MenuVariant {
  id: number;

  sku?: string | null;

  name: string;

  price: number;

  is_default: boolean;

  is_available: boolean;

  is_active: boolean;

  sort_order: number;
}

/*
|--------------------------------------------------------------------------
| Menu Add-ons
|--------------------------------------------------------------------------
*/

export interface MenuAddon {
  id: number;

  addon_group_id: number;

  sku?: string | null;

  name: string;

  base_price: number;

  price: number;

  consumes_inventory: boolean;

  is_available: boolean;

  is_active: boolean;

  is_default: boolean;

  sort_order: number;
}

/*
|--------------------------------------------------------------------------
| Menu Items
|--------------------------------------------------------------------------
*/

export interface MenuItem {
  id: number;

  category_id: number;

  sku?: string | null;

  name: string;

  slug: string;

  description?: string | null;

  photo_url?: string | null;

  price: number;

  tax_rate: number;

  is_available: boolean;

  is_active: boolean;

  is_visible_on_website?: boolean;

  is_visible_on_qr?: boolean;

  has_variants: boolean;

  sort_order: number;

  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;

  variants?: MenuVariant[];

  addons?: MenuAddon[];

  created_at?: string | null;

  updated_at?: string | null;
}

/*
|--------------------------------------------------------------------------
| Order Add-ons
|--------------------------------------------------------------------------
*/

export interface OrderAddon {
  id?: number;

  addon_id?: number | null;

  addon_name_snapshot?: string;

  name?: string;

  quantity: number;

  unit_price: number;

  line_total?: number;
}

/*
|--------------------------------------------------------------------------
| Order Items
|--------------------------------------------------------------------------
*/

export interface OrderItem {
  id: number;

  menu_item_id?: number | null;

  variant_id?: number | null;

  /*
   * Flattened fields used by the
   * Electron POS normalizer.
   */
  item_name_snapshot?: string;

  item_name?: string;

  variant_name_snapshot?: string | null;

  variant_name?: string | null;

  quantity: number;

  unit_price: number;

  line_total: number;

  status?: string;

  special_notes?: string | null;

  sent_to_kitchen_at?: string | null;

  cancelled_at?: string | null;

  addons: OrderAddon[];
}

/*
|--------------------------------------------------------------------------
| Orders
|--------------------------------------------------------------------------
*/

export interface Order {
  id: number;

  order_number: string;

  order_type: string;

  order_source: string;

  status: string;

  business_day_id?: number;

  table_session_id?: number | null;

  table_id?: number | null;

  session_sequence?: number | null;

  /*
   * Laravel currently returns table_name.
   *
   * CashierWorkspace normalizes it into both
   * table_name and table_name_snapshot so
   * existing UI code can safely use either.
   */
  table_name_snapshot?: string | null;

  table_name?: string | null;

  takeaway_token?: string | null;

  /*
   * Flattened customer fields populated by
   * normalizeOrder().
   */
  customer_name?: string | null;

  customer_phone?: string | null;

  customer_notes?: string | null;

  pickup_notes?: string | null;

  internal_notes?: string | null;

  /*
   * Flattened totals populated by
   * normalizeOrder().
   */
  subtotal: number;

  discount_total: number;

  tax_total: number;

  service_charge_total: number;

  grand_total: number;

  estimated_cost_total?: number;

  created_by?: number | null;

  confirmed_by?: number | null;

  cancelled_by?: number | null;

  rejected_by?: number | null;

  confirmed_at?: string | null;

  sent_to_kitchen_at?: string | null;

  served_at?: string | null;

  completed_at?: string | null;

  cancelled_at?: string | null;

  rejected_at?: string | null;

  cancellation_reason?: string | null;

  rejection_reason?: string | null;

  pending_kitchen_item_count?: number;

  items?: OrderItem[];

  status_history?: unknown[];

  created_at?: string | null;

  updated_at?: string | null;
}

/*
|--------------------------------------------------------------------------
| POS Cart
|--------------------------------------------------------------------------
*/

export interface SelectedAddon {
  addon: MenuAddon;

  quantity: number;
}

export interface CartLine {
  id: string;

  item: MenuItem;

  variant: MenuVariant | null;

  addons: SelectedAddon[];

  quantity: number;

  notes: string;
}
