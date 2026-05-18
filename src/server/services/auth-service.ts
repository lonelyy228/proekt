import { generateSecret, generateURI, verifySync } from "otplib";
import { toDataURL } from "qrcode";
import { Role } from "@prisma/client";
import { userRepository } from "@/server/repositories/user-repository";
import { sessionRepository } from "@/server/repositories/session-repository";
import { refreshTokenRepository } from "@/server/repositories/refresh-token-repository";
import { auditRepository } from "@/server/repositories/audit-repository";
import { AppError } from "@/server/utils/errors";
import { hashPassword, verifyPassword } from "@/server/utils/password";
import { randomToken, sha256 } from "@/server/utils/crypto";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/server/utils/tokens";
import { authConfig } from "@/config/constants";
import { decryptSecret, encryptSecret } from "@/server/utils/encryption";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const refreshTokenHash = (token: string): string => sha256(`${token}.${env.REFRESH_TOKEN_PEPPER}`);
const backupCodeHash = (code: string): string => sha256(`${code}.${env.REFRESH_TOKEN_PEPPER}`);

const generateBackupCodes = (): string[] =>
  Array.from({ length: 8 }, () => randomToken(6).replace(/-/g, "").slice(0, 10).toUpperCase());

export const authService = {
  register: async (email: string, password: string) => {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError("CONFLICT", "Email already exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({
      email,
      passwordHash,
      role: Role.USER
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role
    };
  },

  login: async (params: {
    email: string;
    password: string;
    userAgent: string | null;
    ipAddress: string | null;
    deviceType: string;
    totpCode?: string;
  }) => {
    const user = await userRepository.findByEmail(params.email);
    if (!user || user.deletedAt || user.isBlocked) {
      throw new AppError("AUTH_ERROR", "Invalid credentials");
    }

    const passwordValid = await verifyPassword(params.password, user.passwordHash);
    if (!passwordValid) {
      throw new AppError("AUTH_ERROR", "Invalid credentials");
    }

    if (user.twoFactorEnabled) {
      if (!params.totpCode) {
        throw new AppError("AUTH_ERROR", "Two-factor code required");
      }

      if (!user.twoFactorSecretEnc) {
        throw new AppError("AUTH_ERROR", "Two-factor not configured");
      }

      const secret = decryptSecret(user.twoFactorSecretEnc);
      const verificationResult = verifySync({ token: params.totpCode, secret });
      const isValidCode = verificationResult.valid;

      if (!isValidCode) {
        throw new AppError("AUTH_ERROR", "Invalid two-factor code");
      }
    }

    const session = await sessionRepository.createSession({
      userId: user.id,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      deviceType: params.deviceType,
      expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000)
    });

    const refreshFamilyId = randomToken(24);
    const refreshToken = await signRefreshToken({
      sub: user.id,
      sessionId: session.id,
      familyId: refreshFamilyId
    });

    const hashedRefreshToken = refreshTokenHash(refreshToken);

    await refreshTokenRepository.createToken({
      userId: user.id,
      sessionId: session.id,
      tokenHash: hashedRefreshToken,
      familyId: refreshFamilyId,
      expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000)
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id
    });

    await auditRepository.log({
      actorId: user.id,
      action: "AUTH_LOGIN",
      targetType: "SESSION",
      targetId: session.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    };
  },

  refreshSession: async (token: string) => {
    const payload = await verifyRefreshToken(token);
    const tokenHash = refreshTokenHash(token);
    const existingToken = await refreshTokenRepository.findByHash(tokenHash);

    if (!existingToken) {
      throw new AppError("AUTH_ERROR", "Refresh token does not exist");
    }

    if (existingToken.isRevoked) {
      await refreshTokenRepository.revokeFamily(existingToken.familyId);
      throw new AppError("AUTH_ERROR", "Refresh token reuse detected");
    }

    if (existingToken.expiresAt.getTime() < Date.now()) {
      throw new AppError("AUTH_ERROR", "Refresh token expired");
    }

    const user = await userRepository.findById(payload.sub);
    if (!user || user.deletedAt || user.isBlocked) {
      throw new AppError("AUTH_ERROR", "Invalid refresh token subject");
    }

    const rotatedRefreshToken = await signRefreshToken({
      sub: user.id,
      sessionId: payload.sessionId,
      familyId: payload.familyId
    });

    const rotatedHash = refreshTokenHash(rotatedRefreshToken);

    await refreshTokenRepository.revokeToken(existingToken.tokenHash, rotatedHash);

    await refreshTokenRepository.createToken({
      userId: user.id,
      sessionId: payload.sessionId,
      tokenHash: rotatedHash,
      familyId: payload.familyId,
      expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000)
    });

    await sessionRepository.touchSession(payload.sessionId);

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId
    });

    return {
      accessToken,
      refreshToken: rotatedRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    };
  },

  logout: async (refreshToken?: string) => {
    if (!refreshToken) {
      return;
    }

    const tokenHash = refreshTokenHash(refreshToken);
    const tokenRow = await refreshTokenRepository.findByHash(tokenHash);

    if (!tokenRow) {
      return;
    }

    await Promise.all([
      refreshTokenRepository.revokeFamily(tokenRow.familyId),
      sessionRepository.revokeSession(tokenRow.sessionId)
    ]);
  },

  me: async (userId: string) => {
    const user = await userRepository.findById(userId);

    if (!user || user.deletedAt) {
      throw new AppError("NOT_FOUND", "User not found");
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled
    };
  },

  setup2fa: async (userId: string, email: string) => {
    const secret = generateSecret();
    const otpAuth = generateURI({
      issuer: "ApparelStore",
      label: email,
      secret
    });
    const qrCodeDataUrl = await toDataURL(otpAuth);

    const encrypted = encryptSecret(secret);

    await userRepository.setTwoFactor(userId, {
      enabled: false,
      secret: encrypted
    });

    return {
      secret,
      otpAuth,
      qrCodeDataUrl
    };
  },

  verifyAndEnable2fa: async (userId: string, code: string) => {
    const user = await userRepository.findById(userId);

    if (!user || !user.twoFactorSecretEnc) {
      throw new AppError("NOT_FOUND", "Two-factor setup not found");
    }

    const secret = decryptSecret(user.twoFactorSecretEnc);
    const isValid = verifySync({ token: code, secret }).valid;

    if (!isValid) {
      throw new AppError("AUTH_ERROR", "Invalid TOTP code");
    }

    const backupCodes = generateBackupCodes();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true }
      }),
      prisma.backupCode.deleteMany({ where: { userId } }),
      prisma.backupCode.createMany({
        data: backupCodes.map((codeValue) => ({
          userId,
          codeHash: backupCodeHash(codeValue)
        }))
      })
    ]);

    return { backupCodes };
  },

  verify2faCode: async (userId: string, code: string) => {
    const user = await userRepository.findById(userId);

    if (!user || !user.twoFactorSecretEnc || !user.twoFactorEnabled) {
      throw new AppError("AUTH_ERROR", "2FA is not enabled");
    }

    const secret = decryptSecret(user.twoFactorSecretEnc);
    const isValidTotp = verifySync({ token: code, secret }).valid;

    if (isValidTotp) {
      return { valid: true };
    }

    const backupCodeHashValue = backupCodeHash(code.toUpperCase());
    const backupCode = await prisma.backupCode.findFirst({
      where: {
        userId,
        codeHash: backupCodeHashValue,
        usedAt: null
      }
    });

    if (!backupCode) {
      throw new AppError("AUTH_ERROR", "Invalid 2FA code");
    }

    await prisma.backupCode.update({
      where: { id: backupCode.id },
      data: { usedAt: new Date() }
    });

    return { valid: true, usedBackupCode: true };
  },

  listSessions: async (userId: string, currentSessionId: string) => {
    const sessions = await sessionRepository.listByUserId(userId);

    return sessions.map((session) => ({
      id: session.id,
      status: session.status,
      deviceType: session.deviceType,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === currentSessionId
    }));
  },

  revokeSession: async (userId: string, currentSessionId: string, targetSessionId: string) => {
    if (targetSessionId === currentSessionId) {
      throw new AppError("VALIDATION_ERROR", "Текущую сессию нужно завершать через выход из аккаунта");
    }

    const targetSession = await sessionRepository.findById(targetSessionId);
    if (!targetSession || targetSession.userId !== userId) {
      throw new AppError("NOT_FOUND", "Сессия не найдена");
    }

    await Promise.all([
      sessionRepository.revokeByUserAndId(userId, targetSessionId),
      refreshTokenRepository.revokeBySessionId(targetSessionId)
    ]);

    return { revoked: true };
  }
};
