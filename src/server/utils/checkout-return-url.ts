import { env } from "@/config/env";
import { AppError } from "@/server/utils/errors";

type ReturnUrlPolicyInput = {
  url: string;
  appUrl: string;
  nodeEnv: "development" | "test" | "production";
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

const isHttpProtocol = (url: URL): boolean => url.protocol === "http:" || url.protocol === "https:";

export const isAllowedCheckoutReturnUrl = ({ url, appUrl, nodeEnv }: ReturnUrlPolicyInput): boolean => {
  try {
    const candidate = new URL(url);
    const application = new URL(appUrl);

    if (!isHttpProtocol(candidate)) {
      return false;
    }

    if (candidate.origin === application.origin) {
      return true;
    }

    if (nodeEnv !== "production" && LOCAL_HOSTS.has(candidate.hostname) && LOCAL_HOSTS.has(application.hostname)) {
      return candidate.port === application.port;
    }

    return false;
  } catch {
    return false;
  }
};

export const assertAllowedCheckoutReturnUrl = (url: string): void => {
  if (
    !isAllowedCheckoutReturnUrl({
      url,
      appUrl: env.APP_URL,
      nodeEnv: env.NODE_ENV
    })
  ) {
    throw new AppError("VALIDATION_ERROR", "Checkout return URL origin is not allowed");
  }
};
