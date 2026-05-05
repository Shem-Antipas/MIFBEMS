import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { WARDS_BY_SUBCOUNTY } from "../lib/locationData.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";
const router = Router();
const createCaptureRecordSchema = z.object({
    fisherName: z.string().min(2),
    idNumber: z.string().min(4).optional(),
    phoneNumber: z.string().min(7).optional(),
    ward: z.enum(WARDS_BY_SUBCOUNTY.Nyatike),
    bmuName: z.string().min(2).optional(),
    landingSite: z.string().min(2).optional(),
    species: z.string().min(2),
    catchKg: z.number().min(0),
    value: z.number().min(0).optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    effortHours: z.number().min(0).optional(),
    fishingDate: z.coerce.date().optional()
});
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"]), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    if (req.user.role === "FISHERIES_OFFICER" && req.user.subCounty !== "Nyatike") {
        res.status(200).json({ data: [] });
        return;
    }
    const records = await prisma.captureFisheriesRecord.findMany({
        where: { subCounty: "Nyatike" },
        orderBy: { fishingDate: "desc" }
    });
    res.status(200).json({ data: records });
}));
router.post("/", validate({ body: createCaptureRecordSchema }), authorize(["FISHERIES_OFFICER"]), auditLog("CAPTURE_FISHERIES"), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    if (req.user.subCounty !== "Nyatike") {
        throw new HttpError(403, "Capture fisheries data collection is limited to Nyatike sub-county");
    }
    const payload = req.body;
    const fishingDate = payload.fishingDate ?? new Date(payload.year, payload.month - 1, 1);
    const record = await prisma.captureFisheriesRecord.create({
        data: {
            ...payload,
            fishingDate,
            value: payload.value ?? 0,
            subCounty: "Nyatike",
            recordedById: req.user.id
        }
    });
    res.status(201).json({ data: record });
}));
export default router;
