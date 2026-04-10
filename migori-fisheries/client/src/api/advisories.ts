import { apiClient } from "@/api/client";
import type { Advisory } from "@/types";

export const advisoriesApi = {
  async list(): Promise<Advisory[]> {
    const { data } = await apiClient.get<{ data: Advisory[] }>("/advisories");
    return data.data;
  }
};
