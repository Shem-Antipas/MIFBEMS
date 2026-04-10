import { prisma } from "../lib/prisma.js";

export interface DashboardSummary {
  totalFarmers: number;
  activeLicenses: number;
  expiredLicenses: number;
  totalProjects: number;
  ongoingProjects: number;
  totalProductionKg: number;
  inspectionsThisYear: number;
}

export const getDashboardSummary = async (subCounty?: string): Promise<DashboardSummary> => {
  const farmerWhere = subCounty ? { subCounty } : {};
  const projectWhere = subCounty ? { subCounty } : {};
  const inspectionWhere = subCounty ? { subCounty } : {};

  const [
    totalFarmers,
    totalProduction,
    activeLicenses,
    expiredLicenses,
    totalProjects,
    ongoingProjects,
    inspectionsThisYear
  ] = await Promise.all([
    prisma.farmer.count({ where: farmerWhere }),
    prisma.farmer.aggregate({ where: farmerWhere, _sum: { productionKg: true } }),
    prisma.license.count({ where: { status: "VALID", farmer: farmerWhere } }),
    prisma.license.count({ where: { status: "EXPIRED", farmer: farmerWhere } }),
    prisma.blueEconomyProject.count({ where: projectWhere }),
    prisma.blueEconomyProject.count({ where: { ...projectWhere, status: "ONGOING" } }),
    prisma.inspection.count({
      where: {
        ...inspectionWhere,
        date: {
          gte: new Date(new Date().getFullYear(), 0, 1)
        }
      }
    })
  ]);

  return {
    totalFarmers,
    activeLicenses,
    expiredLicenses,
    totalProjects,
    ongoingProjects,
    totalProductionKg: totalProduction._sum.productionKg ?? 0,
    inspectionsThisYear
  };
};
