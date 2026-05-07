import { Router } from "express";
import { z } from "zod";
import { AgeBracket, CaptureApprovalStatus, Gender } from "@prisma/client";
import { asyncHandler, HttpError } from "../lib/http.js";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY, isValidWardForSubCounty } from "../lib/locationData.js";
import { CAPTURE_SPECIES, NYATIKE_SUBCOUNTY, isNyatikeBeachForWard } from "../lib/nyatikeBeaches.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const captureRecordFieldsSchema = z.object({
  extensionOfficerName: z.string().min(2),
  extensionOfficerPhone: z.string().min(7).optional(),
  fisherName: z.string().min(2),
  farmerNumber: z.string().min(2).optional(),
  idNumber: z.string().min(4).optional(),
  phoneNumber: z.string().min(7),
  subCounty: z.literal(NYATIKE_SUBCOUNTY),
  ward: z.string().min(2),
  gender: z.enum(Gender).default("MALE"),
  ageBracket: z.enum(AgeBracket).default("ADULT"),
  topics: z.array(z.string().min(2)).default([]),
  bmuName: z.string().min(2).optional(),
  landingSite: z.string().min(2),
  activeCages: z.number().int().min(0).optional(),
  inactiveCages: z.number().int().min(0).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  species: z.enum(CAPTURE_SPECIES),
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

  if (!isNyatikeBeachForWard(value.landingSite, value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["landingSite"],
      message: "Selected beach does not belong to the selected Nyatike ward"
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

  if (value.landingSite && value.ward && !isNyatikeBeachForWard(value.landingSite, value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["landingSite"],
      message: "Selected beach does not belong to the selected Nyatike ward"
    });
  }
});

const updateApprovalSchema = z.object({
  status: z.enum([CaptureApprovalStatus.APPROVED, CaptureApprovalStatus.REJECTED])
});

const idParamSchema = z.object({ id: z.string().min(5) });

const cageProductionFieldsSchema = z.object({
  farmerUniqueId: z.string().trim().min(2).optional(),
  farmerName: z.string().trim().min(2, "Farmer name is required"),
  phoneNumber: z.string().trim().min(7).optional(),
  idNumber: z.string().trim().min(4).optional(),
  bmuLocation: z.string().trim().min(2).optional(),
  cageIdentifier: z.string().trim().min(2, "Cage ID is required"),
  fishSpecies: z.literal("Tilapia"),
  subCounty: z.enum(MIGORI_SUBCOUNTIES),
  ward: z.string().trim().min(2, "Ward is required"),
  numberOfCages: z.number().int().min(0).optional(),
  activeCages: z.number().int().min(0).optional(),
  inactiveCages: z.number().int().min(0).optional(),
  fingerlingsStocked: z.number().int().min(0),
  stockingDate: z.coerce.date().optional(),
  feedTypes: z.array(z.enum(["Mash", "Pellets"])).min(1, "Select at least one feed type"),
  feedQuantityKg: z.number().min(0),
  averageFishWeightKg: z.number().min(0),
  mortalityPieces: z.number().int().min(0),
  quantityHarvestedKg: z.number().min(0),
  numberHarvestedPieces: z.number().int().min(0),
  harvestDate: z.coerce.date().optional(),
  extensionOfficerName: z.string().trim().min(2).optional(),
  remarks: z.string().trim().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100)
});

const createCageProductionSchema = cageProductionFieldsSchema.superRefine((value, ctx) => {
  if (!isValidWardForSubCounty(value.subCounty, value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ward"],
      message: "Selected ward does not belong to the selected sub-county"
    });
  }

  const numberOfCages = value.numberOfCages ?? (value.activeCages ?? 0) + (value.inactiveCages ?? 0);
  const activeCages = value.activeCages ?? 0;
  const inactiveCages = value.inactiveCages ?? 0;
  if (activeCages + inactiveCages > numberOfCages) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["numberOfCages"],
      message: "Active and inactive cages cannot exceed the total number of cages"
    });
  }
});

const updateCageProductionSchema = cageProductionFieldsSchema.partial().superRefine((value, ctx) => {
  if (value.subCounty && value.ward && !isValidWardForSubCounty(value.subCounty, value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ward"],
      message: "Selected ward does not belong to the selected sub-county"
    });
  }

  if (
    (value.numberOfCages ?? 0) > 0 &&
    (value.activeCages ?? 0) + (value.inactiveCages ?? 0) > (value.numberOfCages ?? 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["numberOfCages"],
      message: "Active and inactive cages cannot exceed the total number of cages"
    });
  }
});

const getOfficerScopeWhere = (role: string, subCounty?: string | null) => {
  if (role !== "FISHERIES_OFFICER") {
    return undefined;
  }

  return { subCounty: subCounty ?? "__no_officer_subcounty__" };
};

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

router.get(
  "/cage-production",
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"]),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
      throw new HttpError(403, "Your account is not assigned to a sub-county");
    }

    const records = await prisma.cageProductionRecord.findMany({
      where: getOfficerScopeWhere(req.user.role, req.user.subCounty),
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }]
    });

    res.status(200).json({ data: records });
  })
);

