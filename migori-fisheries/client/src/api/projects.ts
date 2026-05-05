import { apiClient } from "@/api/client";
import type { BlueEconomyProject } from "@/types";

export type CreateProjectPayload = Omit<
  BlueEconomyProject,
  "id" | "projectCode" | "createdAt" | "updatedAt" | "responsibleOfficerId" | "responsibleOfficerName"
>;
export type UpdateProjectPayload = Partial<CreateProjectPayload>;
export type ImportProjectsResult = {
  createdCount: number;
  skippedCount: number;
  errors: string[];
};

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
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/projects/${id}`);
  },
  async uploadImages(files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    const { data } = await apiClient.post<{ data: { photos: string[] } }>("/projects/upload-images", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data.data.photos;
  },
  async importSpreadsheet(file: File): Promise<ImportProjectsResult> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<{ data: ImportProjectsResult }>("/projects/import", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data.data;
  }
};
