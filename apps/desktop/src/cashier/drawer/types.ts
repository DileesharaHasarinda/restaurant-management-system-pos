export interface DrawerCashierShift {
  id: number;

  shift_number: string;

  opening_cash: number;

  expected_cash: number;

  status: "OPEN" | "CLOSED";
}

export interface CurrentCashierShiftResponse {
  shift: DrawerCashierShift | null;

  summary?: {
    opening_cash: number;

    cash_sales: number;

    cash_refunds: number;

    cash_in: number;

    cash_out: number;

    calculated_expected_cash: number;

    expected_cash: number;
  };
}

export interface ManualDrawerOpenResponse {
  movement: {
    id: number;

    cashier_shift_id: number;

    movement_type: string;

    amount: number;

    reason: string | null;

    occurred_at: string | null;
  };

  shift: DrawerCashierShift;

  cash_drawer: {
    should_open: boolean;
  };

  created: boolean;
}
