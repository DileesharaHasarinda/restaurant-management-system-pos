export interface CashierShiftUser {
  id: number;

  name: string;
}

export interface CashierShift {
  id: number;

  shift_number: string;

  business_day_id: number;

  cashier_id: number;

  cashier: CashierShiftUser | null;

  terminal_name: string | null;

  opening_cash: number;

  expected_cash: number;

  actual_cash: number | null;

  cash_difference: number | null;

  status: "OPEN" | "CLOSED";

  opened_at: string | null;

  closed_at: string | null;

  closed_by: number | null;

  closed_by_user: CashierShiftUser | null;

  opening_notes: string | null;

  closing_notes: string | null;
}

export interface CashierShiftSummary {
  opening_cash: number;

  cash_sales: number;

  cash_refunds: number;

  cash_in: number;

  cash_out: number;

  calculated_expected_cash: number;

  expected_cash: number;

  actual_cash?: number | null;

  cash_difference?: number | null;
}

export interface CashDrawerMovement {
  id: number;

  cashier_shift_id: number;

  movement_type:
    | "OPENING_FLOAT"
    | "CASH_SALE"
    | "CASH_REFUND"
    | "CASH_IN"
    | "CASH_OUT"
    | "MANUAL_OPEN"
    | string;

  amount: number;

  reference_type: string | null;

  reference_id: number | null;

  reason: string | null;

  created_by: number;

  occurred_at: string | null;
}

export interface CurrentShiftResponse {
  shift: CashierShift | null;

  summary?: CashierShiftSummary;
}

export interface ShiftOperationResponse {
  shift: CashierShift;

  summary: CashierShiftSummary;

  created?: boolean;

  closed?: boolean;
}

export interface CashMovementResponse {
  movement: CashDrawerMovement;

  shift: CashierShift;

  summary: CashierShiftSummary;

  created: boolean;
}

export interface ShiftMovementsResponse {
  movements: CashDrawerMovement[];
}
