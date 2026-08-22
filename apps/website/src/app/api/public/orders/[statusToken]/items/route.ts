import { forwardToRestaurantApi } from "@/lib/server-api";

interface RouteContext {
  params: Promise<{
    statusToken: string;
  }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { statusToken } = await context.params;

  const body = await request.text();

  return forwardToRestaurantApi(
    `/public/orders/${encodeURIComponent(statusToken)}/items`,
    {
      method: "POST",
      body,
    }
  );
}
