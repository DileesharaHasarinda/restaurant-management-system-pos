import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
    type ReactNode,
} from 'react';

import {
    ApiError,
} from '../../api';

import type {
    Order,
} from '../../types';

import './CorrectionsModule.css';

import {
    cancelOrder,
    createRefund,
    createWastage,
    ensureOrderInvoice,
    getCurrentCashierShift,
    getInvoicePayments,
    getInvoiceRefunds,
    getSaleConsumptionMovements,
    reverseSaleConsumption,
} from './correctionsService';

import type {
    CorrectionInvoice,
    CorrectionPayment,
    CorrectionsTab,
    CreateRefundPayload,
    ManagerCredentials,
    RefundRecord,
    StockMovementRecord,
} from './types';

interface CorrectionsModuleProps {
    order: Order | null;
    permissions: string[];
    onSessionExpired?: () => void;
    onOrderChanged?: () => Promise<void>;
}

interface OrderItemKitchenShape {
    sent_to_kitchen_at?: string | null;
}

type AuthorizationAction =
    | 'cancel'
    | 'refund'
    | 'stock';

interface PendingAuthorization {
    action: AuthorizationAction;
    title: string;
    description: string;
}

interface WastageDraft {
    ingredientId: string;
    unitId: string;
    quantity: string;
    reason: string;
}

const CANCELABLE_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'SENT_TO_KITCHEN',
    'SERVED',
];

function makeUuid(): string {
    if (
        typeof crypto !== 'undefined'
        && typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    if (
        typeof crypto !== 'undefined'
        && typeof crypto.getRandomValues === 'function'
    ) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);

        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = Array.from(
            bytes,
            (byte) => byte.toString(16).padStart(2, '0'),
        ).join('');

        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20),
        ].join('-');
    }

    throw new Error(
        'Secure random UUID generation is unavailable on this device.',
    );
}

function numeric(
    value: number | string | null | undefined,
): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function money(
    value: number | string | null | undefined,
): string {
    return `Rs. ${numeric(value).toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function dateTime(
    value: string | null | undefined,
): string {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('en-LK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function paymentMethodLabel(
    value: string | null | undefined,
): string {
    switch (value) {
        case 'CASH':
            return 'Cash';
        case 'CARD':
            return 'Card';
        case 'QR':
            return 'QR Payment';
        case 'BANK_TRANSFER':
            return 'Bank Transfer';
        case 'OTHER':
            return 'Other';
        default:
            return value ?? 'Unknown';
    }
}

function refundActorName(
    actor: RefundRecord['authorized_by'],
): string {
    if (
        actor
        && typeof actor === 'object'
        && 'name' in actor
        && typeof actor.name === 'string'
    ) {
        return actor.name;
    }

    if (typeof actor === 'number') {
        return `User #${actor}`;
    }

    return '—';
}

function isPostKitchen(
    order: Order | null,
): boolean {
    if (!order) {
        return false;
    }

    if (
        order.status === 'SENT_TO_KITCHEN'
        || order.status === 'SERVED'
    ) {
        return true;
    }

    const items =
        Array.isArray(order.items)
            ? order.items as OrderItemKitchenShape[]
            : [];

    return items.some(
        (item) => Boolean(item.sent_to_kitchen_at),
    );
}

function paymentMethod(
    payment: CorrectionPayment,
): CorrectionPayment['payment_method'] {
    return payment.payment_method ?? payment.method ?? null;
}

function paymentRemainingRefundable(
    payment: CorrectionPayment,
    refunds: RefundRecord[],
): number {
    const refunded = refunds
        .filter(
            (refund) =>
                (refund.status ?? 'COMPLETED') === 'COMPLETED'
                && (
                    refund.payment_id === payment.id
                    || refund.payment?.id === payment.id
                ),
        )
        .reduce(
            (total, refund) =>
                total + numeric(refund.amount),
            0,
        );

    return Math.max(
        0,
        Math.round(
            (numeric(payment.amount) - refunded) * 100,
        ) / 100,
    );
}

