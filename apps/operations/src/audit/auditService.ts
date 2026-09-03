import { api } from "../lib/api";

import type {
  AuditLog,
  AuditLogFilters,
  AuditLogListResult,
  AuditPagination,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number): number {
  const result = Number(value);

  return Number.isFinite(result) ? result : fallback;
}

function paginationFromMeta(meta: unknown): AuditPagination {
  if (!isRecord(meta) || !isRecord(meta.pagination)) {
    return {
      currentPage: 1,
      perPage: 25,
      total: 0,
      lastPage: 1,
    };
  }

  const pagination = meta.pagination;

  return {
    currentPage: numberValue(pagination.current_page, 1),

    perPage: numberValue(pagination.per_page, 25),

    total: numberValue(pagination.total, 0),

    lastPage: numberValue(pagination.last_page, 1),
  };
}

export async function getAuditLogs(
  filters: AuditLogFilters,
  page = 1,
  perPage = 25
): Promise<AuditLogListResult> {
  const params = new URLSearchParams();

  const search = filters.search.trim();

  const action = filters.action.trim();

  const entityType = filters.entityType.trim();

  if (search) {
    params.set("search", search);
  }

  if (action) {
    params.set("action", action);
  }

  if (entityType) {
    params.set("entity_type", entityType);
  }

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  params.set("page", String(page));

  params.set("per_page", String(perPage));

  const response = await api.get<AuditLog[]>(
    `/audit-logs?${params.toString()}`
  );

  return {
    items: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

export async function getAuditLog(auditLogId: number): Promise<AuditLog> {
  const response = await api.get<AuditLog>(`/audit-logs/${auditLogId}`);

  return response.data;
}
