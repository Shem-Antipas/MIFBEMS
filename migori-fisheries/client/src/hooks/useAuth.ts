import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export const useAuth = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const state = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated && !isBootstrapping) {
      void bootstrap();
    }
  }, [bootstrap, isAuthenticated, isBootstrapping]);

  return state;
};
