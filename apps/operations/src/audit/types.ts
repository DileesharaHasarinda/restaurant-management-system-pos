export interface AuditRole {
  code: string;

  name: string;
}

export interface AuditActor {
  id: number;

  name: string;

  username: string | null;

  role: AuditRole | null;
}

export interface AuditRequestInfo {
  ip_address: string | null;

  user_agent: string | null;

  method: string | null;

  path: string | null;
}

export interface AuditLog {
  id: number;

  action: string;

  entity_type: string | null;

  entity_id: number | null;

  actor: AuditActor | null;

  old_values: unknown;

  new_values: unknown;

  metadata: unknown;

  request: AuditRequestInfo;

  created_at: string | null;
}

export interface AuditPagination {
  currentPage: number;

  perPage: number;

  total: number;

  lastPage: number;
}

export interface AuditLogListResult {
  items: AuditLog[];

  pagination: AuditPagination;
}

export interface AuditLogFilters {
  search: string;

  action: string;

  entityType: string;

  dateFrom: string;

  dateTo: string;
}
