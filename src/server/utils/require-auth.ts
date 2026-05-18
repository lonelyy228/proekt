import { getAccessCookie } from "@/server/utils/cookies";
import { verifyAccessToken } from "@/server/utils/tokens";
import { AppError } from "@/server/utils/errors";
import { AuthenticatedUser } from "@/types/domain";
import { sessionRepository } from "@/server/repositories/session-repository";

export const requireAuth = async (): Promise<AuthenticatedUser> => {
  const accessToken = getAccessCookie();

  if (!accessToken) {
    throw new AppError("AUTH_ERROR", "Authentication required");
  }

  const payload = await verifyAccessToken(accessToken);
  const session = await sessionRepository.findById(payload.sessionId);

  if (!session || session.userId !== payload.sub || session.status !== "ACTIVE" || session.expiresAt.getTime() < Date.now()) {
    throw new AppError("AUTH_ERROR", "Session is not active");
  }

  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    sessionId: payload.sessionId
  };
};