export default function CorrectionsModule(
    {
        order,
        permissions,
        onSessionExpired,
        onOrderChanged,
    }: CorrectionsModuleProps,
) {
    const canCancel =
        permissions.includes('orders.cancel');

    const canCancelAfterKitchen =
        permissions.includes('orders.cancel_after_kitchen');

    const canViewRefunds =
        permissions.includes('refunds.view');

    const canCreateRefunds =
        permissions.includes('refunds.create');

    const canAuthorizeRefunds =
        permissions.includes('refunds.authorize');

    const canViewInventory =
        permissions.includes('inventory.view');

    const canRequestStockCorrection =
        permissions.includes('inventory.cancellation_reversal.request')
        || permissions.includes('inventory.cancellation_reversal');

    const canAuthorizeStockCorrection =
        permissions.includes('inventory.cancellation_reversal');

    const canCreateWastage =
        permissions.includes('wastage.create');

    const availableTabs =
        useMemo<CorrectionsTab[]>(
            () => {
                const tabs: CorrectionsTab[] = [];

                if (canCancel) {
                    tabs.push('cancellation');
                }

                if (canViewRefunds || canCreateRefunds) {
                    tabs.push('refunds');
                }

                if (canRequestStockCorrection) {
                    tabs.push('stock');
                }

                return tabs;
            },
            [
                canCancel,
                canCreateRefunds,
                canRequestStockCorrection,
                canViewRefunds,
            ],
        );

    const [
        activeTab,
        setActiveTab,
    ] = useState<CorrectionsTab>(
        availableTabs[0] ?? 'cancellation',
    );

    const [
        error,
        setError,
    ] = useState('');

    const [
        success,
        setSuccess,
    ] = useState('');

    const [
        processing,
        setProcessing,
    ] = useState(false);

    const [
        cancellationReason,
        setCancellationReason,
    ] = useState('');

    const [
        pendingAuthorization,
        setPendingAuthorization,
    ] = useState<PendingAuthorization | null>(null);

    const [
        managerCredentials,
        setManagerCredentials,
    ] = useState<ManagerCredentials>({
        login: '',
        password: '',
    });

    const [
        invoice,
        setInvoice,
    ] = useState<CorrectionInvoice | null>(null);

    const [
        payments,
        setPayments,
    ] = useState<CorrectionPayment[]>([]);

    const [
        refunds,
        setRefunds,
    ] = useState<RefundRecord[]>([]);

    const [
        selectedPaymentId,
        setSelectedPaymentId,
    ] = useState<number | null>(null);

    const [
        refundAmount,
        setRefundAmount,
    ] = useState('');

    const [
        refundReason,
        setRefundReason,
    ] = useState('');

    const [
        refundRequestId,
        setRefundRequestId,
    ] = useState(
        () => makeUuid(),
    );

    const [
        loadingRefunds,
        setLoadingRefunds,
    ] = useState(false);

    const [
        stockMovements,
        setStockMovements,
    ] = useState<StockMovementRecord[]>([]);

    const [
        loadingStock,
        setLoadingStock,
    ] = useState(false);

    const [
        selectedStockMovementId,
        setSelectedStockMovementId,
    ] = useState<number | null>(null);

    const [
        manualStockMovementId,
        setManualStockMovementId,
    ] = useState('');

    const [
        stockQuantity,
        setStockQuantity,
    ] = useState('');

    const [
        stockReason,
        setStockReason,
    ] = useState('');

    const [
        stockRequestId,
        setStockRequestId,
    ] = useState(
        () => makeUuid(),
    );

    const [
        wastagePromptOpen,
        setWastagePromptOpen,
    ] = useState(false);

    const [
        wastageFormOpen,
        setWastageFormOpen,
    ] = useState(false);

    const [
        wastageDraft,
        setWastageDraft,
    ] = useState<WastageDraft>({
        ingredientId: '',
        unitId: '',
        quantity: '',
        reason: '',
    });

    const [
        wastageRequestId,
        setWastageRequestId,
    ] = useState(
        () => makeUuid(),
    );

    const clearMessages =
        (): void => {
            setError('');
            setSuccess('');
        };

    const handleException =
        useCallback(
            (
                exception: unknown,
                fallback: string,
            ): void => {
                if (
                    exception instanceof ApiError
                    && exception.status === 401
                ) {
                    onSessionExpired?.();
                    return;
                }

                setError(
                    exception instanceof Error
                        ? exception.message
                        : fallback,
                );
            },
            [onSessionExpired],
        );

    useEffect(
        () => {
            if (
                !availableTabs.includes(activeTab)
                && availableTabs.length > 0
            ) {
                setActiveTab(availableTabs[0]);
            }
        },
        [activeTab, availableTabs],
    );

    useEffect(
        () => {
            setCancellationReason('');
            setInvoice(null);
            setPayments([]);
            setRefunds([]);
            setSelectedPaymentId(null);
            setRefundAmount('');
            setRefundReason('');
            setRefundRequestId(makeUuid());
            setWastagePromptOpen(false);
            setWastageFormOpen(false);
            clearMessages();
        },
        [order?.id],
    );

    const selectedPayment =
        useMemo(
            () =>
                payments.find(
                    (payment) => payment.id === selectedPaymentId,
                ) ?? null,
            [payments, selectedPaymentId],
        );

    const selectedPaymentRemaining =
        useMemo(
            () =>
                selectedPayment
                    ? paymentRemainingRefundable(
                        selectedPayment,
                        refunds,
                    )
                    : 0,
            [refunds, selectedPayment],
        );

    const selectedStockMovement =
        useMemo(
            () =>
                stockMovements.find(
                    (movement) =>
                        movement.id === selectedStockMovementId,
                ) ?? null,
            [selectedStockMovementId, stockMovements],
        );

    const refreshRefundData =
        useCallback(
            async (): Promise<void> => {
                if (!order) {
                    return;
                }

                setLoadingRefunds(true);

                try {
                    const currentInvoice =
                        await ensureOrderInvoice(order.id);

                    const [
                        paymentRows,
                        refundRows,
                    ] = await Promise.all([
                        getInvoicePayments(currentInvoice.id),
                        canViewRefunds
                            ? getInvoiceRefunds(currentInvoice.id)
                            : Promise.resolve([]),
                    ]);

                    setInvoice(currentInvoice);
                    setPayments(paymentRows);
                    setRefunds(refundRows);

                    setSelectedPaymentId(
                        (current) => {
                            if (
                                current
                                && paymentRows.some(
                                    (payment) => payment.id === current,
                                )
                            ) {
                                return current;
                            }

                            const firstRefundable =
                                paymentRows.find(
                                    (payment) =>
                                        paymentRemainingRefundable(
                                            payment,
                                            refundRows,
                                        ) > 0.009,
                                );

                            return firstRefundable?.id ?? null;
                        },
                    );
                } catch (exception) {
                    handleException(
                        exception,
                        'Unable to load refund information.',
                    );
                } finally {
                    setLoadingRefunds(false);
                }
            },
            [canViewRefunds, handleException, order],
        );

    useEffect(
        () => {
            if (
                activeTab === 'refunds'
                && order
                && (
                    order.status === 'SERVED'
                    || order.status === 'COMPLETED'
                )
            ) {
                void refreshRefundData();
            }
        },
        [activeTab, order, refreshRefundData],
    );

    const refreshStockMovements =
        useCallback(
            async (): Promise<void> => {
                if (!canViewInventory) {
                    return;
                }

                setLoadingStock(true);

                try {
                    const movements =
                        await getSaleConsumptionMovements();

                    setStockMovements(movements);

                    setSelectedStockMovementId(
                        (current) =>
                            current
                            && movements.some(
                                (movement) => movement.id === current,
                            )
                                ? current
                                : movements[0]?.id ?? null,
                    );
                } catch (exception) {
                    handleException(
                        exception,
                        'Unable to load sale-consumption movements.',
                    );
                } finally {
                    setLoadingStock(false);
                }
            },
            [canViewInventory, handleException],
        );

    useEffect(
        () => {
            if (
                activeTab === 'stock'
                && canViewInventory
            ) {
                void refreshStockMovements();
            }
        },
        [activeTab, canViewInventory, refreshStockMovements],
    );

    const closeAuthorization =
        (): void => {
            if (processing) {
                return;
            }

            setPendingAuthorization(null);
            setManagerCredentials({
                login: '',
                password: '',
            });
        };

    const performCancellation =
        async (
            manager?: ManagerCredentials,
        ): Promise<void> => {
            if (!order) {
                return;
            }

            const reason = cancellationReason.trim();

            if (!reason) {
                setError('Enter a cancellation reason.');
                return;
            }

            setProcessing(true);
            clearMessages();

            const postKitchen = isPostKitchen(order);

            try {
                await cancelOrder(
                    order.id,
                    {
                        reason,
                        ...(manager
                            ? {
                                manager_login: manager.login,
                                manager_password: manager.password,
                            }
                            : {}),
                    },
                );

                setSuccess(
                    postKitchen
                        ? 'Order cancelled. A kitchen cancellation is queued for previously sent items. Inventory was NOT automatically reversed.'
                        : 'Order cancelled before kitchen processing. No inventory correction was created.',
                );

                setCancellationReason('');
                setPendingAuthorization(null);
                setManagerCredentials({
                    login: '',
                    password: '',
                });

                if (postKitchen) {
                    setWastageDraft({
                        ingredientId: '',
                        unitId: '',
                        quantity: '',
                        reason:
                            `Customer cancellation - ${order.order_number ?? `Order ${order.id}`}`,
                    });
                    setWastagePromptOpen(true);
                }

                await onOrderChanged?.();
            } catch (exception) {
                handleException(
                    exception,
                    'Unable to cancel the order.',
                );
            } finally {
                setProcessing(false);
            }
        };

    const requestCancellation =
        (): void => {
            clearMessages();

            if (!order) {
                setError('Select an order first.');
                return;
            }

            if (!CANCELABLE_STATUSES.includes(order.status)) {
                setError(
                    `Order status ${order.status} cannot be cancelled.`,
                );
                return;
            }

            if (!cancellationReason.trim()) {
                setError('Enter a cancellation reason.');
                return;
            }

            if (
                isPostKitchen(order)
                && !canCancelAfterKitchen
            ) {
                setPendingAuthorization({
                    action: 'cancel',
                    title: 'Manager Approval Required',
                    description:
                        'This order has already reached the kitchen. A manager must authorize the cancellation.',
                });
                return;
            }

            void performCancellation();
        };

    const performRefund =
        async (
            manager?: ManagerCredentials,
        ): Promise<void> => {
            if (!invoice || !selectedPayment) {
                setError('Select a payment to refund.');
                return;
            }

            const amount = numeric(refundAmount);
            const reason = refundReason.trim();
            const method = paymentMethod(selectedPayment);

            if (!method) {
                setError('The selected payment has no valid payment method.');
                return;
            }

            if (amount <= 0) {
                setError('Refund amount must be greater than zero.');
                return;
            }

            if (amount > selectedPaymentRemaining + 0.009) {
                setError(
                    `Maximum refundable amount is ${money(selectedPaymentRemaining)}.`,
                );
                return;
            }

            if (!reason) {
                setError('Enter a refund reason.');
                return;
            }

            setProcessing(true);
            clearMessages();

            try {
                let cashierShiftId: number | null = null;

                if (method === 'CASH') {
                    const shift = await getCurrentCashierShift();

                    if (!shift) {
                        throw new Error(
                            'Open your cashier shift before processing a cash refund.',
                        );
                    }

                    cashierShiftId = shift.id;
                }

                const payload: CreateRefundPayload = {
                    client_request_id: refundRequestId,
                    payment_id: selectedPayment.id,
                    amount,
                    refund_method: method,
                    reason,
                    ...(cashierShiftId
                        ? {
                            cashier_shift_id: cashierShiftId,
                        }
                        : {}),
                    ...(manager
                        ? {
                            manager_login: manager.login,
                            manager_password: manager.password,
                        }
                        : {}),
                };

                const result =
                    await createRefund(
                        invoice.id,
                        payload,
                    );

                const created = result.created !== false;

                if (created) {
                    setRefundRequestId(makeUuid());
                }

                setPendingAuthorization(null);
                setManagerCredentials({
                    login: '',
                    password: '',
                });

                setRefundAmount('');
                setRefundReason('');

                await refreshRefundData();

                if (
                    result.cash_drawer?.should_open === true
                ) {
                    try {
                        await window.posBridge.openCashDrawerHardware();

                        setSuccess(
                            `Refund saved successfully. ${money(amount)} was returned in cash and the drawer was opened.`,
                        );
                    } catch (hardwareException) {
                        setSuccess(
                            `Refund SAVED successfully for ${money(amount)}.`,
                        );
                        setError(
                            `The refund is already recorded, but the physical cash drawer failed to open: ${hardwareException instanceof Error
                                ? hardwareException.message
                                : 'Unknown hardware error.'} Do not submit the refund again. Use the audited manual drawer-open function if needed.`,
                        );
                    }
                } else {
                    setSuccess(
                        created
                            ? `Refund saved successfully for ${money(amount)}. The drawer remained closed for ${paymentMethodLabel(method)}.`
                            : 'This refund request was already processed. No duplicate refund or drawer opening was performed.',
                    );
                }
            } catch (exception) {
                handleException(
                    exception,
                    'Unable to process the refund.',
                );
            } finally {
                setProcessing(false);
            }
        };

    const requestRefund =
        (): void => {
            clearMessages();

            if (!canCreateRefunds) {
                setError('Your account cannot create refunds.');
                return;
            }

            if (!selectedPayment) {
                setError('Select a payment to refund.');
                return;
            }

            if (numeric(refundAmount) <= 0) {
                setError('Enter a refund amount greater than zero.');
                return;
            }

            if (!refundReason.trim()) {
                setError('Enter a refund reason.');
                return;
            }

            if (!canAuthorizeRefunds) {
                setPendingAuthorization({
                    action: 'refund',
                    title: 'Manager Refund Approval',
                    description:
                        'Financial refunds require manager authorization. The refund stays separate from inventory correction.',
                });
                return;
            }

            void performRefund();
        };

    const stockMovementId =
        (): number | null => {
            if (canViewInventory) {
                return selectedStockMovementId;
            }

            const parsed = Number(manualStockMovementId);

            return Number.isInteger(parsed) && parsed > 0
                ? parsed
                : null;
        };

    const performStockCorrection =
        async (
            manager?: ManagerCredentials,
        ): Promise<void> => {
            const movementId = stockMovementId();
            const quantity = numeric(stockQuantity);
            const reason = stockReason.trim();

            if (!movementId) {
                setError('Select or enter a valid SALE_CONSUMPTION stock movement ID.');
                return;
            }

            if (quantity <= 0) {
                setError('Correction quantity must be greater than zero.');
                return;
            }

            if (!reason) {
                setError('Enter a stock correction reason.');
                return;
            }

            setProcessing(true);
            clearMessages();

            try {
                const result =
                    await reverseSaleConsumption(
                        movementId,
                        {
                            client_request_id: stockRequestId,
                            quantity,
                            reason,
                            ...(manager
                                ? {
                                    manager_login: manager.login,
                                    manager_password: manager.password,
                                }
                                : {}),
                        },
                    );

                if (result.created !== false) {
                    setStockRequestId(makeUuid());
                }

                setPendingAuthorization(null);
                setManagerCredentials({
                    login: '',
                    password: '',
                });
                setStockQuantity('');
                setStockReason('');

                setSuccess(
                    result.created === false
                        ? 'This stock-correction request was already processed. Inventory was not changed twice.'
                        : 'Stock correction recorded. Only physically unused ingredient stock was restored; no financial refund was created.',
                );

                if (canViewInventory) {
                    await refreshStockMovements();
                }
            } catch (exception) {
                handleException(
                    exception,
                    'Unable to record the stock correction.',
                );
            } finally {
                setProcessing(false);
            }
        };

    const requestStockCorrection =
        (): void => {
            clearMessages();

            if (!canRequestStockCorrection) {
                setError('Your account cannot request stock corrections.');
                return;
            }

            if (!stockMovementId()) {
                setError('Select or enter a valid SALE_CONSUMPTION stock movement ID.');
                return;
            }

            if (numeric(stockQuantity) <= 0) {
                setError('Enter the quantity physically returned to stock.');
                return;
            }

            if (!stockReason.trim()) {
                setError('Enter a stock correction reason.');
                return;
            }

            if (!canAuthorizeStockCorrection) {
                setPendingAuthorization({
                    action: 'stock',
                    title: 'Manager Stock Approval',
                    description:
                        'Restoring consumed ingredient stock requires manager authorization. Use this only when ingredients were physically unused and returned to stock.',
                });
                return;
            }

            void performStockCorrection();
        };

    const submitAuthorization =
        (
            event: FormEvent<HTMLFormElement>,
        ): void => {
            event.preventDefault();

            const login = managerCredentials.login.trim();
            const password = managerCredentials.password;

            if (!login || !password) {
                setError('Enter the manager login and password.');
                return;
            }

            const credentials = {
                login,
                password,
            };

            if (pendingAuthorization?.action === 'cancel') {
                void performCancellation(credentials);
                return;
            }

            if (pendingAuthorization?.action === 'refund') {
                void performRefund(credentials);
                return;
            }

            if (pendingAuthorization?.action === 'stock') {
                void performStockCorrection(credentials);
            }
        };

    const submitWastage =
        async (): Promise<void> => {
            const ingredientId = Number(wastageDraft.ingredientId);
            const unitId = Number(wastageDraft.unitId);
            const quantity = numeric(wastageDraft.quantity);

            if (
                !Number.isInteger(ingredientId)
                || ingredientId <= 0
            ) {
                setError('Enter a valid ingredient ID for wastage.');
                return;
            }

            if (
                !Number.isInteger(unitId)
                || unitId <= 0
            ) {
                setError('Enter the unit ID used for this wastage quantity.');
                return;
            }

            if (quantity <= 0) {
                setError('Wastage quantity must be greater than zero.');
                return;
            }

            if (!wastageDraft.reason.trim()) {
                setError('Enter a wastage description.');
                return;
            }

            setProcessing(true);
            clearMessages();

            try {
                const result = await createWastage({
                    client_request_id: wastageRequestId,
                    ingredient_id: ingredientId,
                    quantity,
                    unit_id: unitId,
                    reason_code: 'OTHER',
                    reason: wastageDraft.reason.trim(),
                });

                if (result.created !== false) {
                    setWastageRequestId(makeUuid());
                }

                setSuccess(
                    result.created === false
                        ? 'This wastage request was already recorded.'
                        : 'Wastage recorded. This represents discarded stock and is intentionally separate from stock restoration.',
                );

                setWastagePromptOpen(false);
                setWastageFormOpen(false);
            } catch (exception) {
                handleException(
                    exception,
                    'Unable to record wastage.',
                );
            } finally {
                setProcessing(false);
            }
        };

    const orderReadyForRefund =
        Boolean(
            order
            && (
                order.status === 'SERVED'
                || order.status === 'COMPLETED'
            ),
        );

    if (availableTabs.length === 0) {
        return (
            <section className="corrections-module">
                <div className="correction-empty-state">
                    <div className="correction-empty-icon">CR</div>
                    <h2>Corrections</h2>
                    <p>
                        Your account does not have permission to use cancellation,
                        refund, or stock-correction actions.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="corrections-module">
            <header className="corrections-header">
                <div>
                    <span className="corrections-eyebrow">
                        CONTROLLED CORRECTIONS
                    </span>
                    <h1>Cancellations, Refunds & Corrections</h1>
                    <p>
                        Financial refunds, stock restoration and wastage are separate audited actions.
                    </p>
                </div>

                <div className="corrections-order-pill">
                    <span>Selected Order</span>
                    <strong>
                        {order
                            ? `#${order.order_number ?? order.id}`
                            : 'None'}
                    </strong>
                    {order ? <small>{order.status}</small> : null}
                </div>
            </header>

            <nav className="corrections-tabs" aria-label="Correction actions">
                {availableTabs.map(
                    (tab) => (
                        <button
                            key={tab}
                            type="button"
                            className={
                                activeTab === tab
                                    ? 'corrections-tab active'
                                    : 'corrections-tab'
                            }
                            onClick={() => {
                                clearMessages();
                                setActiveTab(tab);
                            }}
                        >
                            <span className="corrections-tab-icon">
                                {tab === 'cancellation'
                                    ? 'X'
                                    : tab === 'refunds'
                                        ? 'Rs'
                                        : 'ST'}
                            </span>
                            <span>
                                <strong>
                                    {tab === 'cancellation'
                                        ? 'Cancel Order'
                                        : tab === 'refunds'
                                            ? 'Refunds'
                                            : 'Stock Correction'}
                                </strong>
                                <small>
                                    {tab === 'cancellation'
                                        ? 'Operational cancellation'
                                        : tab === 'refunds'
                                            ? 'Financial refund & history'
                                            : 'Explicit inventory restoration'}
                                </small>
                            </span>
                        </button>
                    ),
                )}
            </nav>

            {error ? (
                <div className="corrections-alert error" role="alert">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => setError('')}
                    >
                        Close
                    </button>
                </div>
            ) : null}

            {success ? (
                <div className="corrections-alert success" role="status">
                    <span>{success}</span>
                    <button
                        type="button"
                        onClick={() => setSuccess('')}
                    >
                        Close
                    </button>
                </div>
            ) : null}

            {activeTab === 'cancellation' ? (
                <CancellationPanel
                    order={order}
                    reason={cancellationReason}
                    setReason={setCancellationReason}
                    postKitchen={isPostKitchen(order)}
                    processing={processing}
                    onCancel={requestCancellation}
                />
            ) : null}

            {activeTab === 'refunds' ? (
                <RefundPanel
                    order={order}
                    ready={orderReadyForRefund}
                    loading={loadingRefunds}
                    processing={processing}
                    invoice={invoice}
                    payments={payments}
                    refunds={refunds}
                    selectedPaymentId={selectedPaymentId}
                    selectedPaymentRemaining={selectedPaymentRemaining}
                    refundAmount={refundAmount}
                    refundReason={refundReason}
                    canCreateRefunds={canCreateRefunds}
                    onRefresh={() => void refreshRefundData()}
                    onSelectPayment={(id) => {
                        setSelectedPaymentId(id);
                        const payment = payments.find((row) => row.id === id);
                        const remaining = payment
                            ? paymentRemainingRefundable(payment, refunds)
                            : 0;
                        setRefundAmount(
                            remaining > 0
                                ? remaining.toFixed(2)
                                : '',
                        );
                        setRefundReason('');
                        clearMessages();
                    }}
                    onAmountChange={setRefundAmount}
                    onReasonChange={setRefundReason}
                    onRefund={requestRefund}
                />
            ) : null}

            {activeTab === 'stock' ? (
                <StockCorrectionPanel
                    canViewInventory={canViewInventory}
                    loading={loadingStock}
                    processing={processing}
                    movements={stockMovements}
                    selectedMovementId={selectedStockMovementId}
                    selectedMovement={selectedStockMovement}
                    manualMovementId={manualStockMovementId}
                    quantity={stockQuantity}
                    reason={stockReason}
                    onRefresh={() => void refreshStockMovements()}
                    onSelectMovement={setSelectedStockMovementId}
                    onManualMovementIdChange={setManualStockMovementId}
                    onQuantityChange={setStockQuantity}
                    onReasonChange={setStockReason}
                    onSubmit={requestStockCorrection}
                />
            ) : null}

            {pendingAuthorization ? (
                <ManagerAuthorizationModal
                    authorization={pendingAuthorization}
                    credentials={managerCredentials}
                    processing={processing}
                    onCredentialsChange={setManagerCredentials}
                    onClose={closeAuthorization}
                    onSubmit={submitAuthorization}
                />
            ) : null}

            {wastagePromptOpen ? (
                <WastagePrompt
                    canCreate={canCreateWastage}
                    processing={processing}
                    formOpen={wastageFormOpen}
                    draft={wastageDraft}
                    onDraftChange={setWastageDraft}
                    onClose={() => {
                        if (!processing) {
                            setWastagePromptOpen(false);
                            setWastageFormOpen(false);
                        }
                    }}
                    onNoWastage={() => {
                        setWastagePromptOpen(false);
                        setWastageFormOpen(false);
                        setSuccess(
                            'Cancellation completed. No wastage record was created.',
                        );
                    }}
                    onOpenForm={() => setWastageFormOpen(true)}
                    onSubmit={() => void submitWastage()}
                />
            ) : null}
        </section>
    );
}

