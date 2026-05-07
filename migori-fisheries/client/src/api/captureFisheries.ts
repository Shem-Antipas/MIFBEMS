import { apiClient } from "@/api/client";
import type { CageProductionRecord, CaptureFisheriesRecord } from "@/types";

export type CreateCaptureFisheriesPayload = Pick<
  CaptureFisheriesRecord,
  | "extensionOfficerName"
  | "fisherName"
  | "farmerNumber"
  | "idNumber"
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
> & {
  extensionOfficerPhone?: string;
  phoneNumber: string;
};

export type CreateCageProductionPayload = Pick<
  CageProductionRecord,
  | "farmerUniqueId"
  | "farmerName"
  | "phoneNumber"
  | "idNumber"
  | "bmuLocation"
  | "cageIdentifier"
  | "fishSpecies"
  | "subCounty"
  | "ward"
  | "numberOfCages"
  | "activeCages"
  | "inactiveCages"
  | "fingerlingsStocked"
  | "stockingDate"
  | "feedTypes"
  | "feedQuantityKg"
  | "averageFishWeightKg"
  | "mortalityPieces"
  | "quantityHarvestedKg"
  | "numberHarvestedPieces"
  | "harvestDate"
  | "extensionOfficerName"
  | "remarks"
  | "month"
  | "year"
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
  },
  async update(id: string, payload: Partial<CreateCaptureFisheriesPayload>): Promise<CaptureFisheriesRecord> {
    const { data } = await apiClient.put<{ data: CaptureFisheriesRecord }>(`/capture-fisheries/${id}`, payload);
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/capture-fisheries/${id}`);
  },
  async listCageProduction(): Promise<CageProductionRecord[]> {
    const { data } = await apiClient.get<{ data: CageProductionRecord[] }>("/capture-fisheries/cage-production");
    return data.data;
  },
  async createCageProduction(payload: CreateCageProductionPayload): Promise<CageProductionRecord> {
    const { data } = await apiClient.post<{ data: CageProductionRecord }>("/capture-fisheries/cage-production", payload);
    return data.data;
  },
  async updateCageProduction(id: string, payload: Partial<CreateCageProductionPayload>): Promise<CageProductionRecord> {
    const { data } = await apiClient.put<{ data: CageProductionRecord }>(`/capture-fisheries/cage-production/${id}`, payload);
    return data.data;
  },
  async removeCageProduction(id: string): Promise<void> {
    await apiClient.delete(`/capture-fisheries/cage-production/${id}`);
  }
};
