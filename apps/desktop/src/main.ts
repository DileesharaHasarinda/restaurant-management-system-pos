import { app, BrowserWindow, ipcMain, safeStorage } from "electron";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import started from "electron-squirrel-startup";

import {
  loadKitchenPrinterSettings,
  printKitchenKot,
  printKitchenTestPage,
  saveKitchenPrinterSettings,
  testKitchenPrinterConnection,
} from "./kitchenPrinter";

import {
  startKitchenPrintWorker,
  stopKitchenPrintWorker,
} from "./kitchenPrintWorker";

import type {
  KitchenKotPayload,
  KitchenPrinterSettings,
} from "./kitchenPrinterTypes";

if (started) {
  app.quit();
}

const SESSION_FILE = "restaurant-pos-auth.bin";

const sessionFilePath = (): string =>
  path.join(app.getPath("userData"), SESSION_FILE);

/*
|--------------------------------------------------------------------------
| Secure Token Storage
|--------------------------------------------------------------------------
*/

const getStoredAuthToken = async (): Promise<string | null> => {
  try {
    const encryptedBase64 = await fs.readFile(sessionFilePath(), "utf8");

    if (!encryptedBase64 || !safeStorage.isEncryptionAvailable()) {
      return null;
    }

    return safeStorage.decryptString(Buffer.from(encryptedBase64, "base64"));
  } catch {
    return null;
  }
};

/*
|--------------------------------------------------------------------------
| IPC
|--------------------------------------------------------------------------
*/

const registerIpcHandlers = (): void => {
  /*
      |--------------------------------------------------------------------------
      | Authentication
      |--------------------------------------------------------------------------
      */

  ipcMain.handle(
    "pos:session:get-token",

    async (): Promise<string | null> => getStoredAuthToken()
  );

  ipcMain.handle(
    "pos:session:set-token",

    async (_event, token: string): Promise<void> => {
      if (!token || !safeStorage.isEncryptionAvailable()) {
        throw new Error(
          "Secure credential storage is not available on this device."
        );
      }

      const encrypted = safeStorage.encryptString(token);

      await fs.writeFile(
        sessionFilePath(),

        encrypted.toString("base64"),

        "utf8"
      );
    }
  );

  ipcMain.handle(
    "pos:session:clear-token",

    async (): Promise<void> => {
      try {
        await fs.unlink(sessionFilePath());
      } catch {
        // Nothing to clear.
      }
    }
  );

  /*
      |--------------------------------------------------------------------------
      | Device Information
      |--------------------------------------------------------------------------
      */

  ipcMain.handle(
    "pos:device-info",

    async () => ({
      hostname: os.hostname(),

      platform: process.platform,

      appVersion: app.getVersion(),
    })
  );

  /*
      |--------------------------------------------------------------------------
      | Kitchen Printer Settings
      |--------------------------------------------------------------------------
      */

  ipcMain.handle(
    "pos:kitchen-printer:get-settings",

    async () => loadKitchenPrinterSettings()
  );

  ipcMain.handle(
    "pos:kitchen-printer:set-settings",

    async (_event, settings: Partial<KitchenPrinterSettings>) =>
      saveKitchenPrinterSettings(settings)
  );

  /*
      |--------------------------------------------------------------------------
      | Printer Connection Test
      |--------------------------------------------------------------------------
      */

  ipcMain.handle(
    "pos:kitchen-printer:test-connection",

    async () => {
      const settings = await loadKitchenPrinterSettings();

      return testKitchenPrinterConnection(settings);
    }
  );

  /*
      |--------------------------------------------------------------------------
      | Test Print
      |--------------------------------------------------------------------------
      */

  ipcMain.handle(
    "pos:kitchen-printer:test-print",

    async () => {
      const settings = await loadKitchenPrinterSettings();

      return printKitchenTestPage(settings);
    }
  );

  /*
      |--------------------------------------------------------------------------
      | Manual KOT Print
      |--------------------------------------------------------------------------
      */

  ipcMain.handle(
    "pos:kitchen-printer:print-kot",

    async (_event, payload: KitchenKotPayload) => {
      const settings = await loadKitchenPrinterSettings();

      return printKitchenKot(settings, payload);
    }
  );
};

/*
|--------------------------------------------------------------------------
| Window
|--------------------------------------------------------------------------
*/

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1440,

    height: 900,

    minWidth: 1024,

    minHeight: 700,

    center: true,

    title: "Restaurant POS",

    backgroundColor: "#eef2f7",

    autoHideMenuBar: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),

      contextIsolation: true,

      nodeIntegration: false,

      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "deny",
  }));

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

/*
|--------------------------------------------------------------------------
| Electron Lifecycle
|--------------------------------------------------------------------------
*/

void app.whenReady().then(() => {
  registerIpcHandlers();

  /*
   * Phase 22:
   *
   * The worker remains harmless until:
   *
   * autoPrint = true
   * AND
   * printer host is configured.
   */
  startKitchenPrintWorker({
    getAuthToken: getStoredAuthToken,

    apiBaseUrl: "http://127.0.0.1:8000/api/v1",

    pollIntervalMs: 1500,
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopKitchenPrintWorker();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
