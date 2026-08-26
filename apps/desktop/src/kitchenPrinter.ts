import { app } from "electron";

import fs from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";

import type {
  KitchenKotItem,
  KitchenKotPayload,
  KitchenPrintResult,
  KitchenPrinterConnectionResult,
  KitchenPrinterSettings,
} from "./kitchenPrinterTypes";

const SETTINGS_FILE = "restaurant-pos-kitchen-printer.json";

const DEFAULT_PORT = 9100;

const DEFAULT_CONNECT_TIMEOUT_MS = 4000;

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

const DOUBLE_SIZE_ON = Buffer.from([GS, 0x21, 0x11]);

const NORMAL_SIZE = Buffer.from([GS, 0x21, 0x00]);

const FULL_CUT = Buffer.from([GS, 0x56, 0x00]);

/*
|--------------------------------------------------------------------------
| Settings
|--------------------------------------------------------------------------
*/

const settingsPath = (): string =>
  path.join(app.getPath("userData"), SETTINGS_FILE);

export const defaultKitchenPrinterSettings = (): KitchenPrinterSettings => ({
  printerName: "Kitchen Printer",

  host: "",

  port: DEFAULT_PORT,

  paperWidthMm: 80,

  /*
   * Keep automatic printing OFF until
   * printer IP + test print are verified.
   */
  autoPrint: false,

  connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
});

const normaliseSettings = (
  value: Partial<KitchenPrinterSettings>
): KitchenPrinterSettings => {
  const defaults = defaultKitchenPrinterSettings();

  const port = Number(value.port ?? defaults.port);

  const timeout = Number(value.connectTimeoutMs ?? defaults.connectTimeoutMs);

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

    autoPrint: Boolean(value.autoPrint ?? defaults.autoPrint),

    connectTimeoutMs:
      Number.isFinite(timeout) && timeout >= 1000 && timeout <= 30000
        ? Math.round(timeout)
        : defaults.connectTimeoutMs,
  };
};

export const loadKitchenPrinterSettings =
  async (): Promise<KitchenPrinterSettings> => {
    try {
      const raw = await fs.readFile(settingsPath(), "utf8");

      const parsed = JSON.parse(raw) as Partial<KitchenPrinterSettings>;

      return normaliseSettings(parsed);
    } catch {
      return defaultKitchenPrinterSettings();
    }
  };

export const saveKitchenPrinterSettings = async (
  value: Partial<KitchenPrinterSettings>
): Promise<KitchenPrinterSettings> => {
  const current = await loadKitchenPrinterSettings();

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
| Printer Validation
|--------------------------------------------------------------------------
*/

const assertPrinterConfigured = (settings: KitchenPrinterSettings): void => {
  if (!settings.host) {
    throw new Error("Kitchen printer IP address is not configured.");
  }

  if (settings.port < 1 || settings.port > 65535) {
    throw new Error("Kitchen printer port is invalid.");
  }
};

/*
|--------------------------------------------------------------------------
| TCP Connection Test
|--------------------------------------------------------------------------
*/

export const testKitchenPrinterConnection = async (
  settings: KitchenPrinterSettings
): Promise<KitchenPrinterConnectionResult> => {
  assertPrinterConfigured(settings);

  return new Promise((resolve, reject) => {
    let settled = false;

    const socket = createConnection({
      host: settings.host,

      port: settings.port,
    });

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
          `Kitchen printer connection timed out after ${settings.connectTimeoutMs}ms.`
        )
      );
    }, settings.connectTimeoutMs);

    socket.once("connect", () => {
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

        message: "Kitchen printer connection successful.",
      });
    });

    socket.once("error", (error) => {
      finishWithError(error);
    });
  });
};

/*
|--------------------------------------------------------------------------
| Raw TCP Print
|--------------------------------------------------------------------------
*/

const sendRawPrint = async (
  settings: KitchenPrinterSettings,
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

    const timer = setTimeout(() => {
      fail(
        new Error(
          `Kitchen printer connection timed out after ${settings.connectTimeoutMs}ms.`
        )
      );
    }, settings.connectTimeoutMs);

    socket.once("error", (error) => {
      fail(error);
    });

    socket.once("connect", () => {
      socket.write(data, (error) => {
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
      });
    });
  });
};

/*
|--------------------------------------------------------------------------
| Text Helpers
|--------------------------------------------------------------------------
*/

const printableText = (value: unknown): string =>
  String(value ?? "")
    /*
     * KOT is intentionally ASCII-safe.
     *
     * This avoids printing corrupt multibyte
     * characters on inexpensive ESC/POS printers
     * whose code page is not guaranteed.
     */
    .replace(/[^\x20-\x7E\n\r\t]/g, "?");

const textBuffer = (value: unknown): Buffer =>
  Buffer.from(printableText(value), "ascii");

const separator = (character = "-"): string =>
  character.repeat(PAPER_CHARACTERS);

const formatQuantity = (quantity: number): string => {
  const value = Number(quantity);

  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
};

const wrapText = (value: string, width = PAPER_CHARACTERS): string[] => {
  const clean = printableText(value).replace(/\s+/g, " ").trim();

  if (!clean) {
    return [];
  }

  const words = clean.split(" ");

  const lines: string[] = [];

  let current = "";

  for (const word of words) {
    /*
     * Handle an unusually long single word.
     */
    if (word.length > width) {
      if (current) {
        lines.push(current);

        current = "";
      }

      let remaining = word;

      while (remaining.length > width) {
        lines.push(remaining.slice(0, width));

        remaining = remaining.slice(width);
      }

      current = remaining;

      continue;
    }

    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }

      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

const formatTime = (iso: string | null | undefined): string => {
  const value = iso ? new Date(iso) : new Date();

  if (Number.isNaN(value.getTime())) {
    return new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",

      minute: "2-digit",

      hour12: true,
    });
  }

  return value.toLocaleTimeString("en-US", {
    hour: "2-digit",

    minute: "2-digit",

    hour12: true,
  });
};

