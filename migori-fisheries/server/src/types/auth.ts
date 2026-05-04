import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  role: Role;
  subCounty: string | null;
}

export interface TokenPayload extends AuthUser {
  type: "access" | "refresh";
  tokenVersion: number;
}
