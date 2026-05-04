import { ProjectCategory, ProjectStatus } from "@prisma/client";
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

const projectPayloadSchema = z.object({
  category: z.enum(ProjectCategory).optional(),
  name: z.string().min(3),
  description: z.string().min(3).optional(),
  subCounty: z.enum(MIGORI_SUBCOUNTIES),
  ward: z.string().min(2),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  budget: z.number().min(0),
  funder: z.string().min(2),
  status: z.enum(ProjectStatus).optional(),
  photos: z.array(z.string().url()).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional()
});

const createProjectSchema = projectPayloadSchema.strict().superRefine((value, ctx) => {
  if (!isValidWardForSubCounty(value.subCounty, value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ward"],
      message: "Selected ward does not belong to the selected sub-county"
    });
  }
});

const updateProjectSchema = projectPayloadSchema.partial().strict();

router.use(authenticate);

router.get(
  "/",
  authorize(["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST"]),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const where = req.user.role === "FISHERIES_OFFICER" ? { subCounty: req.user.subCounty ?? undefined } : {};

    const projects = await prisma.blueEconomyProject.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ data: projects });
  })
);

router.post(
  "/",
  validate({ body: createProjectSchema }),
  authorize(["DIRECTOR", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof createProjectSchema>).subCounty
  }),
  auditLog("PROJECT"),
  asyncHandler(async (req, res) => {
    const payload = req.body as z.infer<typeof createProjectSchema>;

    if (payload.endDate && payload.endDate < payload.startDate) {
      throw new HttpError(400, "endDate cannot be before startDate");
    }

    const officer = req.user
      ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } })
      : null;

    const project = await prisma.blueEconomyProject.create({
      data: {
        ...payload,
        responsibleOfficerId: req.user?.id,
        responsibleOfficerName: officer?.name
      }
    });
    res.status(201).json({ data: project });
  })
);

router.put(
  "/:id",
  validate({ params: idParamSchema, body: updateProjectSchema }),
  authorize(["DIRECTOR", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof updateProjectSchema>).subCounty
  }),
  auditLog("PROJECT"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const current = await prisma.blueEconomyProject.findUnique({ where: { id } });

    if (!current) {
      throw new HttpError(404, "Project not found");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && current.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only update projects in your sub-county");
    }

    const payload = req.body as z.infer<typeof updateProjectSchema>;
    const targetSubCounty = payload.subCounty ?? current.subCounty;
    const targetWard = payload.ward ?? current.ward;

    if (!isValidWardForSubCounty(targetSubCounty, targetWard)) {
      throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }

    const project = await prisma.blueEconomyProject.update({
      where: { id },
      data: payload
    });

    res.status(200).json({ data: project });
  })
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR"]),
  auditLog("PROJECT"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    await prisma.blueEconomyProject.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
