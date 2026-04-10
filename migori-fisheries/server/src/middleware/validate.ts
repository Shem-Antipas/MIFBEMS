import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

interface ValidationSchemas {
  body?: ZodType<unknown>;
  params?: ZodType<unknown>;
  query?: ZodType<unknown>;
}

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const checks: Array<{ schema?: ZodType<unknown>; payload: unknown; key: "body" | "params" | "query" }> = [
      { schema: schemas.body, payload: req.body, key: "body" },
      { schema: schemas.params, payload: req.params, key: "params" },
      { schema: schemas.query, payload: req.query, key: "query" }
    ];

    for (const check of checks) {
      if (!check.schema) {
        continue;
      }

      const parsed = check.schema.safeParse(check.payload);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation error",
          issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
        });
        return;
      }

      if (check.key === "body") {
        req.body = parsed.data;
      } else if (check.key === "params") {
        req.params = parsed.data as Request["params"];
      } else {
        req.query = parsed.data as Request["query"];
      }
    }

    next();
  };
};
