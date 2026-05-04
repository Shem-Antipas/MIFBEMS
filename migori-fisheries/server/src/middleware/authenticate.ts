import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

const bearerPrefix = "Bearer ";

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.header("authorization");

    if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.slice(bearerPrefix.length).trim();
    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const payload = await verifyAccessToken(token);
    if (payload.type !== "access") {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, subCounty: true, isActive: true, tokenVersion: true }
    });

    if (!dbUser || !dbUser.isActive) {
      res.status(401).json({ error: "User not authorized" });
      return;
    }

    if (payload.tokenVersion !== dbUser.tokenVersion) {
      res.status(401).json({ error: "Session has expired. Please sign in again." });
      return;
    }

    req.user = {
      id: dbUser.id,
      role: dbUser.role,
      subCounty: dbUser.subCounty
    };

    next();
  } catch (_error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
