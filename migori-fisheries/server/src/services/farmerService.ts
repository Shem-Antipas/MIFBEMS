import type { Farmer, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

interface Actor {
  id: string;
  role: Role;
  subCounty: string | null;
}

export const listFarmersByActor = (actor: Actor): Promise<Farmer[]> => {
  if (actor.role === "DIRECTOR" || actor.role === "ADMIN" || actor.role === "DATA_ANALYST") {
    return prisma.farmer.findMany({ orderBy: { createdAt: "desc" } });
  }

  if (actor.role === "FISHERIES_OFFICER") {
    if (!actor.subCounty) {
      return Promise.resolve([]);
    }

    return prisma.farmer.findMany({
      where: { subCounty: actor.subCounty },
      orderBy: { createdAt: "desc" }
    });
  }

  if (actor.role === "FARMER") {
    return prisma.farmer.findMany({
      where: { id: actor.id },
      orderBy: { createdAt: "desc" }
    });
  }

  return Promise.resolve([]);
};
