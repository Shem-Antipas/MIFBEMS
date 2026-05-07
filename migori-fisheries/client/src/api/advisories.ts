import { apiClient } from "@/api/client";
import type { Advisory } from "@/types";

export type CreateAdvisoryPayload = Pick<Advisory, "title" | "message" | "type" | "fromName" | "subCounty" | "targetUserId">;

export const advisoriesApi = {
  async list(): Promise<Advisory[]> {
    const { data } = await apiClient.get<{ data: Advisory[] }>("/advisories");
    return data.data;
  },
  async create(payload: CreateAdvisoryPayload): Promise<Advisory> {
    const { data } = await apiClient.post<{ data: Advisory }>("/advisories", payload);
    return data.data;
  }
};
