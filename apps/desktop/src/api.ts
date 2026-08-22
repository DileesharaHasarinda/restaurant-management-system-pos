import type { PosUser } from "./types";

/*
|--------------------------------------------------------------------------
| Restaurant API URL
|--------------------------------------------------------------------------
|
| Current local-development Laravel API.
|
| We are intentionally not using import.meta.env here because the current
| Electron Forge TypeScript configuration reported import.meta as unsupported.
|
*/

export const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export interface ApiEnvelope<T> {
  success?: boolean;

  data: T;

  message?: string;

  code?: string;

  errors?: Record<string, string[]>;

  meta?: unknown;
}

export class ApiError extends Error {
  public readonly status: number;

  public readonly code?: string;

  public readonly errors?: Record<string, string[]>;

  public constructor(
    message: string,
    status: number,
    code?: string,
    errors?: Record<string, string[]>
  ) {
    super(message);

    this.name = "ApiError";

    this.status = status;

    this.code = code;

    this.errors = errors;
  }
}

const request = async <T>(
  endpoint: string,
  options: RequestInit = {},
  authenticated = true
): Promise<ApiEnvelope<T>> => {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated) {
    const token = await window.posBridge.getAuthToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (exception) {
    console.error("Restaurant API network error:", exception);

    throw new ApiError(
      "Unable to connect to the Restaurant API.",
      0,
      "NETWORK_ERROR"
    );
  }

  let payload: ApiEnvelope<T>;

  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "The Restaurant API returned an invalid response.",
      response.status,
      "INVALID_API_RESPONSE"
    );
  }

  if (!response.ok) {
    throw new ApiError(
      payload.message ?? "The request could not be completed.",

      response.status,

      payload.code,

      payload.errors
    );
  }

  return payload;
};

export const api = {
  get: <T>(endpoint: string): Promise<ApiEnvelope<T>> => request<T>(endpoint),

  post: <T>(endpoint: string, body?: unknown): Promise<ApiEnvelope<T>> =>
    request<T>(endpoint, {
      method: "POST",

      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  login: (
    login: string,
    password: string,
    deviceName: string
  ): Promise<
    ApiEnvelope<{
      token_type: string;
      access_token: string;
      expires_at: string;
      user: PosUser;
    }>
  > =>
    request(
      "/auth/login",

      {
        method: "POST",

        body: JSON.stringify({
          login,
          password,

          device_name: deviceName,
        }),

        headers: {
          "Content-Type": "application/json",
        },
      },

      false
    ),

  logout: (): Promise<ApiEnvelope<null>> =>
    request("/auth/logout", {
      method: "POST",
    }),
};

export const extractList = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    const nested = (
      value as {
        data?: unknown;
      }
    ).data;

    if (Array.isArray(nested)) {
      return nested as T[];
    }
  }

  return [];
};
