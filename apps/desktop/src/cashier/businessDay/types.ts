export type BusinessDayStatus = "OPEN" | "CLOSED";

export interface BusinessDayActor {
  id: number;
  name: string;
}

export interface BusinessDay {
  id: number;
  business_date: string;
  status: BusinessDayStatus;
  opened_by: BusinessDayActor | null;
  closed_by: BusinessDayActor | null;
  opened_at: string | null;
  closed_at: string | null;
  notes: string | null;
}

export interface BusinessDayBlockers {
  open_tables: number;
  active_orders: number;
  unpaid_invoices: number;
  open_cashier_shifts: number;
  can_close: boolean;
}

export interface BusinessDayOrderSummary {
  completed: number;
  cancelled: number;
  rejected: number;
}

export interface BusinessDayInvoiceSummary {
  issued: number;
}

export interface BusinessDaySalesSummary {
  subtotal: number;
  discounts: number;
  tax: number;
  service_charge: number;
  gross_invoice_sales: number;
  refunds: number;
  net_sales: number;
}

export interface BusinessDayPaymentBreakdown {
  cash: number;
  card: number;
  qr: number;
  bank_transfer: number;
  other: number;
}

export interface BusinessDayPaymentSummary {
  gross: BusinessDayPaymentBreakdown;
  net: BusinessDayPaymentBreakdown;
}

export interface BusinessDayRefundSummary {
  total: number;
  by_method: BusinessDayPaymentBreakdown;
}

export interface BusinessDaySummary {
  orders: BusinessDayOrderSummary | null;
  invoices: BusinessDayInvoiceSummary | null;
  sales: BusinessDaySalesSummary;
  refunds: BusinessDayRefundSummary;
  payments: BusinessDayPaymentSummary;
  purchases: number;
  supplier_payments: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  wastage: number;
  estimated_net_profit: number;
  expected_cash: number;
  actual_cash: number;
  cash_difference: number;
}

export interface BusinessDayClosingSnapshot {
  version?: number;
  business_day?: {
    id: number;
    business_date: string | null;
  };
  blockers?: BusinessDayBlockers;
  orders?: BusinessDayOrderSummary;
  invoices?: BusinessDayInvoiceSummary;
  sales?: BusinessDaySalesSummary;
  payments?: BusinessDayPaymentSummary;
  refunds?: BusinessDayRefundSummary;
  purchases?: { total: number };
  supplier_payments?: { total: number };
  profit?: {
    cogs: number;
    gross_profit: number;
    expenses: number;
    wastage: number;
    estimated_net_profit: number;
  };
  cash_reconciliation?: {
    expected_cash: number;
    actual_cash: number;
    difference: number;
  };
}

export interface BusinessDayClosing {
  id: number;
  business_day_id: number;
  business_day: BusinessDay | null;
  total_sales: number;
  total_discounts: number;
  total_refunds: number;
  payments: BusinessDayPaymentBreakdown;
  total_cogs: number;
  gross_profit: number;
  total_expenses: number;
  total_wastage_cost: number;
  estimated_net_profit: number;
  total_purchases: number;
  supplier_payments: number;
  expected_cash: number;
  actual_cash: number;
  cash_difference: number;
  snapshot: BusinessDayClosingSnapshot | null;
  closed_by: BusinessDayActor | null;
  closed_at: string | null;
  closing_notes: string | null;
  created_at: string | null;
}

export interface BusinessDayPreview {
  business_day: BusinessDay | null;
  blockers: BusinessDayBlockers | null;
  summary: BusinessDaySummary | null;
  closing: BusinessDayClosing | null;
}

export interface CloseBusinessDayPayload {
  client_request_id: string;
  closing_notes: string | null;
}

export interface CloseBusinessDayResult {
  closing: BusinessDayClosing;
  closed: boolean;
}

export interface OpenBusinessDayPayload {
  notes: string | null;
}

export interface OpenBusinessDayResult {
  business_day: BusinessDay;
  created: boolean;
}
