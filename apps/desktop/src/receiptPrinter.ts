import { app } from "electron";

import fs from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";

import type {
  CashDrawerResult,
  CustomerReceiptPayload,
  ReceiptPrinterConnectionResult,
  ReceiptPrinterResult,
  ReceiptPrinterSettings,
} from "./receiptPrinterTypes";

const SETTINGS_FILE = "restaurant-pos-receipt-printer.json";

const DEFAULT_PORT = 9100;

const DEFAULT_CONNECT_TIMEOUT_MS = 4000;

const DEFAULT_DRAWER_PULSE_ON_MS = 50;

const DEFAULT_DRAWER_PULSE_OFF_MS = 500;

const PAPER_CHARACTERS = 48;

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
| Settings
|--------------------------------------------------------------------------
*/

const settingsPath = (): string =>
  path.join(app.getPath("userData"), SETTINGS_FILE);

export const defaultReceiptPrinterSettings = (): ReceiptPrinterSettings => ({
  printerName: "Cashier Receipt Printer",

  host: "",

  port: DEFAULT_PORT,

  paperWidthMm: 80,

  connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,

  /*
   * ESC/POS drawer connector:
   *
   * 0 = Pin 2
   * 1 = Pin 5
   *
   * Most printers use 0.
   */
  drawerPin: 0,

  /*
   * ESC p timing values.
   *
   * 50ms  -> 25 -> 0x19
   * 500ms -> 250 -> 0xFA
   *
   * Default pulse:
   *
   * 1B 70 00 19 FA
   */
  drawerPulseOnMs: DEFAULT_DRAWER_PULSE_ON_MS,

  drawerPulseOffMs: DEFAULT_DRAWER_PULSE_OFF_MS,
});

const normaliseSettings = (
  value: Partial<ReceiptPrinterSettings>
): ReceiptPrinterSettings => {
  const defaults = defaultReceiptPrinterSettings();

  const port = Number(value.port ?? defaults.port);

  const timeout = Number(value.connectTimeoutMs ?? defaults.connectTimeoutMs);

  const pin = Number(value.drawerPin ?? defaults.drawerPin);

  const pulseOn = Number(value.drawerPulseOnMs ?? defaults.drawerPulseOnMs);

  const pulseOff = Number(value.drawerPulseOffMs ?? defaults.drawerPulseOffMs);

  return {
    printerName:
      String(value.printerName ?? defaults.printerName).trim() ||
      defaults.printerName,

    host: String(value.host ?? defaults.host).trim(),

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

  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), "utf8");

  return next;
};

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

const assertPrinterConfigured = (settings: ReceiptPrinterSettings): void => {
  if (!settings.host) {
    throw new Error("Cashier receipt printer IP address is not configured.");
  }

  if (settings.port < 1 || settings.port > 65535) {
    throw new Error("Cashier receipt printer port is invalid.");
  }
};

/*
|--------------------------------------------------------------------------
| TCP
|--------------------------------------------------------------------------
*/

const sendRaw = async (
  settings: ReceiptPrinterSettings,
  data: Buffer
): Promise<number> => {
  assertPrinterConfigured(settings);

  return new Promise((resolve, reject) => {
    let settled = false;

    const socket = createConnection({
      host: settings.host,

      port: settings.port,
    });

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;

      clearTimeout(timer);

      socket.destroy();

      reject(error);
    };

    const timer = setTimeout(
      () => {
        fail(
          new Error(
            `Receipt printer connection timed out after ${settings.connectTimeoutMs}ms.`
          )
        );
      },

      settings.connectTimeoutMs
    );

    socket.once(
      "error",

      (error) => {
        fail(error);
      }
    );

    socket.once(
      "connect",

      () => {
        socket.write(
          data,

          (error) => {
            if (error) {
              fail(error);

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
          }
        );
      }
    );
  });
};

/*
|--------------------------------------------------------------------------
| Connection Test
|--------------------------------------------------------------------------
*/

export const testReceiptPrinterConnection = async (
  settings: ReceiptPrinterSettings
): Promise<ReceiptPrinterConnectionResult> => {
  assertPrinterConfigured(settings);

  return new Promise((resolve, reject) => {
    let settled = false;

    const socket = createConnection({
      host: settings.host,

      port: settings.port,
    });

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;

      clearTimeout(timer);

      socket.destroy();

      reject(error);
    };

    const timer = setTimeout(
      () => {
        fail(
          new Error(
            `Receipt printer connection timed out after ${settings.connectTimeoutMs}ms.`
          )
        );
      },

      settings.connectTimeoutMs
    );

    socket.once(
      "error",

      (error) => {
        fail(error);
      }
    );

    socket.once(
      "connect",

      () => {
        if (settled) {
          return;
        }

        settled = true;

        clearTimeout(timer);

        socket.destroy();

        resolve({
          success: true,

          printerName: settings.printerName,

          host: settings.host,

          port: settings.port,

          message: "Cashier receipt printer connection successful.",
        });
      }
    );
  });
};

/*
|--------------------------------------------------------------------------
| Cash Drawer Pulse
|--------------------------------------------------------------------------
*/

const pulseUnit = (milliseconds: number): number => {
  const value = Math.round(milliseconds / 2);

  return Math.max(1, Math.min(255, value));
};

export const buildCashDrawerPulseBuffer = (
  settings: ReceiptPrinterSettings
): Buffer => {
  const pulse = Buffer.from([
    ESC,

    /*
     * ESC p m t1 t2
     */
    0x70,

    settings.drawerPin,

    pulseUnit(settings.drawerPulseOnMs),

    pulseUnit(settings.drawerPulseOffMs),
  ]);

  return Buffer.concat([INITIALIZE, pulse]);
};

