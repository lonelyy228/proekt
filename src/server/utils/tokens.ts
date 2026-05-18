import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "@/config/constants";
import { env } from "@/config/env";
import { AppError } from "@/server/utils/errors";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: "USER" | "ADMIN";
  sessionId: string;
};

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export const signAccessToken = async (payload: AccessTokenPayload): Promise<string> =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", kid: env.JWT_KEY_ID })
    .setIssuedAt()
    .setIssuer(authConfig.issuer)
    .setAudience(authConfig.audience)
    .setExpirationTime(`${authConfig.accessTokenTtlSeconds}s`)
    .sign(accessSecret);

export const signRefreshToken = async (payload: { sub: string; sessionId: string; familyId: string }): Promise<string> =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", kid: env.JWT_KEY_ID })
    .setIssuedAt()
    .setIssuer(authConfig.issuer)
    .setAudience(authConfig.audience)
    .setExpirationTime(`${authConfig.refreshTokenTtlDays}d`)
    .sign(refreshSecret);

export const verifyAccessToken = async (token: string): Promise<AccessTokenPayload> => {
  try {
    const verified = await jwtVerify(token, accessSecret, {
      issuer: authConfig.issuer,
      audience: authConfig.audience
    });

    return verified.payload as AccessTokenPayload;
  } catch {
    throw new AppError("AUTH_ERROR", "Invalid access token");
  }
};

export const verifyRefreshToken = async (
  token: string
): Promise<{ sub: string; sessionId: string; familyId: string }> => {
  try {
    const verified = await jwtVerify(token, refreshSecret, {
      issuer: authConfig.issuer,
      audience: authConfig.audience
    });

    return {
      sub: String(verified.payload.sub),
      sessionId: String(verified.payload.sessionId),
      familyId: String(verified.payload.familyId)
    };
  } catch {
    throw new AppError("AUTH_ERROR", "Invalid refresh token");
  }
};
