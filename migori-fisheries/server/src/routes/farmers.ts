import { FarmType, FarmerStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";
import { listFarmersByActor } from "../services/farmerService.js";

const router = Router();

const createFarmerSchema = z.object({
  name: z.string().min(2),
  subCounty: z.string().min(2),
  farmType: z.enum(FarmType),
  species: z.array(z.string().min(2)).min(1),
  licenseNo: z.string().optional(),
  status: z.enum(FarmerStatus).optional(),
  productionKg: z.number().min(0).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

const updateFarmerSchema = createFarmerSchema.partial();

const idParamSchema = z.object({ id: z.string().min(5) });

router.use(authenticate);

router.get(
  "/",
  authorize(["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const farmers = await listFarmersByActor(req.user);
    res.status(200).json({ data: farmers });
  })
);

router.get(
  "/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;

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
  })
);

router.post(
  "/",
  validate({ body: createFarmerSchema }),
  authorize(["DIRECTOR", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof createFarmerSchema>).subCounty
  }),
  auditLog("FARMER"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const payload = req.body as z.infer<typeof createFarmerSchema>;

    const farmer = await prisma.farmer.create({
      data: {
        ...payload,
        registeredById: req.user.id,
        productionKg: payload.productionKg ?? 0
      }
    });

    res.status(201).json({ data: farmer });
  })
);

router.put(
  "/:id",
  validate({ params: idParamSchema, body: updateFarmerSchema }),
  authorize(["DIRECTOR", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof updateFarmerSchema>).subCounty
  }),
  auditLog("FARMER"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const existingFarmer = await prisma.farmer.findUnique({ where: { id } });

    if (!existingFarmer) {
      throw new HttpError(404, "Farmer not found");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && existingFarmer.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only update farmers in your sub-county");
    }

    const payload = req.body as z.infer<typeof updateFarmerSchema>;

    const farmer = await prisma.farmer.update({
      where: { id },
      data: payload
    });

    res.status(200).json({ data: farmer });
  })
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR"]),
  auditLog("FARMER"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;

    await prisma.farmer.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
