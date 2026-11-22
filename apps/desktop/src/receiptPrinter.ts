import { app } from "electron";

import fs from "node:fs/promises";

import path from "node:path";

import { createConnection } from "node:net";

import { sendRawToLocalPrinter, testLocalRawPrinter } from "./localRawPrinter";

import type {
  CashDrawerResult,
  CustomerReceiptPayload,
  ReceiptPrinterConnectionResult,
  ReceiptPrinterResult,
  ReceiptPrinterSettings,
  ActiveReceiptPrinterTransport,
} from "./receiptPrinterTypes";

/*
|--------------------------------------------------------------------------
| Settings
|--------------------------------------------------------------------------
*/

const SETTINGS_FILE = "restaurant-pos-receipt-printer.json";

const LOCAL_PRINTER_HOST = "LOCAL_USB";

const LOCAL_PRINTER_PORT = 0;

const DEFAULT_NETWORK_HOST = "192.168.1.101";

const DEFAULT_NETWORK_PORT = 9100;

const DEFAULT_CONNECT_TIMEOUT_MS = 4000;

const DEFAULT_DRAWER_PULSE_ON_MS = 50;

/*
 * XP-Q80B + HER-405 was verified repeatedly over TCP using:
 *
 * ESC p 0 25 25
 *
 * 25 x 2 ms = approximately 50 ms.
 */
const DEFAULT_DRAWER_PULSE_OFF_MS = 50;

const PAPER_CHARACTERS = 48;

/*
|--------------------------------------------------------------------------
| Receipt Time Zone
|--------------------------------------------------------------------------
*/

const RECEIPT_TIME_ZONE = "Asia/Colombo";

/*
|--------------------------------------------------------------------------
| ESC/POS Commands
|--------------------------------------------------------------------------
*/

const ESC = 0x1b;

const GS = 0x1d;

const INITIALIZE = Buffer.from([ESC, 0x40]);

const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);

const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);

const BOLD_ON = Buffer.from([ESC, 0x45, 0x01]);

const BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);

const FULL_CUT = Buffer.from([GS, 0x56, 0x00]);

/*
|--------------------------------------------------------------------------
| Settings Path
|--------------------------------------------------------------------------
*/

const settingsPath = (): string =>
  path.join(app.getPath("userData"), SETTINGS_FILE);

/*
|--------------------------------------------------------------------------
| Default Cashier Printer Settings
|--------------------------------------------------------------------------
*/

export const defaultReceiptPrinterSettings = (): ReceiptPrinterSettings => ({
  /*
   * AUTO:
   *
   * Windows:
   *   USB first -> LAN fallback on a detectable USB error.
   *
   * macOS / Linux:
   *   LAN first -> USB fallback.
   *
   * We intentionally prefer LAN on macOS because some CUPS / USB
   * thermal-printer queues can accept a job without reliably completing
   * repeated raw ESC/POS jobs.
   */
  transport: "AUTO",

  printerName: "",

  host: DEFAULT_NETWORK_HOST,

  port: DEFAULT_NETWORK_PORT,

  paperWidthMm: 80,

  connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,

  drawerPin: 0,

  drawerPulseOnMs: DEFAULT_DRAWER_PULSE_ON_MS,

  drawerPulseOffMs: DEFAULT_DRAWER_PULSE_OFF_MS,
});

/*
|--------------------------------------------------------------------------
| Normalize Settings
|--------------------------------------------------------------------------
*/

