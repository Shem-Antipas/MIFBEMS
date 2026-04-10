import { apiClient } from "@/api/client";
import type { License } from "@/types";

export const licensesApi = {
  async list(): Promise<License[]> {
    const { data } = await apiClient.get<{ data: License[] }>("/licenses");
    return data.data;
  }
};
