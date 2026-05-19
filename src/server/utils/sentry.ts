import { randomUUID } from "crypto";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

type MonitoringLevel = "info" | "warning" | "error";

type MonitoringContext = {
  requestId?: string;
  endpoint?: string;
  method?: string;
  area?: "api" | "webhook" | "admin";
  details?: Record<string, boolean | number | string | null | undefined>;
};

type SentryDsnConfig = {
  dsn: string;
  endpointUrl: string;
};

type SentryException = {
  type: string;
  value: string;
  stacktrace?: {
    frames: Array<{
      function?: string;
      filename?: string;
      lineno?: number;
      colno?: number;
      in_app?: boolean;
    }>;
  };
};

let sentryDsnCache: SentryDsnConfig | null | undefined;
let hasLoggedUnavailableSentry = false;

const parseSentryDsn = (dsn: string): SentryDsnConfig | null => {
  try {
    const url = new URL(dsn);
    const pathSegments = url.pathname.split("/").filter((segment) => segment.length > 0);
    const projectId = pathSegments[pathSegments.length - 1];

    if (!projectId) {
      return null;
    }

    const pathPrefixSegments = pathSegments.slice(0, -1);
    const pathPrefix = pathPrefixSegments.length > 0 ? `/${pathPrefixSegments.join("/")}` : "";
    const endpointUrl = `${url.protocol}//${url.host}${pathPrefix}/api/${projectId}/envelope/`;

    return {
      dsn,
      endpointUrl
    };
  } catch {
    return null;
  }
};

const getSentryConfig = (): SentryDsnConfig | null => {
  if (sentryDsnCache !== undefined) {
    return sentryDsnCache;
  }

  if (!env.SENTRY_DSN) {
    sentryDsnCache = null;
    return null;
  }

  const parsed = parseSentryDsn(env.SENTRY_DSN);
  if (!parsed) {
    sentryDsnCache = null;
    logger.warn("SENTRY_DSN is set but invalid, monitoring events are disabled");
    return null;
  }

  sentryDsnCache = parsed;
  return sentryDsnCache;
};

const toSentryException = (error: unknown): SentryException => {
  if (error instanceof Error) {
    return {
      type: error.name || "Error",
      value: error.message,
      stacktrace: error.stack
        ? {
            frames: error.stack.split("\n").map((line) => ({
              function: line.trim(),
              in_app: true
            }))
          }
        : undefined
    };
  }

  if (typeof error === "string") {
    return {
      type: "Error",
      value: error
    };
  }

  return {
    type: "Error",
    value: "Unknown non-error value was thrown"
  };
};

const sendSentryEnvelope = async (
  level: MonitoringLevel,
  context: MonitoringContext,
  payload: {
    message: string;
    exception?: SentryException;
  }
): Promise<void> => {
  const config = getSentryConfig();
  if (!config) {
    return;
  }

  const eventId = randomUUID().replace(/-/g, "");
  const timestampIso = new Date().toISOString();

  const eventPayload = {
    event_id: eventId,
    level,
    platform: "node",
    timestamp: timestampIso,
    message: payload.message,
    tags: {
      request_id: context.requestId,
      endpoint: context.endpoint,
      method: context.method,
      area: context.area
    },
    extra: context.details,
    exception: payload.exception
      ? {
          values: [payload.exception]
        }
      : undefined
  };

  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: timestampIso, dsn: config.dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(eventPayload)
  ].join("\n");

  try {
    await fetch(config.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope"
      },
      body: envelope
    });
  } catch (error: unknown) {
    if (!hasLoggedUnavailableSentry) {
      logger.warn({ err: error }, "Failed to send monitoring event to Sentry");
      hasLoggedUnavailableSentry = true;
    }
  }
};

export const captureServerMessage = (
  message: string,
  context: MonitoringContext,
  level: MonitoringLevel = "info"
): void => {
  void sendSentryEnvelope(level, context, { message });
};

export const captureServerError = (error: unknown, context: MonitoringContext, message: string): void => {
  const exception = toSentryException(error);
  void sendSentryEnvelope("error", context, {
    message,
    exception
  });
};


