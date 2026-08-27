export type OperationsRoleCode = "OWNER" | "ADMIN" | "MANAGER" | "WAITER";

export type SystemRoleCode = OperationsRoleCode | "CASHIER";

export interface AuthRole {
  id: number;

  name: string;

  code: SystemRoleCode;
}

export interface AuthUser {
  id: number;

  name: string;

  username: string;

  email: string | null;

  phone: string | null;

  status: string;

  last_login_at: string | null;

  role: AuthRole | null;

  permissions: string[];

  created_at: string | null;

  updated_at: string | null;
}

export interface LoginResponseData {
  token_type: string;

  access_token: string;

  expires_at: string;

  user: AuthUser;
}

export interface ApiSuccess<T> {
  success: true;

  data: T;

  message: string;

  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success?: false;

  message?: string;

  code?: string;

  errors?: Record<string, string[]>;
}
