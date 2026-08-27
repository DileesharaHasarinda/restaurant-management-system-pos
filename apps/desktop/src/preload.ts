import { contextBridge, ipcRenderer } from "electron";

import type {
  KitchenKotPayload,
  KitchenPrintResult,
  KitchenPrinterConnectionResult,
  KitchenPrinterSettings,
} from "./kitchenPrinterTypes";

import type {
  CashDrawerResult,
  CustomerReceiptPayload,
  ReceiptPrinterConnectionResult,
  ReceiptPrinterResult,
  ReceiptPrinterSettings,
} from "./receiptPrinterTypes";

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

  /*
    |--------------------------------------------------------------------------
    | Phase 30 - Receipt Printer / Cash Drawer
    |--------------------------------------------------------------------------
    */

  getReceiptPrinterSettings: (): Promise<ReceiptPrinterSettings> =>
    ipcRenderer.invoke("pos:receipt-printer:get-settings"),

  setReceiptPrinterSettings: (
    settings: Partial<ReceiptPrinterSettings>
  ): Promise<ReceiptPrinterSettings> =>
    ipcRenderer.invoke("pos:receipt-printer:set-settings", settings),

  testReceiptPrinterConnection: (): Promise<ReceiptPrinterConnectionResult> =>
    ipcRenderer.invoke("pos:receipt-printer:test-connection"),

  testReceiptPrinter: (): Promise<ReceiptPrinterResult> =>
    ipcRenderer.invoke("pos:receipt-printer:test-print"),

  printCustomerReceipt: (
    payload: CustomerReceiptPayload
  ): Promise<ReceiptPrinterResult> =>
    ipcRenderer.invoke("pos:receipt-printer:print-receipt", payload),

  testCashDrawer: (): Promise<CashDrawerResult> =>
    ipcRenderer.invoke("pos:cash-drawer:test"),

  openCashDrawerHardware: (): Promise<CashDrawerResult> =>
    ipcRenderer.invoke("pos:cash-drawer:open-hardware"),
});
