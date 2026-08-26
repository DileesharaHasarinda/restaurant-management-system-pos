import type { KitchenKotPayload } from "./kitchenPrinterTypes";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export type KitchenPrintJobStatus =
  "PENDING" | "PROCESSING" | "PRINTED" | "FAILED";

export type KitchenPrintJobType =
  "INITIAL_ORDER" | "ADDITIONAL_ORDER" | "CANCELLATION" | "REPRINT";

export interface KitchenPrintJobRecord {
  id: number;

  job_number: string;

  order_id: number;

  job_type: KitchenPrintJobType;

  printer_name: string | null;

  printer_address: string | null;

  payload: KitchenKotPayload;

  status: KitchenPrintJobStatus;

  attempts: number;

  last_error: string | null;

  requested_by: number | null;

  queued_at: string | null;

  printed_at: string | null;

  created_at: string | null;

  updated_at: string | null;
}

interface PaginationMeta {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

interface ApiEnvelope<T> {
  success?: boolean;

  message?: string;

  data?: T;

  code?: string;

  errors?: Record<string, string[]>;

  meta?: {
    pagination?: PaginationMeta;
  };
}

export interface KitchenPrintHistoryResult {
  jobs: KitchenPrintJobRecord[];

  pagination: PaginationMeta | null;
}

export class KitchenPrintApiError extends Error {
  public readonly status: number;

  public readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);

    this.name = "KitchenPrintApiError";

    this.status = status;

    this.code = code;
  }
}

const request = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiEnvelope<T>> => {
  const token = await window.posBridge.getAuthToken();

  if (!token) {
    throw new KitchenPrintApiError(
      "No authenticated POS session was found.",
      401,
      "UNAUTHENTICATED"
    );
  }

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  headers.set("Authorization", `Bearer ${token}`);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const rawBody = await response.text();

  let body: ApiEnvelope<T> = {};

  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as ApiEnvelope<T>;
    } catch {
      throw new KitchenPrintApiError(
        "The kitchen print API returned invalid JSON.",
        response.status
      );
    }
  }

  if (!response.ok || body.success === false) {
    throw new KitchenPrintApiError(
      body.message ||
        `Kitchen print request failed with status ${response.status}.`,

      response.status,

      body.code || null
    );
  }

  return body;
};

export const getKitchenPrintJobs =
  async (): Promise<KitchenPrintHistoryResult> => {
    const response = await request<KitchenPrintJobRecord[]>(
      "/kitchen/print-jobs?per_page=50"
    );

    return {
      jobs: response.data || [],

      pagination: response.meta?.pagination || null,
    };
  };

export const retryKitchenPrintJob = async (
  jobId: number
): Promise<KitchenPrintJobRecord> => {
  const response = await request<KitchenPrintJobRecord>(
    `/kitchen/print-jobs/${jobId}/retry`,
    {
      method: "POST",
    }
  );

  if (!response.data) {
    throw new KitchenPrintApiError(
      "Retry did not return a kitchen print job.",
      500
    );
  }

  return response.data;
};

export const reprintKitchenPrintJob = async (
  jobId: number
): Promise<KitchenPrintJobRecord> => {
  const response = await request<KitchenPrintJobRecord>(
    `/kitchen/print-jobs/${jobId}/reprint`,
    {
      method: "POST",
    }
  );

  if (!response.data) {
    throw new KitchenPrintApiError(
      "Reprint did not return a kitchen print job.",
      500
    );
  }

  return response.data;
};
