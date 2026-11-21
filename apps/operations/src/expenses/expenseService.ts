import { api } from "../lib/api";

import type {
  CreateExpensePayload,
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  ExpenseListResult,
  ExpensePagination,
  ExpensePaymentMethodOption,
  UpdateExpensePayload,
} from "./types";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): ExpensePagination {
  const pagination = meta?.pagination;

  if (!isRecord(pagination)) {
    return {
      current_page: 1,
      per_page: 30,
      total: 0,
      last_page: 1,
    };
  }

  return {
    current_page: numberValue(pagination.current_page, 1),

    per_page: numberValue(pagination.per_page, 30),

    total: numberValue(pagination.total, 0),

    last_page: numberValue(pagination.last_page, 1),
  };
}

/*
|--------------------------------------------------------------------------
| List
|--------------------------------------------------------------------------
*/

export async function getExpenses(
  filters: ExpenseFilters
): Promise<ExpenseListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage ?? 30));

  if (filters.categoryId !== null && filters.categoryId !== undefined) {
    params.set("expense_category_id", String(filters.categoryId));
  }

  if (filters.paymentMethod) {
    params.set("payment_method", filters.paymentMethod);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const response = await api.get<Expense[]>(`/expenses?${params.toString()}`);

  return {
    expenses: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

/*
|--------------------------------------------------------------------------
| Show
|--------------------------------------------------------------------------
*/

export async function getExpense(expenseId: number): Promise<Expense> {
  const response = await api.get<Expense>(`/expenses/${expenseId}`);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Create
|--------------------------------------------------------------------------
*/

export async function createExpense(
  payload: CreateExpensePayload
): Promise<Expense> {
  const response = await api.post<Expense>("/expenses", payload);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Update
|--------------------------------------------------------------------------
*/

export async function updateExpense(
  expenseId: number,
  payload: UpdateExpensePayload
): Promise<Expense> {
  const response = await api.put<Expense>(`/expenses/${expenseId}`, payload);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Categories
|--------------------------------------------------------------------------
|
| ExpenseCategoryController exposes the active
| expense category catalogue.
|
*/

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const response = await api.get<ExpenseCategory[]>("/expense-categories");

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Payment Methods
|--------------------------------------------------------------------------
*/

export async function getExpensePaymentMethods(): Promise<
  ExpensePaymentMethodOption[]
> {
  const response = await api.get<ExpensePaymentMethodOption[]>(
    "/expenses/payment-methods"
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Raw Receipt API
|--------------------------------------------------------------------------
*/

function apiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }

  return value.replace(/\/+$/, "");
}

async function responseError(response: Response): Promise<Error> {
  try {
    const payload = await response.json();

    if (isRecord(payload) && typeof payload.message === "string") {
      return new Error(payload.message);
    }
  } catch {
    /*
     * Ignore JSON decoding error.
     */
  }

  return new Error(`Request failed with status ${response.status}.`);
}

/*
|--------------------------------------------------------------------------
| Upload Receipt
|--------------------------------------------------------------------------
*/

export async function uploadExpenseReceipt(
  expenseId: number,
  file: File
): Promise<Expense> {
  const formData = new FormData();

  formData.append("receipt", file);

  const response = await fetch(
    `${apiBaseUrl()}/expenses/${expenseId}/receipt`,
    {
      method: "POST",

      credentials: "include",

      headers: {
        "X-Requested-With": "XMLHttpRequest",

        Accept: "application/json",
      },

      body: formData,
    }
  );

  if (!response.ok) {
    throw await responseError(response);
  }

  const payload = await response.json();

  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("Invalid receipt upload response.");
  }

  return payload.data as unknown as Expense;
}

/*
|--------------------------------------------------------------------------
| Remove Receipt
|--------------------------------------------------------------------------
*/

export async function removeExpenseReceipt(
  expenseId: number
): Promise<Expense> {
  const response = await fetch(
    `${apiBaseUrl()}/expenses/${expenseId}/receipt`,
    {
      method: "DELETE",

      credentials: "include",

      headers: {
        "X-Requested-With": "XMLHttpRequest",

        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw await responseError(response);
  }

  const payload = await response.json();

  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("Invalid receipt remove response.");
  }

  return payload.data as unknown as Expense;
}

/*
|--------------------------------------------------------------------------
| Download Receipt
|--------------------------------------------------------------------------
*/

export async function downloadExpenseReceipt(expense: Expense): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/expenses/${expense.id}/receipt`,
    {
      method: "GET",

      credentials: "include",

      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    }
  );

  if (!response.ok) {
    throw await responseError(response);
  }

  const blob = await response.blob();

  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = objectUrl;

  anchor.download =
    expense.receipt?.original_name ?? `${expense.expense_number}-receipt`;

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(objectUrl);
}
