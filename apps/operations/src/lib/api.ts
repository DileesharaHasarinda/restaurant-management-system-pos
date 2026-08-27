import type { ApiSuccess } from "../types/auth";

/*
|--------------------------------------------------------------------------
| API Base URL
|--------------------------------------------------------------------------
*/

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  typeof configuredApiBaseUrl === "string"
    ? configuredApiBaseUrl.replace(/\/+$/, "")
    : "http://127.0.0.1:8000/api/v1";

/*
|--------------------------------------------------------------------------
| Token Storage
|--------------------------------------------------------------------------
*/

const TOKEN_KEY = "restaurant-operations-token";

export const authTokenStorage = {
  get(): string | null {
    return window.sessionStorage.getItem(TOKEN_KEY);
  },

  set(token: string): void {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  },

  clear(): void {
    window.sessionStorage.removeItem(TOKEN_KEY);
  },
};

/*
|--------------------------------------------------------------------------
| API Error
|--------------------------------------------------------------------------
*/

export class ApiError extends Error {
  readonly status: number;

  readonly code: string | null;

  readonly errors: Record<string, string[]>;

  constructor(
    message: string,

    status: number,

    code: string | null = null,

    errors: Record<string, string[]> = {}
  ) {
    super(message);

    this.name = "ApiError";

    this.status = status;

    this.code = code;

    this.errors = errors;
  }
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeValidationErrors(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, string[]> = {};

  for (const [key, fieldValue] of Object.entries(value)) {
    if (Array.isArray(fieldValue)) {
      result[key] = fieldValue.filter(
        (item): item is string => typeof item === "string"
      );

      continue;
    }

    if (typeof fieldValue === "string") {
      result[key] = [fieldValue];
    }
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| Request Options
|--------------------------------------------------------------------------
*/

interface RequestOptions extends RequestInit {
  authenticated?: boolean;
}

/*
|--------------------------------------------------------------------------
| Request
|--------------------------------------------------------------------------
*/

async function request<T>(
  endpoint: string,

  options: RequestOptions = {}
): Promise<ApiSuccess<T>> {
  const {
    authenticated = true,

    headers,
    ...requestOptions
  } = options;

  const token = authTokenStorage.get();

  const requestHeaders = new Headers(headers);

  requestHeaders.set("Accept", "application/json");

  if (
    requestOptions.body !== undefined &&
    requestOptions.body !== null &&
    !requestHeaders.has("Content-Type") &&
    !(requestOptions.body instanceof FormData)
  ) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (authenticated && token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...requestOptions,

      headers: requestHeaders,
    });
  } catch {
    throw new ApiError(
      "Unable to connect to the restaurant server.",
      0,
      "NETWORK_ERROR"
    );
  }

  /*
    |--------------------------------------------------------------------------
    | Handle Empty Response
    |--------------------------------------------------------------------------
    */

  if (response.status === 204) {
    return {
      success: true,

      data: undefined as T,

      message: "Request completed successfully.",
    };
  }

  /*
    |--------------------------------------------------------------------------
    | Parse JSON
    |--------------------------------------------------------------------------
    */

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "The restaurant server returned an invalid response.",
      response.status,
      "INVALID_RESPONSE"
    );
  }

  /*
    |--------------------------------------------------------------------------
    | HTTP Error Response
    |--------------------------------------------------------------------------
    */

  if (!response.ok) {
    if (!isRecord(payload)) {
      throw new ApiError(
        "The request could not be completed.",
        response.status,
        "REQUEST_FAILED"
      );
    }

    const message =
      getString(payload.message) ?? "The request could not be completed.";

    const code = getString(payload.code);

    const errors = normalizeValidationErrors(payload.errors);

    throw new ApiError(message, response.status, code, errors);
  }

  /*
    |--------------------------------------------------------------------------
    | Validate Successful Envelope
    |--------------------------------------------------------------------------
    */

  if (!isRecord(payload)) {
    throw new ApiError(
      "The restaurant server returned an invalid response.",
      response.status,
      "INVALID_RESPONSE"
    );
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new ApiError(
      "The restaurant server response does not contain data.",
      response.status,
      "INVALID_RESPONSE"
    );
  }

  const success = payload.success;

  if (success === false) {
    throw new ApiError(
      getString(payload.message) ?? "The request could not be completed.",
      response.status,
      getString(payload.code),
      normalizeValidationErrors(payload.errors)
    );
  }

  /*
    |--------------------------------------------------------------------------
    | Successful Response
    |--------------------------------------------------------------------------
    */

  return {
    success: true,

    data: payload.data as T,

    message: getString(payload.message) ?? "Request completed successfully.",
  };
}

/*
|--------------------------------------------------------------------------
| API Client
|--------------------------------------------------------------------------
*/

export const api = {
  get<T>(
    endpoint: string,

    authenticated = true
  ): Promise<ApiSuccess<T>> {
    return request<T>(endpoint, {
      method: "GET",

      authenticated,
    });
  },

  post<T>(
    endpoint: string,

    body?: unknown,

    authenticated = true
  ): Promise<ApiSuccess<T>> {
    return request<T>(endpoint, {
      method: "POST",

      authenticated,

      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  put<T>(
    endpoint: string,

    body?: unknown
  ): Promise<ApiSuccess<T>> {
    return request<T>(endpoint, {
      method: "PUT",

      authenticated: true,

      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  patch<T>(
    endpoint: string,

    body?: unknown
  ): Promise<ApiSuccess<T>> {
    return request<T>(endpoint, {
      method: "PATCH",

      authenticated: true,

      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  delete<T>(endpoint: string): Promise<ApiSuccess<T>> {
    return request<T>(endpoint, {
      method: "DELETE",

      authenticated: true,
    });
  },
};
