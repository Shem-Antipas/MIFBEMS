import { apiClient } from "@/api/client";
import type { CaptureFisheriesRecord } from "@/types";

export type CreateCaptureFisheriesPayload = Pick<
  CaptureFisheriesRecord,
  | "extensionOfficerName"
  | "extensionOfficerPhone"
  | "fisherName"
  | "farmerNumber"
  | "idNumber"
  | "phoneNumber"
  | "subCounty"
  | "ward"
  | "gender"
  | "ageBracket"
  | "topics"
  | "bmuName"
  | "landingSite"
  | "latitude"
  | "longitude"
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
  },
  async updateApproval(id: string, status: "APPROVED" | "REJECTED"): Promise<CaptureFisheriesRecord> {
    const { data } = await apiClient.patch<{ data: CaptureFisheriesRecord }>(`/capture-fisheries/${id}/approval`, {
      status
    });
    return data.data;
  }
};
