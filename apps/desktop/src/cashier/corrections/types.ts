export type CorrectionsTab =
    | 'cancellation'
    | 'refunds'
    | 'stock';

export type CorrectionPaymentMethod =
    | 'CASH'
    | 'CARD'
    | 'QR'
    | 'BANK_TRANSFER'
    | 'OTHER';

export interface ManagerCredentials {
    login: string;
    password: string;
}

export interface CorrectionInvoice {
    id: number;
    invoice_number?: string | null;
    order_id?: number | null;
    table_session_id?: number | null;
    grand_total?: number | string | null;
    paid_amount?: number | string | null;
    balance_due?: number | string | null;
    payment_status?: string | null;
    status?: string | null;
    payment?: {
        status?: string | null;
        grand_total?: number | string | null;
        paid_amount?: number | string | null;
        balance_due?: number | string | null;
        change_amount?: number | string | null;
    } | null;
}

export interface CorrectionPayment {
    id: number;
    payment_number?: string | null;
    payment_method?: CorrectionPaymentMethod | null;
    method?: CorrectionPaymentMethod | null;
    amount?: number | string | null;
    tendered_amount?: number | string | null;
    change_given?: number | string | null;
    reference_number?: string | null;
    status?: string | null;
    paid_at?: string | null;
}

export interface RefundActor {
    id: number;
    name: string;
}

export interface RefundRecord {
    id: number;
    refund_number?: string | null;
    invoice_id?: number | null;
    payment_id?: number | null;
    payment?: {
        id?: number | null;
        payment_number?: string | null;
        payment_method?: CorrectionPaymentMethod | null;
    } | null;
    business_day_id?: number | null;
    cashier_shift_id?: number | null;
    amount?: number | string | null;
    refund_method?: CorrectionPaymentMethod | null;
    status?: string | null;
    reason?: string | null;
    initiated_by?: RefundActor | number | null;
    authorized_by?: RefundActor | number | null;
    processed_by?: RefundActor | number | null;
    refunded_at?: string | null;
    created_at?: string | null;
}

export interface RefundListResponse {
    refunds?: RefundRecord[];
    data?: RefundRecord[];
}

export interface CreateRefundPayload {
    client_request_id: string;
    payment_id: number;
    cashier_shift_id?: number | null;
    amount: number;
    refund_method: CorrectionPaymentMethod;
    reason: string;
    manager_login?: string;
    manager_password?: string;
}

export interface RefundResultResponse {
    refund?: RefundRecord;
    created?: boolean;
    cash_drawer?: {
        should_open?: boolean;
    } | null;
}

export interface CurrentCashierShift {
    id: number;
    shift_number?: string | null;
    expected_cash?: number | string | null;
    status?: string | null;
}

export interface CurrentCashierShiftResponse {
    shift?: CurrentCashierShift | null;
}

export interface StockMovementIngredient {
    id: number;
    sku?: string | null;
    name?: string | null;
    base_unit?: {
        id: number;
        symbol: string;
    } | null;
}

export interface StockMovementRecord {
    id: number;
    movement_key?: string | null;
    ingredient?: StockMovementIngredient | null;
    movement_type?: string | null;
    quantity_delta?: number | string | null;
    balance_after?: number | string | null;
    unit_cost?: number | string | null;
    total_cost?: number | string | null;
    reference?: string | null;
    notes?: string | null;
    source?: {
        type?: string | null;
        id?: number | null;
    } | null;
    business_day_id?: number | null;
    created_by?: RefundActor | null;
    occurred_at?: string | null;
}

export interface StockReversalPayload {
    client_request_id: string;
    quantity: number;
    reason: string;
    manager_login?: string;
    manager_password?: string;
}

export interface StockReversalResultResponse {
    movement?: StockMovementRecord;
    reversal?: StockMovementRecord;
    created?: boolean;
}

export interface CreateWastagePayload {
    client_request_id: string;
    ingredient_id: number;
    quantity: number;
    unit_id: number;
    reason_code: string;
    reason: string | null;
}

export interface WastageRecord {
    id: number;
    wastage_number?: string | null;
    ingredient?: {
        id?: number;
        name?: string | null;
    } | null;
    quantity?: number | string | null;
    reason_code?: string | null;
    reason?: string | null;
    estimated_cost?: number | string | null;
    status?: string | null;
    wasted_at?: string | null;
}

export interface CreateWastageResultResponse {
    wastage?: WastageRecord;
    created?: boolean;
}

export interface CancelOrderPayload {
    reason: string;
    manager_login?: string;
    manager_password?: string;
}
