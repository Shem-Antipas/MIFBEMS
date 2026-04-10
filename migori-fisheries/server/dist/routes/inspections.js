import { InspectionResult } from "@prisma/client";
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
const createInspectionSchema = z.object({
    farmName: z.string().min(2),
    subCounty: z.string().min(2),
    date: z.coerce.date(),
    result: z.enum(InspectionResult),
    notes: z.string().optional()
});
const updateInspectionSchema = createInspectionSchema.partial();
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST"]), asyncHandler(async (req, res) => {
    const where = req.user?.role === "FISHERIES_OFFICER" ? { subCounty: req.user.subCounty ?? undefined } : {};
    const inspections = await prisma.inspection.findMany({
        where,
        include: { officer: { select: { id: true, name: true, subCounty: true } } },
        orderBy: { date: "desc" }
    });
    res.status(200).json({ data: inspections });
}));
router.post("/", validate({ body: createInspectionSchema }), authorize(["DIRECTOR", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => req.body.subCounty
}), auditLog("INSPECTION"), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const payload = req.body;
    const inspection = await prisma.inspection.create({
        data: {
            ...payload,
            officerId: req.user.id
        }
    });
    res.status(201).json({ data: inspection });
}));
router.put("/:id", validate({ params: idParamSchema, body: updateInspectionSchema }), authorize(["DIRECTOR", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => req.body.subCounty
}), auditLog("INSPECTION"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const inspection = await prisma.inspection.findUnique({ where: { id } });
    if (!inspection) {
        throw new HttpError(404, "Inspection not found");
    }
    if (req.user?.role === "FISHERIES_OFFICER" && inspection.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only update inspections in your sub-county");
    }
    const payload = req.body;
    const updated = await prisma.inspection.update({ where: { id }, data: payload });
    res.status(200).json({ data: updated });
}));
router.delete("/:id", validate({ params: idParamSchema }), authorize(["DIRECTOR"]), auditLog("INSPECTION"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.inspection.delete({ where: { id } });
    res.status(204).send();
}));
export default router;
