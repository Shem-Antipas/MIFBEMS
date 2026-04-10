import { apiClient } from "@/api/client";
import type { BlueEconomyProject } from "@/types";

export const projectsApi = {
  async list(): Promise<BlueEconomyProject[]> {
    const { data } = await apiClient.get<{ data: BlueEconomyProject[] }>("/projects");
    return data.data;
  }
};