const normaliseSettings = (
  value: Partial<ReceiptPrinterSettings>
): ReceiptPrinterSettings => {
  const defaults = defaultReceiptPrinterSettings();

  const timeout = Number(value.connectTimeoutMs ?? defaults.connectTimeoutMs);

  const pin = Number(value.drawerPin ?? defaults.drawerPin);

  const pulseOn = Number(value.drawerPulseOnMs ?? defaults.drawerPulseOnMs);

  const pulseOff = Number(value.drawerPulseOffMs ?? defaults.drawerPulseOffMs);

  const port = Number(value.port ?? defaults.port);

  const requestedTransport = String(value.transport ?? defaults.transport)
    .trim()
    .toUpperCase();

  const transport =
    requestedTransport === "USB" || requestedTransport === "LAN"
      ? requestedTransport
      : "AUTO";

  const savedHost = String(value.host ?? "").trim();

  /*
   * Backward compatibility:
   *
   * Older versions stored:
   *
   * host = LOCAL_USB
   * port = 0
   *
   * Convert those old settings to the new LAN fallback defaults.
   */
  const host =
    !savedHost || savedHost === LOCAL_PRINTER_HOST ? defaults.host : savedHost;

  return {
    transport,

    printerName: String(value.printerName ?? defaults.printerName).trim(),

    host,

    port:
      Number.isInteger(port) && port >= 1 && port <= 65535
        ? port
        : defaults.port,

    paperWidthMm: 80,

    connectTimeoutMs:
      Number.isFinite(timeout) && timeout >= 1000 && timeout <= 30000
        ? Math.round(timeout)
        : defaults.connectTimeoutMs,

    drawerPin: pin === 1 ? 1 : 0,

    drawerPulseOnMs:
      Number.isFinite(pulseOn) && pulseOn >= 2 && pulseOn <= 510
        ? Math.round(pulseOn)
        : defaults.drawerPulseOnMs,

    drawerPulseOffMs:
      Number.isFinite(pulseOff) && pulseOff >= 2 && pulseOff <= 510
        ? Math.round(pulseOff)
        : defaults.drawerPulseOffMs,
  };
};

/*
|--------------------------------------------------------------------------
| Load Settings
|--------------------------------------------------------------------------
*/

export const loadReceiptPrinterSettings =
  async (): Promise<ReceiptPrinterSettings> => {
    try {
      const raw = await fs.readFile(settingsPath(), "utf8");

      const parsed = JSON.parse(raw) as Partial<ReceiptPrinterSettings>;

      return normaliseSettings(parsed);
    } catch {
      return defaultReceiptPrinterSettings();
    }
  };

/*
|--------------------------------------------------------------------------
| Save Settings
|--------------------------------------------------------------------------
*/

export const saveReceiptPrinterSettings = async (
  value: Partial<ReceiptPrinterSettings>
): Promise<ReceiptPrinterSettings> => {
  const current = await loadReceiptPrinterSettings();

  const next = normaliseSettings({
    ...current,
    ...value,
  });

  await fs.mkdir(path.dirname(settingsPath()), {
    recursive: true,
  });

  await fs.writeFile(
    settingsPath(),

    JSON.stringify(next, null, 2),

    "utf8"
  );

  return next;
};

/*
|--------------------------------------------------------------------------
| Transport Validation
|--------------------------------------------------------------------------
*/

const assertUsbConfigured = (settings: ReceiptPrinterSettings): void => {
  if (!settings.printerName.trim()) {
    throw new Error(
      "USB receipt printer name is not configured. Enter the exact local operating-system printer queue name."
    );
  }
};

const assertLanConfigured = (settings: ReceiptPrinterSettings): void => {
  if (!settings.host.trim()) {
    throw new Error("LAN receipt printer IP address / host is not configured.");
  }

  if (
    !Number.isInteger(settings.port) ||
    settings.port < 1 ||
    settings.port > 65535
  ) {
    throw new Error("LAN receipt printer TCP port is invalid.");
  }
};

/*
|--------------------------------------------------------------------------
| AUTO Transport Order
|--------------------------------------------------------------------------
|
| Windows:
|   USB -> LAN fallback
|
| macOS / Linux:
|   LAN -> USB fallback
|
| Why:
| - Windows USB RAW printing is retained for deployments where it works.
| - The XP-Q80B used during development was verified as reliable over
|   direct TCP 9100 on macOS.
|--------------------------------------------------------------------------
*/

const transportOrder = (
  settings: ReceiptPrinterSettings
): ActiveReceiptPrinterTransport[] => {
  if (settings.transport === "USB") {
    return ["USB"];
  }

  if (settings.transport === "LAN") {
    return ["LAN"];
  }

  return process.platform === "win32" ? ["USB", "LAN"] : ["LAN", "USB"];
};

/*
|--------------------------------------------------------------------------
| LAN / TCP RAW Send
|--------------------------------------------------------------------------
*/

