export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SENT_TO_KITCHEN"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

export type OrderType = "DINE_IN" | "TAKEAWAY";

export type OrderSource = "QR_CUSTOMER" | "WAITER" | "CASHIER";

export interface OrderCustomer {
  name: string | null;

  phone: string | null;
}

export interface OrderTotals {
  subtotal: number;

  discount: number;

  tax: number;

  service_charge: number;

  grand_total: number;
}

export interface OrderAddon {
  id: number;

  addon_id: number | null;

  name: string;

  quantity: number;

  unit_price: number;

  line_total: number;
}

export interface OrderItem {
  id: number;

  menu_item_id: number | null;

  variant_id: number | null;

  name: string;

  variant: string | null;

  quantity: number;

  unit_price: number;

  line_total: number;

  status: string;

  special_notes: string | null;

  sent_to_kitchen_at: string | null;

  cancelled_at: string | null;

  addons: OrderAddon[];
}

export interface OrderStatusHistory {
  id: number;

  from_status: string | null;

  to_status: string;

  changed_by: number | null;

  notes: string | null;

  changed_at: string | null;
}

export interface OrderActions {
  can_confirm: boolean;

  can_reject: boolean;

  can_send_to_kitchen: boolean;

  can_serve: boolean;

  can_complete: boolean;

  can_cancel: boolean;
}

export interface Order {
  id: number;

  order_number: string;

  business_day_id: number | null;

  table_session_id: number | null;

  table_id: number | null;

  table_name: string | null;

  takeaway_token: string | null;

  pickup_notes: string | null;

  order_type: OrderType;

  order_source: OrderSource;

  session_sequence: number | null;

  status: OrderStatus;

  customer: OrderCustomer;

  totals: OrderTotals;

  customer_notes: string | null;

  internal_notes: string | null;

  created_by: number | null;

  confirmed_by: number | null;

  cancelled_by: number | null;

  rejected_by: number | null;

  confirmed_at: string | null;

  sent_to_kitchen_at: string | null;

  served_at: string | null;

  completed_at: string | null;

  cancelled_at: string | null;

  rejected_at: string | null;

  cancellation_reason: string | null;

  rejection_reason: string | null;

  pending_kitchen_item_count: number;

  actions: OrderActions;

  items: OrderItem[];

  status_history: OrderStatusHistory[];

  created_at: string | null;

  updated_at: string | null;
}

export interface OrderPagination {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

export interface OrderListResult {
  orders: Order[];

  pagination: OrderPagination;
}

export interface OrderFilters {
  page: number;

  perPage: number;

  search?: string;

  status?: OrderStatus | "";

  orderType?: OrderType | "";

  orderSource?: OrderSource | "";

  tableId?: number | null;
}

export interface OrderTransitionPayload {
  notes?: string | null;
}

export interface RejectOrderPayload {
  reason: string;
}

export interface CancelOrderPayload {
  reason: string;

  manager_login?: string;

  manager_password?: string;
}
