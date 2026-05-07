import { apiClient } from "@/api/client";
import type { ExtensionPhoto, Inspection } from "@/types";

export type CreateInspectionPayload = {
  extensionOfficerName: string;
  extensionOfficerPhone: string;
  farmName: string;
  farmerNumber?: string;
  farmerPhoneNumber?: string;
  gender: "MALE" | "FEMALE";
  ageBracket: "YOUTH" | "ADULT";
  subCounty: string;
  ward: string;
  extensionTopics: string[];
  feedback?: string;
  challenges?: string;
  latitude?: number;
  longitude?: number;
  photos?: ExtensionPhoto[];
  date: string;
  result?: "PASS" | "FAIL" | "PENDING";
  notes?: string;
};

export const inspectionsApi = {
  async list(): Promise<Inspection[]> {
    const { data } = await apiClient.get<{ data: Inspection[] }>("/inspections");
    return data.data;
  },
  async create(payload: CreateInspectionPayload): Promise<Inspection> {
    const { data } = await apiClient.post<{ data: Inspection }>("/inspections", payload);
    return data.data;
  },
  async update(id: string, payload: Partial<CreateInspectionPayload>): Promise<Inspection> {
    const { data } = await apiClient.put<{ data: Inspection }>(`/inspections/${id}`, payload);
    return data.data;
  },
  async updateApproval(id: string, approvalStatus: "APPROVED" | "REJECTED"): Promise<Inspection> {
    const { data } = await apiClient.patch<{ data: Inspection }>(`/inspections/${id}/approval`, { approvalStatus });
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/inspections/${id}`);
  }
};
