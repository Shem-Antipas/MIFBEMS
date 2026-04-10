import { apiClient } from "@/api/client";
import type { License } from "@/types";

export type UpdateLicensePayload = Partial<Pick<License, "type" | "issuedDate" | "expiryDate" | "status">>;

export const licensesApi = {
  async list(): Promise<License[]> {
    const { data } = await apiClient.get<{ data: License[] }>("/licenses");
    return data.data;
  },
  async update(id: string, payload: UpdateLicensePayload): Promise<License> {
    const { data } = await apiClient.put<{ data: License }>(`/licenses/${id}`, payload);
    return data.data;
  }
};
