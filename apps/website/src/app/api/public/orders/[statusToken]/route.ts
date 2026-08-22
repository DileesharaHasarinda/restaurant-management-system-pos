import { forwardToRestaurantApi } from "@/lib/server-api";

interface RouteContext {
  params: Promise<{
    statusToken: string;
  }>;
}

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  const { statusToken } = await context.params;

  return forwardToRestaurantApi(
    `/public/orders/${encodeURIComponent(statusToken)}`
  );
}
