import { api } from "../lib/api";

import type { DashboardData } from "./types";

export async function getDashboard(): Promise<DashboardData> {
  const response = await api.get<DashboardData>("/dashboard");

  return response.data;
}
