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
}

export interface TableSession {
  id: number;
  session_number?: string;
  table_id: number;

  guest_count: number;

  status: string;

  bill_requested?: boolean;

  bill_requested_at?: string | null;

  bill_requested_by?: number | null;

  merged_into_session_id?: number | null;
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

  open_session?: TableSession | null;

  openSession?: TableSession | null;
}

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

export interface MenuAddon {
  id: number;
  addon_group_id: number;
  sku?: string | null;
  name: string;
  base_price: number;
  price: number;
  is_available: boolean;
  is_active: boolean;
  is_default: boolean;
  consumes_inventory: boolean;
  sort_order: number;
}

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
}

export interface MenuCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface OrderAddon {
  id?: number;
  addon_id?: number;

  addon_name_snapshot?: string;

  name?: string;

  quantity: number;

  unit_price: number;

  line_total?: number;
}

export interface OrderItem {
  id: number;

  menu_item_id?: number | null;

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

  addons?: OrderAddon[];
}

export interface Order {
  id: number;

  order_number: string;

  order_type: string;

  order_source: string;

  status: string;

  table_session_id?: number | null;

  table_id?: number | null;

  table_name_snapshot?: string | null;

  table_name?: string | null;

  takeaway_token?: string | null;

  customer_name?: string | null;

  customer_phone?: string | null;

  customer_notes?: string | null;

  pickup_notes?: string | null;

  subtotal: number;

  discount_total?: number;

  tax_total?: number;

  service_charge_total?: number;

  grand_total: number;

  created_at?: string | null;

  confirmed_at?: string | null;

  sent_to_kitchen_at?: string | null;

  served_at?: string | null;

  completed_at?: string | null;

  items?: OrderItem[];
}

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
