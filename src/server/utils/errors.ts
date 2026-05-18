export class AppError extends Error {
  constructor(
    public readonly code:
      | "VALIDATION_ERROR"
      | "AUTH_ERROR"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "RATE_LIMITED"
      | "EXTERNAL_PROVIDER_ERROR"
      | "INTERNAL_ERROR",
    message: string,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