router.post(
  "/cage-production",
  validate({ body: createCageProductionSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof createCageProductionSchema>).subCounty
  }),
  auditLog("CAGE_PRODUCTION"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
      throw new HttpError(403, "Your account is not assigned to a sub-county");
    }

    const payload = req.body as z.infer<typeof createCageProductionSchema>;
    if (req.user.role === "FISHERIES_OFFICER" && payload.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only create cage production entries in your assigned sub-county");
    }

    const numberOfCages = payload.numberOfCages ?? (payload.activeCages ?? 0) + (payload.inactiveCages ?? 0);
    const record = await prisma.cageProductionRecord.create({
      data: {
        farmerUniqueId: payload.farmerUniqueId ?? payload.cageIdentifier,
        farmerName: payload.farmerName,
        phoneNumber: payload.phoneNumber,
        idNumber: payload.idNumber,
        bmuLocation: payload.bmuLocation,
        cageIdentifier: payload.cageIdentifier,
        fishSpecies: payload.fishSpecies,
        subCounty: payload.subCounty,
        ward: payload.ward,
        numberOfCages,
        activeCages: payload.activeCages ?? 0,
        inactiveCages: payload.inactiveCages ?? 0,
        fingerlingsStocked: payload.fingerlingsStocked,
        stockingDate: payload.stockingDate,
        feedTypes: payload.feedTypes,
        feedQuantityKg: payload.feedQuantityKg,
        averageFishWeightKg: payload.averageFishWeightKg,
        mortalityPieces: payload.mortalityPieces,
        quantityHarvestedKg: payload.quantityHarvestedKg,
        numberHarvestedPieces: payload.numberHarvestedPieces,
        harvestDate: payload.harvestDate,
        extensionOfficerName: payload.extensionOfficerName,
        remarks: payload.remarks,
        month: payload.month,
        year: payload.year,
        recordedById: req.user.id
      }
    });

    res.status(201).json({ data: record });
  })
);

router.put(
  "/cage-production/:id",
  validate({ params: idParamSchema, body: updateCageProductionSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof updateCageProductionSchema>).subCounty
  }),
  auditLog("CAGE_PRODUCTION"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { id } = req.params as z.infer<typeof idParamSchema>;
    const payload = req.body as z.infer<typeof updateCageProductionSchema>;
    const existing = await prisma.cageProductionRecord.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError(404, "Cage production entry not found");
    }

    if (req.user.role === "FISHERIES_OFFICER") {
      if (!req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
      }

      const targetSubCounty = payload.subCounty ?? existing.subCounty;
      if (targetSubCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only update cage production entries in your assigned sub-county");
      }
    }

    const targetSubCounty = payload.subCounty ?? existing.subCounty;
    const targetWard = payload.ward ?? existing.ward;
    if (!isValidWardForSubCounty(targetSubCounty, targetWard)) {
      throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }

    const totalCages = payload.numberOfCages ?? existing.numberOfCages;
    const activeCages = payload.activeCages ?? existing.activeCages;
    const inactiveCages = payload.inactiveCages ?? existing.inactiveCages;
    if (totalCages > 0 && activeCages + inactiveCages > totalCages) {
      throw new HttpError(400, "Active and inactive cages cannot exceed the total number of cages");
    }

    const updated = await prisma.cageProductionRecord.update({
      where: { id },
      data: {
        ...payload,
        farmerUniqueId: payload.farmerUniqueId ?? payload.cageIdentifier ?? existing.farmerUniqueId
      }
    });
    res.status(200).json({ data: updated });
  })
);

router.delete(
  "/cage-production/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]),
  auditLog("CAGE_PRODUCTION"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { id } = req.params as z.infer<typeof idParamSchema>;
    const existing = await prisma.cageProductionRecord.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError(404, "Cage production entry not found");
    }

    if (req.user.role === "FISHERIES_OFFICER") {
      if (!req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
      }

      if (existing.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only delete cage production entries in your assigned sub-county");
      }
    }

    await prisma.cageProductionRecord.delete({ where: { id } });
    res.status(204).send();
  })
);

router.post(
  "/",
  validate({ body: createCaptureRecordSchema }),
  authorize(["FISHERIES_OFFICER", "DIRECTOR", "ADMIN"], {
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
        extensionOfficerName: payload.extensionOfficerName,
        extensionOfficerPhone: payload.extensionOfficerPhone ?? "",
        fisherName: payload.fisherName,
        farmerNumber: payload.farmerNumber,
        idNumber: payload.idNumber,
        phoneNumber: payload.phoneNumber,
        gender: payload.gender,
        ageBracket: payload.ageBracket,
        topics: payload.topics,
        bmuName: payload.bmuName,
        landingSite: payload.landingSite,
        activeCages: payload.activeCages ?? 0,
        inactiveCages: payload.inactiveCages ?? 0,
        ward: payload.ward,
        latitude: payload.latitude,
        longitude: payload.longitude,
        species: payload.species,
        catchKg: payload.catchKg,
        value: payload.value ?? 0,
        effortHours: payload.effortHours,
        fishingDate,
        month: payload.month,
        year: payload.year,
        subCounty: payload.subCounty,
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
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]),
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

    if (req.user.role === "FISHERIES_OFFICER") {
      if (!req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
      }

      if (existing.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only validate capture entries in your assigned sub-county");
      }
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
