import { apiClient } from "@/api/client";
import type { BlueEconomyProject } from "@/types";

export type CreateProjectPayload = Omit<
  BlueEconomyProject,
  "id" | "projectCode" | "createdAt" | "updatedAt" | "responsibleOfficerId" | "responsibleOfficerName"
>;
export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export const projectsApi = {
  async list(): Promise<BlueEconomyProject[]> {
    const { data } = await apiClient.get<{ data: BlueEconomyProject[] }>("/projects");
    return data.data;
  },
  async create(payload: CreateProjectPayload): Promise<BlueEconomyProject> {
    const { data } = await apiClient.post<{ data: BlueEconomyProject }>("/projects", payload);
    return data.data;
  },
  async update(id: string, payload: UpdateProjectPayload): Promise<BlueEconomyProject> {
    const { data } = await apiClient.put<{ data: BlueEconomyProject }>(`/projects/${id}`, payload);
    return data.data;
  }
};
