import { createContext } from "react";

import type { AuthUser } from "../types/auth";

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

export interface LoginInput {
  login: string;

  password: string;
}

export interface LoginResult {
  success: boolean;

  message?: string;
}

/*
|--------------------------------------------------------------------------
| Auth Context
|--------------------------------------------------------------------------
*/

export interface AuthContextValue {
  user: AuthUser | null;

  loading: boolean;

  authenticated: boolean;

  login: (input: LoginInput) => Promise<LoginResult>;

  logout: () => Promise<void>;

  refreshUser: () => Promise<void>;

  hasPermission: (permission: string) => boolean;

  hasAnyPermission: (permissions: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
