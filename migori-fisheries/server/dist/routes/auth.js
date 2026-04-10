import { Router } from "express";
import { z } from "zod";
import { env } from "../lib/env.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { getCurrentUser, loginWithEmailPassword, refreshSession } from "../services/authService.js";
const router = Router();
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});
const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000
};
router.post("/login", validate({ body: loginSchema }), asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const session = await loginWithEmailPassword(email, password);
    res.cookie("refreshToken", session.refreshToken, cookieOptions);
    res.status(200).json({
        accessToken: session.accessToken,
        user: session.user
    });
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
