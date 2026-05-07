import { ExtensionApprovalStatus, InspectionResult } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { MIGORI_SUBCOUNTIES, isValidWardForSubCounty } from "../lib/locationData.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";
const router = Router();
const idParamSchema = z.object({ id: z.string().min(5) });
const MAX_EXTENSION_PHOTO_BYTES = 5 * 1024 * 1024;
const allowedExtensionPhotoTypes = ["image/png", "image/jpeg", "image/webp"];
const extensionPhotoSchema = z
    .object({
    name: z.string().trim().min(1).max(160),
    type: z.enum(allowedExtensionPhotoTypes),
    size: z.number().int().min(1).max(MAX_EXTENSION_PHOTO_BYTES),
    dataUrl: z.string().min(32)
})
    .superRefine((photo, ctx) => {
    if (!photo.dataUrl.startsWith(`data:${photo.type};base64,`)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dataUrl"],
            message: "Attached photo content is invalid"
        });
    }
});
const extensionPhotosSchema = z.array(extensionPhotoSchema).max(8).superRefine((photos, ctx) => {
    const totalSize = photos.reduce((total, photo) => total + photo.size, 0);
    if (totalSize > MAX_EXTENSION_PHOTO_BYTES) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Attached photos must not exceed 5MB in total"
        });
    }
});
const inspectionFieldsSchema = z.object({
    extensionOfficerName: z.string().trim().min(1, "Extension officer name is required"),
    extensionOfficerPhone: z.string().trim().min(1, "Phone number is required"),
    farmName: z.string().trim().min(1, "Farmer name is required"),
    farmerNumber: z.string().trim().min(1, "Farmer number is required"),
    farmerPhoneNumber: z.string().trim().min(1).optional(),
    gender: z.enum(["MALE", "FEMALE"]),
    ageBracket: z.enum(["YOUTH", "ADULT"]),
    subCounty: z.enum(MIGORI_SUBCOUNTIES),
    ward: z.string().trim().min(1, "Ward is required"),
    extensionTopics: z.array(z.string().trim().min(1)).min(1, "At least one extension topic is required"),
    feedback: z.string().trim().optional(),
    challenges: z.string().trim().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    photos: extensionPhotosSchema.optional(),
    date: z.coerce.date(),
    result: z.enum(InspectionResult).optional(),
    notes: z.string().trim().optional()
});
const createInspectionSchema = inspectionFieldsSchema.superRefine((value, ctx) => {
    if (!isValidWardForSubCounty(value.subCounty, value.ward)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ward"],
            message: "Selected ward does not belong to the selected sub-county"
        });
    }
});
const updateInspectionSchema = inspectionFieldsSchema.partial().superRefine((value, ctx) => {
    if (value.subCounty && value.ward && !isValidWardForSubCounty(value.subCounty, value.ward)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ward"],
            message: "Selected ward does not belong to the selected sub-county"
        });
    }
});
const updateApprovalSchema = z.object({
    approvalStatus: z.enum(["APPROVED", "REJECTED"])
});
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "FARMER"]), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
    }
    const farmerUser = req.user.role === "FARMER"
        ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, subCounty: true } })
        : null;
    const where = req.user.role === "FISHERIES_OFFICER"
        ? { subCounty: req.user.subCounty }
        : req.user.role === "FARMER"
            ? {
                subCounty: farmerUser?.subCounty ?? "__no_farmer_subcounty__",
                farmName: { contains: farmerUser?.name ?? "__no_farmer_name__", mode: "insensitive" }
            }
            : {};
    const inspections = await prisma.inspection.findMany({
        where,
        include: { officer: { select: { id: true, name: true, subCounty: true } } },
        orderBy: { date: "desc" }
    });
    res.status(200).json({ data: inspections });
}));
router.post("/", validate({ body: createInspectionSchema }), authorize(["FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => req.body.subCounty
}), auditLog("INSPECTION"), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const payload = req.body;
    if (req.user.role === "FISHERIES_OFFICER" && req.user.subCounty && payload.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only create extension records in your sub-county");
    }
    const inspection = await prisma.inspection.create({
        data: {
            ...payload,
            photos: payload.photos ?? [],
            approvalStatus: ExtensionApprovalStatus.PENDING,
            result: payload.result ?? InspectionResult.PENDING,
            officerId: req.user.id
        }
    });
    res.status(201).json({ data: inspection });
}));
router.put("/:id", validate({ params: idParamSchema, body: updateInspectionSchema }), authorize(["FISHERIES_OFFICER"], {
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
    if (inspection.approvalStatus !== ExtensionApprovalStatus.PENDING) {
        throw new HttpError(403, "Approved or rejected extension entries cannot be edited by officers");
    }
    const payload = req.body;
    const targetSubCounty = payload.subCounty ?? inspection.subCounty;
    const targetWard = payload.ward ?? inspection.ward;
    if (!isValidWardForSubCounty(targetSubCounty, targetWard)) {
        throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }
    if (req.user?.role === "FISHERIES_OFFICER" && req.user.subCounty && targetSubCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only update extension records in your sub-county");
    }
    const updated = await prisma.inspection.update({
        where: { id },
        data: {
            ...payload,
            photos: payload.photos ?? undefined
        }
    });
    res.status(200).json({ data: updated });
}));
router.patch("/:id/approval", validate({ params: idParamSchema, body: updateApprovalSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("INSPECTION", "APPROVAL"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payload = req.body;
    const inspection = await prisma.inspection.findUnique({ where: { id } });
    if (!inspection) {
        throw new HttpError(404, "Inspection not found");
    }
    const updated = await prisma.inspection.update({
        where: { id },
        data: {
            approvalStatus: payload.approvalStatus,
            approvedById: req.user?.id,
            approvedAt: new Date(),
            result: payload.approvalStatus === ExtensionApprovalStatus.APPROVED
                ? InspectionResult.PASS
                : InspectionResult.FAIL
        }
    });
    res.status(200).json({ data: updated });
}));
router.delete("/:id", validate({ params: idParamSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("INSPECTION"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.inspection.delete({ where: { id } });
    res.status(204).send();
}));
export default router;
