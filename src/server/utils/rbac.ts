import { Role } from "@prisma/client";
import { AppError } from "@/server/utils/errors";

export const assertRole = (role: Role, requiredRole: Role): void => {
  if (role !== requiredRole) {
    throw new AppError("FORBIDDEN", "Insufficient permissions");
  }
};
