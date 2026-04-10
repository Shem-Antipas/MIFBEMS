import { create } from "zustand";
import { authApi, type LoginPayload } from "@/api/auth";
import type { Role, User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  switchRole: (role: Role) => void;
  setAccessToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isBootstrapping: false,
  login: async (credentials) => {
    const response = await authApi.login(credentials);
    set({
      user: response.user,
      accessToken: response.accessToken,
      isAuthenticated: true
    });
  },
  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      set({ user: null, accessToken: null, isAuthenticated: false });
    }
  },
  bootstrap: async () => {
    if (get().isBootstrapping) {
      return;
    }

    set({ isBootstrapping: true });

    try {
      const response = await authApi.refresh();
      set({
        user: response.user,
        accessToken: response.accessToken,
        isAuthenticated: true
      });
    } catch (_error) {
      set({ user: null, accessToken: null, isAuthenticated: false });
    } finally {
      set({ isBootstrapping: false });
    }
  },
  switchRole: (role) => {
    const user = get().user;
    if (!user) return;

    set({
      user: { ...user, role }
    });
  },
  setAccessToken: (token) => {
    set((state) => ({
      accessToken: token,
      isAuthenticated: token ? true : state.isAuthenticated && Boolean(state.user)
    }));
  }
}));
