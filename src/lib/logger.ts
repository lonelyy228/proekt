import pino from "pino";
import { env } from "@/config/env";

const isPlaywrightRuntime = process.env.PLAYWRIGHT_TEST === "1";

export const logger = pino({
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
