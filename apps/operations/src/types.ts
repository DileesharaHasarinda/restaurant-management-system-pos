export interface AuthUser {
  id: number;
  name: string;
  username: string;

  role?: {
    id?: number;
    name?: string;
    code?: string;
  } | null;
}

export interface TableSessionSummary {
  id: number;
  session_number: string;
  guest_count: number;
  status: string;

  bill_requested: boolean;
  bill_requested_at: string | null;
  bill_requested_by: number | null;

  current_total: number;
  order_count: number;

  active_waiter_order_id: number | null;
}

export interface WaiterTable {
  id: number;
  table_number: number;
  code: string;
  name: string;
  area: string | null;
  capacity: number;
  status: string;
  is_active: boolean;

  current_session: TableSessionSummary | null;
}

export interface OrderAddon {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OrderItem {
  id: number;
  name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  status: string;
  kitchen_status: string;
  sent_to_kitchen_at: string | null;
  special_notes: string | null;
  addons: OrderAddon[];
}

export interface WaiterOrder {
  id: number;
  order_number: string;

  table_id: number;
  table_session_id: number;

  table_name: string;

  order_type: string;
  order_source: string;
  status: string;

  subtotal: number;
  discount_total: number;
  tax_total: number;
  service_charge_total: number;
  grand_total: number;

  can_add_items: boolean;

  items: OrderItem[];

  created_at: string | null;
  confirmed_at: string | null;
  updated_at: string | null;
}

export interface WaiterTableDetail {
  table: WaiterTable;
  orders: WaiterOrder[];
}

export interface MenuVariant {
  id: number;
  name: string;
  price: number;
  is_default: boolean;
  is_available: boolean;
}

export interface MenuAddon {
  id: number;
  name: string;
  price: number;
  is_available: boolean;
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  photo_url: string | null;

  price: number;

  has_variants: boolean;

  variants: MenuVariant[];
  addons: MenuAddon[];
}

export interface MenuCategory {
  id: number;
  name: string;
  description: string | null;
  items: MenuItem[];
}

export interface CartAddon {
  addon_id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface CartLine {
  local_id: string;

  menu_item_id: number;
  name: string;

  variant_id: number | null;
  variant_name: string | null;

  quantity: number;

  unit_price: number;

  addons: CartAddon[];

  special_notes: string;

  display_total: number;
}

export interface OrderItemsPayload {
  items: Array<{
    menu_item_id: number;
    variant_id: number | null;
    quantity: number;
    special_notes: string | null;

    addons: Array<{
      addon_id: number;
      quantity: number;
    }>;
  }>;
}
