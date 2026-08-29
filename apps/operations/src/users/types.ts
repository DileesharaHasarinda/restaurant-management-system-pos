export type UserStatus = "ACTIVE" | "INACTIVE";

export type RoleCode = "OWNER" | "ADMIN" | "MANAGER" | "CASHIER" | "WAITER";

export interface UserRole {
  id: number;
  name: string;
  code: RoleCode;
}

export interface User {
  id: number;

  name: string;
  username: string;

  email: string | null;
  phone: string | null;

  status: UserStatus;

  last_login_at: string | null;

  role: UserRole | null;

  permissions: string[];

  created_at: string | null;
  updated_at: string | null;
}

export interface Role {
  id: number;

  name: string;
  code: RoleCode;

  description: string | null;

  is_active: boolean;

  permissions: string[];
}

export interface Permission {
  id: number;

  name: string;
  code: string;
  group: string;
  description: string | null;
}

export interface UserSession {
  id: number;

  name: string;

  abilities: string[];

  last_used_at: string | null;
  expires_at: string | null;

  created_at: string | null;
  updated_at: string | null;
}

export interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface UserListFilters {
  search: string;

  role: RoleCode | "";

  status: UserStatus | "";

  page: number;

  perPage: number;
}

export interface UserListResult {
  users: User[];

  pagination: Pagination;
}

export interface CreateUserPayload {
  name: string;
  username: string;

  email: string | null;
  phone: string | null;

  role_id: number;

  password: string;
  password_confirmation: string;
}

export interface UpdateUserPayload {
  name: string;
  username: string;

  email: string | null;
  phone: string | null;
}

export interface UpdateUserStatusPayload {
  status: UserStatus;
}

export interface AssignRolePayload {
  role_id: number;
}
