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
  farmerCode: string;
  name: string;
  idNumber?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  subCounty: string;
  ward: string;
  farmType: "POND" | "CAGE" | "TANK" | "DAM";
  species: string[];
  licenseNo?: string | null;
  status: "ACTIVE" | "INACTIVE" | "PARTIALLY_ACTIVE" | "SUSPENDED";
  productionKg: number;
  numberOfPonds: number;
  activePonds: number;
  inactivePonds: number;
  latitude?: number | null;
  longitude?: number | null;
  registeredById: string;
  createdAt: string;
  updatedAt: string;
}

export interface License {
  id: string;
  licenseNo: string;
  receiptNo?: string | null;
  bmuName?: string | null;
  holderName?: string | null;
  holderIdNumber?: string | null;
  holderPhoneNumber?: string | null;
  holderEmail?: string | null;
  subCounty?: string | null;
  ward?: string | null;
  beachName?: string | null;
  market?: string | null;
  amountLicensed: number;
  licensedById?: string | null;
  licensedByName?: string | null;
  farmerId?: string | null;
  type:
    | "FISH_DEPOT"
    | "FISHERMAN"
    | "FISH_TRADER"
    | "BOAT_OWNER"
    | "FISH_MOVEMENT_PERMIT"
    | "BOAT_LICENSE"
    | "NEW_BOARD_REGISTRATION"
    | "ICE_PLANT"
    | "BOAT";
  issuedDate: string;
  expiryDate: string;
  status: "PENDING" | "VALID" | "EXPIRED" | "REVOKED" | "REJECTED";
  approvedById?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  farmer?: {
    id: string;
    name: string;
    subCounty: string;
    ward?: string;
    idNumber?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
  };
}

export interface CaptureFisheriesRecord {
  id: string;
  captureCode: string;
  extensionOfficerName: string;
  extensionOfficerPhone: string;
  fisherName: string;
  farmerNumber?: string | null;
  idNumber?: string | null;
  phoneNumber?: string | null;
  bmuName?: string | null;
  landingSite?: string | null;
  gender: "MALE" | "FEMALE";
  ageBracket: "YOUTH" | "ADULT";
  topics: string[];
  ward: string;
  latitude?: number | null;
  longitude?: number | null;
  species: string;
  catchKg: number;
  value: number;
  month?: number | null;
  year?: number | null;
  effortHours?: number | null;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvedById?: string | null;
  approvedAt?: string | null;
  fishingDate: string;
  subCounty: string;
  recordedById: string;
  createdAt: string;
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
  projectCode: string;
  budgetLine?: string | null;
  category: "BLUE_ECONOMY" | "LAKEFRONT_DEVELOPMENT" | "AQUACULTURE_DEVELOPMENT";
  name: string;
  description: string;
  subCounty: string;
  ward: string;
  latitude?: number | null;
  longitude?: number | null;
  budget: number;
  completionPercent: number;
  funder: string;
  status: "PENDING" | "IN_PROGRESS" | "STALLED" | "PLANNED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  photos: string[];
  responsibleOfficerId?: string | null;
  responsibleOfficerName?: string | null;
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
