import { apiClient } from "@/api/client";
import type { Farmer } from "@/types";

type InitialLicensePayload = {
  licenseNo: string;
  type: "AQUACULTURE" | "COMMERCIAL_FISHING" | "ARTISANAL_FISHING";
  issuedDate: string;
  expiryDate: string;
  status?: "VALID" | "EXPIRED" | "REVOKED";
};

export type CreateFarmerPayload = Omit<
  Farmer,
  "id" | "registeredById" | "createdAt" | "updatedAt" | "licenseNo"
> & {
  licenseNo?: string;
  initialLicense?: InitialLicensePayload;
};

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
  }
};
