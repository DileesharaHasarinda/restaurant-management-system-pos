import type {
  CustomerReceiptAddon,
  CustomerReceiptPayment,
  CustomerReceiptPayload,
} from "../../receiptPrinterTypes";

import type {
  CashierInvoice,
  CashierInvoiceAddon,
  CustomerPaymentRecord,
} from "./types";

/*
|--------------------------------------------------------------------------
| Number Helpers
|--------------------------------------------------------------------------
*/

const numberValue = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : fallback;
};

/*
|--------------------------------------------------------------------------
| Normalize Invoice Add-on
|--------------------------------------------------------------------------
*/

const mapAddon = (addon: CashierInvoiceAddon): CustomerReceiptAddon => {
  const quantity = numberValue(addon.quantity, 1);

  const unitPrice = numberValue(addon.unit_price ?? addon.price ?? 0);

  const providedLineTotal = addon.line_total ?? addon.total;

  const lineTotal =
    providedLineTotal !== null && providedLineTotal !== undefined
      ? numberValue(providedLineTotal)
      : quantity * unitPrice;

  return {
    name:
      addon.addon_name_snapshot ?? addon.addon_name ?? addon.name ?? "Addon",

    quantity,

    unitPrice,

    lineTotal,
  };
};

/*
|--------------------------------------------------------------------------
| Normalize Payment
|--------------------------------------------------------------------------
*/

const mapPayment = (
  payment: CustomerPaymentRecord
): CustomerReceiptPayment => ({
  method: payment.payment_method ?? payment.method ?? "OTHER",

  amount: numberValue(payment.amount),

  tenderedAmount:
    payment.tendered_amount !== null && payment.tendered_amount !== undefined
      ? numberValue(payment.tendered_amount)
      : null,

  changeGiven: numberValue(payment.change_given ?? 0),

  referenceNumber: payment.reference_number ?? null,

  paidAt: payment.paid_at ?? null,
});

/*
|--------------------------------------------------------------------------
| Amount Actually Received From Customer
|--------------------------------------------------------------------------
|
| CASH:
|
| amount           = amount applied to invoice
| tendered_amount  = actual cash handed over
|
| Example:
|
| Invoice balance  = 1,500
| Customer gives   = 2,000
| amount            = 1,500
| tendered_amount   = 2,000
| change_given      =   500
|
| CARD / QR / BANK / OTHER:
|
| There is no physical cash tender amount, therefore payment.amount is the
| amount received.
|--------------------------------------------------------------------------
*/

const calculateAmountReceived = (payments: CustomerReceiptPayment[]): number =>
  payments.reduce((total, payment) => {
    const method = payment.method.trim().toUpperCase();

    if (
      method === "CASH" &&
      payment.tenderedAmount !== null &&
      payment.tenderedAmount !== undefined
    ) {
      return total + numberValue(payment.tenderedAmount);
    }

    return total + numberValue(payment.amount);
  }, 0);

/*
|--------------------------------------------------------------------------
| Total Change
|--------------------------------------------------------------------------
|
| Prefer the individual payment history because it records the actual
| change associated with each cash payment.
|
| If old payment history does not contain change_given, the mapper falls
| back to invoice.payment.change_amount.
|--------------------------------------------------------------------------
*/

const calculateChangeAmount = (
  payments: CustomerPaymentRecord[],
  invoiceChangeAmount: number
): number => {
  const hasRecordedChange = payments.some(
    (payment) =>
      payment.change_given !== null && payment.change_given !== undefined
  );

  if (!hasRecordedChange) {
    return numberValue(invoiceChangeAmount);
  }

  return payments.reduce(
    (total, payment) => total + numberValue(payment.change_given ?? 0),
    0
  );
};

/*
|--------------------------------------------------------------------------
| Payment Timestamp Parsing
|--------------------------------------------------------------------------
|
| Laravel normally serializes Carbon timestamps as ISO-8601.
|
| This also supports a plain:
|
| YYYY-MM-DD HH:mm:ss
|
| timestamp by treating it as Sri Lanka local time.
|--------------------------------------------------------------------------
*/

const timestampMilliseconds = (
  value: string | null | undefined
): number | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const plainLocalTimestamp =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

  const normalized = plainLocalTimestamp.test(trimmed)
    ? `${trimmed.replace(" ", "T")}+05:30`
    : trimmed;

  const milliseconds = new Date(normalized).getTime();

  return Number.isNaN(milliseconds) ? null : milliseconds;
};

/*
|--------------------------------------------------------------------------
| Latest Payment Time
|--------------------------------------------------------------------------
|
| Customer receipt date/time should represent the payment transaction,
| not merely the time at which the invoice was generated.
|--------------------------------------------------------------------------
*/

const latestPaymentDateTime = (
  payments: CustomerPaymentRecord[]
): string | null => {
  let latestValue: string | null = null;

  let latestMilliseconds = Number.NEGATIVE_INFINITY;

  for (const payment of payments) {
    if (!payment.paid_at) {
      continue;
    }

    const milliseconds = timestampMilliseconds(payment.paid_at);

    if (milliseconds === null) {
      continue;
    }

    if (milliseconds > latestMilliseconds) {
      latestMilliseconds = milliseconds;

      latestValue = payment.paid_at;
    }
  }

  return latestValue;
};

/*
|--------------------------------------------------------------------------
| Build Customer Receipt Payload
|--------------------------------------------------------------------------
*/

export const buildCustomerReceiptPayload = (
  invoice: CashierInvoice,

  payments: CustomerPaymentRecord[],

  copyLabel: string | null = null
): CustomerReceiptPayload => {
  const mappedPayments = payments.map(mapPayment);

  const amountReceived = calculateAmountReceived(mappedPayments);

  const changeAmount = calculateChangeAmount(
    payments,
    invoice.payment.change_amount
  );

  const paidAt = latestPaymentDateTime(payments);

  return {
    invoiceNumber: invoice.invoice_number,

    tableName: invoice.table_name,

    customerName: invoice.customer.name,

    customerPhone: invoice.customer.phone,

    items: (invoice.items ?? []).map((item) => ({
      name: item.name,

      variant: item.variant,

      quantity: numberValue(item.quantity),

      unitPrice: numberValue(item.unit_price),

      lineTotal: numberValue(item.line_total),

      addons: (item.addons ?? []).map(mapAddon),
    })),

    subtotal: numberValue(invoice.totals.subtotal),

    discount: numberValue(invoice.totals.discount),

    serviceCharge: numberValue(invoice.totals.service_charge),

    tax: numberValue(invoice.totals.tax),

    grandTotal: numberValue(invoice.totals.grand_total),

    /*
     * Actual money/tender received from the customer.
     */
    amountReceived,

    /*
     * Amount applied to invoice accounting.
     */
    paidAmount: numberValue(invoice.payment.paid_amount),

    /*
     * Actual change returned.
     */
    changeAmount,

    balanceDue: numberValue(invoice.payment.balance_due),

    paymentStatus: invoice.payment.status,

    payments: mappedPayments,

    /*
     * Prefer payment time for receipt date/time.
     */
    paidAt,

    /*
     * Retain invoice issue time as fallback/history.
     */
    issuedAt: invoice.issued_at,

    /*
     * Final fallback if there is neither payment nor invoice timestamp.
     */
    printedAt: new Date().toISOString(),

    copyLabel: copyLabel,
  };
};
