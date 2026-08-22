import { forwardToRestaurantApi } from "@/lib/server-api";

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  const { token } = await context.params;

  return forwardToRestaurantApi(
    `/public/table-qr/${encodeURIComponent(token)}`
  );
}
