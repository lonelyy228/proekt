import pino from "pino";
import { env } from "@/config/env";

const isPlaywrightRuntime = process.env.PLAYWRIGHT_TEST === "1";
const shouldUsePrettyTransport =
  process.env.RSH_PRETTY_LOGS === "1" && env.NODE_ENV !== "production" && !isPlaywrightRuntime;

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport: shouldUsePrettyTransport
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname"
        }
      }
    : undefined
});
