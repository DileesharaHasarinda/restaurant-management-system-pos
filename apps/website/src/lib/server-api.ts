function apiBaseUrl(): string {
  const value =
    process.env.RESTAURANT_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

  return value.replace(/\/+$/, "");
}

export async function forwardToRestaurantApi(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (init.body !== undefined && init.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,

      headers,

      cache: "no-store",
    });

    const body = await response.text();

    return new Response(body || null, {
      status: response.status,

      statusText: response.statusText,

      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("Restaurant API proxy failed:", error);

    return Response.json(
      {
        success: false,

        message: "The restaurant service is temporarily unavailable.",

        code: "API_UNAVAILABLE",
      },
      {
        status: 503,
      }
    );
  }
}
