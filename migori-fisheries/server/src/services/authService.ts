import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { HttpError } from "../lib/http.js";
import { logger } from "../lib/logger.js";

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: "DIRECTOR" | "FISHERIES_OFFICER" | "DATA_ANALYST" | "FARMER" | "ADMIN";
  subCounty: string | null;
}

interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

interface TokenUser extends AuthUserDto {
  tokenVersion: number;
}

export interface PasswordResetRequestResult {
  message: string;
  resetUrl?: string;
}

const resetRequestMessage = "If an account exists for that email, a password reset link has been prepared.";
const resetTokenTtlMs = 30 * 60 * 1000;

const toAuthUser = (user: {
  id: string;
  name: string;
  email: string;
  role: AuthUserDto["role"];
  subCounty: string | null;
}): AuthUserDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  subCounty: user.subCounty
});

const issueTokens = async (user: TokenUser): Promise<TokenBundle> => {
  const payload = {
    id: user.id,
    role: user.role,
    subCounty: user.subCounty,
    tokenVersion: user.tokenVersion
  };

  const [accessToken, refreshToken] = await Promise.all([signAccessToken(payload), signRefreshToken(payload)]);

  return { accessToken, refreshToken, user: toAuthUser(user) };
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const hashPasswordResetToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

const buildPasswordResetUrl = (token: string): string => {
  return `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
};

export const loginWithEmailPassword = async (email: string, password: string): Promise<TokenBundle> => {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      subCounty: true,
      isActive: true,
      passwordHash: true,
      tokenVersion: true
    }
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  return issueTokens({ ...toAuthUser(user), tokenVersion: user.tokenVersion });
};

export const refreshSession = async (refreshToken: string): Promise<TokenBundle> => {
  const payload = await verifyRefreshToken(refreshToken);
  if (payload.type !== "refresh") {
    throw new HttpError(401, "Invalid refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, name: true, email: true, role: true, subCounty: true, isActive: true, tokenVersion: true }
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "User not authorized");
  }

  if (payload.tokenVersion !== user.tokenVersion) {
    throw new HttpError(401, "Refresh token has been revoked");
  }

  return issueTokens({ ...toAuthUser(user), tokenVersion: user.tokenVersion });
};

export const getCurrentUser = async (userId: string): Promise<AuthUserDto> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, subCounty: true, isActive: true }
  });

  if (!user || !user.isActive) {
    throw new HttpError(404, "User not found");
  }

  return toAuthUser(user);
};

export const requestPasswordReset = async (email: string): Promise<PasswordResetRequestResult> => {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true, isActive: true }
  });

  if (!user || !user.isActive) {
    return { message: resetRequestMessage };
  }

  const token = randomBytes(32).toString("base64url");
  const resetUrl = buildPasswordResetUrl(token);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashPasswordResetToken(token),
      passwordResetExpiresAt: new Date(Date.now() + resetTokenTtlMs)
    }
  });

  if (env.NODE_ENV === "development") {
    logger.info("Development password reset link generated", {
      userId: user.id,
      email: user.email,
      resetUrl
    });

    return { message: resetRequestMessage, resetUrl };
  }

  return { message: resetRequestMessage };
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hashPasswordResetToken(token),
      passwordResetExpiresAt: { gt: new Date() },
      isActive: true
    },
    select: {
      id: true,
      email: true,
      passwordHash: true
    }
  });

  if (!user) {
    throw new HttpError(400, "Password reset link is invalid or has expired");
  }

  const passwordMatchesCurrent = await bcrypt.compare(password, user.passwordHash);
  if (passwordMatchesCurrent) {
    throw new HttpError(400, "Choose a new password that is different from the current password");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 }
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_COMPLETED",
        resource: "User",
        details: { email: user.email }
      }
    })
  ]);
};
