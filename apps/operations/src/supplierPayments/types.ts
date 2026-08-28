import type { Purchase, PurchasePaymentStatus } from "../purchases/types";

export type SupplierPaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "OTHER";

export interface SupplierPaymentCreatedBy {
  id: number;
  name: string;
}

export interface SupplierPaymentLine {
  id: number;

  payment_number: string;

  payment_date: string | null;

  payment_method: SupplierPaymentMethod;

  amount: number;

  reference: string | null;

  notes: string | null;

  created_by: SupplierPaymentCreatedBy | null;

  created_at: string | null;
}

export interface SupplierPaymentBatchSupplier {
  id: number;

  name: string;

  current_balance: number;
}

export interface SupplierPaymentBatchPurchase {
  id: number;

  purchase_number: string;

  grand_total: number;

  paid_amount: number;

  balance_due: number;

  payment_status: PurchasePaymentStatus;
}

export interface SupplierPaymentBatch {
  id: number;

  batch_number: string;

  payment_date: string | null;

  supplier: SupplierPaymentBatchSupplier | null;

  purchase: SupplierPaymentBatchPurchase | null;

  total_amount: number;

  notes: string | null;

  payments: SupplierPaymentLine[];

  created_by: SupplierPaymentCreatedBy | null;

  created_at: string | null;
}

export interface SupplierPaymentPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface SupplierPaymentFilters {
  page: number;

  search?: string;

  supplierId?: number | null;

  purchaseId?: number | null;

  paymentMethod?: SupplierPaymentMethod | null;

  dateFrom?: string;

  dateTo?: string;

  perPage?: number;
}

export interface SupplierPaymentListResult {
  batches: SupplierPaymentBatch[];

  pagination: SupplierPaymentPagination;
}

export interface SupplierPaymentLinePayload {
  payment_method: SupplierPaymentMethod;

  amount: number;

  reference: string | null;

  notes: string | null;
}

export interface SupplierPaymentPayload {
  idempotency_key: string;

  payment_date: string;

  notes: string | null;

  payments: SupplierPaymentLinePayload[];
}

export type OutstandingPurchase = Purchase;
