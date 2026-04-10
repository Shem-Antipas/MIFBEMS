import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const SENSITIVE_KEYS = new Set(["password", "passwordHash", "token", "refreshToken"]);

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }

  if (value && typeof value === "object") {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (SENSITIVE_KEYS.has(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, sanitize(entry)];
    });

    return Object.fromEntries(sanitizedEntries);
  }

  return value;
};

const inferAction = (method: string): string => {
  if (method === "POST") return "CREATE";
  if (method === "PUT" || method === "PATCH") return "UPDATE";
  if (method === "DELETE") return "DELETE";
  return "READ";
};

export const auditLog = (resource: string, action?: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on("finish", () => {
      if (!req.user || res.statusCode >= 400 || req.method === "GET") {
        return;
      }

      prisma.auditLog
        .create({
          data: {
            userId: req.user.id,
            action: action ?? inferAction(req.method),
            resource,
            ipAddress: req.ip,
            details: sanitize({
              params: req.params,
              query: req.query,
              body: req.body
            }) as Prisma.InputJsonValue
          }
        })
        .catch((error: unknown) => {
          logger.error({ message: "Failed to write audit log", error });
        });
    });

    next();
  };
};
