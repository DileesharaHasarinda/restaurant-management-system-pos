import { forwardToRestaurantApi } from "@/lib/server-api";

export async function GET(): Promise<Response> {
  return forwardToRestaurantApi("/public/menu/qr");
}
