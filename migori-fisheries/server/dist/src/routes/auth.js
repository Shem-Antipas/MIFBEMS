import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../lib/env.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { getCurrentUser, loginWithEmailPassword, refreshSession, requestPasswordReset, resetPassword } from "../services/authService.js";
const router = Router();
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});
const newPasswordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol");
const forgotPasswordSchema = z.object({
    email: z.string().trim().email()
});
const resetPasswordSchema = z.object({
    token: z.string().min(32).max(512),
    password: newPasswordSchema
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "development" ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: "Too many login attempts. Please try again later." }
});
const passwordResetRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "development" ? 1000 : 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many password reset requests. Please try again later." }
});
const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "development" ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many password reset attempts. Please try again later." }
});
const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000
};
router.post("/login", loginLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const session = await loginWithEmailPassword(email, password);
    res.cookie("refreshToken", session.refreshToken, cookieOptions);
    res.status(200).json({
        accessToken: session.accessToken,
        user: session.user
    });
}));
router.post("/forgot-password", passwordResetRequestLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await requestPasswordReset(email);
    res.status(200).json(result);
}));
router.post("/reset-password", passwordResetLimiter, validate({ body: resetPasswordSchema }), asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    await resetPassword(token, password);
    res.clearCookie("refreshToken", { ...cookieOptions, maxAge: undefined });
    res.status(200).json({ message: "Password reset successful. Please sign in with your new password." });
}));
router.post("/refresh", asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        throw new HttpError(401, "Refresh token is missing");
    }
    const session = await refreshSession(refreshToken);
    res.cookie("refreshToken", session.refreshToken, cookieOptions);
    res.status(200).json({
        accessToken: session.accessToken,
        user: session.user
    });
}));
router.post("/logout", asyncHandler(async (_req, res) => {
    res.clearCookie("refreshToken", { ...cookieOptions, maxAge: undefined });
    res.status(204).send();
}));
router.get("/me", authenticate, asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const user = await getCurrentUser(req.user.id);
    res.status(200).json({ user });
}));
export default router;
