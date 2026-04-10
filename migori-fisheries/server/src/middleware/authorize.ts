import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

interface AuthorizeOptions {
  resolveSubCounty?: (req: Request) => string | undefined;
}

const defaultSubCountyResolver = (req: Request): string | undefined => {
  const fromBody = typeof req.body?.subCounty === "string" ? req.body.subCounty : undefined;
  const fromParams = typeof req.params?.subCounty === "string" ? req.params.subCounty : undefined;
  const fromQuery = typeof req.query?.subCounty === "string" ? req.query.subCounty : undefined;

  return fromBody ?? fromParams ?? fromQuery;
};

export const authorize = (allowedRoles: Role[], options?: AuthorizeOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }

    if (req.user.role === "FISHERIES_OFFICER") {
      const resourceSubCounty = options?.resolveSubCounty?.(req) ?? defaultSubCountyResolver(req);

      if (resourceSubCounty && req.user.subCounty && resourceSubCounty !== req.user.subCounty) {
        res.status(403).json({ error: "Forbidden: sub-county scope mismatch" });
        return;
      }
    }

    next();
  };
};
