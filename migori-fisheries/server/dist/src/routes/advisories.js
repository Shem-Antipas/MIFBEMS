import { AdvisoryType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";
const router = Router();
const idParamSchema = z.object({ id: z.string().min(5) });
const createAdvisorySchema = z.object({
    title: z.string().min(3),
    message: z.string().min(5),
    type: z.enum(AdvisoryType),
    fromName: z.string().min(2),
    subCounty: z.string().min(2).optional(),
    targetUserId: z.string().min(5).optional()
});
const updateAdvisorySchema = createAdvisorySchema.partial();
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const where = req.user.role === "FARMER"
        ? {
            OR: [
                { targetUserId: req.user.id },
                { targetUserId: null, subCounty: null },
                { targetUserId: null, subCounty: req.user.subCounty ?? "__no_farmer_subcounty__" }
            ]
        }
        : req.user.role === "FISHERIES_OFFICER"
            ? {
                OR: [{ subCounty: null }, { subCounty: req.user.subCounty ?? "__no_officer_subcounty__" }]
            }
            : {};
    const advisories = await prisma.advisory.findMany({
        where,
        orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ data: advisories });
}));
router.post("/", validate({ body: createAdvisorySchema }), authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => req.body.subCounty
}), auditLog("ADVISORY"), asyncHandler(async (req, res) => {
    const payload = req.body;
    const subCounty = req.user?.role === "FISHERIES_OFFICER" ? req.user.subCounty : payload.subCounty;
    if (req.user?.role === "FISHERIES_OFFICER" && !subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
    }
    const advisory = await prisma.advisory.create({
        data: {
            ...payload,
            subCounty
        }
    });
    res.status(201).json({ data: advisory });
}));
router.put("/:id", validate({ params: idParamSchema, body: updateAdvisorySchema }), authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => req.body.subCounty
}), auditLog("ADVISORY"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const current = await prisma.advisory.findUnique({ where: { id } });
    if (!current) {
        throw new HttpError(404, "Advisory not found");
    }
    if (req.user?.role === "FISHERIES_OFFICER" && current.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only update advisories in your sub-county");
    }
    const payload = req.body;
    const advisory = await prisma.advisory.update({
        where: { id },
        data: payload
    });
    res.status(200).json({ data: advisory });
}));
router.delete("/:id", validate({ params: idParamSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("ADVISORY"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.advisory.delete({ where: { id } });
    res.status(204).send();
}));
export default router;