const formatItemLines = (item: KitchenKotItem): string[] => {
  const lines: string[] = [];

  const title = `${formatQuantity(item.quantity)} x ${item.name}`;

  const wrappedTitle = wrapText(title, PAPER_CHARACTERS);

  lines.push(...wrappedTitle);

  if (item.variant) {
    const variantLines = wrapText(
      `    Variant: ${item.variant}`,
      PAPER_CHARACTERS
    );

    lines.push(...variantLines);
  }

  for (const addon of item.addons ?? []) {
    const addonLine = `    + ${addon.name} x${formatQuantity(addon.quantity)}`;

    lines.push(...wrapText(addonLine, PAPER_CHARACTERS));
  }

  if (item.notes) {
    const note = `    *** ${String(item.notes).toUpperCase()} ***`;

    lines.push(...wrapText(note, PAPER_CHARACTERS));
  }

  return lines;
};

/*
|--------------------------------------------------------------------------
| KOT ESC/POS Formatter
|--------------------------------------------------------------------------
*/

export const buildKitchenKotBuffer = (payload: KitchenKotPayload): Buffer => {
  const buffers: Buffer[] = [];

  const heading = payload.heading || "KITCHEN ORDER";

  const table =
    payload.table || (payload.order_type === "TAKEAWAY" ? "TAKEAWAY" : "-");

  const token = payload.token || "-";

  buffers.push(INITIALIZE);

  /*
   * Heading
   */
  buffers.push(
    ALIGN_CENTER,
    BOLD_ON,
    DOUBLE_SIZE_ON,
    textBuffer(`${heading}\n`),
    NORMAL_SIZE,
    BOLD_OFF
  );

  if (payload.reprint) {
    buffers.push(BOLD_ON, textBuffer("*** REPRINT COPY ***\n"), BOLD_OFF);
  }

  buffers.push(textBuffer(`${separator("=")}\n`));

  /*
   * Table + token.
   */
  buffers.push(
    BOLD_ON,
    DOUBLE_SIZE_ON,
    textBuffer(`${table}\n`),
    textBuffer(`TOKEN ${token}\n`),
    NORMAL_SIZE,
    BOLD_OFF
  );

  buffers.push(ALIGN_LEFT);

  if (payload.order_number) {
    buffers.push(textBuffer(`ORDER: ${payload.order_number}\n`));
  }

  buffers.push(textBuffer(`TIME : ${formatTime(payload.printed_for_time)}\n`));

  if (payload.order_type) {
    buffers.push(
      textBuffer(`TYPE : ${payload.order_type.replace(/_/g, " ")}\n`)
    );
  }

  buffers.push(textBuffer(`${separator()}\n`));

  /*
   * Items
   */
  for (const item of payload.items ?? []) {
    buffers.push(BOLD_ON);

    const lines = formatItemLines(item);

    for (const line of lines) {
      buffers.push(textBuffer(`${line}\n`));
    }

    buffers.push(BOLD_OFF, textBuffer("\n"));
  }

  /*
   * Cancellation reason.
   */
  if (payload.cancellation_reason) {
    buffers.push(
      textBuffer(`${separator()}\n`),

      BOLD_ON,

      textBuffer("REASON:\n"),

      BOLD_OFF
    );

    const reasonLines = wrapText(payload.cancellation_reason, PAPER_CHARACTERS);

    for (const line of reasonLines) {
      buffers.push(textBuffer(`${line}\n`));
    }
  }

  buffers.push(textBuffer(`${separator("=")}\n`));

  buffers.push(
    ALIGN_CENTER,
    BOLD_ON,
    textBuffer("END OF KITCHEN ORDER\n"),
    BOLD_OFF
  );

  /*
   * Feed enough paper below ticket
   * before cutting.
   */
  buffers.push(textBuffer("\n\n\n"));

  buffers.push(FULL_CUT);

  return Buffer.concat(buffers);
};

/*
|--------------------------------------------------------------------------
| Print Kitchen KOT
|--------------------------------------------------------------------------
*/

export const printKitchenKot = async (
  settings: KitchenPrinterSettings,
  payload: KitchenKotPayload
): Promise<KitchenPrintResult> => {
  const data = buildKitchenKotBuffer(payload);

  const bytesWritten = await sendRawPrint(settings, data);

  return {
    success: true,

    printerName: settings.printerName,

    host: settings.host,

    port: settings.port,

    bytesWritten,

    message: "Kitchen KOT sent to printer successfully.",
  };
};

/*
|--------------------------------------------------------------------------
| Test Print
|--------------------------------------------------------------------------
*/

export const printKitchenTestPage = async (
  settings: KitchenPrinterSettings
): Promise<KitchenPrintResult> => {
  const payload: KitchenKotPayload = {
    version: 1,

    document_type: "INITIAL_ORDER",

    heading: "KITCHEN TEST",

    order_number: "TEST-ORDER-001",

    order_type: "DINE_IN",

    table: "TABLE 05",

    token: "024",

    printed_for_time: new Date().toISOString(),

    items: [
      {
        id: 1,

        name: "Chicken Fried Rice",

        variant: "Large",

        quantity: 2,

        notes: "No onion",

        addons: [
          {
            id: 1,

            name: "Egg",

            quantity: 1,
          },

          {
            id: 2,

            name: "Cheese",

            quantity: 1,
          },
        ],
      },

      {
        id: 2,

        name: "Coca Cola",

        variant: null,

        quantity: 1,

        notes: null,

        addons: [],
      },
    ],
  };

  return printKitchenKot(settings, payload);
};