export const pulseCashDrawer = async (
  settings: ReceiptPrinterSettings
): Promise<CashDrawerResult> => {
  const data = buildCashDrawerPulseBuffer(settings);

  const bytesWritten = await sendRaw(settings, data);

  return {
    success: true,

    printerName: settings.printerName,

    host: settings.host,

    port: settings.port,

    bytesWritten,

    message: "Cash drawer pulse sent successfully.",
  };
};

/*
|--------------------------------------------------------------------------
| Receipt Helpers
|--------------------------------------------------------------------------
*/

const printableText = (value: unknown): string =>
  String(value ?? "").replace(/[^\x20-\x7E\n\r\t]/g, "?");

const receiptText = (value: unknown): Buffer =>
  Buffer.from(printableText(value), "ascii");

const separator = (character = "-"): string =>
  character.repeat(PAPER_CHARACTERS);

const receiptMoney = (value: number): string => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return amount.toFixed(2);
};

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

const receiptDateTime = (value: string | null | undefined): string => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-LK");
};

const leftRight = (left: string, right: string): string => {
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
| Customer Receipt
|--------------------------------------------------------------------------
*/

export const buildCustomerReceiptBuffer = (
  payload: CustomerReceiptPayload
): Buffer => {
  const buffers: Buffer[] = [];

  buffers.push(INITIALIZE);

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

  buffers.push(receiptText(`INVOICE: ${payload.invoiceNumber}\n`));

  if (payload.tableName) {
    buffers.push(receiptText(`TABLE  : ${payload.tableName}\n`));
  }

  buffers.push(
    receiptText(
      `DATE   : ${receiptDateTime(payload.issuedAt ?? payload.printedAt)}\n`
    )
  );

  if (payload.customerName) {
    buffers.push(receiptText(`CUSTOMER: ${payload.customerName}\n`));
  }

  if (payload.customerPhone) {
    buffers.push(receiptText(`PHONE   : ${payload.customerPhone}\n`));
  }

  buffers.push(receiptText(`${separator()}\n`));

  for (const item of payload.items) {
    const name = item.variant ? `${item.name} (${item.variant})` : item.name;

    buffers.push(
      BOLD_ON,

      receiptText(`${name}\n`),

      BOLD_OFF
    );

    buffers.push(
      receiptText(
        `${leftRight(
          `${receiptQuantity(item.quantity)} x ${receiptMoney(item.unitPrice)}`,

          receiptMoney(item.lineTotal)
        )}\n`
      )
    );
  }

  buffers.push(receiptText(`${separator()}\n`));

  buffers.push(
    receiptText(`${leftRight("Subtotal", receiptMoney(payload.subtotal))}\n`)
  );

  if (payload.discount > 0) {
    buffers.push(
      receiptText(
        `${leftRight("Discount", `-${receiptMoney(payload.discount)}`)}\n`
      )
    );
  }

  if (payload.serviceCharge > 0) {
    buffers.push(
      receiptText(
        `${leftRight("Service Charge", receiptMoney(payload.serviceCharge))}\n`
      )
    );
  }

  if (payload.tax > 0) {
    buffers.push(
      receiptText(`${leftRight("Tax", receiptMoney(payload.tax))}\n`)
    );
  }

  buffers.push(
    BOLD_ON,

    receiptText(`${separator("=")}\n`),

    receiptText(
      `${leftRight("TOTAL", `Rs.${receiptMoney(payload.grandTotal)}`)}\n`
    ),

    receiptText(`${separator("=")}\n`),

    BOLD_OFF
  );

  buffers.push(
    BOLD_ON,

    receiptText("PAYMENTS\n"),

    BOLD_OFF
  );

  for (const payment of payload.payments) {
    buffers.push(
      receiptText(
        `${leftRight(
          payment.method.replace(/_/g, " "),

          receiptMoney(payment.amount)
        )}\n`
      )
    );

    if (payment.referenceNumber) {
      buffers.push(receiptText(`  Ref: ${payment.referenceNumber}\n`));
    }
  }

  buffers.push(
    receiptText(`${separator()}\n`),

    receiptText(`${leftRight("Paid", receiptMoney(payload.paidAmount))}\n`),

    receiptText(`${leftRight("Change", receiptMoney(payload.changeAmount))}\n`),

    receiptText(`${leftRight("Balance", receiptMoney(payload.balanceDue))}\n`)
  );

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

export const printCustomerReceipt = async (
  settings: ReceiptPrinterSettings,
  payload: CustomerReceiptPayload
): Promise<ReceiptPrinterResult> => {
  const data = buildCustomerReceiptBuffer(payload);

  const bytesWritten = await sendRaw(settings, data);

  return {
    success: true,

    printerName: settings.printerName,

    host: settings.host,

    port: settings.port,

    bytesWritten,

    message: "Customer receipt sent to printer successfully.",
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
    `Printer: ${settings.printerName}`,
    `IP: ${settings.host}`,
    `Port: ${settings.port}`,
    "--------------------------------",
    "Receipt printer is configured.",
    "",
    "Cash drawer is connected to",
    "the printer RJ11/RJ12 port.",
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

  const bytesWritten = await sendRaw(settings, data);

  return {
    success: true,

    printerName: settings.printerName,

    host: settings.host,

    port: settings.port,

    bytesWritten,

    message: "Receipt printer test page sent successfully.",
  };
};
