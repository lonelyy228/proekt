export type ApiSuccess<TData> = {
  success: true;
  data: TData;
  requestId?: string;
};

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL_PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export type ApiErrorPayload = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: string[];
  };
  requestId?: string;
};

export type ApiResponse<TData> = ApiSuccess<TData> | ApiErrorPayload;
