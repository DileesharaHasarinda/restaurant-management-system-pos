export type TableStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "RESERVED"
  | "CLEANING"
  | "OUT_OF_SERVICE";

export type ManualTableStatus = Exclude<TableStatus, "OCCUPIED">;

export interface TableQrToken {
  id: number;

  token: string;

  order_url: string;

  is_active: boolean;

  expires_at: string | null;

  last_scanned_at: string | null;

  created_at: string | null;
}

export interface TableSession {
  id: number;

  session_number: string;

  public_token: string;

  business_day_id: number;

  table_id: number;

  merged_into_session_id: number | null;

  guest_count: number;

  opened_source: string;

  status: "OPEN" | "CLOSED" | "MERGED";

  opened_at: string | null;

  closed_at: string | null;

  closed_by: number | null;

  close_reason: string | null;

  last_activity_at: string | null;

  bill_requested: boolean;

  bill_requested_at: string | null;

  bill_requested_by: number | null;
}

export interface RestaurantTable {
  id: number;

  table_number: number;

  code: string;

  name: string | null;

  area: string | null;

  capacity: number;

  status: TableStatus;

  qr_ordering_enabled: boolean;

  is_active: boolean;

  sort_order: number;

  notes: string | null;

  qr: TableQrToken | null;

  current_session: TableSession | null;

  created_at: string | null;

  updated_at: string | null;
}

export interface TableFormValues {
  table_number: number;

  name: string;

  area: string;

  capacity: number;

  qr_ordering_enabled: boolean;

  is_active: boolean;

  notes: string;
}

export interface CreateTablePayload {
  table_number: number;

  name: string | null;

  area: string | null;

  capacity: number;

  qr_ordering_enabled: boolean;

  notes: string | null;
}

export interface UpdateTablePayload {
  table_number: number;

  name: string | null;

  area: string | null;

  capacity: number;

  is_active: boolean;

  notes: string | null;
}

export interface HistoryTableReference {
  id: number | null;

  table_number: number | null;

  code: string | null;

  name: string | null;
}

export interface HistoryUser {
  id: number;

  name: string;
}

export interface TableTransfer {
  id: number;

  table_session_id: number;

  from_table: HistoryTableReference;

  to_table: HistoryTableReference;

  reason: string | null;

  transferred_by: HistoryUser | null;

  transferred_at: string | null;
}

export interface TableMerge {
  id: number;

  source_session_id: number;

  target_session_id: number;

  source_table: HistoryTableReference;

  target_table: HistoryTableReference;

  reason: string | null;

  merged_by: HistoryUser | null;

  merged_at: string | null;
}

export interface Pagination {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

export interface TableHistoryResponse<T> {
  items: T[];

  pagination: Pagination;
}

export interface TransferTablePayload {
  to_table_id: number;

  reason?: string | null;
}

export interface MergeTablesPayload {
  secondary_table_id: number;

  reason?: string | null;
}
