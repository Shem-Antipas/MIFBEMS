import { create } from "zustand";
import { authApi, type LoginPayload } from "@/api/auth";
import type { Role, User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  hasCheckedSession: boolean;
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
  hasCheckedSession: false,
  login: async (credentials) => {
    const response = await authApi.login(credentials);
    set({
      user: response.user,
      accessToken: response.accessToken,
      isAuthenticated: true,
      hasCheckedSession: true
    });
  },
  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      set({ user: null, accessToken: null, isAuthenticated: false, hasCheckedSession: true });
    }
  },
  bootstrap: async () => {
    if (get().isBootstrapping || get().hasCheckedSession) {
      return;
    }

    set({ isBootstrapping: true });

    try {
      const response = await authApi.refresh();
      set({
        user: response.user,
        accessToken: response.accessToken,
        isAuthenticated: true,
        hasCheckedSession: true
      });
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false, hasCheckedSession: true });
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
