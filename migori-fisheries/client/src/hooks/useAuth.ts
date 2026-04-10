import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

let bootstrapAttempted = false;

export const useAuth = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const hasCheckedSession = useAuthStore((state) => state.hasCheckedSession);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const state = useAuthStore();

  useEffect(() => {
    const path = window.location.pathname;
    const isPublicRoute = path === "/login" || path === "/unauthorized";

    if (isPublicRoute) {
      return;
    }

    if (!bootstrapAttempted && !isAuthenticated && !isBootstrapping && !hasCheckedSession) {
      bootstrapAttempted = true;
      void bootstrap();
    }
  }, [bootstrap, hasCheckedSession, isAuthenticated, isBootstrapping]);

  return state;
};
