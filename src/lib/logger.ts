import pino from "pino";
import { env } from "@/config/env";

const isPlaywrightRuntime = process.env.PLAYWRIGHT_TEST === "1";

const globalForLogger = globalThis as unknown as {
  logger?: pino.Logger;
};

export const logger =
  globalForLogger.logger ??
  pino({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    transport:
      env.NODE_ENV === "production" || isPlaywrightRuntime
        ? undefined
        : {
            target: "pino-pretty",
            options: {
              colorize: true,
              ignore: "pid,hostname"
            }
          }
  });

if (env.NODE_ENV !== "production") {
  globalForLogger.logger = logger;
}
