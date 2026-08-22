import { forwardToRestaurantApi } from "@/lib/server-api";

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { token } = await context.params;

  const body = await request.text();

  return forwardToRestaurantApi(
    `/public/table-qr/${encodeURIComponent(token)}/orders`,
    {
      method: "POST",
      body,
    }
  );
}
