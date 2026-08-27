export type CashDrawerPin = 0 | 1;

export interface ReceiptPrinterSettings {
  printerName: string;

  host: string;

  port: number;

  paperWidthMm: 80;

  connectTimeoutMs: number;

  drawerPin: CashDrawerPin;

  drawerPulseOnMs: number;

  drawerPulseOffMs: number;
}

export interface ReceiptPrinterConnectionResult {
  success: boolean;

  printerName: string;

  host: string;

  port: number;

  message: string;
}

export interface ReceiptPrinterResult {
  success: boolean;

  printerName: string;

  host: string;

  port: number;

  bytesWritten: number;

  message: string;
}

export interface CashDrawerResult {
  success: boolean;

  printerName: string;

  host: string;

  port: number;

  bytesWritten: number;

  message: string;
}

export interface CustomerReceiptItem {
  name: string;

  variant?: string | null;

  quantity: number;

  unitPrice: number;

  lineTotal: number;
}

export interface CustomerReceiptPayment {
  method: string;

  amount: number;

  tenderedAmount?: number | null;

  changeGiven?: number;

  referenceNumber?: string | null;
}

export interface CustomerReceiptPayload {
  invoiceNumber: string;

  tableName?: string | null;

  customerName?: string | null;

  customerPhone?: string | null;

  items: CustomerReceiptItem[];

  subtotal: number;

  discount: number;

  serviceCharge: number;

  tax: number;

  grandTotal: number;

  paidAmount: number;

  changeAmount: number;

  balanceDue: number;

  paymentStatus: string;

  payments: CustomerReceiptPayment[];

  issuedAt?: string | null;

  printedAt: string;

  copyLabel?: string | null;
}
