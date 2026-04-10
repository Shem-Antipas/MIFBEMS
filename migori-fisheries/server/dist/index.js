import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import authRoutes from "./routes/auth.js";
import farmerRoutes from "./routes/farmers.js";
import licenseRoutes from "./routes/licenses.js";
import projectRoutes from "./routes/projects.js";
import inspectionRoutes from "./routes/inspections.js";
import reportRoutes from "./routes/reports.js";
import userRoutes from "./routes/users.js";
import queryRoutes from "./routes/queries.js";
import advisoryRoutes from "./routes/advisories.js";
const app = express();
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "https:"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", env.FRONTEND_ORIGIN],
            fontSrc: ["'self'", "https:", "data:"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    referrerPolicy: { policy: "no-referrer" }
}));
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin === env.FRONTEND_ORIGIN) {
            callback(null, true);
            return;
        }
        callback(new Error("CORS policy violation"));
    },
    credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." }
});
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "GET",
    message: { error: "Too many write requests. Please slow down." }
});
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "MiFBEMS API" });
});
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1", writeLimiter);
app.use("/api/v1/farmers", farmerRoutes);
app.use("/api/v1/licenses", licenseRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/inspections", inspectionRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/queries", queryRoutes);
app.use("/api/v1/advisories", advisoryRoutes);
app.use((req, _res, next) => {
    const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
    next(error);
});
const errorHandler = (error, req, res, _next) => {
    logger.error({
        message: error.message,
        stack: error.stack,
        path: req.originalUrl,
        method: req.method
    });
    const statusCode = (res.statusCode >= 400 && res.statusCode < 600) ? res.statusCode : 500;
    const message = statusCode === 500 ? "Internal server error" : error.message;
    res.status(statusCode).json({ error: message });
};
app.use(errorHandler);
app.listen(env.PORT, () => {
    logger.info(`MiFBEMS server running on port ${env.PORT}`);
});
