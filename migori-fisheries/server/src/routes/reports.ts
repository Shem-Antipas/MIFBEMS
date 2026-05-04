import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http.js";
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

router.get(
  "/summary",
  validate({ query: summaryQuerySchema }),
  authorize(["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST"]),
  asyncHandler(async (req, res) => {
    const query = req.query as z.infer<typeof summaryQuerySchema>;

    const subCounty = req.user?.role === "FISHERIES_OFFICER" ? req.user.subCounty ?? undefined : query.subCounty;

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
        where: subCounty ? { farmer: { subCounty } } : {}
      })
    ]);

    res.status(200).json({
      data: {
        summary,
        productionBySubCounty,
        licensesByStatus
      }
    });
  })
);

export default router;
