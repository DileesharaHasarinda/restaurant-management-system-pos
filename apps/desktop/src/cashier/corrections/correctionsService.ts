import {
    api,
} from '../../api';

import type {
    CancelOrderPayload,
    CorrectionInvoice,
    CorrectionPayment,
    CreateRefundPayload,
    CreateWastagePayload,
    CreateWastageResultResponse,
    CurrentCashierShift,
    CurrentCashierShiftResponse,
    RefundListResponse,
    RefundRecord,
    RefundResultResponse,
    StockMovementRecord,
    StockReversalPayload,
    StockReversalResultResponse,
} from './types';

interface GeneratedInvoiceResponse {
    invoice: CorrectionInvoice;
}

interface PaymentHistoryResponse {
    payments?: CorrectionPayment[];
}

function asRecord(
    value: unknown,
): Record<string, unknown> | null {
    if (
        typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
    ) {
        return value as Record<string, unknown>;
    }

    return null;
}

function normalizeList<T>(
    value: unknown,
): T[] {
    if (Array.isArray(value)) {
        return value as T[];
    }

    const object = asRecord(value);

    if (!object) {
        return [];
    }

    if (Array.isArray(object.data)) {
        return object.data as T[];
    }

    if (Array.isArray(object.items)) {
        return object.items as T[];
    }

    if (Array.isArray(object.movements)) {
        return object.movements as T[];
    }

    return [];
}

export async function cancelOrder(
    orderId: number,
    payload: CancelOrderPayload,
): Promise<void> {
    await api.post(
        `/orders/${orderId}/cancel`,
        payload,
    );
}

export async function ensureOrderInvoice(
    orderId: number,
): Promise<CorrectionInvoice> {
    const response =
        await api.post<GeneratedInvoiceResponse>(
            `/orders/${orderId}/invoice`,
            {},
        );

    return response.data.invoice;
}

export async function getInvoicePayments(
    invoiceId: number,
): Promise<CorrectionPayment[]> {
    const response =
        await api.get<PaymentHistoryResponse>(
            `/invoices/${invoiceId}/payments`,
        );

    return response.data.payments ?? [];
}

export async function getInvoiceRefunds(
    invoiceId: number,
): Promise<RefundRecord[]> {
    const response =
        await api.get<RefundListResponse | RefundRecord[]>(
            `/invoices/${invoiceId}/refunds`,
        );

    if (Array.isArray(response.data)) {
        return response.data;
    }

    if (Array.isArray(response.data.refunds)) {
        return response.data.refunds;
    }

    if (Array.isArray(response.data.data)) {
        return response.data.data;
    }

    return [];
}

export async function createRefund(
    invoiceId: number,
    payload: CreateRefundPayload,
): Promise<RefundResultResponse> {
    const response =
        await api.post<RefundResultResponse>(
            `/invoices/${invoiceId}/refunds`,
            payload,
        );

    return response.data;
}

export async function getCurrentCashierShift(): Promise<CurrentCashierShift | null> {
    const response =
        await api.get<CurrentCashierShiftResponse>(
            '/cashier-shifts/current',
        );

    return response.data.shift ?? null;
}

export async function getSaleConsumptionMovements(): Promise<StockMovementRecord[]> {
    const response =
        await api.get<unknown>(
            '/inventory/stock/movements?movement_type=SALE_CONSUMPTION&per_page=50',
        );

    return normalizeList<StockMovementRecord>(
        response.data,
    ).filter(
        (movement) =>
            movement.movement_type === 'SALE_CONSUMPTION',
    );
}

export async function reverseSaleConsumption(
    stockMovementId: number,
    payload: StockReversalPayload,
): Promise<StockReversalResultResponse> {
    const response =
        await api.post<StockReversalResultResponse>(
            `/stock-movements/${stockMovementId}/cancellation-reversal`,
            payload,
        );

    return response.data;
}

export async function createWastage(
    payload: CreateWastagePayload,
): Promise<CreateWastageResultResponse> {
    const response =
        await api.post<CreateWastageResultResponse>(
            '/wastages',
            payload,
        );

    return response.data;
}
