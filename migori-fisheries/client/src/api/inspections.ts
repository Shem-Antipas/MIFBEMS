import { apiClient } from "@/api/client";
import type { Inspection } from "@/types";

export const inspectionsApi = {
  async list(): Promise<Inspection[]> {
    const { data } = await apiClient.get<{ data: Inspection[] }>("/inspections");
    return data.data;
  }
};
