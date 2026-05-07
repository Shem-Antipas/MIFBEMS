import { apiClient } from "@/api/client";
import type { Farmer } from "@/types";

type InitialLicensePayload = {
  licenseNo: string;
  receiptNo: string;
  bmuName?: string;
  type:
    | "FISH_DEPOT"
    | "FISHERMAN"
    | "FISH_TRADER"
    | "BOAT_OWNER"
    | "FISH_MOVEMENT_PERMIT"
    | "BOAT_LICENSE"
    | "NEW_BOARD_REGISTRATION"
    | "ICE_PLANT"
    | "BOAT";
  issuedDate: string;
  expiryDate: string;
};

export type CreateFarmerPayload = Omit<
  Farmer,
  "id" | "farmerCode" | "registeredById" | "createdAt" | "updatedAt" | "licenseNo"
> & {
  licenseNo?: string;
  initialLicense?: InitialLicensePayload;
};

export interface ImportFarmersResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

export const farmersApi = {
  async list(): Promise<Farmer[]> {
    const { data } = await apiClient.get<{ data: Farmer[] }>("/farmers");
    return data.data;
  },
  async create(payload: CreateFarmerPayload): Promise<Farmer> {
    const { data } = await apiClient.post<{ data: Farmer }>("/farmers", payload);
    return data.data;
  },
  async update(id: string, payload: Partial<CreateFarmerPayload>): Promise<Farmer> {
    const { data } = await apiClient.put<{ data: Farmer }>(`/farmers/${id}`, payload);
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/farmers/${id}`);
  },
  async importSpreadsheet(file: File): Promise<ImportFarmersResult> {
    const formData = new FormData();
    formData.append("file", file);

    const { data } = await apiClient.post<{ data: ImportFarmersResult }>("/farmers/import", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data.data;
  }
};
