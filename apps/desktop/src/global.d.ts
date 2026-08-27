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

export {};

declare global {
  interface Window {
    posBridge: {
      /*
      |--------------------------------------------------------------------------
      | Authentication
      |--------------------------------------------------------------------------
      */

      getAuthToken: () => Promise<string | null>;

      setAuthToken: (token: string) => Promise<void>;

      clearAuthToken: () => Promise<void>;

      /*
      |--------------------------------------------------------------------------
      | Device
      |--------------------------------------------------------------------------
      */

      getDeviceInfo: () => Promise<{
        hostname: string;

        platform: string;

        appVersion: string;
      }>;

      /*
      |--------------------------------------------------------------------------
      | Phase 22 - Kitchen Printer
      |--------------------------------------------------------------------------
      */

      getKitchenPrinterSettings: () => Promise<KitchenPrinterSettings>;

      setKitchenPrinterSettings: (
        settings: Partial<KitchenPrinterSettings>
      ) => Promise<KitchenPrinterSettings>;

      testKitchenPrinterConnection: () => Promise<KitchenPrinterConnectionResult>;

      testKitchenPrinter: () => Promise<KitchenPrintResult>;

      printKitchenKot: (
        payload: KitchenKotPayload
      ) => Promise<KitchenPrintResult>;

      /*
      |--------------------------------------------------------------------------
      | Phase 30 - Receipt Printer / Cash Drawer
      |--------------------------------------------------------------------------
      */

      getReceiptPrinterSettings: () => Promise<ReceiptPrinterSettings>;

      setReceiptPrinterSettings: (
        settings: Partial<ReceiptPrinterSettings>
      ) => Promise<ReceiptPrinterSettings>;

      testReceiptPrinterConnection: () => Promise<ReceiptPrinterConnectionResult>;

      testReceiptPrinter: () => Promise<ReceiptPrinterResult>;

      printCustomerReceipt: (
        payload: CustomerReceiptPayload
      ) => Promise<ReceiptPrinterResult>;

      testCashDrawer: () => Promise<CashDrawerResult>;

      openCashDrawerHardware: () => Promise<CashDrawerResult>;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
