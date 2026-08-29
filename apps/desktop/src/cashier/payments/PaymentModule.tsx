import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    ApiError,
    api,
} from "../../api";

import type {
    Order,
} from "../../types";

import {
    buildCustomerReceiptPayload,
} from "./receiptMapper";

import {
    makePaymentUuid,
    normaliseMoney,
    paymentDateTime,
    paymentMethodLabel,
    paymentMoney,
} from "./helpers";

import type {
    CashierInvoice,
    CurrentCashierShiftResponse,
    CustomerPaymentHistoryResponse,
    CustomerPaymentMethod,
    CustomerPaymentRecord,
    CustomerPaymentResultResponse,
    GeneratedInvoiceResponse,
    PaymentInputRow,
    PaymentMode,
} from "./types";

interface PaymentModuleProps {
    order:
    Order | null;

    onSessionExpired?:
    () => void;

    onPaymentCompleted?:
    (
        invoice:
            CashierInvoice,
    ) => Promise<void>;
}

export default function PaymentModule(
    {
        order,
        onSessionExpired,
        onPaymentCompleted,
    }: PaymentModuleProps,
) {
    const [
        invoice,
        setInvoice,
    ] =
        useState<CashierInvoice | null>(
            null,
        );

    const [
        paymentHistory,
        setPaymentHistory,
    ] =
        useState<CustomerPaymentRecord[]>(
            [],
        );

    const [
        mode,
        setMode,
    ] =
        useState<PaymentMode>(
            "CASH",
        );

    /*
    |--------------------------------------------------------------------------
    | Cash
    |--------------------------------------------------------------------------
    */

    const [
        cashReceived,
        setCashReceived,
    ] =
        useState("");

    const [
        cashAmount,
        setCashAmount,
    ] =
        useState("");

    /*
    |--------------------------------------------------------------------------
    | Non-Cash Amounts
    |--------------------------------------------------------------------------
    */

    const [
        cardAmount,
        setCardAmount,
    ] =
        useState("");

    const [
        qrAmount,
        setQrAmount,
    ] =
        useState("");

    const [
        bankAmount,
        setBankAmount,
    ] =
        useState("");

    const [
        otherAmount,
        setOtherAmount,
    ] =
        useState("");

    /*
    |--------------------------------------------------------------------------
    | References
    |--------------------------------------------------------------------------
    */

    const [
        cardReference,
        setCardReference,
    ] =
        useState("");

    const [
        qrReference,
        setQrReference,
    ] =
        useState("");

    const [
        bankReference,
        setBankReference,
    ] =
        useState("");

    const [
        otherReference,
        setOtherReference,
    ] =
        useState("");

    /*
    |--------------------------------------------------------------------------
    | UI
    |--------------------------------------------------------------------------
    */

    const [
        loadingInvoice,
        setLoadingInvoice,
    ] =
        useState(false);

    const [
        processing,
        setProcessing,
    ] =
        useState(false);

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(false);

    const [
        message,
        setMessage,
    ] =
        useState("");

    const [
        error,
        setError,
    ] =
        useState("");

    /*
    |--------------------------------------------------------------------------
    | Payment Idempotency
    |--------------------------------------------------------------------------
    |
    | Keep this UUID while retrying the SAME payment request.
    |
    | Laravel Phase 28 guarantees:
    |
    | same request + same UUID
    | → no second charge
    | → no second CASH_SALE
    | → should_open = false
    |--------------------------------------------------------------------------
    */

    const [
        paymentRequestId,
        setPaymentRequestId,
    ] =
        useState(
            () =>
                makePaymentUuid(),
        );

    /*
    |--------------------------------------------------------------------------
    | Paid Order Finalization Recovery
    |--------------------------------------------------------------------------
    |
    | Prevent repeated automatic completion calls for the same paid invoice.
    | If finalization fails, the ref is cleared so a later retry can recover.
    |--------------------------------------------------------------------------
    */

    const finalizationAttemptInvoiceId =
        useRef<number | null>(
            null,
        );

    /*
    |--------------------------------------------------------------------------
    | Error Handler
    |--------------------------------------------------------------------------
    */

    const handleError =
        useCallback(
            (
                exception:
                    unknown,
            ): void => {
                if (
                    exception instanceof ApiError
                    &&
                    exception.status === 401
                ) {
                    onSessionExpired?.();

                    return;
                }

                setError(
                    exception instanceof Error
                        ? exception.message
                        : "Payment operation failed.",
                );
            },
            [
                onSessionExpired,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Reset When Selected Order Changes
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            setInvoice(
                null,
            );

            setPaymentHistory(
                [],
            );

            setMode(
                "CASH",
            );

            setCashReceived(
                "",
            );

            setCashAmount(
                "",
            );

            setCardAmount(
                "",
            );

            setQrAmount(
                "",
            );

            setBankAmount(
                "",
            );

            setOtherAmount(
                "",
            );

            setCardReference(
                "",
            );

            setQrReference(
                "",
            );

            setBankReference(
                "",
            );

            setOtherReference(
                "",
            );

            setMessage(
                "",
            );

            setError(
                "",
            );

            finalizationAttemptInvoiceId
                .current =
                null;

            setPaymentRequestId(
                makePaymentUuid(),
            );
        },
        [
            order?.id,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Load Payment History
    |--------------------------------------------------------------------------
    */

    const loadPaymentHistory =
        useCallback(
            async (
                invoiceId:
                    number,
            ): Promise<CustomerPaymentRecord[]> => {
                const response =
                    await api.get<CustomerPaymentHistoryResponse>(
                        `/invoices/${invoiceId}/payments`,
                    );

                const records =
                    response
                        .data
                        .payments
                    ??
                    [];

                setPaymentHistory(
                    records,
                );

                return records;
            },
            [],
        );

    /*
    |--------------------------------------------------------------------------
    | Generate Invoice
    |--------------------------------------------------------------------------
    */

    const ensureInvoice =
        useCallback(
            async (): Promise<CashierInvoice | null> => {
                if (
                    !order
                ) {
                    return null;
                }

                if (
                    invoice
                ) {
                    return invoice;
                }

                if (
                    order.status !== "SERVED"
                    &&
                    order.status !== "COMPLETED"
                ) {
                    setError(
                        "The order must be marked as served before billing.",
                    );

                    return null;
                }

                setLoadingInvoice(
                    true,
                );

                setError(
                    "",
                );

                try {
                    const invoiceEndpoint =
                        order.table_session_id
                            ? `/table-sessions/${order.table_session_id}/invoice`
                            : `/orders/${order.id}/invoice`;

                    const response =
                        await api.post<GeneratedInvoiceResponse>(
                            invoiceEndpoint,
                            {},
                        );

                    const generatedInvoice =
                        response.data.invoice;

                    setInvoice(
                        generatedInvoice,
                    );

                    try {
                        await loadPaymentHistory(
                            generatedInvoice.id,
                        );
                    } catch (
                    historyException
                    ) {
                        handleError(
                            historyException,
                        );
                    }

                    return generatedInvoice;
                } catch (
                exception
                ) {
                    handleError(
                        exception,
                    );

                    return null;
                } finally {
                    setLoadingInvoice(
                        false,
                    );
                }
            },
            [
                handleError,
                invoice,
                loadPaymentHistory,
                order,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Automatically Prepare Billing For Served Order
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            if (
                order
                &&
                (
                    order.status === "SERVED"
                    ||
                    order.status === "COMPLETED"
                )
            ) {
                void ensureInvoice();
            }
        },
        [
            ensureInvoice,
            order,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Refresh Invoice + Payment History
    |--------------------------------------------------------------------------
    */

    const refreshBilling =
        useCallback(
            async (
                invoiceId:
                    number,
            ): Promise<{
                invoice:
                CashierInvoice;

                payments:
                CustomerPaymentRecord[];
            }> => {
                const [
                    invoiceResponse,
                    historyResponse,
                ] =
                    await Promise.all([
                        api.get<CashierInvoice>(
                            `/invoices/${invoiceId}`,
                        ),

                        api.get<CustomerPaymentHistoryResponse>(
                            `/invoices/${invoiceId}/payments`,
                        ),
                    ]);

                const freshInvoice =
                    invoiceResponse.data;

                const freshPayments =
                    historyResponse
                        .data
                        .payments
                    ??
                    [];

                setInvoice(
                    freshInvoice,
                );

                setPaymentHistory(
                    freshPayments,
                );

                return {
                    invoice:
                        freshInvoice,

                    payments:
                        freshPayments,
                };
            },
            [],
        );

    /*
    |--------------------------------------------------------------------------
    | Finalize Sale After Full Payment
    |--------------------------------------------------------------------------
    |
    | Payment is authoritative and already committed by Laravel before this
    | function is called.
    |
    | If order finalization fails:
    | - never reverse or retry the financial transaction automatically
    | - never print a second automatic receipt
    | - keep the error visible so the cashier can recover safely
    |--------------------------------------------------------------------------
    */

    const finalizePaidInvoice =
        useCallback(
            async (
                paidInvoice:
                    CashierInvoice,
            ): Promise<string | null> => {
                const fullyPaid =
                    paidInvoice
                        .payment
                        .status
                    ===
                    "PAID"
                    ||
                    Number(
                        paidInvoice
                            .payment
                            .balance_due,
                    )
                    <=
                    0.009;

                if (
                    !fullyPaid
                    ||
                    !onPaymentCompleted
                ) {
                    return null;
                }

                try {
                    await onPaymentCompleted(
                        paidInvoice,
                    );

                    return null;
                } catch (
                exception
                ) {
                    if (
                        exception instanceof ApiError
                        &&
                        exception.status === 401
                    ) {
                        onSessionExpired?.();
                    }

                    return exception instanceof Error
                        ? `Payment was SAVED successfully, but the sale could not be fully finalized: ${exception.message}`
                        : "Payment was SAVED successfully, but the sale could not be fully finalized.";
                }
            },
            [
                onPaymentCompleted,
                onSessionExpired,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Derived Amounts
    |--------------------------------------------------------------------------
    */

    const balance =
        Number(
            invoice
                ?.payment
                .balance_due
            ??
            order
                ?.grand_total
            ??
            0,
        );

    const grandTotal =
        Number(
            invoice
                ?.totals
                .grand_total
            ??
            order
                ?.grand_total
            ??
            0,
        );

    const paidAmount =
        Number(
            invoice
                ?.payment
                .paid_amount
            ??
            0,
        );

    const cashTendered =
        Number(
            cashReceived
            ||
            0,
        );

    const singleCashChange =
        Math.max(
            0,
            normaliseMoney(
                cashTendered
                -
                balance,
            ),
        );

    const mixedCash =
        Number(
            cashAmount
            ||
            0,
        );

    const mixedAllocated =
        normaliseMoney(
            mixedCash
            +
            Number(
                cardAmount
                ||
                0,
            )
            +
            Number(
                qrAmount
                ||
                0,
            )
            +
            Number(
                bankAmount
                ||
                0,
            )
            +
            Number(
                otherAmount
                ||
                0,
            ),
        );

    const mixedRemaining =
        normaliseMoney(
            balance
            -
            mixedAllocated,
        );

    const mixedCashChange =
        Math.max(
            0,
            normaliseMoney(
                cashTendered
                -
                mixedCash,
            ),
        );

    const isPaid =
        Boolean(
            invoice
            &&
            (
                invoice.payment.status === "PAID"
                ||
                balance <= 0.009
            ),
        );

    /*
    |--------------------------------------------------------------------------
    | Recover A Paid Invoice With Incomplete Sale Finalization
    |--------------------------------------------------------------------------
    |
    | This repairs both recovery states:
    |
    | invoice = PAID
    | order   = SERVED
    |
    | and:
    |
    | invoice       = PAID
    | order         = COMPLETED
    | table session = OPEN
    |
    | Opening the Payment module again safely retries lifecycle finalization.
    | It does not create another financial payment.
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {
            const recoverablePaidOrder =
                order?.status === "SERVED"
                ||
                order?.status === "COMPLETED";

            if (
                !invoice
                ||
                !order
                ||
                !recoverablePaidOrder
                ||
                !isPaid
                ||
                !onPaymentCompleted
                ||
                finalizationAttemptInvoiceId
                    .current
                ===
                invoice.id
            ) {
                return;
            }

            finalizationAttemptInvoiceId
                .current =
                invoice.id;

            void finalizePaidInvoice(
                invoice,
            )
                .then(
                    (
                        warning,
                    ) => {
                        if (
                            warning
                        ) {
                            finalizationAttemptInvoiceId
                                .current =
                                null;

                            setError(
                                warning,
                            );
                        }
                    },
                )
                .catch(
                    () => {
                        finalizationAttemptInvoiceId
                            .current =
                            null;
                    },
                );
        },
        [
            finalizePaidInvoice,
            invoice,
            isPaid,
            onPaymentCompleted,
            order,
        ],
    );

    /*
    |--------------------------------------------------------------------------
    | Payment Status Tone
    |--------------------------------------------------------------------------
    */

    const paymentStatusClass =
        useMemo(
            () => {
                const status =
                    invoice
                        ?.payment
                        .status
                    ??
                    "UNPAID";

                if (
                    status === "PAID"
                ) {
                    return "paid";
                }

                if (
                    status === "PARTIAL"
                ) {
                    return "partial";
                }

                return "unpaid";
            },
            [
                invoice,
            ],
        );

    /*
    |--------------------------------------------------------------------------
    | Keypad
    |--------------------------------------------------------------------------
    */

    const appendCashReceived =
        (
            value:
                string,
        ): void => {
            setCashReceived(
                (
                    current,
                ) =>
                    current
                    +
                    value,
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Build Payment Request
    |--------------------------------------------------------------------------
    */

    const buildPayments =
        (
            targetBalance:
                number,
        ): PaymentInputRow[] => {
            const amountDue =
                normaliseMoney(
                    targetBalance,
                );

            if (
                amountDue <= 0
            ) {
                throw new Error(
                    "This invoice has no outstanding balance.",
                );
            }

            /*
            |--------------------------------------------------------------------------
            | CASH
            |--------------------------------------------------------------------------
            */

            if (
                mode === "CASH"
            ) {
                if (
                    !Number.isFinite(
                        cashTendered,
                    )
                    ||
                    cashTendered < amountDue
                ) {
                    throw new Error(
                        "Cash received cannot be less than the invoice balance.",
                    );
                }

                return [
                    {
                        payment_method:
                            "CASH",

                        amount:
                            amountDue,

                        tendered_amount:
                            normaliseMoney(
                                cashTendered,
                            ),
                    },
                ];
            }

            /*
            |--------------------------------------------------------------------------
            | Single Non-Cash
            |--------------------------------------------------------------------------
            */

            if (
                mode !== "MIXED"
            ) {
                let reference =
                    "";

                switch (
                mode
                ) {
                    case "CARD":
                        reference =
                            cardReference;
                        break;

                    case "QR":
                        reference =
                            qrReference;
                        break;

                    case "BANK_TRANSFER":
                        reference =
                            bankReference;
                        break;

                    case "OTHER":
                        reference =
                            otherReference;
                        break;

                    default:
                        reference =
                            "";
                }

                return [
                    {
                        payment_method:
                            mode,

                        amount:
                            amountDue,

                        reference_number:
                            reference.trim()
                            ||
                            undefined,
                    },
                ];
            }

            /*
            |--------------------------------------------------------------------------
            | Mixed
            |--------------------------------------------------------------------------
            */

            if (
                Math.abs(
                    mixedRemaining,
                )
                >
                0.009
            ) {
                throw new Error(
                    `Mixed payments must exactly equal the invoice balance. Remaining: ${paymentMoney(
                        mixedRemaining,
                    )}`,
                );
            }

            const rows:
                PaymentInputRow[] =
                [];

            if (
                mixedCash > 0
            ) {
                if (
                    !Number.isFinite(
                        cashTendered,
                    )
                    ||
                    cashTendered < mixedCash
                ) {
                    throw new Error(
                        "Cash received cannot be less than the cash allocation.",
                    );
                }

                rows.push({
                    payment_method:
                        "CASH",

                    amount:
                        normaliseMoney(
                            mixedCash,
                        ),

                    tendered_amount:
                        normaliseMoney(
                            cashTendered,
                        ),
                });
            }

            const addNonCash =
                (
                    paymentMethod:
                        CustomerPaymentMethod,

                    rawAmount:
                        string,

                    reference:
                        string,
                ): void => {
                    const value =
                        normaliseMoney(
                            Number(
                                rawAmount
                                ||
                                0,
                            ),
                        );

                    if (
                        !Number.isFinite(
                            value,
                        )
                        ||
                        value <= 0
                    ) {
                        return;
                    }

                    rows.push({
                        payment_method:
                            paymentMethod,

                        amount:
                            value,

                        reference_number:
                            reference.trim()
                            ||
                            undefined,
                    });
                };

            addNonCash(
                "CARD",
                cardAmount,
                cardReference,
            );

            addNonCash(
                "QR",
                qrAmount,
                qrReference,
            );

            addNonCash(
                "BANK_TRANSFER",
                bankAmount,
                bankReference,
            );

            addNonCash(
                "OTHER",
                otherAmount,
                otherReference,
            );

            if (
                rows.length === 0
            ) {
                throw new Error(
                    "Add at least one payment method.",
                );
            }

            return rows;
        };

    /*
    |--------------------------------------------------------------------------
    | Clear Payment Entry
    |--------------------------------------------------------------------------
    */

    const clearEntry =
        (): void => {
            setCashReceived(
                "",
            );

            setCashAmount(
                "",
            );

            setCardAmount(
                "",
            );

            setQrAmount(
                "",
            );

            setBankAmount(
                "",
            );

            setOtherAmount(
                "",
            );

            setCardReference(
                "",
            );

            setQrReference(
                "",
            );

            setBankReference(
                "",
            );

            setOtherReference(
                "",
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Process Payment
    |--------------------------------------------------------------------------
    */

    const processPayment =
        async (): Promise<void> => {
            if (
                processing
            ) {
                return;
            }

            const currentInvoice =
                await ensureInvoice();

            if (
                !currentInvoice
            ) {
                return;
            }

            const currentBalance =
                Number(
                    currentInvoice
                        .payment
                        .balance_due,
                );

            if (
                currentBalance <= 0.009
            ) {
                const finalizationWarning =
                    await finalizePaidInvoice(
                        currentInvoice,
                    );

                if (
                    finalizationWarning
                ) {
                    setError(
                        finalizationWarning,
                    );
                }

                setMessage(
                    "This invoice is already fully paid.",
                );

                return;
            }

            setProcessing(
                true,
            );

            setMessage(
                "",
            );

            setError(
                "",
            );

            try {
                const payments =
                    buildPayments(
                        currentBalance,
                    );

                const containsCash =
                    payments.some(
                        (
                            payment,
                        ) =>
                            payment.payment_method === "CASH",
                    );

                let shiftId:
                    number | null =
                    null;

                /*
                |--------------------------------------------------------------------------
                | Cash Requires Open Cashier Shift
                |--------------------------------------------------------------------------
                */

                if (
                    containsCash
                ) {
                    const shiftResponse =
                        await api.get<CurrentCashierShiftResponse>(
                            "/cashier-shifts/current",
                        );

                    if (
                        !shiftResponse
                            .data
                            .shift
                    ) {
                        throw new Error(
                            "Open a cashier shift before accepting a cash payment.",
                        );
                    }

                    shiftId =
                        shiftResponse
                            .data
                            .shift
                            .id;
                }

                /*
                |--------------------------------------------------------------------------
                | Financial Commit
                |--------------------------------------------------------------------------
                */

                const response =
                    await api.post<CustomerPaymentResultResponse>(
                        `/invoices/${currentInvoice.id}/payments`,
                        {
                            client_request_id:
                                paymentRequestId,

                            cashier_shift_id:
                                shiftId,

                            payments:
                                payments,
                        },
                    );

                const result =
                    response.data;

                /*
                 * This payment flow will finalize the order explicitly below.
                 * Mark the invoice now so the recovery effect cannot start a
                 * second concurrent completion request during this operation.
                 */
                finalizationAttemptInvoiceId
                    .current =
                    result.invoice.id;

                setInvoice(
                    result.invoice,
                );

                /*
                |--------------------------------------------------------------------------
                | Idempotent Retry
                |--------------------------------------------------------------------------
                |
                | Payment already exists.
                |
                | Do NOT:
                | - print another automatic receipt
                | - pulse drawer again
                |--------------------------------------------------------------------------
                */

                if (
                    !result.created
                ) {
                    const refreshed =
                        await refreshBilling(
                            result.invoice.id,
                        );

                    const finalizationWarning =
                        await finalizePaidInvoice(
                            refreshed.invoice,
                        );

                    if (
                        finalizationWarning
                    ) {
                        setError(
                            finalizationWarning,
                        );
                    }

                    setMessage(
                        "This payment request was already processed. No duplicate payment, receipt or drawer opening was performed.",
                    );

                    return;
                }

                /*
                 * Financial transaction is definitely saved now.
                 *
                 * The next genuine payment operation gets a new UUID,
                 * even if receipt hardware subsequently fails.
                 */
                setPaymentRequestId(
                    makePaymentUuid(),
                );

                const refreshed =
                    await refreshBilling(
                        result.invoice.id,
                    );

                clearEntry();

                /*
                |--------------------------------------------------------------------------
                | Finalize Fully Paid Sale
                |--------------------------------------------------------------------------
                |
                | Do this after Laravel has committed the payment and before
                | receipt/drawer hardware. A printer failure must not leave a
                | fully paid order incorrectly stuck in SERVED.
                |--------------------------------------------------------------------------
                */

                const finalizationWarning =
                    await finalizePaidInvoice(
                        refreshed.invoice,
                    );

                /*
                |--------------------------------------------------------------------------
                | Hardware Flow
                |--------------------------------------------------------------------------
                |
                | Laravel SUCCESS
                |      ↓
                | Receipt Print
                |      ↓
                | Receipt SUCCESS
                |      ↓
                | Laravel should_open?
                |      ↓
                | Drawer Pulse
                |--------------------------------------------------------------------------
                */

                let receiptPrinted =
                    false;

                try {
                    const receiptPayload =
                        buildCustomerReceiptPayload(
                            refreshed.invoice,

                            refreshed.payments,
                        );

                    await window
                        .posBridge
                        .printCustomerReceipt(
                            receiptPayload,
                        );

                    receiptPrinted =
                        true;

                    if (
                        result
                            .cash_drawer
                            .should_open
                    ) {
                        await window
                            .posBridge
                            .openCashDrawerHardware();
                    }
                } catch (
                hardwareException
                ) {
                    const hardwareMessage =
                        receiptPrinted
                            ? `Payment was SAVED and the receipt printed, but the cash drawer hardware failed: ${hardwareException instanceof Error
                                ? hardwareException.message
                                : "Unknown hardware error."
                            }`
                            : `Payment was SAVED successfully, but receipt printing failed: ${hardwareException instanceof Error
                                ? hardwareException.message
                                : "Unknown hardware error."
                            }`;

                    setError(
                        finalizationWarning
                            ? `${finalizationWarning} ${hardwareMessage}`
                            : hardwareMessage,
                    );

                    return;
                }

                if (
                    finalizationWarning
                ) {
                    setError(
                        finalizationWarning,
                    );
                }

                setMessage(
                    result
                        .cash_drawer
                        .should_open
                        ? "Payment completed. Receipt printed and cash drawer opened."
                        : "Payment completed. Receipt printed and cash drawer remained closed.",
                );
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );
            } finally {
                setProcessing(
                    false,
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Reprint Receipt
    |--------------------------------------------------------------------------
    |
    | Reprinting never opens the cash drawer.
    |--------------------------------------------------------------------------
    */

    const reprintReceipt =
        async (): Promise<void> => {
            if (
                !invoice
            ) {
                return;
            }

            setProcessing(
                true,
            );

            setMessage(
                "",
            );

            setError(
                "",
            );

            try {
                const refreshed =
                    await refreshBilling(
                        invoice.id,
                    );

                const payload =
                    buildCustomerReceiptPayload(
                        refreshed.invoice,

                        refreshed.payments,

                        "REPRINT",
                    );

                await window
                    .posBridge
                    .printCustomerReceipt(
                        payload,
                    );

                setMessage(
                    "Receipt reprinted successfully. Cash drawer was not opened.",
                );
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );
            } finally {
                setProcessing(
                    false,
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Manual Refresh
    |--------------------------------------------------------------------------
    */

    const refresh =
        async (): Promise<void> => {
            if (
                !invoice
            ) {
                return;
            }

            setRefreshing(
                true,
            );

            setError(
                "",
            );

            try {
                await refreshBilling(
                    invoice.id,
                );
            } catch (
            exception
            ) {
                handleError(
                    exception,
                );
            } finally {
                setRefreshing(
                    false,
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | No Selected Order
    |--------------------------------------------------------------------------
    */

    if (
        !order
    ) {
        return (
            <div className="billing-page">
                <style>
                    {styles}
                </style>

                <header className="billing-header">
                    <div>
                        <span className="billing-eyebrow">
                            BILLING
                        </span>

                        <h1>
                            Payment
                        </h1>

                        <p>
                            Select a served order before processing payment.
                        </p>
                    </div>
                </header>

                <section className="billing-empty-card">
                    <div className="billing-empty-icon">
                        Rs
                    </div>

                    <h2>
                        No Order Selected
                    </h2>

                    <p>
                        Open a customer order and mark it as served before
                        moving to the Payment module.
                    </p>
                </section>
            </div>
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Order Not Ready
    |--------------------------------------------------------------------------
    */

    if (
        order.status !== "SERVED"
        &&
        order.status !== "COMPLETED"
    ) {
        return (
            <div className="billing-page">
                <style>
                    {styles}
                </style>

                <header className="billing-header">
                    <div>
                        <span className="billing-eyebrow">
                            BILLING
                        </span>

                        <h1>
                            Payment
                        </h1>

                        <p>
                            Order #{order.order_number ?? order.id}
                        </p>
                    </div>

                    <div className="billing-status unpaid">
                        NOT READY
                    </div>
                </header>

                <section className="billing-warning-card">
                    <strong>
                        Order must be served first.
                    </strong>

                    <span>
                        Current status: {order.status}
                    </span>
                </section>
            </div>
        );
    }

    return (
        <div className="billing-page">
            <style>
                {styles}
            </style>

            <header className="billing-header">
                <div>
                    <span className="billing-eyebrow">
                        BILLING & PAYMENT
                    </span>

                    <h1>
                        Customer Payment
                    </h1>

                    <p>
                        Order #{order.order_number ?? order.id}
                        {
                            invoice
                                ? ` • ${invoice.invoice_number}`
                                : ""
                        }
                    </p>
                </div>

                <div
                    className={
                        `billing-status ${paymentStatusClass}`
                    }
                >
                    {
                        invoice
                            ?.payment
                            .status
                        ??
                        "PREPARING"
                    }
                </div>
            </header>

            {
                error
                    ? (
                        <div className="billing-alert error">
                            {error}
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div className="billing-alert success">
                            {message}
                        </div>
                    )
                    : null
            }

            {
                loadingInvoice
                    ? (
                        <div className="billing-loading">
                            Preparing final invoice...
                        </div>
                    )
                    : null
            }

            <section className="billing-summary-grid">
                <SummaryCard
                    label="Invoice Total"
                    value={
                        paymentMoney(
                            grandTotal,
                        )
                    }
                />

                <SummaryCard
                    label="Applied to Invoice"
                    value={
                        paymentMoney(
                            paidAmount,
                        )
                    }
                    tone="positive"
                />

                <SummaryCard
                    label="Balance Due"
                    value={
                        paymentMoney(
                            balance,
                        )
                    }
                    tone={
                        balance <= 0.009
                            ? "positive"
                            : "primary"
                    }
                />

                <SummaryCard
                    label="Change Returned"
                    value={
                        paymentMoney(
                            invoice
                                ?.payment
                                .change_amount
                            ??
                            0,
                        )
                    }
                />
            </section>

            <div className="billing-main-grid">
                <section className="billing-card">
                    <div className="billing-card-header">
                        <div>
                            <span className="billing-card-kicker">
                                PAYMENT
                            </span>

                            <h2>
                                Payment Method
                            </h2>
                        </div>

                        <span className="billing-balance-badge">
                            Due {paymentMoney(
                                balance,
                            )}
                        </span>
                    </div>

                    <div className="billing-method-grid">
                        {
                            (
                                [
                                    "CASH",
                                    "CARD",
                                    "QR",
                                    "BANK_TRANSFER",
                                    "OTHER",
                                    "MIXED",
                                ] as PaymentMode[]
                            ).map(
                                (
                                    paymentMode,
                                ) => (
                                    <button
                                        key={
                                            paymentMode
                                        }
                                        type="button"
                                        className={
                                            mode === paymentMode
                                                ? "billing-method active"
                                                : "billing-method"
                                        }
                                        disabled={
                                            processing
                                            ||
                                            isPaid
                                        }
                                        onClick={
                                            () => {
                                                setMode(
                                                    paymentMode,
                                                );

                                                setError(
                                                    "",
                                                );
                                            }
                                        }
                                    >
                                        <strong>
                                            {
                                                paymentMethodLabel(
                                                    paymentMode,
                                                )
                                            }
                                        </strong>
                                    </button>
                                ),
                            )
                        }
                    </div>

                    {
                        mode === "CASH"
                            ? (
                                <div className="cash-payment-panel">
                                    <div className="billing-value-block">
                                        <span>
                                            Amount Due
                                        </span>

                                        <strong>
                                            {
                                                paymentMoney(
                                                    balance,
                                                )
                                            }
                                        </strong>
                                    </div>

                                    <div className="billing-value-block highlight">
                                        <span>
                                            Cash Received
                                        </span>

                                        <strong>
                                            {
                                                paymentMoney(
                                                    cashTendered,
                                                )
                                            }
                                        </strong>
                                    </div>

                                    <div className="billing-value-block change">
                                        <span>
                                            Change
                                        </span>

                                        <strong>
                                            {
                                                paymentMoney(
                                                    singleCashChange,
                                                )
                                            }
                                        </strong>
                                    </div>
                                </div>
                            )
                            : null
                    }

                    {
                        mode === "CARD"
                            ? (
                                <SingleNonCashForm
                                    label="Card Reference"
                                    placeholder="Card reference / last digits"
                                    value={
                                        cardReference
                                    }
                                    disabled={
                                        processing
                                    }
                                    onChange={
                                        setCardReference
                                    }
                                />
                            )
                            : null
                    }

                    {
                        mode === "QR"
                            ? (
                                <SingleNonCashForm
                                    label="QR Transaction Reference"
                                    placeholder="QR transaction reference"
                                    value={
                                        qrReference
                                    }
                                    disabled={
                                        processing
                                    }
                                    onChange={
                                        setQrReference
                                    }
                                />
                            )
                            : null
                    }

                    {
                        mode === "BANK_TRANSFER"
                            ? (
                                <SingleNonCashForm
                                    label="Bank Transfer Reference"
                                    placeholder="Bank transfer reference"
                                    value={
                                        bankReference
                                    }
                                    disabled={
                                        processing
                                    }
                                    onChange={
                                        setBankReference
                                    }
                                />
                            )
                            : null
                    }

                    {
                        mode === "OTHER"
                            ? (
                                <SingleNonCashForm
                                    label="Payment Reference / Note"
                                    placeholder="Payment reference or note"
                                    value={
                                        otherReference
                                    }
                                    disabled={
                                        processing
                                    }
                                    onChange={
                                        setOtherReference
                                    }
                                />
                            )
                            : null
                    }

                    {
                        mode === "MIXED"
                            ? (
                                <div className="mixed-panel">
                                    <div className="mixed-grid">
                                        <MoneyField
                                            label="Cash Allocation"
                                            value={
                                                cashAmount
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setCashAmount
                                            }
                                        />

                                        <MoneyField
                                            label="Cash Received"
                                            value={
                                                cashReceived
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setCashReceived
                                            }
                                        />

                                        <MoneyField
                                            label="Card Amount"
                                            value={
                                                cardAmount
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setCardAmount
                                            }
                                        />

                                        <ReferenceField
                                            label="Card Reference"
                                            value={
                                                cardReference
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setCardReference
                                            }
                                        />

                                        <MoneyField
                                            label="QR Amount"
                                            value={
                                                qrAmount
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setQrAmount
                                            }
                                        />

                                        <ReferenceField
                                            label="QR Reference"
                                            value={
                                                qrReference
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setQrReference
                                            }
                                        />

                                        <MoneyField
                                            label="Bank Transfer"
                                            value={
                                                bankAmount
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setBankAmount
                                            }
                                        />

                                        <ReferenceField
                                            label="Bank Reference"
                                            value={
                                                bankReference
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setBankReference
                                            }
                                        />

                                        <MoneyField
                                            label="Other Amount"
                                            value={
                                                otherAmount
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setOtherAmount
                                            }
                                        />

                                        <ReferenceField
                                            label="Other Reference"
                                            value={
                                                otherReference
                                            }
                                            disabled={
                                                processing
                                            }
                                            onChange={
                                                setOtherReference
                                            }
                                        />
                                    </div>

                                    <div className="mixed-totals">
                                        <div>
                                            <span>
                                                Allocated
                                            </span>

                                            <strong>
                                                {
                                                    paymentMoney(
                                                        mixedAllocated,
                                                    )
                                                }
                                            </strong>
                                        </div>

                                        <div
                                            className={
                                                Math.abs(
                                                    mixedRemaining,
                                                ) <= 0.009
                                                    ? "balanced"
                                                    : "remaining"
                                            }
                                        >
                                            <span>
                                                Remaining
                                            </span>

                                            <strong>
                                                {
                                                    paymentMoney(
                                                        mixedRemaining,
                                                    )
                                                }
                                            </strong>
                                        </div>

                                        {
                                            mixedCash > 0
                                                ? (
                                                    <div>
                                                        <span>
                                                            Cash Change
                                                        </span>

                                                        <strong>
                                                            {
                                                                paymentMoney(
                                                                    mixedCashChange,
                                                                )
                                                            }
                                                        </strong>
                                                    </div>
                                                )
                                                : null
                                        }
                                    </div>
                                </div>
                            )
                            : null
                    }

                    <div className="billing-primary-actions">
                        <button
                            type="button"
                            className="billing-complete-button"
                            disabled={
                                processing
                                ||
                                loadingInvoice
                                ||
                                !invoice
                                ||
                                isPaid
                            }
                            onClick={
                                () => {
                                    void processPayment();
                                }
                            }
                        >
                            {
                                processing
                                    ? "Processing Payment..."
                                    : isPaid
                                        ? "Invoice Paid"
                                        : "Complete Payment"
                            }
                        </button>

                        <button
                            type="button"
                            className="billing-secondary-button"
                            disabled={
                                processing
                                ||
                                !invoice
                            }
                            onClick={
                                () => {
                                    void refresh();
                                }
                            }
                        >
                            {
                                refreshing
                                    ? "Refreshing..."
                                    : "Refresh"
                            }
                        </button>

                        <button
                            type="button"
                            className="billing-secondary-button"
                            disabled={
                                processing
                                ||
                                !invoice
                                ||
                                paidAmount <= 0
                            }
                            onClick={
                                () => {
                                    void reprintReceipt();
                                }
                            }
                        >
                            Reprint Receipt
                        </button>
                    </div>
                </section>

                <aside className="billing-side">
                    {
                        mode === "CASH"
                            ? (
                                <section className="numeric-keypad billing-keypad">
                                    {
                                        [
                                            "7",
                                            "8",
                                            "9",
                                            "4",
                                            "5",
                                            "6",
                                            "1",
                                            "2",
                                            "3",
                                            "00",
                                            "0",
                                            ".",
                                        ].map(
                                            (
                                                key,
                                            ) => (
                                                <button
                                                    key={
                                                        key
                                                    }
                                                    type="button"
                                                    disabled={
                                                        processing
                                                        ||
                                                        isPaid
                                                    }
                                                    onClick={
                                                        () =>
                                                            appendCashReceived(
                                                                key,
                                                            )
                                                    }
                                                >
                                                    {key}
                                                </button>
                                            ),
                                        )
                                    }

                                    <button
                                        type="button"
                                        className="billing-key-clear"
                                        disabled={
                                            processing
                                            ||
                                            isPaid
                                        }
                                        onClick={
                                            () =>
                                                setCashReceived(
                                                    "",
                                                )
                                        }
                                    >
                                        CLEAR
                                    </button>

                                    <button
                                        type="button"
                                        className="billing-key-back"
                                        disabled={
                                            processing
                                            ||
                                            isPaid
                                        }
                                        onClick={
                                            () =>
                                                setCashReceived(
                                                    (
                                                        current,
                                                    ) =>
                                                        current.slice(
                                                            0,
                                                            -1,
                                                        ),
                                                )
                                        }
                                    >
                                        BACK
                                    </button>
                                </section>
                            )
                            : (
                                <section className="billing-card billing-rule-card">
                                    <span className="billing-card-kicker">
                                        HARDWARE RULE
                                    </span>

                                    <h2>
                                        Cash Drawer
                                    </h2>

                                    <div className="hardware-rule opens">
                                        <strong>
                                            Cash / Mixed with Cash
                                        </strong>

                                        <span>
                                            Receipt prints first, then drawer opens.
                                        </span>
                                    </div>

                                    <div className="hardware-rule closed">
                                        <strong>
                                            Card / QR / Bank / Other
                                        </strong>

                                        <span>
                                            Receipt prints. Drawer remains closed.
                                        </span>
                                    </div>

                                    <div className="hardware-rule secure">
                                        <strong>
                                            Receipt Reprint
                                        </strong>

                                        <span>
                                            Drawer never opens during reprint.
                                        </span>
                                    </div>
                                </section>
                            )
                    }
                </aside>
            </div>

            <section className="billing-card">
                <div className="billing-card-header">
                    <div>
                        <span className="billing-card-kicker">
                            HISTORY
                        </span>

                        <h2>
                            Payment History
                        </h2>
                    </div>

                    <span className="history-count">
                        {paymentHistory.length}
                        {" "}
                        payments
                    </span>
                </div>

                {
                    paymentHistory.length === 0
                        ? (
                            <div className="billing-empty-history">
                                No customer payments recorded yet.
                            </div>
                        )
                        : (
                            <div className="payment-history-list">
                                {
                                    paymentHistory.map(
                                        (
                                            payment,
                                            index,
                                        ) => (
                                            <div
                                                className="payment-history-row"
                                                key={
                                                    payment.id
                                                    ??
                                                    `${payment.payment_number ?? "payment"}-${index}`
                                                }
                                            >
                                                <div className="payment-history-method">
                                                    <span>
                                                        {
                                                            paymentMethodLabel(
                                                                payment.payment_method
                                                                ??
                                                                payment.method
                                                                ??
                                                                "OTHER",
                                                            )
                                                        }
                                                    </span>

                                                    <small>
                                                        {
                                                            payment.payment_number
                                                            ??
                                                            `Payment ${index + 1}`
                                                        }
                                                    </small>
                                                </div>

                                                <div className="payment-history-reference">
                                                    <span>
                                                        {
                                                            payment.reference_number
                                                            ??
                                                            "No reference"
                                                        }
                                                    </span>

                                                    <small>
                                                        {
                                                            paymentDateTime(
                                                                payment.paid_at,
                                                            )
                                                        }
                                                    </small>
                                                </div>

                                                <div className="payment-history-amount">
                                                    <strong>
                                                        {
                                                            paymentMoney(
                                                                payment.amount,
                                                            )
                                                        }
                                                    </strong>

                                                    {
                                                        payment.payment_method
                                                            ===
                                                            "CASH"
                                                            &&
                                                            payment.tendered_amount
                                                            !==
                                                            null
                                                            &&
                                                            payment.tendered_amount
                                                            !==
                                                            undefined
                                                            ? (
                                                                <small>
                                                                    Cash received:
                                                                    {" "}
                                                                    {
                                                                        paymentMoney(
                                                                            payment.tendered_amount,
                                                                        )
                                                                    }
                                                                </small>
                                                            )
                                                            : null
                                                    }

                                                    {
                                                        Number(
                                                            payment.change_given
                                                            ??
                                                            0,
                                                        ) > 0
                                                            ? (
                                                                <small>
                                                                    Change returned:
                                                                    {" "}
                                                                    {
                                                                        paymentMoney(
                                                                            payment.change_given,
                                                                        )
                                                                    }
                                                                </small>
                                                            )
                                                            : null
                                                    }
                                                </div>
                                            </div>
                                        ),
                                    )
                                }
                            </div>
                        )
                }
            </section>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Small Components
|--------------------------------------------------------------------------
*/

function SummaryCard(
    {
        label,
        value,
        tone = "neutral",
    }: {
        label:
        string;

        value:
        string;

        tone?:
        "neutral"
        |
        "primary"
        |
        "positive";
    },
) {
    return (
        <div
            className={
                `billing-summary-card ${tone}`
            }
        >
            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>
        </div>
    );
}

function SingleNonCashForm(
    {
        label,
        placeholder,
        value,
        disabled,
        onChange,
    }: {
        label:
        string;

        placeholder:
        string;

        value:
        string;

        disabled:
        boolean;

        onChange:
        (
            value:
                string,
        ) => void;
    },
) {
    return (
        <div className="single-payment-panel">
            <div className="single-payment-total">
                <span>
                    Full Balance
                </span>
            </div>

            <label className="billing-field">
                <span>
                    {label}
                </span>

                <input
                    value={
                        value
                    }
                    placeholder={
                        placeholder
                    }
                    disabled={
                        disabled
                    }
                    onChange={
                        (
                            event,
                        ) =>
                            onChange(
                                event.target.value,
                            )
                    }
                />
            </label>
        </div>
    );
}

function MoneyField(
    {
        label,
        value,
        disabled,
        onChange,
    }: {
        label:
        string;

        value:
        string;

        disabled:
        boolean;

        onChange:
        (
            value:
                string,
        ) => void;
    },
) {
    return (
        <label className="billing-field">
            <span>
                {label}
            </span>

            <input
                type="number"
                min="0"
                step="0.01"
                value={
                    value
                }
                disabled={
                    disabled
                }
                placeholder="0.00"
                onChange={
                    (
                        event,
                    ) =>
                        onChange(
                            event.target.value,
                        )
                }
            />
        </label>
    );
}

function ReferenceField(
    {
        label,
        value,
        disabled,
        onChange,
    }: {
        label:
        string;

        value:
        string;

        disabled:
        boolean;

        onChange:
        (
            value:
                string,
        ) => void;
    },
) {
    return (
        <label className="billing-field">
            <span>
                {label}
            </span>

            <input
                value={
                    value
                }
                disabled={
                    disabled
                }
                placeholder="Optional reference"
                onChange={
                    (
                        event,
                    ) =>
                        onChange(
                            event.target.value,
                        )
                }
            />
        </label>
    );
}

/*
|--------------------------------------------------------------------------
| Styles
|--------------------------------------------------------------------------
*/

const styles = `
  .billing-page {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      color: #0f172a;
  }
  
  .billing-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
  }
  
  .billing-header h1 {
      margin: 4px 0 5px;
      font-size: 31px;
      line-height: 1.1;
      letter-spacing: -.025em;
  }
  
  .billing-header p {
      margin: 0;
      color: #64748b;
      font-size: 14px;
  }
  
  .billing-eyebrow,
  .billing-card-kicker {
      display: block;
      color: #64748b;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .12em;
  }
  
  .billing-status {
      min-width: 110px;
      padding: 11px 17px;
      border-radius: 999px;
      text-align: center;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .05em;
  }
  
  .billing-status.paid {
      color: #166534;
      background: #dcfce7;
      border: 1px solid #bbf7d0;
  }
  
  .billing-status.partial {
      color: #92400e;
      background: #fef3c7;
      border: 1px solid #fde68a;
  }
  
  .billing-status.unpaid {
      color: #991b1b;
      background: #fee2e2;
      border: 1px solid #fecaca;
  }
  
  .billing-alert {
      padding: 14px 16px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
  }
  
  .billing-alert.success {
      color: #166534;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
  }
  
  .billing-alert.error {
      color: #991b1b;
      background: #fef2f2;
      border: 1px solid #fecaca;
  }
  
  .billing-loading {
      padding: 14px;
      text-align: center;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      font-weight: 800;
  }
  
  .billing-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 13px;
  }
  
  .billing-summary-card {
      min-height: 96px;
      padding: 17px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 7px;
      border: 1px solid #e2e8f0;
      border-radius: 15px;
      background: #ffffff;
      box-shadow: 0 5px 18px rgba(15,23,42,.04);
  }
  
  .billing-summary-card span {
      color: #64748b;
      font-size: 12px;
      font-weight: 800;
  }
  
  .billing-summary-card strong {
      font-size: 20px;
  }
  
  .billing-summary-card.primary {
      border-color: #bfdbfe;
      background: #eff6ff;
  }
  
  .billing-summary-card.primary strong {
      color: #1d4ed8;
  }
  
  .billing-summary-card.positive {
      border-color: #bbf7d0;
      background: #f0fdf4;
  }
  
  .billing-summary-card.positive strong {
      color: #15803d;
  }
  
  .billing-main-grid {
      display: grid;
      grid-template-columns: minmax(600px, 1.4fr) minmax(320px, .6fr);
      gap: 20px;
      align-items: start;
  }
  
  .billing-card {
      padding: 21px;
      background: #ffffff;
      border: 1px solid #dbe3ec;
      border-radius: 18px;
      box-shadow: 0 6px 22px rgba(15,23,42,.05);
  }
  
  .billing-card-header {
      margin-bottom: 18px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
  }
  
  .billing-card-header h2 {
      margin: 4px 0 0;
      font-size: 21px;
  }
  
  .billing-balance-badge {
      padding: 8px 12px;
      border-radius: 999px;
      color: #1d4ed8;
      background: #eff6ff;
      font-size: 12px;
      font-weight: 900;
  }
  
  .billing-method-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 9px;
  }
  
  .billing-method {
      min-height: 58px;
      padding: 10px;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      cursor: pointer;
  }
  
  .billing-method.active {
      color: #1d4ed8;
      background: #eff6ff;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(37,99,235,.08);
  }
  
  .billing-method:disabled {
      opacity: .5;
      cursor: not-allowed;
  }
  
  .cash-payment-panel {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
  }
  
  .billing-value-block {
      min-height: 90px;
      padding: 15px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 5px;
      border-radius: 13px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
  }
  
  .billing-value-block span {
      color: #64748b;
      font-size: 11px;
      font-weight: 800;
  }
  
  .billing-value-block strong {
      font-size: 20px;
  }
  
  .billing-value-block.highlight {
      color: #1d4ed8;
      background: #eff6ff;
      border-color: #bfdbfe;
  }
  
  .billing-value-block.change {
      color: #15803d;
      background: #f0fdf4;
      border-color: #bbf7d0;
  }
  
  .single-payment-panel,
  .mixed-panel {
      margin-top: 18px;
  }
  
  .single-payment-total {
      margin-bottom: 12px;
      padding: 13px;
      color: #334155;
      background: #f8fafc;
      border-radius: 11px;
      font-weight: 800;
  }
  
  .billing-field {
      display: flex;
      flex-direction: column;
      gap: 7px;
  }
  
  .billing-field > span {
      color: #334155;
      font-size: 12px;
      font-weight: 800;
  }
  
  .billing-field input {
      width: 100%;
      min-height: 48px;
      box-sizing: border-box;
      padding: 11px 13px;
      color: #0f172a;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font: inherit;
      font-size: 14px;
      outline: none;
  }
  
  .billing-field input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.09);
  }
  
  .mixed-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 12px;
  }
  
  .mixed-totals {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 9px;
  }
  
  .mixed-totals > div {
      padding: 13px;
      border-radius: 11px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
  }
  
  .mixed-totals span,
  .mixed-totals strong {
      display: block;
  }
  
  .mixed-totals span {
      color: #64748b;
      font-size: 11px;
      font-weight: 800;
  }
  
  .mixed-totals strong {
      margin-top: 3px;
  }
  
  .mixed-totals .balanced {
      color: #15803d;
      background: #f0fdf4;
      border-color: #bbf7d0;
  }
  
  .mixed-totals .remaining {
      color: #b91c1c;
      background: #fef2f2;
      border-color: #fecaca;
  }
  
  .billing-primary-actions {
      margin-top: 19px;
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto auto;
      gap: 9px;
  }
  
  .billing-complete-button,
  .billing-secondary-button {
      min-height: 51px;
      padding: 0 17px;
      border-radius: 11px;
      font-size: 14px;
      font-weight: 900;
      cursor: pointer;
  }
  
  .billing-complete-button {
      color: #ffffff;
      background: #15803d;
      border: 1px solid #15803d;
  }
  
  .billing-secondary-button {
      color: #334155;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
  }
  
  .billing-complete-button:disabled,
  .billing-secondary-button:disabled {
      opacity: .5;
      cursor: not-allowed;
  }
  
  .billing-side {
      min-width: 0;
  }
  
  .billing-keypad {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 9px;
      padding: 18px;
      background: #ffffff;
      border: 1px solid #dbe3ec;
      border-radius: 18px;
      box-shadow: 0 6px 22px rgba(15,23,42,.05);
  }
  
  .billing-keypad button {
      min-height: 67px;
      border: 1px solid #dbe3ec;
      border-radius: 12px;
      background: #f8fafc;
      color: #0f172a;
      font-size: 20px;
      font-weight: 900;
      cursor: pointer;
  }
  
  .billing-keypad button:active {
      transform: scale(.98);
  }
  
  .billing-keypad button:disabled {
      opacity: .45;
  }
  
  .billing-keypad .billing-key-clear {
      grid-column: span 2;
      color: #b91c1c;
      background: #fef2f2;
  }
  
  .billing-keypad .billing-key-back {
      color: #92400e;
      background: #fffbeb;
  }
  
  .billing-rule-card h2 {
      margin: 5px 0 17px;
  }
  
  .hardware-rule {
      margin-top: 10px;
      padding: 13px;
      border-radius: 11px;
  }
  
  .hardware-rule strong,
  .hardware-rule span {
      display: block;
  }
  
  .hardware-rule span {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.45;
  }
  
  .hardware-rule.opens {
      color: #166534;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
  }
  
  .hardware-rule.closed {
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
  }
  
  .hardware-rule.secure {
      color: #1e40af;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
  }
  
  .history-count {
      color: #64748b;
      font-size: 12px;
      font-weight: 800;
  }
  
  .payment-history-list {
      display: flex;
      flex-direction: column;
  }
  
  .payment-history-row {
      display: grid;
      grid-template-columns: minmax(180px,.8fr) minmax(220px,1.2fr) auto;
      gap: 15px;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid #eef2f7;
  }
  
  .payment-history-row:last-child {
      border-bottom: 0;
  }
  
  .payment-history-method span,
  .payment-history-method small,
  .payment-history-reference span,
  .payment-history-reference small,
  .payment-history-amount strong,
  .payment-history-amount small {
      display: block;
  }
  
  .payment-history-method span {
      font-weight: 900;
  }
  
  .payment-history-method small,
  .payment-history-reference small,
  .payment-history-reference span,
  .payment-history-amount small {
      margin-top: 3px;
      color: #64748b;
      font-size: 11px;
  }
  
  .payment-history-amount {
      text-align: right;
  }
  
  .payment-history-amount strong {
      color: #15803d;
      font-size: 16px;
  }
  
  .billing-empty-history,
  .billing-empty-card,
  .billing-warning-card {
      padding: 36px;
      text-align: center;
      color: #64748b;
  }
  
  .billing-empty-card,
  .billing-warning-card {
      background: #ffffff;
      border: 1px solid #dbe3ec;
      border-radius: 18px;
  }
  
  .billing-empty-card h2 {
      margin: 11px 0 6px;
      color: #0f172a;
  }
  
  .billing-empty-card p {
      max-width: 500px;
      margin: 0 auto;
  }
  
  .billing-empty-icon {
      width: 58px;
      height: 58px;
      margin: 0 auto;
      display: grid;
      place-items: center;
      border-radius: 16px;
      color: #1d4ed8;
      background: #eff6ff;
      font-weight: 900;
  }
  
  .billing-warning-card strong,
  .billing-warning-card span {
      display: block;
  }
  
  .billing-warning-card strong {
      color: #92400e;
      font-size: 18px;
  }
  
  .billing-warning-card span {
      margin-top: 7px;
  }
  
  @media (max-width: 1180px) {
      .billing-summary-grid {
          grid-template-columns: repeat(2, minmax(0,1fr));
      }
  
      .billing-main-grid {
          grid-template-columns: 1fr;
      }
  }
  
  @media (max-width: 800px) {
      .billing-header {
          flex-direction: column;
      }
  
      .billing-summary-grid,
      .billing-method-grid,
      .cash-payment-panel,
      .mixed-grid,
      .mixed-totals,
      .billing-primary-actions {
          grid-template-columns: 1fr;
      }
  
      .payment-history-row {
          grid-template-columns: 1fr;
      }
  
      .payment-history-amount {
          text-align: left;
      }
  }
  `;