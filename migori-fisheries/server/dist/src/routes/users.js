import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
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
const createUserSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(Role),
    subCounty: z.string().min(2).optional(),
    isActive: z.boolean().optional()
});
const updateUserSchema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    role: z.enum(Role).optional(),
    subCounty: z.string().min(2).nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional()
});
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "ADMIN"]), asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subCounty: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        },
        orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ data: users });
}));
router.get("/:id", validate({ params: idParamSchema }), authorize(["DIRECTOR", "ADMIN"]), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subCounty: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
    if (!user) {
        throw new HttpError(404, "User not found");
    }
    res.status(200).json({ data: user });
}));
router.post("/", validate({ body: createUserSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("USER"), asyncHandler(async (req, res) => {
    const payload = req.body;
    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await prisma.user.create({
        data: {
            name: payload.name,
            email: payload.email.toLowerCase(),
            passwordHash,
            role: payload.role,
            subCounty: payload.subCounty,
            isActive: payload.isActive ?? true
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subCounty: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
    res.status(201).json({ data: user });
}));
router.put("/:id", validate({ params: idParamSchema, body: updateUserSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("USER"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payload = req.body;
    const updateData = {
        name: payload.name,
        email: payload.email?.toLowerCase(),
        role: payload.role,
        subCounty: payload.subCounty,
        isActive: payload.isActive
    };
    if (payload.password) {
        updateData.passwordHash = await bcrypt.hash(payload.password, 12);
    }
    const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subCounty: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
    res.status(200).json({ data: user });
}));
router.patch("/:id/deactivate", validate({ params: idParamSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("USER", "DEACTIVATE"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subCounty: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
    res.status(200).json({ data: user });
}));
export default router;
