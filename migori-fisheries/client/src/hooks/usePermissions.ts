import type { Role } from "@/types";
import { useAuthStore } from "@/store/authStore";

export const hasRole = (currentRole: Role | undefined, allowedRoles: Role[]): boolean => {
  if (!currentRole) return false;
  return allowedRoles.includes(currentRole);
};

export const usePermissions = () => {
  const role = useAuthStore((state) => state.user?.role);

  return {
    role,
    canAccess: (allowedRoles: Role[]) => hasRole(role, allowedRoles)
  };
};
