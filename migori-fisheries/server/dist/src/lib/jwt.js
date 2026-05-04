import { jwtVerify, SignJWT } from "jose";
import { env } from "./env.js";
const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
const issuer = "mifbems-server";
const audience = "mifbems-client";
const buildToken = async (payload, secret, expiresIn) => {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer(issuer)
        .setAudience(audience)
        .setExpirationTime(expiresIn)
        .sign(secret);
};
export const signAccessToken = (payload) => {
    return buildToken({ ...payload, type: "access" }, accessSecret, "1h");
};
export const signRefreshToken = (payload) => {
    return buildToken({ ...payload, type: "refresh" }, refreshSecret, "7d");
};
const verify = async (token, secret) => {
    const { payload } = await jwtVerify(token, secret, { issuer, audience });
    const tokenPayload = payload;
    if (!tokenPayload.id || !tokenPayload.role || !Object.hasOwn(tokenPayload, "subCounty") || !tokenPayload.type) {
        throw new Error("Invalid token payload");
    }
    const tokenVersion = tokenPayload.tokenVersion;
    if (tokenVersion !== undefined && (typeof tokenVersion !== "number" || !Number.isInteger(tokenVersion))) {
        throw new Error("Invalid token payload");
    }
    return {
        id: tokenPayload.id,
        role: tokenPayload.role,
        subCounty: tokenPayload.subCounty ?? null,
        type: tokenPayload.type,
        tokenVersion: tokenVersion ?? 0
    };
};
export const verifyAccessToken = (token) => verify(token, accessSecret);
export const verifyRefreshToken = (token) => verify(token, refreshSecret);
