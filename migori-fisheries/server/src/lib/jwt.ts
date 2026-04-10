import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { env } from "./env.js";
import type { TokenPayload } from "../types/auth.js";

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

const issuer = "mifbems-server";
const audience = "mifbems-client";

const buildToken = async (payload: TokenPayload, secret: Uint8Array, expiresIn: string): Promise<string> => {
  return new SignJWT({ ...payload } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresIn)
    .sign(secret);
};

export const signAccessToken = (payload: Omit<TokenPayload, "type">): Promise<string> => {
  return buildToken({ ...payload, type: "access" }, accessSecret, "1h");
};

export const signRefreshToken = (payload: Omit<TokenPayload, "type">): Promise<string> => {
  return buildToken({ ...payload, type: "refresh" }, refreshSecret, "7d");
};

const verify = async (token: string, secret: Uint8Array): Promise<TokenPayload> => {
  const { payload } = await jwtVerify(token, secret, { issuer, audience });
  const tokenPayload = payload as JWTPayload & Partial<TokenPayload>;

  if (!tokenPayload.id || !tokenPayload.role || !Object.hasOwn(tokenPayload, "subCounty") || !tokenPayload.type) {
    throw new Error("Invalid token payload");
  }

  return {
    id: tokenPayload.id,
    role: tokenPayload.role,
    subCounty: tokenPayload.subCounty ?? null,
    type: tokenPayload.type
  };
};

export const verifyAccessToken = (token: string): Promise<TokenPayload> => verify(token, accessSecret);
export const verifyRefreshToken = (token: string): Promise<TokenPayload> => verify(token, refreshSecret);
