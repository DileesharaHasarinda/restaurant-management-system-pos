import type { CustomerReceiptPayload } from "../../receiptPrinterTypes";

import type { CashierInvoice, CustomerPaymentRecord } from "./types";

export const buildCustomerReceiptPayload = (
  invoice: CashierInvoice,

  payments: CustomerPaymentRecord[],

  copyLabel: string | null = null
): CustomerReceiptPayload => ({
  invoiceNumber: invoice.invoice_number,

  tableName: invoice.table_name,

  customerName: invoice.customer.name,

  customerPhone: invoice.customer.phone,

  items: (invoice.items ?? []).map((item) => ({
    name: item.name,

    variant: item.variant,

    quantity: Number(item.quantity),

    unitPrice: Number(item.unit_price),

    lineTotal: Number(item.line_total),
  })),

  subtotal: Number(invoice.totals.subtotal),

  discount: Number(invoice.totals.discount),

  serviceCharge: Number(invoice.totals.service_charge),

  tax: Number(invoice.totals.tax),

  grandTotal: Number(invoice.totals.grand_total),

  paidAmount: Number(invoice.payment.paid_amount),

  changeAmount: Number(invoice.payment.change_amount),

  balanceDue: Number(invoice.payment.balance_due),

  paymentStatus: invoice.payment.status,

  payments: payments.map((payment) => ({
    method: payment.payment_method ?? payment.method ?? "OTHER",

    amount: Number(payment.amount),

    tenderedAmount: payment.tendered_amount ?? null,

    changeGiven: Number(payment.change_given ?? 0),

    referenceNumber: payment.reference_number ?? null,
  })),

  issuedAt: invoice.issued_at,

  printedAt: new Date().toISOString(),

  copyLabel: copyLabel,
});