function CancellationPanel(
    {
        order,
        reason,
        setReason,
        postKitchen,
        processing,
        onCancel,
    }: {
        order: Order | null;
        reason: string;
        setReason: (value: string) => void;
        postKitchen: boolean;
        processing: boolean;
        onCancel: () => void;
    },
) {
    const allowed =
        Boolean(
            order
            && CANCELABLE_STATUSES.includes(order.status),
        );

    return (
        <div className="corrections-panel-grid">
            <section className="corrections-card correction-primary-card">
                <div className="corrections-card-heading">
                    <div>
                        <span>ORDER CANCELLATION</span>
                        <h2>Cancel Selected Order</h2>
                    </div>
                    <StatusBadge
                        label={
                            !order
                                ? 'NO ORDER'
                                : postKitchen
                                    ? 'KITCHEN EXPOSED'
                                    : 'BEFORE KITCHEN'
                        }
                        tone={
                            !order
                                ? 'neutral'
                                : postKitchen
                                    ? 'danger'
                                    : 'safe'
                        }
                    />
                </div>

                {!order ? (
                    <EmptyMessage>
                        Select an order from Incoming Orders, Current Order or Sales History first.
                    </EmptyMessage>
                ) : (
                    <>
                        <div className="correction-order-summary">
                            <SummaryMetric
                                label="Order"
                                value={`#${order.order_number ?? order.id}`}
                            />
                            <SummaryMetric
                                label="Status"
                                value={order.status}
                            />
                            <SummaryMetric
                                label="Grand Total"
                                value={money(order.grand_total)}
                            />
                        </div>

                        <div
                            className={
                                postKitchen
                                    ? 'correction-rule-card danger'
                                    : 'correction-rule-card safe'
                            }
                        >
                            <strong>
                                {postKitchen
                                    ? 'After-kitchen cancellation'
                                    : 'Before-kitchen cancellation'}
                            </strong>
                            <p>
                                {postKitchen
                                    ? 'Previously sent items will receive a cancellation KOT. Ingredients remain consumed. No refund and no stock reversal happen automatically.'
                                    : 'No kitchen cancellation ticket or inventory restoration is required because this order has not reached kitchen processing.'}
                            </p>
                        </div>

                        <label className="corrections-field">
                            <span>Mandatory cancellation reason</span>
                            <textarea
                                rows={4}
                                maxLength={1000}
                                disabled={processing || !allowed}
                                value={reason}
                                placeholder="Example: Customer requested cancellation before preparation."
                                onChange={(event) => setReason(event.target.value)}
                            />
                            <small>{reason.length}/1000</small>
                        </label>

                        <button
                            type="button"
                            className="corrections-touch-button danger full"
                            disabled={
                                processing
                                || !allowed
                                || !reason.trim()
                            }
                            onClick={onCancel}
                        >
                            {processing
                                ? 'Processing Cancellation...'
                                : postKitchen
                                    ? 'Cancel with Controlled Approval'
                                    : 'Cancel Order'}
                        </button>

                        {!allowed ? (
                            <p className="corrections-inline-note danger-text">
                                Status {order.status} is not cancellable.
                            </p>
                        ) : null}
                    </>
                )}
            </section>

            <section className="corrections-card correction-guide-card">
                <span className="corrections-card-kicker">SAFETY RULES</span>
                <h2>What this action does</h2>
                <RuleList
                    items={[
                        'Records a mandatory reason and audit trail.',
                        'After kitchen dispatch, manager approval is required unless your account is already authorized.',
                        'Previously sent items can produce a kitchen cancellation ticket.',
                        'Never creates a financial refund automatically.',
                        'Never restores consumed ingredients automatically.',
                        'After a kitchen cancellation, the POS can optionally record wastage as a separate action.',
                    ]}
                />
            </section>
        </div>
    );
}

