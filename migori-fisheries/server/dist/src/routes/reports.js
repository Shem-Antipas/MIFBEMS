import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { getDashboardSummary } from "../services/reportService.js";
const router = Router();
const summaryQuerySchema = z.object({
    subCounty: z.string().optional()
});
router.use(authenticate);
router.get("/summary", validate({ query: summaryQuerySchema }), authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"]), asyncHandler(async (req, res) => {
    const query = req.query;
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
    }
    const subCounty = req.user.role === "FISHERIES_OFFICER" ? req.user.subCounty : query.subCounty;
    const [summary, productionBySubCounty, licensesByStatus] = await Promise.all([
        getDashboardSummary(subCounty),
        prisma.farmer.groupBy({
            by: ["subCounty"],
            _sum: { productionKg: true },
            where: subCounty ? { subCounty } : {},
            orderBy: { subCounty: "asc" }
        }),
        prisma.license.groupBy({
            by: ["status"],
            _count: { id: true },
            where: subCounty ? { OR: [{ subCounty }, { farmer: { subCounty } }] } : {}
        })
    ]);
    res.status(200).json({
        data: {
            summary,
            productionBySubCounty,
            licensesByStatus
        }
    });
}));
export default router;
