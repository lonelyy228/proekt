import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { checkoutService } from "@/server/services/checkout-service";
import { getRequestId } from "@/server/utils/request-context";
import { captureServerError, captureServerMessage } from "@/server/utils/sentry";

const buildWebhookResponse = (payload: Record<string, number | string>, status: number, requestId: string): Response => {
  const response = NextResponse.json(payload, { status });
  response.headers.set("x-request-id", requestId);
  return response;
};

export async function POST(
  request: NextRequest,
  context: { params: { event: string } }
): Promise<Response> {
  const requestId = getRequestId();

  if (env.PAYMENT_PROVIDER !== "cloudpayments") {
    return buildWebhookResponse({ code: 13, message: "CloudPayments webhook endpoint is disabled", requestId }, 503, requestId);
  }

  const signature = request.headers.get("content-hmac") ?? request.headers.get("x-content-hmac");
  if (!signature) {
    return buildWebhookResponse({ code: 13, message: "Missing CloudPayments signature", requestId }, 400, requestId);
  }

  const rawBody = await request.text();
  const eventType = context.params.event;

  try {
    const result =
      eventType === "check"
        ? await checkoutService.processCloudPaymentsCheckWebhook(signature, rawBody)
        : eventType === "pay"
          ? await checkoutService.processCloudPaymentsPayWebhook(signature, rawBody)
          : eventType === "fail"
            ? await checkoutService.processCloudPaymentsFailWebhook(signature, rawBody)
            : null;

    if (!result) {
      return buildWebhookResponse({ code: 13, message: "Unsupported CloudPayments event", requestId }, 404, requestId);
    }

    captureServerMessage("CloudPayments webhook processed", {
      requestId,
      endpoint: `/api/webhooks/cloudpayments/${eventType}`,
      method: "POST",
      area: "webhook",
      details: {
        processed: true,
        eventType,
        code: String(result.code)
      }
    });

    return buildWebhookResponse({ code: result.code }, 200, requestId);
  } catch (error: unknown) {
    logger.error({ err: error, requestId, eventType }, "CloudPayments webhook processing failed");
    captureServerError(
      error,
      {
        requestId,
        endpoint: `/api/webhooks/cloudpayments/${eventType}`,
        method: "POST",
        area: "webhook",
        details: {
          eventType
        }
      },
      "CloudPayments webhook processing failed"
    );

    return buildWebhookResponse({ code: 13, requestId }, 400, requestId);
  }
}
