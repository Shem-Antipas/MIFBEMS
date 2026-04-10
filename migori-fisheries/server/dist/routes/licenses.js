import { LicenseStatus, LicenseType } from "@prisma/client";
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
const createLicenseSchema = z.object({
    licenseNo: z.string().min(4),
    farmerId: z.string().min(5),
    type: z.enum(LicenseType),
    issuedDate: z.coerce.date(),
    expiryDate: z.coerce.date(),
    status: z.enum(LicenseStatus).optional()
});
const updateLicenseSchema = z.object({
    type: z.enum(LicenseType).optional(),
    issuedDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    status: z.enum(LicenseStatus).optional()
});
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const where = req.user.role === "FISHERIES_OFFICER"
        ? { farmer: { subCounty: req.user.subCounty ?? undefined } }
        : req.user.role === "FARMER"
            ? { farmerId: req.user.id }
            : {};
    const licenses = await prisma.license.findMany({
        where,
        include: { farmer: true },
        orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ data: licenses });
}));
router.post("/", validate({ body: createLicenseSchema }), authorize(["DIRECTOR", "FISHERIES_OFFICER"]), auditLog("LICENSE"), asyncHandler(async (req, res) => {
    const payload = req.body;
    const farmer = await prisma.farmer.findUnique({ where: { id: payload.farmerId } });
    if (!farmer) {
        throw new HttpError(404, "Farmer not found");
    }
    if (req.user?.role === "FISHERIES_OFFICER" && farmer.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only issue licenses in your sub-county");
    }
    if (payload.expiryDate <= payload.issuedDate) {
        throw new HttpError(400, "Expiry date must be later than issued date");
    }
    const license = await prisma.license.create({ data: payload });
    res.status(201).json({ data: license });
}));
router.put("/:id", validate({ params: idParamSchema, body: updateLicenseSchema }), authorize(["DIRECTOR", "FISHERIES_OFFICER"]), auditLog("LICENSE"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const license = await prisma.license.findUnique({
        where: { id },
        include: { farmer: true }
    });
    if (!license) {
        throw new HttpError(404, "License not found");
    }
    if (req.user?.role === "FISHERIES_OFFICER" && license.farmer.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only update licenses in your sub-county");
    }
    const payload = req.body;
    const updated = await prisma.license.update({
        where: { id },
        data: payload
    });
    res.status(200).json({ data: updated });
}));
router.delete("/:id", validate({ params: idParamSchema }), authorize(["DIRECTOR"]), auditLog("LICENSE"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.license.delete({ where: { id } });
    res.status(204).send();
}));
export default router;
