export type Role = "DIRECTOR" | "FISHERIES_OFFICER" | "DATA_ANALYST" | "FARMER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  subCounty: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Farmer {
  id: string;
  name: string;
  subCounty: string;
  ward: string;
  farmType: "POND" | "CAGE" | "TANK" | "DAM";
  species: string[];
  licenseNo?: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  productionKg: number;
  latitude?: number | null;
  longitude?: number | null;
  registeredById: string;
  createdAt: string;
  updatedAt: string;
}

export interface License {
  id: string;
  licenseNo: string;
  farmerId: string;
  type: "AQUACULTURE" | "COMMERCIAL_FISHING" | "ARTISANAL_FISHING";
  issuedDate: string;
  expiryDate: string;
  status: "VALID" | "EXPIRED" | "REVOKED";
  createdAt: string;
  farmer?: {
    id: string;
    name: string;
    subCounty: string;
  };
}

export interface Inspection {
  id: string;
  farmName: string;
  subCounty: string;
  officerId: string;
  date: string;
  result: "PASS" | "FAIL" | "PENDING";
  notes?: string | null;
  createdAt: string;
}

export interface BlueEconomyProject {
  id: string;
  name: string;
  subCounty: string;
  budget: number;
  funder: string;
  status: "PLANNED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  startDate: string;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Advisory {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "ACTION";
  fromName: string;
  subCounty?: string | null;
  createdAt: string;
}

export interface QueryRecord {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: "PENDING" | "RESOLVED";
  reply?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  totalFarmers: number;
  activeLicenses: number;
  expiredLicenses: number;
  totalProjects: number;
  ongoingProjects: number;
  totalProductionKg: number;
  inspectionsThisYear: number;
}
