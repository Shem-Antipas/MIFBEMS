import { Router } from "express";
import { z } from "zod";
import { AgeBracket, CaptureApprovalStatus, Gender } from "@prisma/client";
import { asyncHandler, HttpError } from "../lib/http.js";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY, isValidWardForSubCounty } from "../lib/locationData.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const captureRecordFieldsSchema = z.object({
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
  activeCages: z.number().int().min(0).optional(),
  inactiveCages: z.number().int().min(0).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  species: z.string().min(2),
  catchKg: z.number().min(0),
  value: z.number().min(0).optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  effortHours: z.number().min(0).optional(),
  fishingDate: z.coerce.date().optional()
});

const createCaptureRecordSchema = captureRecordFieldsSchema.superRefine((value, ctx) => {
  if (!isValidWardForSubCounty(value.subCounty, value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ward"],
      message: "Selected ward does not belong to the selected sub-county"
    });
  }
});

const updateCaptureRecordSchema = captureRecordFieldsSchema.partial().superRefine((value, ctx) => {
  if (value.subCounty && value.ward && !isValidWardForSubCounty(value.subCounty, value.ward)) {
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

router.get(
  "/",
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"]),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
      throw new HttpError(403, "Your account is not assigned to a sub-county");
    }

    const where = req.user.role === "FISHERIES_OFFICER" ? { subCounty: req.user.subCounty } : undefined;

    const records = await prisma.captureFisheriesRecord.findMany({
      where,
      orderBy: { fishingDate: "desc" }
    });

    res.status(200).json({ data: records });
  })
);

router.post(
  "/",
  validate({ body: createCaptureRecordSchema }),
  authorize(["FISHERIES_OFFICER", "DIRECTOR"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof createCaptureRecordSchema>).subCounty
  }),
  auditLog("CAPTURE_FISHERIES"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
      throw new HttpError(403, "Your account is not assigned to a sub-county");
    }

    const payload = req.body as z.infer<typeof createCaptureRecordSchema>;
    if (req.user.role === "FISHERIES_OFFICER" && payload.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only create extension entries in your assigned sub-county");
    }

    const fishingDate = payload.fishingDate ?? new Date(payload.year, payload.month - 1, 1);
    const record = await prisma.captureFisheriesRecord.create({
      data: {
        ...payload,
        fishingDate,
        value: payload.value ?? 0,
        activeCages: payload.activeCages ?? 0,
        inactiveCages: payload.inactiveCages ?? 0,
        approvalStatus: CaptureApprovalStatus.PENDING,
        approvedById: null,
        approvedAt: null,
        recordedById: req.user.id
      }
    });

    res.status(201).json({ data: record });
  })
);

router.put(
  "/:id",
  validate({ params: idParamSchema, body: updateCaptureRecordSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof updateCaptureRecordSchema>).subCounty
  }),
  auditLog("CAPTURE_FISHERIES"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { id } = req.params as z.infer<typeof idParamSchema>;
    const payload = req.body as z.infer<typeof updateCaptureRecordSchema>;
    const existing = await prisma.captureFisheriesRecord.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError(404, "Extension entry not found");
    }

    if (req.user.role === "FISHERIES_OFFICER") {
      if (!req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
      }

      const targetSubCounty = payload.subCounty ?? existing.subCounty;
      if (targetSubCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only edit extension entries in your assigned sub-county");
      }
    }

    const targetSubCounty = payload.subCounty ?? existing.subCounty;
    const targetWard = payload.ward ?? existing.ward;
    if (!isValidWardForSubCounty(targetSubCounty, targetWard)) {
      throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }

    const updated = await prisma.captureFisheriesRecord.update({
      where: { id },
      data: payload
    });

    res.status(200).json({ data: updated });
  })
);

router.patch(
  "/:id/approval",
  validate({ params: idParamSchema, body: updateApprovalSchema }),
  authorize(["DIRECTOR", "ADMIN"]),
  auditLog("CAPTURE_FISHERIES_APPROVAL"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { id } = req.params as z.infer<typeof idParamSchema>;
    const { status } = req.body as z.infer<typeof updateApprovalSchema>;

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
  })
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]),
  auditLog("CAPTURE_FISHERIES"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { id } = req.params as z.infer<typeof idParamSchema>;
    const existing = await prisma.captureFisheriesRecord.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError(404, "Extension entry not found");
    }

    if (req.user.role === "FISHERIES_OFFICER") {
      if (!req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
      }

      if (existing.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only delete extension entries in your assigned sub-county");
      }
    }

    await prisma.captureFisheriesRecord.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
