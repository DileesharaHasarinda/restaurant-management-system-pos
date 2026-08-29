import { forwardToRestaurantApi } from "../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();

  return forwardToRestaurantApi("/public/reviews", {
    method: "POST",

    body,
  });
}