const sendRawToNetworkPrinter = async (
  settings: ReceiptPrinterSettings,
  data: Buffer
): Promise<number> => {
  assertLanConfigured(settings);

  return new Promise<number>((resolve, reject) => {
    let settled = false;

    const socket = createConnection({
      host: settings.host,
      port: settings.port,
    });

    socket.setNoDelay(true);

    const finishWithError = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;

      clearTimeout(timer);

      socket.destroy();

      reject(error);
    };

    const timer = setTimeout(() => {
      finishWithError(
        new Error(
          `LAN receipt printer connection timed out after ${settings.connectTimeoutMs}ms (${settings.host}:${settings.port}).`
        )
      );
    }, settings.connectTimeoutMs);

    socket.once("error", (error) => {
      finishWithError(error);
    });

    socket.once("connect", () => {
      socket.write(data, (error) => {
        if (error) {
          finishWithError(error);

          return;
        }

        socket.end(() => {
          if (settled) {
            return;
          }

          settled = true;

          clearTimeout(timer);

          resolve(data.length);
        });
      });
    });
  });
};

/*
|--------------------------------------------------------------------------
| LAN Connection Test
|--------------------------------------------------------------------------
*/

const testNetworkPrinterConnection = async (
  settings: ReceiptPrinterSettings
): Promise<void> => {
  assertLanConfigured(settings);

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const socket = createConnection({
      host: settings.host,
      port: settings.port,
    });

    socket.setNoDelay(true);

    const finishWithError = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;

      clearTimeout(timer);

      socket.destroy();

      reject(error);
    };

    const timer = setTimeout(() => {
      finishWithError(
        new Error(
          `LAN receipt printer connection timed out after ${settings.connectTimeoutMs}ms (${settings.host}:${settings.port}).`
        )
      );
    }, settings.connectTimeoutMs);

    socket.once("error", (error) => {
      finishWithError(error);
    });

    socket.once("connect", () => {
      if (settled) {
        return;
      }

      settled = true;

      clearTimeout(timer);

      socket.destroy();

      resolve();
    });
  });
};

/*
|--------------------------------------------------------------------------
| Per-Transport Send
|--------------------------------------------------------------------------
*/

interface RawSendResult {
  bytesWritten: number;

  transportUsed: ActiveReceiptPrinterTransport;
}

const sendRawUsingTransport = async (
  transport: ActiveReceiptPrinterTransport,
  settings: ReceiptPrinterSettings,
  data: Buffer
): Promise<RawSendResult> => {
  if (transport === "USB") {
    assertUsbConfigured(settings);

    const bytesWritten = await sendRawToLocalPrinter(
      settings.printerName,
      data
    );

    return {
      bytesWritten,
      transportUsed: "USB",
    };
  }

  const bytesWritten = await sendRawToNetworkPrinter(settings, data);

  return {
    bytesWritten,
    transportUsed: "LAN",
  };
};

/*
|--------------------------------------------------------------------------
| Send RAW With AUTO Fallback
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| An operating-system spooler can sometimes accept a USB job even when the
| physical printer does not complete it. That kind of silent hardware/driver
| failure cannot be detected reliably after lp/spool acceptance.
|
| Therefore:
|
| - AUTO on Windows prefers USB because that deployment is expected to use
|   the working Windows USB driver.
| - AUTO on macOS/Linux prefers LAN because direct TCP 9100 was verified.
| - The UI also exposes explicit USB and LAN modes for manual override.
|--------------------------------------------------------------------------
*/

const sendRaw = async (
  settings: ReceiptPrinterSettings,
  data: Buffer
): Promise<RawSendResult> => {
  const transports = transportOrder(settings);

  const errors: string[] = [];

  for (const transport of transports) {
    try {
      return await sendRawUsingTransport(transport, settings, data);
    } catch (exception) {
      const message =
        exception instanceof Error ? exception.message : String(exception);

      errors.push(`${transport}: ${message}`);
    }
  }

  throw new Error(
    `Cashier receipt printer failed using ${transports.join(
      " -> "
    )}. ${errors.join(" | ")}`
  );
};

/*
|--------------------------------------------------------------------------
| Per-Transport Connection Test
|--------------------------------------------------------------------------
*/

