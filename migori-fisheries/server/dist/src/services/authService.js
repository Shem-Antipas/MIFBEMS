import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { HttpError } from "../lib/http.js";
const toAuthUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    subCounty: user.subCounty
});
const issueTokens = async (user) => {
    const payload = {
        id: user.id,
        role: user.role,
        subCounty: user.subCounty
    };
    const [accessToken, refreshToken] = await Promise.all([signAccessToken(payload), signRefreshToken(payload)]);
    return { accessToken, refreshToken, user };
};
export const loginWithEmailPassword = async (email, password) => {
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subCounty: true,
            isActive: true,
            passwordHash: true
        }
    });
    if (!user || !user.isActive) {
        throw new HttpError(401, "Invalid email or password");
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
        throw new HttpError(401, "Invalid email or password");
    }
    return issueTokens(toAuthUser(user));
};
export const refreshSession = async (refreshToken) => {
    const payload = await verifyRefreshToken(refreshToken);
    if (payload.type !== "refresh") {
        throw new HttpError(401, "Invalid refresh token");
    }
    const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, name: true, email: true, role: true, subCounty: true, isActive: true }
    });
    if (!user || !user.isActive) {
        throw new HttpError(401, "User not authorized");
    }
    return issueTokens(toAuthUser(user));
};
export const getCurrentUser = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, subCounty: true, isActive: true }
    });
    if (!user || !user.isActive) {
        throw new HttpError(404, "User not found");
    }
    return toAuthUser(user);
};
