import { apiClient } from "@/api/client";
import type { CaptureFisheriesRecord } from "@/types";

export type CreateCaptureFisheriesPayload = Pick<
  CaptureFisheriesRecord,
  | "fisherName"
  | "idNumber"
  | "phoneNumber"
  | "ward"
  | "bmuName"
  | "landingSite"
  | "species"
  | "catchKg"
  | "value"
  | "month"
  | "year"
  | "effortHours"
  | "fishingDate"
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
