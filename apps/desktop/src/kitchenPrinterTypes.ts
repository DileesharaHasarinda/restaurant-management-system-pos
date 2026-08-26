export interface KitchenPrinterSettings {
  printerName: string;

  host: string;

  port: number;

  paperWidthMm: 80;

  autoPrint: boolean;

  connectTimeoutMs: number;
}

export interface KitchenKotAddon {
  id?: number;

  name: string;

  quantity: number;
}

export interface KitchenKotItem {
  id: number;

  name: string;

  variant?: string | null;

  quantity: number;

  notes?: string | null;

  addons: KitchenKotAddon[];
}

export interface KitchenKotPayload {
  version?: number;

  document_type?: string;

  heading?: string;

  order_id?: number;

  order_number?: string;

  order_type?: string;

  order_source?: string;

  table_id?: number | null;

  table?: string | null;

  token?: string | null;

  session_sequence?: number | null;

  printed_for_time?: string | null;

  cancellation_reason?: string | null;

  reprint?: boolean;

  reprint_of_job_id?: number;

  reprint_of_job_number?: string;

  reprint_requested_at?: string;

  items: KitchenKotItem[];
}

export interface KitchenPrinterConnectionResult {
  success: boolean;

  printerName: string;

  host: string;

  port: number;

  message: string;
}

export interface KitchenPrintResult {
  success: boolean;

  printerName: string;

  host: string;

  port: number;

  bytesWritten: number;

  message: string;
}
