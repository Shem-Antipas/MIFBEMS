import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
const SENSITIVE_KEYS = new Set(["password", "passwordHash", "token", "refreshToken"]);
const sanitize = (value) => {
    if (Array.isArray(value)) {
        return value.map((entry) => sanitize(entry));
    }
    if (value && typeof value === "object") {
        const sanitizedEntries = Object.entries(value).map(([key, entry]) => {
            if (SENSITIVE_KEYS.has(key)) {
                return [key, "[REDACTED]"];
            }
            return [key, sanitize(entry)];
        });
        return Object.fromEntries(sanitizedEntries);
    }
    return value;
};
const inferAction = (method) => {
    if (method === "POST")
        return "CREATE";
    if (method === "PUT" || method === "PATCH")
        return "UPDATE";
    if (method === "DELETE")
        return "DELETE";
    return "READ";
};
export const auditLog = (resource, action) => {
    return (req, res, next) => {
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
                    })
                }
            })
                .catch((error) => {
                logger.error({ message: "Failed to write audit log", error });
            });
        });
        next();
    };
};
