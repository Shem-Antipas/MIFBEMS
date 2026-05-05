import { FarmType, FarmerStatus, LicenseStatus, LicenseType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { MIGORI_SUBCOUNTIES, isValidWardForSubCounty } from "../lib/locationData.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";
import { listFarmersByActor } from "../services/farmerService.js";
const router = Router();
const createFarmerSchema = z.object({
    name: z.string().min(2),
    idNumber: z.string().min(4).optional(),
    phoneNumber: z.string().min(7).optional(),
    email: z.string().email().optional(),
    subCounty: z.enum(MIGORI_SUBCOUNTIES),
    ward: z.string().min(2),
    farmType: z.enum(FarmType),
    species: z.array(z.string().min(2)).min(1),
    licenseNo: z.string().optional(),
    status: z.enum(FarmerStatus).optional(),
    productionKg: z.number().min(0).optional(),
    numberOfPonds: z.number().int().min(0).optional(),
    activePonds: z.number().int().min(0).optional(),
    inactivePonds: z.number().int().min(0).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    initialLicense: z
        .object({
        licenseNo: z.string().min(4),
        receiptNo: z.string().min(2),
        bmuName: z.string().min(2).optional(),
        type: z.enum(LicenseType),
        issuedDate: z.coerce.date(),
        expiryDate: z.coerce.date()
    })
        .optional()
}).strict().superRefine((value, ctx) => {
    if (!isValidWardForSubCounty(value.subCounty, value.ward)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ward"],
            message: "Selected ward does not belong to the selected sub-county"
        });
    }
    if (value.initialLicense && value.initialLicense.expiryDate <= value.initialLicense.issuedDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["initialLicense", "expiryDate"],
            message: "Expiry date must be later than issued date"
        });
    }
    const numberOfPonds = value.numberOfPonds ?? 0;
    const activePonds = value.activePonds ?? 0;
    const inactivePonds = value.inactivePonds ?? 0;
    if (activePonds + inactivePonds > numberOfPonds) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["numberOfPonds"],
            message: "Active and inactive ponds cannot exceed total ponds"
        });
    }
});
const updateFarmerSchema = z
    .object({
    name: z.string().min(2).optional(),
    idNumber: z.string().min(4).nullable().optional(),
    phoneNumber: z.string().min(7).nullable().optional(),
    email: z.string().email().nullable().optional(),
    subCounty: z.enum(MIGORI_SUBCOUNTIES).optional(),
    ward: z.string().min(2).optional(),
    farmType: z.enum(FarmType).optional(),
    species: z.array(z.string().min(2)).min(1).optional(),
    licenseNo: z.string().optional(),
    status: z.enum(FarmerStatus).optional(),
    productionKg: z.number().min(0).optional(),
    numberOfPonds: z.number().int().min(0).optional(),
    activePonds: z.number().int().min(0).optional(),
    inactivePonds: z.number().int().min(0).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional()
})
    .strict();
const idParamSchema = z.object({ id: z.string().min(5) });
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const farmers = await listFarmersByActor(req.user);
    res.status(200).json({ data: farmers });
}));
router.get("/:id", validate({ params: idParamSchema }), authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const farmer = await prisma.farmer.findUnique({
        where: { id },
        include: { licenses: true, productionRecords: true }
    });
    if (!farmer) {
        throw new HttpError(404, "Farmer not found");
    }
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    if (req.user.role === "FISHERIES_OFFICER" && farmer.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only access farmers in your sub-county");
    }
    if (req.user.role === "FARMER" && farmer.id !== req.user.id) {
        throw new HttpError(403, "You can only access your own farmer record");
    }
    res.status(200).json({ data: farmer });
}));
router.post("/", validate({ body: createFarmerSchema }), authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => req.body.subCounty
}), auditLog("FARMER"), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const payload = req.body;
    const { initialLicense, ...farmerPayload } = payload;
    const farmer = await prisma.$transaction(async (tx) => {
        const created = await tx.farmer.create({
            data: {
                ...farmerPayload,
                licenseNo: initialLicense?.licenseNo ?? farmerPayload.licenseNo,
                registeredById: req.user.id,
                productionKg: farmerPayload.productionKg ?? 0,
                numberOfPonds: farmerPayload.numberOfPonds ?? 0,
                activePonds: farmerPayload.activePonds ?? 0,
                inactivePonds: farmerPayload.inactivePonds ?? 0
            }
        });
        if (initialLicense) {
            if (req.user.role !== "FISHERIES_OFFICER") {
                throw new HttpError(403, "Only extension officers can record license and receipt information");
            }
            await tx.license.create({
                data: {
                    ...initialLicense,
                    status: LicenseStatus.PENDING,
                    farmerId: created.id,
                    holderName: created.name,
                    holderIdNumber: created.idNumber,
                    holderPhoneNumber: created.phoneNumber,
                    holderEmail: created.email,
                    subCounty: created.subCounty,
                    ward: created.ward,
                    licensedById: req.user.id
                }
            });
        }
        return tx.farmer.findUnique({
            where: { id: created.id },
            include: { licenses: true }
        });
    });
    if (!farmer) {
        throw new HttpError(500, "Failed to create farmer");
    }
    res.status(201).json({ data: farmer });
}));
router.put("/:id", validate({ params: idParamSchema, body: updateFarmerSchema }), authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => req.body.subCounty
}), auditLog("FARMER"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existingFarmer = await prisma.farmer.findUnique({ where: { id } });
    if (!existingFarmer) {
        throw new HttpError(404, "Farmer not found");
    }
    if (req.user?.role === "FISHERIES_OFFICER" && existingFarmer.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only update farmers in your sub-county");
    }
    const payload = req.body;
    const targetSubCounty = payload.subCounty ?? existingFarmer.subCounty;
    const targetWard = payload.ward ?? existingFarmer.ward;
    const targetNumberOfPonds = payload.numberOfPonds ?? existingFarmer.numberOfPonds;
    const targetActivePonds = payload.activePonds ?? existingFarmer.activePonds;
    const targetInactivePonds = payload.inactivePonds ?? existingFarmer.inactivePonds;
    if (!isValidWardForSubCounty(targetSubCounty, targetWard)) {
        throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }
    if (targetActivePonds + targetInactivePonds > targetNumberOfPonds) {
        throw new HttpError(400, "Active and inactive ponds cannot exceed total ponds");
    }
    const farmer = await prisma.farmer.update({
        where: { id },
        data: payload
    });
    res.status(200).json({ data: farmer });
}));
router.delete("/:id", validate({ params: idParamSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("FARMER"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.farmer.delete({ where: { id } });
    res.status(204).send();
}));
export default router;
