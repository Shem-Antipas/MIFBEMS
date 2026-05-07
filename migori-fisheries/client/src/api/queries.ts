import { apiClient } from "@/api/client";
import type { QueryRecord } from "@/types";

export const queriesApi = {
  async list(): Promise<QueryRecord[]> {
    const { data } = await apiClient.get<{ data: QueryRecord[] }>("/queries");
    return data.data;
  },
  async create(payload: { subject: string; message: string }): Promise<QueryRecord> {
    const { data } = await apiClient.post<{ data: QueryRecord }>("/queries", payload);
    return data.data;
  },
  async reply(id: string, payload: { reply: string; status?: "PENDING" | "RESOLVED" }): Promise<QueryRecord> {
    const { data } = await apiClient.patch<{ data: QueryRecord }>(`/queries/${id}/reply`, payload);
    return data.data;
  }
};
