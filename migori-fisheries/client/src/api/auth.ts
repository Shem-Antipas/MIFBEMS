import axios from "axios";
import type { AuthResponse, User } from "@/types";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

const authClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await authClient.post<AuthResponse>("/auth/login", payload);
    return data;
  },
  async refresh(): Promise<AuthResponse> {
    const { data } = await authClient.post<AuthResponse>("/auth/refresh", {});
    return data;
  },
  async me(token: string): Promise<User> {
    const { data } = await authClient.get<{ user: User }>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.user;
  },
  async logout(): Promise<void> {
    await authClient.post("/auth/logout", {});
  }
};
