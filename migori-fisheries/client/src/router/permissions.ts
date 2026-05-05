import type { Role } from "@/types";

export interface NavItem {
  label: string;
  path: string;
  allowedRoles: Role[];
}

export const allRoles: Role[] = ["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER", "ADMIN"];

export const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", allowedRoles: ["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"] },
  { label: "Farmers", path: "/farmers", allowedRoles: ["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"] },
  { label: "Licenses", path: "/licenses", allowedRoles: ["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "ADMIN"] },
  { label: "Capture Fisheries", path: "/capture-fisheries", allowedRoles: ["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"] },
  { label: "Projects", path: "/projects", allowedRoles: ["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"] },
  { label: "Inspections", path: "/inspections", allowedRoles: ["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"] },
  { label: "Reports", path: "/reports", allowedRoles: ["DIRECTOR", "ADMIN", "DATA_ANALYST"] },
  { label: "Analytics", path: "/analytics", allowedRoles: ["DIRECTOR", "ADMIN", "DATA_ANALYST"] },
  { label: "Users", path: "/users", allowedRoles: ["DIRECTOR", "ADMIN"] },
  { label: "Settings", path: "/settings", allowedRoles: allRoles },
  { label: "Backups", path: "/admin/backups", allowedRoles: ["ADMIN"] },
  { label: "My Farm", path: "/farmer/my-farm", allowedRoles: ["FARMER"] },
  { label: "Advisories", path: "/farmer/advisories", allowedRoles: ["FARMER"] },
  { label: "Queries", path: "/farmer/queries", allowedRoles: ["FARMER"] }
];
