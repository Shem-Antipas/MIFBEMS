import { Router } from "express";
import { z } from "zod";
import { AgeBracket, CaptureApprovalStatus, Gender } from "@prisma/client";
import { asyncHandler, HttpError } from "../lib/http.js";
import { MIGORI_SUBCOUNTIES, isValidWardForSubCounty } from "../lib/locationData.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";
const router = Router();
const createCaptureRecordSchema = z.object({
    extensionOfficerName: z.string().min(2),
    extensionOfficerPhone: z.string().min(7),
    fisherName: z.string().min(2),
    farmerNumber: z.string().min(2).optional(),
    idNumber: z.string().min(4).optional(),
    phoneNumber: z.string().min(7).optional(),
    subCounty: z.enum(MIGORI_SUBCOUNTIES),
    ward: z.string().min(2),
    gender: z.enum(Gender),
    ageBracket: z.enum(AgeBracket),
    topics: z.array(z.string().min(2)).min(1),
    bmuName: z.string().min(2).optional(),
    landingSite: z.string().min(2).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    species: z.string().min(2),
    catchKg: z.number().min(0),
    value: z.number().min(0).optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    effortHours: z.number().min(0).optional(),
    fishingDate: z.coerce.date().optional()
}).superRefine((value, ctx) => {
    if (!isValidWardForSubCounty(value.subCounty, value.ward)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ward"],
            message: "Selected ward does not belong to the selected sub-county"
        });
    }
});
const updateApprovalSchema = z.object({
    status: z.enum([CaptureApprovalStatus.APPROVED, CaptureApprovalStatus.REJECTED])
});
const idParamSchema = z.object({ id: z.string().min(5) });
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"]), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const where = req.user.role === "FISHERIES_OFFICER"
        ? req.user.subCounty
            ? { subCounty: req.user.subCounty }
            : { id: "__no_officer_subcounty__" }
        : undefined;
    const records = await prisma.captureFisheriesRecord.findMany({
        where,
        orderBy: { fishingDate: "desc" }
    });
    res.status(200).json({ data: records });
}));
router.post("/", validate({ body: createCaptureRecordSchema }), authorize(["FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => req.body.subCounty
}), auditLog("CAPTURE_FISHERIES"), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    if (!req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
    }
    const payload = req.body;
    if (payload.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only create extension entries in your assigned sub-county");
    }
    const fishingDate = payload.fishingDate ?? new Date(payload.year, payload.month - 1, 1);
    const record = await prisma.captureFisheriesRecord.create({
        data: {
            ...payload,
            fishingDate,
            value: payload.value ?? 0,
            approvalStatus: CaptureApprovalStatus.PENDING,
            approvedById: null,
            approvedAt: null,
            recordedById: req.user.id
        }
    });
    res.status(201).json({ data: record });
}));
router.patch("/:id/approval", validate({ params: idParamSchema, body: updateApprovalSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("CAPTURE_FISHERIES_APPROVAL"), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const { id } = req.params;
    const { status } = req.body;
    const existing = await prisma.captureFisheriesRecord.findUnique({ where: { id } });
    if (!existing) {
        throw new HttpError(404, "Extension entry not found");
    }
    const record = await prisma.captureFisheriesRecord.update({
        where: { id },
        data: {
            approvalStatus: status,
            approvedById: req.user.id,
            approvedAt: new Date()
        }
    });
    res.status(200).json({ data: record });
}));
export default router;
