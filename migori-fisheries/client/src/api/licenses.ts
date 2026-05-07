import { apiClient } from "@/api/client";
import type { License } from "@/types";

export type CreateLicensePayload = Pick<
  License,
  | "licenseNo"
  | "receiptNo"
  | "bmuName"
  | "holderName"
  | "holderIdNumber"
  | "holderPhoneNumber"
  | "holderEmail"
  | "subCounty"
  | "ward"
  | "beachName"
  | "market"
  | "amountLicensed"
  | "farmerId"
  | "type"
  | "issuedDate"
  | "expiryDate"
>;

export type UpdateLicensePayload = Partial<
  Pick<
    License,
    | "licenseNo"
    | "receiptNo"
    | "bmuName"
    | "holderName"
    | "holderIdNumber"
    | "holderPhoneNumber"
    | "holderEmail"
    | "subCounty"
    | "ward"
    | "beachName"
    | "market"
    | "amountLicensed"
    | "type"
    | "issuedDate"
    | "expiryDate"
    | "status"
  >
>;

export interface ImportLicensesResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

export const licensesApi = {
  async list(): Promise<License[]> {
    const { data } = await apiClient.get<{ data: License[] }>("/licenses");
    return data.data;
  },
  async create(payload: CreateLicensePayload): Promise<License> {
    const { data } = await apiClient.post<{ data: License }>("/licenses", payload);
    return data.data;
  },
  async update(id: string, payload: UpdateLicensePayload): Promise<License> {
    const { data } = await apiClient.put<{ data: License }>(`/licenses/${id}`, payload);
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/licenses/${id}`);
  },
  async importSpreadsheet(file: File): Promise<ImportLicensesResult> {
    const formData = new FormData();
    formData.append("file", file);

    const { data } = await apiClient.post<{ data: ImportLicensesResult }>("/licenses/import", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data.data;
  }
};
