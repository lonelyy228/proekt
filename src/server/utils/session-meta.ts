import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";

export const getSessionMeta = (): {
  userAgent: string | null;
  ipAddress: string | null;
  deviceType: string;
} => {
  const requestHeaders = headers();
  const userAgent = requestHeaders.get("user-agent");
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const parser = new UAParser(userAgent ?? "");

  return {
    userAgent,
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
    deviceType: parser.getDevice().type ?? "desktop"
  };
};
