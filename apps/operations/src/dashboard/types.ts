export interface DashboardBusinessDay {
  id: number;

  business_date: string | null;

  status: string;

  opened_at: string | null;

  closed_at: string | null;
}

export interface DashboardVisibility {
  tables: boolean;

  orders: boolean;

  financial: boolean;

  inventory: boolean;
}

export interface DashboardTableSummary {
  total: number;

  available: number;

  occupied: number;

  reserved: number;

  cleaning: number;

  out_of_service: number;

  open_sessions: number;

  bill_requests: number;
}

export interface DashboardOrderSummary {
  total: number;

  pending: number;

  confirmed: number;

  sent_to_kitchen: number;

  served: number;

  completed: number;

  cancelled: number;

  rejected: number;
}

export interface DashboardPaymentBreakdown {
  method: string;

  count: number;

  amount: number;
}

export interface DashboardFinancialSummary {
  revenue: number;

  completed_orders: number;

  cogs: number;

  gross_profit: number;

  expenses: number;

  wastage_cost: number;

  estimated_net_profit: number;

  payment_total: number;

  average_order_value: number;

  payment_breakdown: DashboardPaymentBreakdown[];
}

export interface DashboardUnit {
  name: string | null;

  symbol: string | null;
}

export interface DashboardLowStockItem {
  id: number;

  sku: string | null;

  name: string;

  current_stock: number;

  reorder_level: number;

  unit: DashboardUnit;
}

export interface DashboardInventorySummary {
  tracked_ingredients: number;

  low_stock_count: number;

  out_of_stock_count: number;

  stock_value: number;

  low_stock_items: DashboardLowStockItem[];
}

export interface DashboardTopItem {
  name: string;

  variant: string | null;

  quantity: number;

  sales_total: number;
}

export interface DashboardRecentOrder {
  id: number;

  order_number: string;

  order_type: string;

  order_source: string;

  table_name: string | null;

  takeaway_token: string | null;

  customer_name: string | null;

  status: string;

  grand_total: number;

  created_at: string | null;
}

export interface DashboardOperations {
  tables: DashboardTableSummary | null;

  orders: DashboardOrderSummary | null;
}

export interface DashboardData {
  business_day: DashboardBusinessDay | null;

  generated_at: string;

  visibility: DashboardVisibility;

  operations: DashboardOperations;

  financial: DashboardFinancialSummary | null;

  inventory: DashboardInventorySummary | null;

  top_items: DashboardTopItem[];

  recent_orders: DashboardRecentOrder[];
}
