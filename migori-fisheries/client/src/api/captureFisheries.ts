import { apiClient } from "@/api/client";
import type { CaptureFisheriesRecord } from "@/types";

export type CreateCaptureFisheriesPayload = Pick<
  CaptureFisheriesRecord,
  "fisherName" | "bmuName" | "landingSite" | "species" | "catchKg" | "effortHours" | "fishingDate"
>;

export const captureFisheriesApi = {
  async list(): Promise<CaptureFisheriesRecord[]> {
    const { data } = await apiClient.get<{ data: CaptureFisheriesRecord[] }>("/capture-fisheries");
    return data.data;
  },
  async create(payload: CreateCaptureFisheriesPayload): Promise<CaptureFisheriesRecord> {
    const { data } = await apiClient.post<{ data: CaptureFisheriesRecord }>("/capture-fisheries", payload);
    return data.data;
  }
};
