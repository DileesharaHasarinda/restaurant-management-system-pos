export interface CashierInvoiceItem {
  id: number;

  name: string;

  variant: string | null;

  quantity: number;

  unit_price: number;

  line_total: number;
}

export interface CashierInvoice {
  id: number;

  invoice_number: string;

  invoice_type: string;

  business_day_id: number;

  cashier_shift_id: number | null;

  order_id: number | null;

  table_session_id: number | null;

  table_name: string | null;

  customer: {
    name: string | null;

    phone: string | null;
  };

  items: CashierInvoiceItem[];

  totals: {
    subtotal: number;

    discount: number;

    service_charge: number;

    tax: number;

    grand_total: number;
  };

  payment: {
    paid_amount: number;

    change_amount: number;

    balance_due: number;

    status: string;
  };

  status: string;

  issued_at: string | null;
}

export interface GeneratedInvoiceResponse {
  invoice: CashierInvoice;

  created: boolean;
}

export interface CustomerPaymentRecord {
  id?: number;

  payment_number?: string;

  payment_method?: string;

  method?: string;

  amount: number;

  tendered_amount?: number | null;

  change_given?: number;

  reference_number?: string | null;

  status?: string;

  paid_at?: string | null;
}

export interface CustomerPaymentHistoryResponse {
  invoice_id: number;

  invoice_number: string;

  payment_status: string;

  paid_amount: number;

  balance_due: number;

  payments: CustomerPaymentRecord[];
}

export interface CustomerPaymentResultResponse {
  batch: {
    id: number;

    client_request_id: string;

    total_amount: number;

    cash_amount: number;

    payment_count: number;

    status: string;

    processed_at?: string | null;
  };

  payments: CustomerPaymentRecord[];

  invoice: CashierInvoice;

  cash_drawer: {
    should_open: boolean;

    cash_amount: number;
  };

  created: boolean;
}

export interface CurrentCashierShiftResponse {
  shift: {
    id: number;

    shift_number: string;

    opening_cash: number;

    expected_cash: number;

    status: string;
  } | null;
}

export type CustomerPaymentMethod =
  "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "OTHER";

export type PaymentMode = CustomerPaymentMethod | "MIXED";

export interface PaymentInputRow {
  payment_method: CustomerPaymentMethod;

  amount: number;

  tendered_amount?: number;

  reference_number?: string;
}