const testTransport = async (
  transport: ActiveReceiptPrinterTransport,
  settings: ReceiptPrinterSettings
): Promise<void> => {
  if (transport === "USB") {
    assertUsbConfigured(settings);

    await testLocalRawPrinter(settings.printerName);

    return;
  }

  await testNetworkPrinterConnection(settings);
};

/*
|--------------------------------------------------------------------------
| Printer Test
|--------------------------------------------------------------------------
*/

export const testReceiptPrinterConnection = async (
  settings: ReceiptPrinterSettings
): Promise<ReceiptPrinterConnectionResult> => {
  const transports = transportOrder(settings);

  const errors: string[] = [];

  for (const transport of transports) {
    try {
      await testTransport(transport, settings);

      return {
        success: true,

        printerName: settings.printerName,

        host: transport === "USB" ? LOCAL_PRINTER_HOST : settings.host,

        port: transport === "USB" ? LOCAL_PRINTER_PORT : settings.port,

        transportUsed: transport,

        message:
          transport === "USB"
            ? "Cashier receipt printer is available through the local / USB printer queue."
            : `Cashier receipt printer is reachable through LAN at ${settings.host}:${settings.port}.`,
      };
    } catch (exception) {
      const message =
        exception instanceof Error ? exception.message : String(exception);

      errors.push(`${transport}: ${message}`);
    }
  }

  throw new Error(
    `Cashier receipt printer connection test failed using ${transports.join(
      " -> "
    )}. ${errors.join(" | ")}`
  );
};

/*
|--------------------------------------------------------------------------
| Cash Drawer Pulse
|--------------------------------------------------------------------------
*/

const pulseUnit = (milliseconds: number): number => {
  const value = Math.round(milliseconds / 2);

  return Math.max(
    1,

    Math.min(255, value)
  );
};

/*
|--------------------------------------------------------------------------
| Build Drawer ESC/POS Pulse
|--------------------------------------------------------------------------
|
| ESC p m t1 t2
|--------------------------------------------------------------------------
*/

export const buildCashDrawerPulseBuffer = (
  settings: ReceiptPrinterSettings
): Buffer => {
  const pulse = Buffer.from([
    ESC,

    0x70,

    settings.drawerPin,

    pulseUnit(settings.drawerPulseOnMs),

    pulseUnit(settings.drawerPulseOffMs),
  ]);

  return Buffer.concat([INITIALIZE, pulse]);
};

/*
|--------------------------------------------------------------------------
| Pulse Cash Drawer
|--------------------------------------------------------------------------
*/

export const pulseCashDrawer = async (
  settings: ReceiptPrinterSettings
): Promise<CashDrawerResult> => {
  const data = buildCashDrawerPulseBuffer(settings);

  const result = await sendRaw(settings, data);

  const host =
    result.transportUsed === "USB" ? LOCAL_PRINTER_HOST : settings.host;

  const port =
    result.transportUsed === "USB" ? LOCAL_PRINTER_PORT : settings.port;

  return {
    success: true,

    printerName: settings.printerName,

    host,

    port,

    transportUsed: result.transportUsed,

    bytesWritten: result.bytesWritten,

    message:
      result.transportUsed === "USB"
        ? "Cash drawer pulse sent through the local / USB receipt printer DK port successfully."
        : `Cash drawer pulse sent through LAN ${settings.host}:${settings.port} to the receipt printer DK port successfully.`,
  };
};

/*
|--------------------------------------------------------------------------
| Receipt Text Helpers
|--------------------------------------------------------------------------
*/

const printableText = (value: unknown): string =>
  String(value ?? "").replace(/[^\x20-\x7E\n\r\t]/g, "?");

const receiptText = (value: unknown): Buffer =>
  Buffer.from(printableText(value), "ascii");

const separator = (character = "-"): string =>
  character.repeat(PAPER_CHARACTERS);

/*
|--------------------------------------------------------------------------
| Money
|--------------------------------------------------------------------------
*/

const receiptMoney = (value: number): string => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return amount.toFixed(2);
};

/*
|--------------------------------------------------------------------------
| Quantity
|--------------------------------------------------------------------------
*/

const receiptQuantity = (value: number): string => {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    return "0";
  }

  if (Number.isInteger(quantity)) {
    return String(quantity);
  }

  return quantity.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
};

