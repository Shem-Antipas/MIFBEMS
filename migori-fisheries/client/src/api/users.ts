import { apiClient } from "@/api/client";
import type { User } from "@/types";

export const usersApi = {
  async list(): Promise<User[]> {
    const { data } = await apiClient.get<{ data: User[] }>("/users");
    return data.data;
  }
};
