export type CashDrawerPin = 0 | 1;

export type ReceiptPrinterTransport = "AUTO" | "USB" | "LAN";

export type ActiveReceiptPrinterTransport = "USB" | "LAN";

export interface ReceiptPrinterSettings {
  /*
   * AUTO:
   *   Windows       -> USB first, LAN fallback
   *   macOS/Linux   -> LAN first, USB fallback
   *
   * USB:
   *   Force local operating-system printer queue.
   *
   * LAN:
   *   Force direct TCP ESC/POS printing.
   */
  transport: ReceiptPrinterTransport;

  /*
   * Exact local operating-system printer queue name.
   *
   * Example:
   * Printer_POS_80_2
   *
   * Required for USB mode.
   */
  printerName: string;

  /*
   * Network printer IP / hostname.
   *
   * Example:
   * 192.168.1.101
   *
   * Required for LAN mode.
   */
  host: string;

  /*
   * ESC/POS RAW TCP port.
   *
   * Normally 9100.
   */
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

  /*
   * The transport that was actually used after AUTO resolution.
   */
  transportUsed?: ActiveReceiptPrinterTransport;

  message: string;
}

export interface ReceiptPrinterResult {
  success: boolean;

  printerName: string;

  host: string;

  port: number;

  transportUsed?: ActiveReceiptPrinterTransport;

  bytesWritten: number;

  message: string;
}

export interface CashDrawerResult {
  success: boolean;

  printerName: string;

  host: string;

  port: number;

  transportUsed?: ActiveReceiptPrinterTransport;

  bytesWritten: number;

  message: string;
}

/*
|--------------------------------------------------------------------------
| Customer Receipt Add-on
|--------------------------------------------------------------------------
*/

export interface CustomerReceiptAddon {
  name: string;

  quantity: number;

  unitPrice: number;

  lineTotal: number;
}

/*
|--------------------------------------------------------------------------
| Customer Receipt Item
|--------------------------------------------------------------------------
*/

export interface CustomerReceiptItem {
  name: string;

  variant?: string | null;

  quantity: number;

  unitPrice: number;

  lineTotal: number;

  addons: CustomerReceiptAddon[];
}

/*
|--------------------------------------------------------------------------
| Customer Receipt Payment
|--------------------------------------------------------------------------
*/

export interface CustomerReceiptPayment {
  method: string;

  /*
   * Amount applied to invoice.
   */
  amount: number;

  /*
   * Actual cash supplied by customer for CASH payments.
   */
  tenderedAmount?: number | null;

  /*
   * Cash returned.
   */
  changeGiven?: number;

  referenceNumber?: string | null;

  /*
   * Authoritative payment timestamp.
   */
  paidAt?: string | null;
}

/*
|--------------------------------------------------------------------------
| Customer Receipt Payload
|--------------------------------------------------------------------------
*/

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

  /*
   * Physical money/tender received from customer.
   *
   * Cash:
   * tendered_amount
   *
   * Non-cash:
   * payment.amount
   */
  amountReceived: number;

  /*
   * Amount applied against the invoice.
   */
  paidAmount: number;

  /*
   * Amount returned to customer.
   */
  changeAmount: number;

  balanceDue: number;

  paymentStatus: string;

  payments: CustomerReceiptPayment[];

  /*
   * Latest authoritative payment time.
   */
  paidAt?: string | null;

  /*
   * Invoice issue time retained as fallback.
   */
  issuedAt?: string | null;

  printedAt: string;

  copyLabel?: string | null;
}
