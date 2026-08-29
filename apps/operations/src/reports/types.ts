export type ReportTab =
  | "overview"
  | "sales"
  | "items"
  | "profit"
  | "payments"
  | "expenses"
  | "inventory"
  | "purchases"
  | "orders"
  | "cashier";

export type ReportOrderType = "DINE_IN" | "TAKEAWAY";

export type ReportOrderSource = "QR_CUSTOMER" | "WAITER" | "CASHIER";

export type ReportPaymentMethod =
  | "CASH"
  | "CARD"
  | "QR"
  | "BANK_TRANSFER"
  | "OTHER";

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  businessDayId: string;
  orderType: ReportOrderType | "";
  orderSource: ReportOrderSource | "";
  paymentMethod: ReportPaymentMethod | "";
  supplierId: string;
  ingredientId: string;
  cashierShiftId: string;
  expenseCategoryId: string;
}

export interface ReportScope {
  date_from: string;
  date_to: string;
  business_day_id: number | null;
  generated_at: string;
}

export interface OverviewKpis {
  gross_sales: number;
  refunds: number;
  net_sales: number;
  discounts: number;
  completed_orders: number;
  average_order_value: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  wastage_cost: number;
  estimated_net_profit: number;
  profit_margin: number;
  gross_payments: number;
  net_payments: number;
}

export interface OrderBreakdown {
  order_count: number;
  sales_total?: number;
  order_value?: number;
  order_type?: string;
  order_source?: string;
  status?: string;
}

export interface DailySalesRow {
  business_date: string;
  order_count: number;
  subtotal: number;
  discounts: number;
  tax: number;
  service_charge: number;
  sales: number;
  cogs: number;
  gross_profit: number;
}

export interface ReportItemRow {
  name: string;
  variant: string | null;
  quantity: number;
  base_sales: number;
  sales_total: number;
  cost_total: number;
  gross_profit: number;
  margin: number;
}

export interface ReportAddonRow {
  name: string;
  quantity: number;
  sales_total: number;
  cost_total: number;
  gross_profit: number;
}

export interface PaymentMethodRow {
  method: string;
  payment_count: number;
  refund_count: number;
  gross_amount: number;
  refund_amount: number;
  net_amount: number;
}

export interface PaymentSummary {
  gross_total: number;
  refund_total: number;
  net_total: number;
  by_method: PaymentMethodRow[];
}

export interface OverviewReport extends ReportScope {
  kpis: OverviewKpis;
  sales_by_type: OrderBreakdown[];
  sales_by_source: OrderBreakdown[];
  payments: PaymentSummary;
  order_statuses: OrderBreakdown[];
  daily_sales: DailySalesRow[];
  top_items: ReportItemRow[];
}

export interface SalesReport extends ReportScope {
  summary: {
    completed_orders: number;
    subtotal: number;
    discounts: number;
    tax: number;
    service_charge: number;
    gross_sales: number;
    refunds: number;
    net_sales: number;
    average_order_value: number;
  };
  daily: DailySalesRow[];
  by_type: OrderBreakdown[];
  by_source: OrderBreakdown[];
}

export interface ItemsReport extends ReportScope {
  items: ReportItemRow[];
  addons: ReportAddonRow[];
}

export interface DailyProfitRow {
  business_date: string;
  sales: number;
  refunds: number;
  net_sales: number;
  cogs: number;
  expenses: number;
  wastage_cost: number;
  estimated_net_profit: number;
}

export interface ProfitReport extends ReportScope {
  summary: {
    gross_sales: number;
    refunds: number;
    net_sales: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    wastage_cost: number;
    estimated_net_profit: number;
    gross_margin: number;
    estimated_net_margin: number;
  };
  daily: DailyProfitRow[];
  items: ReportItemRow[];
}

export interface PaymentsReport extends ReportScope {
  gross_total: number;
  refund_total: number;
  net_total: number;
  by_method: PaymentMethodRow[];
}

export interface ExpenseCategoryRow {
  category_id: number;
  category_name: string;
  category_code: string;
  expense_count: number;
  total_amount: number;
}

export interface ExpensePaymentRow {
  payment_method: string;
  expense_count: number;
  total_amount: number;
}

export interface ExpensesReport extends ReportScope {
  summary: {
    expense_count: number;
    total_amount: number;
    average_expense: number;
  };
  by_category: ExpenseCategoryRow[];
  by_payment_method: ExpensePaymentRow[];
}

export interface LowStockItem {
  id: number;
  sku: string | null;
  name: string;
  current_stock: number;
  reorder_level: number;
  stock_value: number;
  unit: {
    name: string | null;
    symbol: string | null;
  };
}

export interface StockMovementSummary {
  movement_type: string;
  movement_count: number;
  quantity_delta: number;
  total_cost: number;
}

export interface ConsumptionRow {
  ingredient_id: number;
  sku: string | null;
  name: string;
  quantity_consumed: number;
  consumption_cost: number;
}

export interface WastageSummaryRow {
  reason_code: string;
  reason_label: string;
  wastage_count: number;
  estimated_cost: number;
}

export interface InventoryReport extends ReportScope {
  current_stock: {
    tracked_ingredients: number;
    low_stock_count: number;
    out_of_stock_count: number;
    stock_value: number;
    low_stock_items: LowStockItem[];
  };
  movements: StockMovementSummary[];
  sale_consumption: ConsumptionRow[];
  wastage: WastageSummaryRow[];
}

export interface SupplierPurchaseRow {
  supplier_id: number;
  supplier_name: string;
  purchase_count: number;
  purchase_total: number;
  paid_amount: number;
  balance_due: number;
}

export interface PurchasesReport extends ReportScope {
  summary: {
    purchase_count: number;
    purchase_total: number;
    paid_amount: number;
    balance_due: number;
    supplier_payments: number;
  };
  by_supplier: SupplierPurchaseRow[];
}

export interface OrderStatusRow {
  status: string;
  order_count: number;
  order_value: number;
}

export interface OrderTypeRow {
  order_type: string;
  order_count: number;
  order_value: number;
}

export interface OrderSourceRow {
  order_source: string;
  order_count: number;
  order_value: number;
}

export interface TableOrderRow {
  table_name: string | null;
  order_count: number;
  order_value: number;
}

export interface ReasonRow {
  reason: string;
  count: number;
}

export interface OrdersReport extends ReportScope {
  total_orders: number;
  by_status: OrderStatusRow[];
  by_type: OrderTypeRow[];
  by_source: OrderSourceRow[];
  by_table: TableOrderRow[];
  cancellation_reasons: ReasonRow[];
  rejection_reasons: ReasonRow[];
}

export interface CashDrawerMovementSummary {
  movement_type: string;
  movement_count: number;
  amount: number;
}

export interface CashierShiftRow {
  id: number;
  shift_number: string | null;
  business_day_id: number;
  cashier_id: number;
  terminal_name: string | null;
  status: string;
  opening_float: number;
  expected_cash: number;
  actual_cash: number | null;
  cash_difference: number | null;
  opened_at: string | null;
  closed_at: string | null;
}

export interface CashierReport extends ReportScope {
  summary: {
    shift_count: number;
    open_shifts: number;
    closed_shifts: number;
    opening_float: number;
    expected_cash: number;
    actual_cash: number;
    cash_difference: number;
  };
  drawer_movements: CashDrawerMovementSummary[];
  shifts: CashierShiftRow[];
}