/*
|--------------------------------------------------------------------------
| Receipt Date Parser
|--------------------------------------------------------------------------
|
| Laravel ISO timestamps:
|
| 2026-09-03T07:45:00.000000Z
|
| are parsed normally.
|
| A plain database timestamp:
|
| 2026-09-03 13:15:00
|
| has no timezone information, therefore it is interpreted as Sri Lanka
| local time (+05:30).
|--------------------------------------------------------------------------
*/

const parseReceiptDate = (value: string | null | undefined): Date => {
  if (!value) {
    return new Date();
  }

  const trimmed = value.trim();

  const plainTimestamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

  const normalized = plainTimestamp.test(trimmed)
    ? `${trimmed.replace(" ", "T")}+05:30`
    : trimmed;

  return new Date(normalized);
};

/*
|--------------------------------------------------------------------------
| Receipt Date / Time
|--------------------------------------------------------------------------
|
| The time zone is explicit so the receipt does not depend on:
|
| - Mac timezone
| - Windows timezone
| - Electron renderer timezone
|
| All Palmyrah POS customer receipts are printed in Sri Lanka time.
|--------------------------------------------------------------------------
*/

const receiptDateTime = (value: string | null | undefined): string => {
  const date = parseReceiptDate(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: RECEIPT_TIME_ZONE,

    day: "2-digit",

    month: "short",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit",

    hour12: true,
  }).format(date);

  return formatted
    .replace(",", "")
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
};

/*
|--------------------------------------------------------------------------
| Left / Right Receipt Line
|--------------------------------------------------------------------------
*/

const leftRight = (
  left: string,

  right: string
): string => {
  const cleanLeft = printableText(left);

  const cleanRight = printableText(right);

  const available = PAPER_CHARACTERS - cleanRight.length;

  if (available <= 1) {
    return `${cleanLeft}\n${cleanRight}`;
  }

  const trimmedLeft = cleanLeft.slice(0, available - 1);

  const spaces = Math.max(
    1,

    PAPER_CHARACTERS - trimmedLeft.length - cleanRight.length
  );

  return `${trimmedLeft}${" ".repeat(spaces)}${cleanRight}`;
};

/*
|--------------------------------------------------------------------------
| Payment Method Label
|--------------------------------------------------------------------------
*/

const receiptPaymentMethod = (value: string): string =>
  printableText(value).replace(/_/g, " ").toUpperCase();

/*
|--------------------------------------------------------------------------
| Build Customer Receipt
|--------------------------------------------------------------------------
*/

