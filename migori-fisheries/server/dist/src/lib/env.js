import { config } from "dotenv";
import { z } from "zod";
config();
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    FRONTEND_ORIGIN: z.string().url(),
    FRONTEND_ORIGINS: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax")
});
export const env = envSchema.parse(process.env);
export const allowedCorsOrigins = Array.from(new Set([
    env.FRONTEND_ORIGIN,
    ...(env.FRONTEND_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [])
]));
