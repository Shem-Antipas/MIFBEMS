import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/api/auth";

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = authApi
      .refresh()
      .then((response) => {
        useAuthStore.getState().setAccessToken(response.accessToken);
        useAuthStore.setState({ user: response.user, isAuthenticated: true });
        return response.accessToken;
      })
      .catch(async () => {
        await useAuthStore.getState().logout();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !String(originalRequest.url).includes("/auth/login") &&
      !String(originalRequest.url).includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      const nextToken = await refreshAccessToken();

      if (nextToken) {
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${nextToken}`
        };
        return apiClient.request(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
