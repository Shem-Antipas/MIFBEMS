import { QueryStatus } from "@prisma/client";
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

const createQuerySchema = z.object({
  subject: z.string().min(3),
  message: z.string().min(5)
});

const replySchema = z.object({
  reply: z.string().min(2),
  status: z.enum(QueryStatus).optional()
});

router.use(authenticate);

router.get(
  "/",
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const where =
      req.user.role === "FARMER"
        ? { userId: req.user.id }
        : req.user.role === "FISHERIES_OFFICER"
          ? { user: { subCounty: req.user.subCounty ?? "__no_officer_subcounty__" } }
          : {};

    const queries = await prisma.query.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, subCounty: true } } },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ data: queries });
  })
);

router.post(
  "/",
  validate({ body: createQuerySchema }),
  authorize(["FARMER"]),
  auditLog("QUERY"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const payload = req.body as z.infer<typeof createQuerySchema>;
    const query = await prisma.query.create({
      data: {
        userId: req.user.id,
        subject: payload.subject,
        message: payload.message
      }
    });

    res.status(201).json({ data: query });
  })
);

router.patch(
  "/:id/reply",
  validate({ params: idParamSchema, body: replySchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]),
  auditLog("QUERY"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const payload = req.body as z.infer<typeof replySchema>;

    const query = await prisma.query.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, subCounty: true } } }
    });

    if (!query) {
      throw new HttpError(404, "Query not found");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && query.user.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only respond to queries from your sub-county");
    }

    const officer = req.user
      ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } })
      : null;
    const replyByName = officer?.name ?? "Fisheries Office";

    const updated = await prisma.$transaction(async (tx) => {
      const repliedQuery = await tx.query.update({
        where: { id },
        data: {
          reply: payload.reply,
          status: payload.status ?? "RESOLVED",
          replyById: req.user?.id,
          replyByName,
          repliedAt: new Date()
        },
        include: { user: { select: { id: true, name: true, email: true, subCounty: true } } }
      });

      await tx.advisory.create({
        data: {
          title: `Response: ${query.subject}`,
          message: payload.reply,
          type: "INFO",
          fromName: replyByName,
          subCounty: query.user.subCounty,
          targetUserId: query.user.id
        }
      });

      return repliedQuery;
    });

    res.status(200).json({ data: updated });
  })
);

router.patch(
  "/:id/resolve",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]),
  auditLog("QUERY"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const existing = await prisma.query.findUnique({
      where: { id },
      include: { user: { select: { subCounty: true } } }
    });

    if (!existing) {
      throw new HttpError(404, "Query not found");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && existing.user.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only resolve queries from your sub-county");
    }

    const query = await prisma.query.update({
      where: { id },
      data: { status: "RESOLVED" }
    });

    res.status(200).json({ data: query });
  })
);

export default router;
