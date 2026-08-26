import { contextBridge, ipcRenderer } from "electron";

import type {
  KitchenKotPayload,
  KitchenPrintResult,
  KitchenPrinterConnectionResult,
  KitchenPrinterSettings,
} from "./kitchenPrinterTypes";

contextBridge.exposeInMainWorld("posBridge", {
  /*
    |--------------------------------------------------------------------------
    | Authentication
    |--------------------------------------------------------------------------
    */

  getAuthToken: (): Promise<string | null> =>
    ipcRenderer.invoke("pos:session:get-token"),

  setAuthToken: (token: string): Promise<void> =>
    ipcRenderer.invoke("pos:session:set-token", token),

  clearAuthToken: (): Promise<void> =>
    ipcRenderer.invoke("pos:session:clear-token"),

  /*
    |--------------------------------------------------------------------------
    | Device
    |--------------------------------------------------------------------------
    */

  getDeviceInfo: (): Promise<{
    hostname: string;

    platform: string;

    appVersion: string;
  }> => ipcRenderer.invoke("pos:device-info"),

  /*
    |--------------------------------------------------------------------------
    | Phase 22 - Kitchen Printer
    |--------------------------------------------------------------------------
    */

  getKitchenPrinterSettings: (): Promise<KitchenPrinterSettings> =>
    ipcRenderer.invoke("pos:kitchen-printer:get-settings"),

  setKitchenPrinterSettings: (
    settings: Partial<KitchenPrinterSettings>
  ): Promise<KitchenPrinterSettings> =>
    ipcRenderer.invoke("pos:kitchen-printer:set-settings", settings),

  testKitchenPrinterConnection: (): Promise<KitchenPrinterConnectionResult> =>
    ipcRenderer.invoke("pos:kitchen-printer:test-connection"),

  testKitchenPrinter: (): Promise<KitchenPrintResult> =>
    ipcRenderer.invoke("pos:kitchen-printer:test-print"),

  printKitchenKot: (payload: KitchenKotPayload): Promise<KitchenPrintResult> =>
    ipcRenderer.invoke("pos:kitchen-printer:print-kot", payload),
});
