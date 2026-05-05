import { LicenseStatus, LicenseType } from "@prisma/client";
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

const baseLicenseSchema = z.object({
  licenseNo: z.string().min(4),
  receiptNo: z.string().min(2),
  bmuName: z.string().min(2).optional(),
  holderName: z.string().min(2).optional(),
  holderIdNumber: z.string().min(4).optional(),
  holderPhoneNumber: z.string().min(7).optional(),
  holderEmail: z.string().email().optional(),
  subCounty: z.enum(MIGORI_SUBCOUNTIES).optional(),
  ward: z.string().min(2).optional(),
  beachName: z.string().min(2).optional(),
  market: z.string().min(2).optional(),
  amountLicensed: z.number().min(0).optional(),
  farmerId: z.string().min(5).optional(),
  type: z.enum(LicenseType),
  issuedDate: z.coerce.date(),
  expiryDate: z.coerce.date()
});

const createLicenseSchema = baseLicenseSchema.strict().superRefine((value, ctx) => {
  if (value.expiryDate <= value.issuedDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expiryDate"],
      message: "Expiry date must be later than issued date"
    });
  }

  if (!value.farmerId) {
    for (const field of ["holderName", "holderIdNumber", "holderPhoneNumber", "subCounty", "ward"] as const) {
      if (!value[field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "This field is required when no registry holder is selected"
        });
      }
    }
  }

  if (value.subCounty && value.ward && !isValidWardForSubCounty(value.subCounty, value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ward"],
      message: "Selected ward does not belong to the selected sub-county"
    });
  }
});

const updateLicenseSchema = baseLicenseSchema
  .partial()
  .extend({
    status: z.enum(LicenseStatus).optional()
  })
  .strict();

router.use(authenticate);

router.get(
  "/",
  authorize(["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER", "ADMIN"]),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const where =
      req.user.role === "FISHERIES_OFFICER"
        ? {
            OR: [
              { subCounty: req.user.subCounty ?? undefined },
              { farmer: { subCounty: req.user.subCounty ?? undefined } }
            ]
          }
        : req.user.role === "FARMER"
          ? { farmerId: req.user.id }
          : {};

    const licenses = await prisma.license.findMany({
      where,
      include: { farmer: true },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ data: licenses });
  })
);

router.post(
  "/",
  validate({ body: createLicenseSchema }),
  authorize(["FISHERIES_OFFICER"]),
  auditLog("LICENSE"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const payload = req.body as z.infer<typeof createLicenseSchema>;
    const farmer = payload.farmerId
      ? await prisma.farmer.findUnique({ where: { id: payload.farmerId } })
      : null;

    if (payload.farmerId && !farmer) {
      throw new HttpError(404, "Registry holder not found");
    }

    const targetSubCounty = farmer?.subCounty ?? payload.subCounty;
    if (!targetSubCounty) {
      throw new HttpError(400, "Sub-county is required");
    }

    if (req.user.subCounty !== targetSubCounty) {
      throw new HttpError(403, "You can only record licenses in your sub-county");
    }

    const officer = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true }
    });

    const license = await prisma.license.create({
      data: {
        ...payload,
        holderName: payload.holderName ?? farmer?.name,
        holderIdNumber: payload.holderIdNumber ?? farmer?.idNumber,
        holderPhoneNumber: payload.holderPhoneNumber ?? farmer?.phoneNumber,
        holderEmail: payload.holderEmail ?? farmer?.email,
        subCounty: targetSubCounty,
        ward: payload.ward ?? farmer?.ward,
        amountLicensed: payload.amountLicensed ?? 0,
        licensedById: req.user.id,
        licensedByName: officer?.name,
        status: LicenseStatus.PENDING
      }
    });

    res.status(201).json({ data: license });
  })
);

router.put(
  "/:id",
  validate({ params: idParamSchema, body: updateLicenseSchema }),
  authorize(["DIRECTOR", "FISHERIES_OFFICER", "ADMIN"]),
  auditLog("LICENSE"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const license = await prisma.license.findUnique({
      where: { id },
      include: { farmer: true }
    });

    if (!license) {
      throw new HttpError(404, "License not found");
    }

    const licenseSubCounty = license.subCounty ?? license.farmer?.subCounty;
    if (req.user?.role === "FISHERIES_OFFICER" && licenseSubCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only update licenses in your sub-county");
    }

    const payload = req.body as z.infer<typeof updateLicenseSchema>;
    const isApprovalChange = payload.status !== undefined;

    if (isApprovalChange && req.user?.role !== "DIRECTOR" && req.user?.role !== "ADMIN") {
      throw new HttpError(403, "Only the Director or Admin can approve or reject licenses");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && license.status !== LicenseStatus.PENDING) {
      throw new HttpError(403, "Approved, rejected, expired, or revoked licenses cannot be edited by extension officers");
    }

    if ((payload.issuedDate ?? license.issuedDate) >= (payload.expiryDate ?? license.expiryDate)) {
      throw new HttpError(400, "Expiry date must be later than issued date");
    }

    if (payload.subCounty && payload.ward && !isValidWardForSubCounty(payload.subCounty, payload.ward)) {
      throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }

    const updated = await prisma.license.update({
      where: { id },
      data: {
        ...payload,
        approvedById:
          payload.status === LicenseStatus.VALID || payload.status === LicenseStatus.REJECTED ? req.user?.id : undefined,
        approvedAt:
          payload.status === LicenseStatus.VALID || payload.status === LicenseStatus.REJECTED ? new Date() : undefined
      }
    });

    res.status(200).json({ data: updated });
  })
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR", "ADMIN"]),
  auditLog("LICENSE"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    await prisma.license.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
