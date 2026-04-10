import { apiClient } from "@/api/client";
import type { DashboardSummary } from "@/types";

export interface SummaryResponse {
  summary: DashboardSummary;
  productionBySubCounty: Array<{ subCounty: string; _sum: { productionKg: number | null } }>;
  licensesByStatus: Array<{ status: string; _count: { id: number } }>;
}

export const reportsApi = {
  async summary(): Promise<SummaryResponse> {
    const { data } = await apiClient.get<{ data: SummaryResponse }>("/reports/summary");
    return data.data;
  }
};
