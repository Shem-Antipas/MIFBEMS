import { apiClient } from "@/api/client";
import type { User } from "@/types";

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: User["role"];
  subCounty?: string;
  isActive?: boolean;
};

export type UpdateUserPayload = Partial<
  Pick<CreateUserPayload, "name" | "email" | "role" | "subCounty" | "isActive" | "password">
>;

export const usersApi = {
  async list(): Promise<User[]> {
    const { data } = await apiClient.get<{ data: User[] }>("/users");
    return data.data;
  },
  async create(payload: CreateUserPayload): Promise<User> {
    const { data } = await apiClient.post<{ data: User }>("/users", payload);
    return data.data;
  },
  async update(id: string, payload: UpdateUserPayload): Promise<User> {
    const { data } = await apiClient.put<{ data: User }>(`/users/${id}`, payload);
    return data.data;
  },
  async deactivate(id: string): Promise<User> {
    const { data } = await apiClient.patch<{ data: User }>(`/users/${id}/deactivate`);
    return data.data;
  }
};
