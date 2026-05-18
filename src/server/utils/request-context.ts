import { randomUUID } from "crypto";
import { headers } from "next/headers";

export const getRequestId = (): string => {
  const requestId = headers().get("x-request-id");
  return requestId ?? randomUUID();
};
