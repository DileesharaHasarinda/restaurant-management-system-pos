import { api } from "../lib/api";

import type {
  AssignRolePayload,
  CreateUserPayload,
  Pagination,
  Permission,
  Role,
  UpdateUserPayload,
  UpdateUserStatusPayload,
  User,
  UserListFilters,
  UserListResult,
  UserSession,
} from "./types";

interface UserListEnvelope {
  data: User[];

  meta?: {
    pagination?: Pagination;
  };
}

function buildUserQuery(filters: UserListFilters): string {
  const params = new URLSearchParams();

  const search = filters.search.trim();

  if (search !== "") {
    params.set("search", search);
  }

  if (filters.role) {
    params.set("role", filters.role);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage));

  return params.toString();
}

export async function getUsers(
  filters: UserListFilters
): Promise<UserListResult> {
  const response = await api.get<User[]>(`/users?${buildUserQuery(filters)}`);

  const envelope = response as unknown as UserListEnvelope;

  const pagination = envelope.meta?.pagination ?? {
    current_page: filters.page,

    per_page: filters.perPage,

    total: envelope.data.length,

    last_page: 1,
  };

  return {
    users: envelope.data,

    pagination,
  };
}

export async function getUser(userId: number): Promise<User> {
  const response = await api.get<User>(`/users/${userId}`);

  return response.data;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const response = await api.post<User>("/users", payload);

  return response.data;
}

export async function updateUser(
  userId: number,
  payload: UpdateUserPayload
): Promise<User> {
  const response = await api.put<User>(`/users/${userId}`, payload);

  return response.data;
}

export async function updateUserStatus(
  userId: number,
  payload: UpdateUserStatusPayload
): Promise<User> {
  const response = await api.patch<User>(`/users/${userId}/status`, payload);

  return response.data;
}

export async function assignUserRole(
  userId: number,
  payload: AssignRolePayload
): Promise<User> {
  const response = await api.patch<User>(`/users/${userId}/role`, payload);

  return response.data;
}

export async function getRoles(): Promise<Role[]> {
  const response = await api.get<Role[]>("/roles");

  return response.data;
}

export async function getPermissions(): Promise<Permission[]> {
  const response = await api.get<Permission[]>("/permissions");

  return response.data;
}

export async function getUserSessions(userId: number): Promise<UserSession[]> {
  const response = await api.get<UserSession[]>(`/users/${userId}/sessions`);

  return response.data;
}

export async function revokeUserSession(
  userId: number,
  tokenId: number
): Promise<void> {
  await api.delete<null>(`/users/${userId}/sessions/${tokenId}`);
}

export async function revokeAllUserSessions(userId: number): Promise<void> {
  await api.delete<unknown>(`/users/${userId}/sessions`);
}