export const buildCustomerReceiptBuffer = (
  payload: CustomerReceiptPayload
): Buffer => {
  const buffers: Buffer[] = [];

  buffers.push(INITIALIZE);

  /*
  |--------------------------------------------------------------------------
  | Header
  |--------------------------------------------------------------------------
  */

  buffers.push(
    ALIGN_CENTER,

    BOLD_ON,

    receiptText("RESTAURANT\n"),

    receiptText("CUSTOMER RECEIPT\n"),

    BOLD_OFF
  );

  if (payload.copyLabel) {
    buffers.push(
      BOLD_ON,

      receiptText(`*** ${payload.copyLabel.toUpperCase()} ***\n`),

      BOLD_OFF
    );
  }

  buffers.push(
    receiptText(`${separator("=")}\n`),

    ALIGN_LEFT
  );

  /*
  |--------------------------------------------------------------------------
  | Invoice Information
  |--------------------------------------------------------------------------
  */

  buffers.push(receiptText(`INVOICE: ${payload.invoiceNumber}\n`));

  if (payload.tableName) {
    buffers.push(receiptText(`TABLE  : ${payload.tableName}\n`));
  }

  /*
   * Prefer authoritative payment time.
   *
   * Fallback:
   * invoice issued time
   * then printer execution time.
   */
  buffers.push(
    receiptText(
      `DATE   : ${receiptDateTime(
        payload.paidAt ?? payload.issuedAt ?? payload.printedAt
      )}\n`
    )
  );

  if (payload.customerName) {
    buffers.push(receiptText(`CUSTOMER: ${payload.customerName}\n`));
  }

  if (payload.customerPhone) {
    buffers.push(receiptText(`PHONE   : ${payload.customerPhone}\n`));
  }

  buffers.push(receiptText(`${separator()}\n`));

  /*
  |--------------------------------------------------------------------------
  | Items + Add-ons
  |--------------------------------------------------------------------------
  */

  for (const item of payload.items) {
    const name = item.variant ? `${item.name} (${item.variant})` : item.name;

    buffers.push(
      BOLD_ON,

      receiptText(`${name}\n`),

      BOLD_OFF
    );

    /*
     * When an item has add-ons, show the base price separately.
     *
     * The authoritative item.lineTotal is still printed as Item Total below.
     */
    if (item.addons.length > 0) {
      const baseLineTotal = Number(item.quantity) * Number(item.unitPrice);

      buffers.push(
        receiptText(
          `${leftRight(
            `${receiptQuantity(item.quantity)} x ${receiptMoney(
              item.unitPrice
            )}`,

            receiptMoney(baseLineTotal)
          )}\n`
        )
      );

      for (const addon of item.addons) {
        buffers.push(receiptText(`  + ${addon.name}\n`));

        buffers.push(
          receiptText(
            `${leftRight(
              `    ${receiptQuantity(addon.quantity)} x ${receiptMoney(
                addon.unitPrice
              )}`,

              receiptMoney(addon.lineTotal)
            )}\n`
          )
        );
      }

      buffers.push(
        BOLD_ON,

        receiptText(
          `${leftRight(
            "  Item Total",

            receiptMoney(item.lineTotal)
          )}\n`
        ),

        BOLD_OFF
      );
    } else {
      /*
       * Existing simple item receipt behavior.
       */
      buffers.push(
        receiptText(
          `${leftRight(
            `${receiptQuantity(item.quantity)} x ${receiptMoney(
              item.unitPrice
            )}`,

            receiptMoney(item.lineTotal)
          )}\n`
        )
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Invoice Totals
  |--------------------------------------------------------------------------
  */

  buffers.push(receiptText(`${separator()}\n`));

  buffers.push(
    receiptText(
      `${leftRight(
        "Subtotal",

        receiptMoney(payload.subtotal)
      )}\n`
    )
  );

  if (payload.discount > 0) {
    buffers.push(
      receiptText(
        `${leftRight(
          "Discount",

          `-${receiptMoney(payload.discount)}`
        )}\n`
      )
    );
  }

  if (payload.serviceCharge > 0) {
    buffers.push(
      receiptText(
        `${leftRight(
          "Service Charge",

          receiptMoney(payload.serviceCharge)
        )}\n`
      )
    );
  }

  if (payload.tax > 0) {
    buffers.push(
      receiptText(
        `${leftRight(
          "Tax",

          receiptMoney(payload.tax)
        )}\n`
      )
    );
  }

  buffers.push(
    BOLD_ON,

    receiptText(`${separator("=")}\n`),

    receiptText(
      `${leftRight(
        "TOTAL",

        `Rs.${receiptMoney(payload.grandTotal)}`
      )}\n`
    ),

    receiptText(`${separator("=")}\n`),

    BOLD_OFF
  );

  /*
  |--------------------------------------------------------------------------
  | Payment Breakdown
  |--------------------------------------------------------------------------
  */

  buffers.push(
    BOLD_ON,

    receiptText("PAYMENTS\n"),

    BOLD_OFF
  );

  for (const payment of payload.payments) {
    const method = receiptPaymentMethod(payment.method);

    /*
     * payment.amount = amount applied to invoice.
     */
    buffers.push(
      receiptText(
        `${leftRight(
          method,

          receiptMoney(payment.amount)
        )}\n`
      )
    );

    /*
     * CASH needs both the accounting amount and actual cash tendered.
     */
    if (
      method === "CASH" &&
      payment.tenderedAmount !== null &&
      payment.tenderedAmount !== undefined
    ) {
      buffers.push(
        receiptText(
          `${leftRight(
            "  Cash Received",

            receiptMoney(payment.tenderedAmount)
          )}\n`
        )
      );
    }

    if (Number(payment.changeGiven ?? 0) > 0) {
      buffers.push(
        receiptText(
          `${leftRight(
            "  Change Returned",

            receiptMoney(Number(payment.changeGiven ?? 0))
          )}\n`
        )
      );
    }

    if (payment.referenceNumber) {
      buffers.push(receiptText(`  Ref: ${payment.referenceNumber}\n`));
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Payment Summary
  |--------------------------------------------------------------------------
  */

  buffers.push(
    receiptText(`${separator()}\n`),

    /*
     * Actual amount/tender received from customer.
     */
    BOLD_ON,

    receiptText(
      `${leftRight(
        "Amount Received",

        receiptMoney(payload.amountReceived)
      )}\n`
    ),

    BOLD_OFF,

    /*
     * Accounting amount applied to invoice.
     */
    receiptText(
      `${leftRight(
        "Applied To Bill",

        receiptMoney(payload.paidAmount)
      )}\n`
    ),

    receiptText(
      `${leftRight(
        "Change",

        receiptMoney(payload.changeAmount)
      )}\n`
    ),

    receiptText(
      `${leftRight(
        "Balance",

        receiptMoney(payload.balanceDue)
      )}\n`
    )
  );

  /*
  |--------------------------------------------------------------------------
  | Footer
  |--------------------------------------------------------------------------
  */

  buffers.push(
    receiptText(`${separator()}\n`),

    ALIGN_CENTER,

    BOLD_ON,

    receiptText(`${payload.paymentStatus}\n`),

    BOLD_OFF,

    receiptText("Thank you. Please visit again.\n"),

    receiptText("\n\n\n"),

    FULL_CUT
  );

  return Buffer.concat(buffers);
};

/*
|--------------------------------------------------------------------------
| Print Customer Receipt
|--------------------------------------------------------------------------
*/

export const printCustomerReceipt = async (
  settings: ReceiptPrinterSettings,

  payload: CustomerReceiptPayload
): Promise<ReceiptPrinterResult> => {
  const data = buildCustomerReceiptBuffer(payload);

  const result = await sendRaw(settings, data);

  const host =
    result.transportUsed === "USB" ? LOCAL_PRINTER_HOST : settings.host;

  const port =
    result.transportUsed === "USB" ? LOCAL_PRINTER_PORT : settings.port;

  return {
    success: true,

    printerName: settings.printerName,

    host,

    port,

    transportUsed: result.transportUsed,

    bytesWritten: result.bytesWritten,

    message:
      result.transportUsed === "USB"
        ? "Customer receipt sent through the local / USB cashier printer successfully."
        : `Customer receipt sent through LAN ${settings.host}:${settings.port} successfully.`,
  };
};

/*
|--------------------------------------------------------------------------
| Receipt Printer Test Page
|--------------------------------------------------------------------------
*/

export const printReceiptTestPage = async (
  settings: ReceiptPrinterSettings
): Promise<ReceiptPrinterResult> => {
  const text = [
    "",
    "RESTAURANT POS",
    "CASHIER RECEIPT PRINTER TEST",
    "--------------------------------",
    `Mode: ${settings.transport}`,
    `USB Queue: ${settings.printerName || "Not configured"}`,
    `LAN: ${settings.host}:${settings.port}`,
    "Paper Width: 80mm",
    "--------------------------------",
    "Receipt printer is configured.",
    "",
    "Cash Drawer:",
    "Printer DK / RJ11-RJ12 port",
    "",
    "",
    "",
  ].join("\n");

  const data = Buffer.concat([
    INITIALIZE,

    ALIGN_CENTER,

    BOLD_ON,

    Buffer.from(text, "ascii"),

    BOLD_OFF,

    ALIGN_LEFT,

    FULL_CUT,
  ]);

  const result = await sendRaw(settings, data);

  const host =
    result.transportUsed === "USB" ? LOCAL_PRINTER_HOST : settings.host;

  const port =
    result.transportUsed === "USB" ? LOCAL_PRINTER_PORT : settings.port;

  return {
    success: true,

    printerName: settings.printerName,

    host,

    port,

    transportUsed: result.transportUsed,

    bytesWritten: result.bytesWritten,

    message:
      result.transportUsed === "USB"
        ? "Receipt printer test page sent through local / USB successfully."
        : `Receipt printer test page sent through LAN ${settings.host}:${settings.port} successfully.`,
  };
};
