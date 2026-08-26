import { net } from "electron";

import { loadKitchenPrinterSettings, printKitchenKot } from "./kitchenPrinter";

import type { KitchenKotPayload } from "./kitchenPrinterTypes";

interface ApiEnvelope<T> {
  success?: boolean;

  message?: string;

  data?: T;

  code?: string;

  errors?: Record<string, string[]>;
}

interface KitchenPrintJob {
  id: number;

  job_number: string;

  order_id: number;

  job_type: string;

  status: string;

  attempts: number;

  payload: KitchenKotPayload;
}

interface KitchenPrintWorkerOptions {
  getAuthToken: () => Promise<string | null>;

  apiBaseUrl?: string;

  pollIntervalMs?: number;
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const DEFAULT_POLL_INTERVAL_MS = 1500;

let workerEnabled = false;

let workerRunning = false;

let workerTimer: ReturnType<typeof setTimeout> | null = null;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const apiErrorMessage = (
  body: ApiEnvelope<unknown>,
  fallback: string
): string => {
  return body.message || fallback;
};

const request = async <T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  headers.set("Authorization", `Bearer ${token}`);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await net.fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const rawBody = await response.text();

  let body: ApiEnvelope<T> = {};

  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as ApiEnvelope<T>;
    } catch {
      throw new Error("Kitchen print API returned invalid JSON.");
    }
  }

  if (!response.ok || body.success === false) {
    throw new Error(
      apiErrorMessage(
        body,
        `Kitchen print API returned status ${response.status}.`
      )
    );
  }

  return body.data as T;
};

const reportPrinted = async (
  baseUrl: string,
  token: string,
  job: KitchenPrintJob
): Promise<void> => {
  await request(baseUrl, token, `/kitchen/print-jobs/${job.id}/printed`, {
    method: "POST",
  });
};

const reportFailed = async (
  baseUrl: string,
  token: string,
  job: KitchenPrintJob,
  error: string
): Promise<void> => {
  await request(baseUrl, token, `/kitchen/print-jobs/${job.id}/failed`, {
    method: "POST",

    body: JSON.stringify({
      error,
    }),
  });
};

const claimNext = async (
  baseUrl: string,
  token: string,
  printerName: string,
  printerAddress: string
): Promise<KitchenPrintJob | null> => {
  return request<KitchenPrintJob | null>(
    baseUrl,
    token,
    "/kitchen/print-jobs/claim-next",
    {
      method: "POST",

      body: JSON.stringify({
        printer_name: printerName,

        printer_address: printerAddress,
      }),
    }
  );
};

/*
|--------------------------------------------------------------------------
| Process One Job
|--------------------------------------------------------------------------
*/

const processNextJob = async (
  options: KitchenPrintWorkerOptions
): Promise<void> => {
  const settings = await loadKitchenPrinterSettings();

  /*
   * Important:
   *
   * Never claim jobs unless automatic printing
   * is explicitly enabled and a printer host
   * has been configured.
   */
  if (!settings.autoPrint || !settings.host) {
    return;
  }

  const token = await options.getAuthToken();

  if (!token) {
    return;
  }

  const baseUrl = (options.apiBaseUrl || DEFAULT_API_BASE_URL).replace(
    /\/+$/,
    ""
  );

  const printerAddress = `${settings.host}:${settings.port}`;

  const job = await claimNext(
    baseUrl,
    token,
    settings.printerName,
    printerAddress
  );

  if (!job) {
    return;
  }

  try {
    await printKitchenKot(settings, job.payload);

    /*
     * Do NOT automatically reprint if this
     * acknowledgement fails.
     *
     * Paper may already have physically
     * printed.
     */
    await reportPrinted(baseUrl, token, job);

    console.info(`[Kitchen Printer] Printed ${job.job_number}.`);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown kitchen printer error.";

    console.error(`[Kitchen Printer] ${job.job_number} failed:`, message);

    /*
     * Best effort failure acknowledgement.
     *
     * If this API call also fails, Laravel
     * will eventually identify the stale
     * PROCESSING job and require manual retry.
     */
    try {
      await reportFailed(baseUrl, token, job, message);
    } catch (acknowledgementError: unknown) {
      console.error(
        "[Kitchen Printer] Unable to report print failure:",
        acknowledgementError
      );
    }
  }
};

/*
|--------------------------------------------------------------------------
| Worker Loop
|--------------------------------------------------------------------------
*/

const scheduleNext = (
  options: KitchenPrintWorkerOptions,
  delay: number
): void => {
  if (!workerEnabled) {
    return;
  }

  if (workerTimer) {
    clearTimeout(workerTimer);
  }

  workerTimer = setTimeout(() => {
    void runWorkerCycle(options);
  }, delay);
};

const runWorkerCycle = async (
  options: KitchenPrintWorkerOptions
): Promise<void> => {
  if (!workerEnabled || workerRunning) {
    return;
  }

  workerRunning = true;

  try {
    await processNextJob(options);

    scheduleNext(options, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
  } catch (error: unknown) {
    console.error("[Kitchen Printer] Worker error:", error);

    /*
     * Slow down after API/network problems.
     */
    scheduleNext(options, 5000);
  } finally {
    workerRunning = false;
  }
};

/*
|--------------------------------------------------------------------------
| Public Worker Controls
|--------------------------------------------------------------------------
*/

export const startKitchenPrintWorker = (
  options: KitchenPrintWorkerOptions
): void => {
  if (workerEnabled) {
    return;
  }

  workerEnabled = true;

  scheduleNext(options, 500);
};

export const stopKitchenPrintWorker = (): void => {
  workerEnabled = false;

  if (workerTimer) {
    clearTimeout(workerTimer);

    workerTimer = null;
  }
};
