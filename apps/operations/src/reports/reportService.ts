import { api } from "../lib/api";

import type {
  CashierReport,
  ExpensesReport,
  InventoryReport,
  ItemsReport,
  OrdersReport,
  OverviewReport,
  PaymentsReport,
  ProfitReport,
  PurchasesReport,
  ReportFilters,
  SalesReport,
} from "./types";

function appendNumericFilter(
  params: URLSearchParams,
  key: string,
  value: string
): void {
  const trimmed = value.trim();

  if (trimmed === "") {
    return;
  }

  const number = Number(trimmed);

  if (Number.isInteger(number) && number > 0) {
    params.set(key, String(number));
  }
}

function buildQuery(filters: ReportFilters): string {
  const params = new URLSearchParams();

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  appendNumericFilter(params, "business_day_id", filters.businessDayId);

  if (filters.orderType) {
    params.set("order_type", filters.orderType);
  }

  if (filters.orderSource) {
    params.set("order_source", filters.orderSource);
  }

  if (filters.paymentMethod) {
    params.set("payment_method", filters.paymentMethod);
  }

  appendNumericFilter(params, "supplier_id", filters.supplierId);

  appendNumericFilter(params, "ingredient_id", filters.ingredientId);

  appendNumericFilter(params, "cashier_shift_id", filters.cashierShiftId);

  appendNumericFilter(params, "expense_category_id", filters.expenseCategoryId);

  const query = params.toString();

  return query ? `?${query}` : "";
}

async function getReport<T>(
  endpoint: string,
  filters: ReportFilters
): Promise<T> {
  const response = await api.get<T>(`${endpoint}${buildQuery(filters)}`);

  return response.data;
}

export function getOverviewReport(
  filters: ReportFilters
): Promise<OverviewReport> {
  return getReport<OverviewReport>("/reports/overview", filters);
}

export function getSalesReport(filters: ReportFilters): Promise<SalesReport> {
  return getReport<SalesReport>("/reports/sales", filters);
}

export function getItemsReport(filters: ReportFilters): Promise<ItemsReport> {
  return getReport<ItemsReport>("/reports/items", filters);
}

export function getProfitReport(filters: ReportFilters): Promise<ProfitReport> {
  return getReport<ProfitReport>("/reports/profit", filters);
}

export function getPaymentsReport(
  filters: ReportFilters
): Promise<PaymentsReport> {
  return getReport<PaymentsReport>("/reports/payments", filters);
}

export function getExpensesReport(
  filters: ReportFilters
): Promise<ExpensesReport> {
  return getReport<ExpensesReport>("/reports/expenses", filters);
}

export function getInventoryReport(
  filters: ReportFilters
): Promise<InventoryReport> {
  return getReport<InventoryReport>("/reports/inventory", filters);
}

export function getPurchasesReport(
  filters: ReportFilters
): Promise<PurchasesReport> {
  return getReport<PurchasesReport>("/reports/purchases", filters);
}

export function getOrdersReport(filters: ReportFilters): Promise<OrdersReport> {
  return getReport<OrdersReport>("/reports/orders", filters);
}

export function getCashierReport(
  filters: ReportFilters
): Promise<CashierReport> {
  return getReport<CashierReport>("/reports/cashier", filters);
}
