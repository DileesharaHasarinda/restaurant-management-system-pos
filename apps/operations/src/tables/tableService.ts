import { API_BASE_URL, ApiError, api } from "../lib/api";

import type {
  CreateTablePayload,
  ManualTableStatus,
  MergeTablesPayload,
  RestaurantTable,
  TableHistoryResponse,
  TableMerge,
  TableQrToken,
  TableTransfer,
  TransferTablePayload,
  UpdateTablePayload,
} from "./types";

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractTables(value: unknown): RestaurantTable[] {
  if (Array.isArray(value)) {
    return value as RestaurantTable[];
  }

  const record = recordValue(value);

  if (!record) {
    return [];
  }

  if (Array.isArray(record.data)) {
    return record.data as RestaurantTable[];
  }

  if (Array.isArray(record.items)) {
    return record.items as RestaurantTable[];
  }

  return [];
}

export async function getTables(): Promise<RestaurantTable[]> {
  const response = await api.get<unknown>("/tables?per_page=100");

  return extractTables(response.data);
}

export async function getTable(tableId: number): Promise<RestaurantTable> {
  const response = await api.get<RestaurantTable>(`/tables/${tableId}`);

  return response.data;
}

export async function createTable(
  payload: CreateTablePayload
): Promise<RestaurantTable> {
  const response = await api.post<RestaurantTable>("/tables", payload);

  return response.data;
}

export async function updateTable(
  tableId: number,

  payload: UpdateTablePayload
): Promise<RestaurantTable> {
  const response = await api.put<RestaurantTable>(
    `/tables/${tableId}`,
    payload
  );

  return response.data;
}

export async function setTableActive(
  table: RestaurantTable,

  enabled: boolean
): Promise<RestaurantTable> {
  return updateTable(table.id, {
    table_number: table.table_number,

    name: table.name,

    area: table.area,

    capacity: table.capacity,

    is_active: enabled,

    notes: table.notes,
  });
}

export async function updateTableStatus(
  tableId: number,

  status: ManualTableStatus
): Promise<RestaurantTable> {
  const response = await api.patch<RestaurantTable>(
    `/tables/${tableId}/status`,
    {
      status,
    }
  );

  return response.data;
}

export async function updateQrOrdering(
  tableId: number,

  enabled: boolean
): Promise<RestaurantTable> {
  const response = await api.patch<RestaurantTable>(
    `/tables/${tableId}/qr-ordering`,
    {
      enabled,
    }
  );

  return response.data;
}

export async function getTableQr(tableId: number): Promise<TableQrToken> {
  const response = await api.get<TableQrToken>(`/tables/${tableId}/qr`);

  return response.data;
}

export async function regenerateTableQr(
  tableId: number
): Promise<TableQrToken> {
  const response = await api.post<TableQrToken>(
    `/tables/${tableId}/qr/regenerate`,
    {}
  );

  return response.data;
}

export async function transferTable(
  sourceTableId: number,

  payload: TransferTablePayload
): Promise<void> {
  await api.post(`/tables/${sourceTableId}/transfer`, payload);
}

export async function mergeTables(
  primaryTableId: number,

  payload: MergeTablesPayload
): Promise<void> {
  await api.post(`/tables/${primaryTableId}/merge`, payload);
}

export async function getTransferHistory(
  tableId: number
): Promise<TableHistoryResponse<TableTransfer>> {
  const response = await api.get<TableHistoryResponse<TableTransfer>>(
    `/tables/${tableId}/transfers?per_page=100`
  );

  return response.data;
}

export async function getMergeHistory(
  tableId: number
): Promise<TableHistoryResponse<TableMerge>> {
  const response = await api.get<TableHistoryResponse<TableMerge>>(
    `/tables/${tableId}/merges?per_page=100`
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Raw Authenticated Endpoints
|--------------------------------------------------------------------------
|
| QR SVG / download / print do not return the normal
| JSON ApiResponse envelope, so the generic api client
| cannot be used for these endpoints.
|--------------------------------------------------------------------------
*/

async function authenticatedFetch(endpoint: string): Promise<Response> {
  const headers = new Headers();

  headers.set("Accept", "*/*");

  headers.set("X-Requested-With", "XMLHttpRequest");

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",

      headers,

      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Unable to connect to the restaurant server.",
      0,
      "NETWORK_ERROR"
    );
  }

  if (!response.ok) {
    throw new ApiError(
      "The QR request could not be completed.",
      response.status,
      "QR_REQUEST_FAILED"
    );
  }

  return response;
}

export async function getTableQrSvg(tableId: number): Promise<string> {
  const response = await authenticatedFetch(`/tables/${tableId}/qr/svg`);

  return response.text();
}

export async function downloadTableQr(table: RestaurantTable): Promise<void> {
  const response = await authenticatedFetch(`/tables/${table.id}/qr/download`);

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download = `table-${String(table.table_number).padStart(
    2,
    "0"
  )}-qr.svg`;

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(url);
}

export async function printTableQr(tableId: number): Promise<void> {
  /*
   * Open immediately while still inside the click event,
   * otherwise browsers can block the popup.
   */
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("The browser blocked the QR print window.");
  }

  try {
    printWindow.document.write(
      "<p style='font-family:sans-serif;padding:24px'>Loading QR print page...</p>"
    );

    const response = await authenticatedFetch(`/tables/${tableId}/qr/print`);

    const html = await response.text();

    printWindow.document.open();

    printWindow.document.write(html);

    printWindow.document.close();
  } catch (error) {
    printWindow.close();

    throw error;
  }
}