function RefundPanel(
    {
        order,
        ready,
        loading,
        processing,
        invoice,
        payments,
        refunds,
        selectedPaymentId,
        selectedPaymentRemaining,
        refundAmount,
        refundReason,
        canCreateRefunds,
        onRefresh,
        onSelectPayment,
        onAmountChange,
        onReasonChange,
        onRefund,
    }: {
        order: Order | null;
        ready: boolean;
        loading: boolean;
        processing: boolean;
        invoice: CorrectionInvoice | null;
        payments: CorrectionPayment[];
        refunds: RefundRecord[];
        selectedPaymentId: number | null;
        selectedPaymentRemaining: number;
        refundAmount: string;
        refundReason: string;
        canCreateRefunds: boolean;
        onRefresh: () => void;
        onSelectPayment: (id: number) => void;
        onAmountChange: (value: string) => void;
        onReasonChange: (value: string) => void;
        onRefund: () => void;
    },
) {
    const selectedPayment =
        payments.find(
            (payment) => payment.id === selectedPaymentId,
        ) ?? null;

    return (
        <div className="refund-layout">
            <section className="corrections-card refund-workspace-card">
                <div className="corrections-card-heading">
                    <div>
                        <span>FINANCIAL REFUND</span>
                        <h2>Refund a Recorded Payment</h2>
                    </div>
                    <button
                        type="button"
                        className="corrections-touch-button secondary compact"
                        disabled={loading || processing || !ready}
                        onClick={onRefresh}
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                {!order ? (
                    <EmptyMessage>
                        Select a served or completed order first.
                    </EmptyMessage>
                ) : !ready ? (
                    <EmptyMessage>
                        Refunds are available from a served or completed order. Current status: {order.status}.
                    </EmptyMessage>
                ) : loading ? (
                    <div className="corrections-loading">Loading invoice payments and refunds...</div>
                ) : !invoice ? (
                    <EmptyMessage>Unable to prepare the invoice for refund.</EmptyMessage>
                ) : (
                    <>
                        <div className="correction-order-summary four">
                            <SummaryMetric
                                label="Invoice"
                                value={invoice.invoice_number ?? `#${invoice.id}`}
                            />
                            <SummaryMetric
                                label="Invoice Total"
                                value={money(
                                    invoice.payment?.grand_total
                                    ?? invoice.grand_total,
                                )}
                            />
                            <SummaryMetric
                                label="Applied Payments"
                                value={money(
                                    invoice.payment?.paid_amount
                                    ?? invoice.paid_amount,
                                )}
                            />
                            <SummaryMetric
                                label="Refunded"
                                value={money(
                                    refunds
                                        .filter(
                                            (refund) =>
                                                (refund.status ?? 'COMPLETED') === 'COMPLETED',
                                        )
                                        .reduce(
                                            (total, refund) => total + numeric(refund.amount),
                                            0,
                                        ),
                                )}
                            />
                        </div>

                        <h3 className="corrections-section-title">
                            Select payment
                        </h3>

                        {payments.length === 0 ? (
                            <EmptyMessage>
                                No completed payment records are available for this invoice.
                            </EmptyMessage>
                        ) : (
                            <div className="refund-payment-grid">
                                {payments.map(
                                    (payment) => {
                                        const remaining =
                                            paymentRemainingRefundable(
                                                payment,
                                                refunds,
                                            );

                                        return (
                                            <button
                                                key={payment.id}
                                                type="button"
                                                className={
                                                    selectedPaymentId === payment.id
                                                        ? 'refund-payment-card selected'
                                                        : 'refund-payment-card'
                                                }
                                                disabled={processing || remaining <= 0.009}
                                                onClick={() => onSelectPayment(payment.id)}
                                            >
                                                <div>
                                                    <strong>
                                                        {paymentMethodLabel(paymentMethod(payment))}
                                                    </strong>
                                                    <small>
                                                        {payment.payment_number ?? `Payment #${payment.id}`}
                                                    </small>
                                                </div>
                                                <span>{money(payment.amount)}</span>
                                                <small className="refund-remaining">
                                                    Refundable {money(remaining)}
                                                </small>
                                            </button>
                                        );
                                    },
                                )}
                            </div>
                        )}

                        {selectedPayment ? (
                            <div className="refund-entry-grid">
                                <div className="refund-selected-banner">
                                    <span>Selected Method</span>
                                    <strong>
                                        {paymentMethodLabel(paymentMethod(selectedPayment))}
                                    </strong>
                                    <small>
                                        Refund method is locked to the original payment method.
                                    </small>
                                </div>

                                <label className="corrections-field">
                                    <span>Refund amount</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        inputMode="decimal"
                                        disabled={processing || !canCreateRefunds}
                                        value={refundAmount}
                                        onChange={(event) => onAmountChange(event.target.value)}
                                    />
                                    <small>
                                        Maximum: {money(selectedPaymentRemaining)}
                                    </small>
                                </label>

                                <label className="corrections-field refund-reason-field">
                                    <span>Mandatory refund reason</span>
                                    <textarea
                                        rows={3}
                                        maxLength={1000}
                                        disabled={processing || !canCreateRefunds}
                                        value={refundReason}
                                        placeholder="Example: Customer approved partial refund for returned item."
                                        onChange={(event) => onReasonChange(event.target.value)}
                                    />
                                </label>

                                <div className="refund-hardware-notice">
                                    <strong>
                                        {paymentMethod(selectedPayment) === 'CASH'
                                            ? 'Cash refund'
                                            : 'Non-cash refund'}
                                    </strong>
                                    <p>
                                        {paymentMethod(selectedPayment) === 'CASH'
                                            ? 'An open cashier shift is required. After the backend saves a genuine cash refund, the POS opens the drawer only when cash_drawer.should_open is true.'
                                            : 'Card, QR, bank and other refunds do not open the physical cash drawer.'}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="corrections-touch-button primary full"
                                    disabled={
                                        processing
                                        || !canCreateRefunds
                                        || !refundReason.trim()
                                        || numeric(refundAmount) <= 0
                                        || numeric(refundAmount) > selectedPaymentRemaining + 0.009
                                    }
                                    onClick={onRefund}
                                >
                                    {processing
                                        ? 'Processing Refund...'
                                        : 'Authorize & Process Refund'}
                                </button>
                            </div>
                        ) : null}
                    </>
                )}
            </section>

            <section className="corrections-card refund-history-card">
                <div className="corrections-card-heading">
                    <div>
                        <span>REFUND HISTORY</span>
                        <h2>Recorded Refunds</h2>
                    </div>
                    <span className="history-count-badge">
                        {refunds.length}
                    </span>
                </div>

                {refunds.length === 0 ? (
                    <EmptyMessage>No financial refunds recorded for this invoice.</EmptyMessage>
                ) : (
                    <div className="refund-history-list">
                        {refunds.map(
                            (refund) => (
                                <article
                                    className="refund-history-row"
                                    key={refund.id}
                                >
                                    <div className="refund-history-top">
                                        <div>
                                            <strong>
                                                {refund.refund_number ?? `Refund #${refund.id}`}
                                            </strong>
                                            <small>
                                                {paymentMethodLabel(refund.refund_method)}
                                            </small>
                                        </div>
                                        <strong className="refund-history-amount">
                                            {money(refund.amount)}
                                        </strong>
                                    </div>

                                    <p>{refund.reason ?? 'No reason provided.'}</p>

                                    <div className="refund-history-meta">
                                        <span>
                                            {refund.status ?? 'COMPLETED'}
                                        </span>
                                        <span>
                                            Authorized by {refundActorName(refund.authorized_by)}
                                        </span>
                                        <span>
                                            {dateTime(refund.refunded_at ?? refund.created_at)}
                                        </span>
                                    </div>
                                </article>
                            ),
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}

function StockCorrectionPanel(
    {
        canViewInventory,
        loading,
        processing,
        movements,
        selectedMovementId,
        selectedMovement,
        manualMovementId,
        quantity,
        reason,
        onRefresh,
        onSelectMovement,
        onManualMovementIdChange,
        onQuantityChange,
        onReasonChange,
        onSubmit,
    }: {
        canViewInventory: boolean;
        loading: boolean;
        processing: boolean;
        movements: StockMovementRecord[];
        selectedMovementId: number | null;
        selectedMovement: StockMovementRecord | null;
        manualMovementId: string;
        quantity: string;
        reason: string;
        onRefresh: () => void;
        onSelectMovement: (id: number) => void;
        onManualMovementIdChange: (value: string) => void;
        onQuantityChange: (value: string) => void;
        onReasonChange: (value: string) => void;
        onSubmit: () => void;
    },
) {
    return (
        <div className="corrections-panel-grid stock-grid">
            <section className="corrections-card correction-primary-card">
                <div className="corrections-card-heading">
                    <div>
                        <span>INVENTORY CORRECTION</span>
                        <h2>Restore Unused Consumed Stock</h2>
                    </div>
                    {canViewInventory ? (
                        <button
                            type="button"
                            className="corrections-touch-button secondary compact"
                            disabled={loading || processing}
                            onClick={onRefresh}
                        >
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                    ) : null}
                </div>

                <div className="correction-rule-card warning">
                    <strong>Use only for physically unused ingredients</strong>
                    <p>
                        This creates a CANCELLATION_REVERSAL against one SALE_CONSUMPTION movement. It does not refund money and is not the correct action for food that was prepared and discarded.
                    </p>
                </div>

                {canViewInventory ? (
                    <>
                        <h3 className="corrections-section-title">
                            Recent sale-consumption movements
                        </h3>

                        {loading ? (
                            <div className="corrections-loading">Loading stock movements...</div>
                        ) : movements.length === 0 ? (
                            <EmptyMessage>
                                No recent SALE_CONSUMPTION movements were returned.
                            </EmptyMessage>
                        ) : (
                            <div className="stock-movement-list">
                                {movements.map(
                                    (movement) => (
                                        <button
                                            key={movement.id}
                                            type="button"
                                            className={
                                                selectedMovementId === movement.id
                                                    ? 'stock-movement-card selected'
                                                    : 'stock-movement-card'
                                            }
                                            disabled={processing}
                                            onClick={() => onSelectMovement(movement.id)}
                                        >
                                            <div>
                                                <strong>
                                                    {movement.ingredient?.name ?? 'Ingredient'}
                                                </strong>
                                                <small>
                                                    {movement.ingredient?.sku ?? `Movement #${movement.id}`}
                                                </small>
                                            </div>
                                            <div className="stock-movement-qty">
                                                <strong>
                                                    {Math.abs(numeric(movement.quantity_delta)).toLocaleString('en-LK')}
                                                    {' '}
                                                    {movement.ingredient?.base_unit?.symbol ?? ''}
                                                </strong>
                                                <small>Consumed</small>
                                            </div>
                                        </button>
                                    ),
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <label className="corrections-field">
                        <span>SALE_CONSUMPTION movement ID</span>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            disabled={processing}
                            value={manualMovementId}
                            placeholder="Example: 1452"
                            onChange={(event) => onManualMovementIdChange(event.target.value)}
                        />
                        <small>
                            Your cashier account can request a correction but cannot browse the inventory ledger. Enter the exact movement ID supplied by an authorized manager.
                        </small>
                    </label>
                )}

                {selectedMovement ? (
                    <div className="stock-selected-summary">
                        <span>Selected movement #{selectedMovement.id}</span>
                        <strong>
                            {selectedMovement.ingredient?.name ?? 'Ingredient'}
                        </strong>
                        <small>
                            Original consumption: {Math.abs(numeric(selectedMovement.quantity_delta))}{' '}
                            {selectedMovement.ingredient?.base_unit?.symbol ?? ''}. The backend calculates the remaining reversible quantity authoritatively.
                        </small>
                    </div>
                ) : null}

                <div className="stock-entry-grid">
                    <label className="corrections-field">
                        <span>Quantity physically returned</span>
                        <input
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            inputMode="decimal"
                            disabled={processing}
                            value={quantity}
                            onChange={(event) => onQuantityChange(event.target.value)}
                        />
                    </label>

                    <label className="corrections-field stock-reason-field">
                        <span>Mandatory correction reason</span>
                        <textarea
                            rows={3}
                            maxLength={1000}
                            disabled={processing}
                            value={reason}
                            placeholder="Example: Ingredients were not used and were physically returned to stock."
                            onChange={(event) => onReasonChange(event.target.value)}
                        />
                    </label>
                </div>

                <button
                    type="button"
                    className="corrections-touch-button warning full"
                    disabled={
                        processing
                        || numeric(quantity) <= 0
                        || !reason.trim()
                        || (
                            canViewInventory
                                ? !selectedMovementId
                                : !manualMovementId.trim()
                        )
                    }
                    onClick={onSubmit}
                >
                    {processing
                        ? 'Recording Correction...'
                        : 'Request Stock Restoration'}
                </button>
            </section>

            <section className="corrections-card correction-guide-card">
                <span className="corrections-card-kicker">DECISION GUIDE</span>
                <h2>Choose the correct action</h2>

                <div className="decision-card refund">
                    <strong>Customer gets money back</strong>
                    <span>Use Financial Refund.</span>
                </div>

                <div className="decision-card wastage">
                    <strong>Prepared food was discarded</strong>
                    <span>Record Wastage. Do not restore stock.</span>
                </div>

                <div className="decision-card stock">
                    <strong>Ingredients were never used</strong>
                    <span>Use Stock Correction with manager approval.</span>
                </div>

                <RuleList
                    items={[
                        'Only SALE_CONSUMPTION movements are accepted by the backend.',
                        'You cannot restore more than the remaining consumed quantity.',
                        'Retries use the same request UUID and cannot restore stock twice.',
                        'Closed business days reject stock restoration.',
                    ]}
                />
            </section>
        </div>
    );
}

function ManagerAuthorizationModal(
    {
        authorization,
        credentials,
        processing,
        onCredentialsChange,
        onClose,
        onSubmit,
    }: {
        authorization: PendingAuthorization;
        credentials: ManagerCredentials;
        processing: boolean;
        onCredentialsChange: (value: ManagerCredentials) => void;
        onClose: () => void;
        onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    },
) {
    return (
        <div className="corrections-modal-backdrop" role="presentation">
            <form
                className="corrections-modal manager-modal"
                onSubmit={onSubmit}
            >
                <header className="corrections-modal-header">
                    <div>
                        <span>SECURE AUTHORIZATION</span>
                        <h2>{authorization.title}</h2>
                    </div>
                    <button
                        type="button"
                        className="corrections-modal-close"
                        aria-label="Close manager authorization"
                        disabled={processing}
                        onClick={onClose}
                    >
                        ×
                    </button>
                </header>

                <p className="manager-modal-description">
                    {authorization.description}
                </p>

                <div className="manager-security-note">
                    Manager credentials are sent only for this authorization request. They are not saved by the POS.
                </div>

                <label className="corrections-field">
                    <span>Manager login</span>
                    <input
                        type="text"
                        autoComplete="username"
                        disabled={processing}
                        value={credentials.login}
                        placeholder="Username or approved login"
                        onChange={(event) => onCredentialsChange({
                            ...credentials,
                            login: event.target.value,
                        })}
                    />
                </label>

                <label className="corrections-field">
                    <span>Manager password</span>
                    <input
                        type="password"
                        autoComplete="current-password"
                        disabled={processing}
                        value={credentials.password}
                        placeholder="Manager password"
                        onChange={(event) => onCredentialsChange({
                            ...credentials,
                            password: event.target.value,
                        })}
                    />
                </label>

                <footer className="corrections-modal-actions">
                    <button
                        type="button"
                        className="corrections-touch-button secondary"
                        disabled={processing}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="corrections-touch-button primary"
                        disabled={
                            processing
                            || !credentials.login.trim()
                            || !credentials.password
                        }
                    >
                        {processing
                            ? 'Authorizing...'
                            : 'Authorize Action'}
                    </button>
                </footer>
            </form>
        </div>
    );
}

function WastagePrompt(
    {
        canCreate,
        processing,
        formOpen,
        draft,
        onDraftChange,
        onClose,
        onNoWastage,
        onOpenForm,
        onSubmit,
    }: {
        canCreate: boolean;
        processing: boolean;
        formOpen: boolean;
        draft: WastageDraft;
        onDraftChange: (value: WastageDraft) => void;
        onClose: () => void;
        onNoWastage: () => void;
        onOpenForm: () => void;
        onSubmit: () => void;
    },
) {
    return (
        <div className="corrections-modal-backdrop" role="presentation">
            <section className="corrections-modal wastage-modal">
                <header className="corrections-modal-header">
                    <div>
                        <span>OPTIONAL FOLLOW-UP</span>
                        <h2>Was prepared food discarded?</h2>
                    </div>
                    <button
                        type="button"
                        className="corrections-modal-close"
                        disabled={processing}
                        aria-label="Close wastage prompt"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </header>

                <div className="correction-rule-card warning">
                    <strong>Kitchen stock remains consumed</strong>
                    <p>
                        The cancellation did not restore inventory. If prepared ingredients or food were discarded, record wastage separately. If ingredients were physically unused and returned, use Stock Correction instead.
                    </p>
                </div>

                {!canCreate ? (
                    <>
                        <div className="manager-security-note">
                            Your account cannot create wastage records. Ask an authorized manager/operations user to record the wastage. Do not use stock restoration for discarded food.
                        </div>
                        <footer className="corrections-modal-actions single">
                            <button
                                type="button"
                                className="corrections-touch-button primary"
                                onClick={onClose}
                            >
                                Done
                            </button>
                        </footer>
                    </>
                ) : !formOpen ? (
                    <div className="wastage-choice-grid">
                        <button
                            type="button"
                            className="wastage-choice safe"
                            disabled={processing}
                            onClick={onNoWastage}
                        >
                            <strong>No Wastage</strong>
                            <span>Nothing prepared was discarded.</span>
                        </button>

                        <button
                            type="button"
                            className="wastage-choice warning"
                            disabled={processing}
                            onClick={onOpenForm}
                        >
                            <strong>Record Wastage</strong>
                            <span>Prepared stock was discarded.</span>
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="wastage-form-grid">
                            <label className="corrections-field">
                                <span>Ingredient ID</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    inputMode="numeric"
                                    disabled={processing}
                                    value={draft.ingredientId}
                                    onChange={(event) => onDraftChange({
                                        ...draft,
                                        ingredientId: event.target.value,
                                    })}
                                />
                            </label>

                            <label className="corrections-field">
                                <span>Unit ID</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    inputMode="numeric"
                                    disabled={processing}
                                    value={draft.unitId}
                                    onChange={(event) => onDraftChange({
                                        ...draft,
                                        unitId: event.target.value,
                                    })}
                                />
                            </label>

                            <label className="corrections-field">
                                <span>Quantity discarded</span>
                                <input
                                    type="number"
                                    min="0.0001"
                                    step="0.0001"
                                    inputMode="decimal"
                                    disabled={processing}
                                    value={draft.quantity}
                                    onChange={(event) => onDraftChange({
                                        ...draft,
                                        quantity: event.target.value,
                                    })}
                                />
                            </label>

                            <label className="corrections-field wastage-reason-field">
                                <span>Description</span>
                                <textarea
                                    rows={3}
                                    maxLength={255}
                                    disabled={processing}
                                    value={draft.reason}
                                    onChange={(event) => onDraftChange({
                                        ...draft,
                                        reason: event.target.value,
                                    })}
                                />
                            </label>
                        </div>

                        <p className="corrections-inline-note">
                            The POS records this with reason code OTHER and the customer-cancellation description. Enter actual ingredient quantities only; the UI does not guess recipe wastage.
                        </p>

                        <footer className="corrections-modal-actions">
                            <button
                                type="button"
                                className="corrections-touch-button secondary"
                                disabled={processing}
                                onClick={onClose}
                            >
                                Skip
                            </button>
                            <button
                                type="button"
                                className="corrections-touch-button warning"
                                disabled={
                                    processing
                                    || !draft.ingredientId
                                    || !draft.unitId
                                    || numeric(draft.quantity) <= 0
                                    || !draft.reason.trim()
                                }
                                onClick={onSubmit}
                            >
                                {processing
                                    ? 'Recording...'
                                    : 'Record Wastage'}
                            </button>
                        </footer>
                    </>
                )}
            </section>
        </div>
    );
}

function SummaryMetric(
    {
        label,
        value,
    }: {
        label: string;
        value: string;
    },
) {
    return (
        <div className="correction-summary-metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function StatusBadge(
    {
        label,
        tone,
    }: {
        label: string;
        tone: 'neutral' | 'safe' | 'danger';
    },
) {
    return (
        <span className={`correction-status-badge ${tone}`}>
            {label}
        </span>
    );
}

function EmptyMessage(
    {
        children,
    }: {
        children: ReactNode;
    },
) {
    return (
        <div className="correction-empty-message">
            {children}
        </div>
    );
}

function RuleList(
    {
        items,
    }: {
        items: string[];
    },
) {
    return (
        <ul className="correction-rule-list">
            {items.map(
                (item) => (
                    <li key={item}>
                        <span>✓</span>
                        <p>{item}</p>
                    </li>
                ),
            )}
        </ul>
    );
}
