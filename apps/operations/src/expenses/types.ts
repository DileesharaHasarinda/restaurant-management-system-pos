export type ExpensePaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "QR"
  | "OTHER";

export type ExpenseStatus = "POSTED" | "VOID";

export interface ExpenseCategory {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

export interface ExpensePaymentMethodOption {
  code: ExpensePaymentMethod;
  label: string;
}

export interface ExpenseBusinessDay {
  id: number;
  business_date: string;
  status: string;
}

export interface ExpenseCashierShift {
  id: number;
  shift_number: string;
  status: string;
}

export interface ExpenseReceipt {
  available: boolean;

  original_name: string | null;

  mime_type: string | null;

  size: number | null;

  uploaded_at: string | null;
}

export interface ExpenseUser {
  id: number;
  name: string;
}

export interface Expense {
  id: number;

  client_request_id: string | null;

  expense_number: string;

  expense_date: string;

  category: ExpenseCategory | null;

  description: string;

  notes: string | null;

  amount: number;

  payment_method: ExpensePaymentMethod;

  payment_method_label: string;

  reference_number: string | null;

  status: ExpenseStatus;

  business_day: ExpenseBusinessDay | null;

  cashier_shift: ExpenseCashierShift | null;

  receipt: ExpenseReceipt | null;

  created_by: ExpenseUser | null;

  approved_by: ExpenseUser | null;

  created_at: string | null;

  updated_at: string | null;
}

export interface ExpensePagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface ExpenseFilters {
  page: number;

  categoryId?: number | null;

  paymentMethod?: ExpensePaymentMethod | null;

  status?: ExpenseStatus | null;

  dateFrom?: string;

  dateTo?: string;

  search?: string;

  perPage?: number;
}

export interface ExpenseListResult {
  expenses: Expense[];

  pagination: ExpensePagination;
}

export interface CreateExpensePayload {
  client_request_id: string;

  expense_category_id: number;

  expense_date: string;

  description: string;

  notes: string | null;

  amount: number;

  payment_method: ExpensePaymentMethod;

  reference_number: string | null;
}

export interface UpdateExpensePayload {
  expense_category_id: number;

  expense_date: string;

  description: string;

  notes: string | null;

  amount: number;

  payment_method: ExpensePaymentMethod;

  reference_number: string | null;
}
