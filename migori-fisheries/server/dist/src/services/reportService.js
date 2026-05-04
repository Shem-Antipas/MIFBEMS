import { prisma } from "../lib/prisma.js";
export const getDashboardSummary = async (subCounty) => {
    const farmerWhere = subCounty ? { subCounty } : {};
    const projectWhere = subCounty ? { subCounty } : {};
    const inspectionWhere = subCounty ? { subCounty } : {};
    const licenseScopeWhere = subCounty
        ? { OR: [{ subCounty }, { farmer: { subCounty } }] }
        : {};
    const [totalFarmers, totalProduction, activeLicenses, expiredLicenses, totalProjects, ongoingProjects, inspectionsThisYear] = await Promise.all([
        prisma.farmer.count({ where: farmerWhere }),
        prisma.farmer.aggregate({ where: farmerWhere, _sum: { productionKg: true } }),
        prisma.license.count({ where: { ...licenseScopeWhere, status: "VALID" } }),
        prisma.license.count({ where: { ...licenseScopeWhere, status: "EXPIRED" } }),
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
