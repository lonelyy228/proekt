import { NextRequest, NextResponse } from "next/server";
import { checkoutService } from "@/server/services/checkout-service";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { getRequestId } from "@/server/utils/request-context";
import { captureServerError, captureServerMessage } from "@/server/utils/sentry";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();

  if (env.PAYMENT_PROVIDER !== "stripe") {
    const response = NextResponse.json({ error: "Stripe webhook endpoint is disabled", requestId }, { status: 503 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    const response = NextResponse.json({ error: "Missing stripe signature", requestId }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const rawBody = await request.text();

  try {
    const processed = await checkoutService.processStripeWebhook(signature, rawBody);
    captureServerMessage("Stripe webhook processed", {
      requestId,
      endpoint: "/api/webhooks/stripe",
      method: "POST",
      area: "webhook",
      details: {
        processed: true,
        result: JSON.stringify(processed)
      }
    });
    const response = NextResponse.json(
      {
        received: true,
        requestId
      },
      { status: 200 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
    const isSignatureError =
      errorMessage.includes("signature") ||
      errorMessage.includes("no signatures found") ||
      errorMessage.includes("unable to extract timestamp");

    logger.error(
      { err: error, requestId, webhookSecretSet: Boolean(env.STRIPE_WEBHOOK_SECRET) },
      "Stripe webhook processing failed"
    );
    captureServerError(
      error,
      {
        requestId,
        endpoint: "/api/webhooks/stripe",
        method: "POST",
        area: "webhook",
        details: {
          webhookSecretSet: Boolean(env.STRIPE_WEBHOOK_SECRET),
          isSignatureError
        }
      },
      "Stripe webhook processing failed",
      {
        level: isSignatureError ? "warning" : "error",
        sampleRate: isSignatureError ? 0.1 : undefined
      }
    );
    const response = NextResponse.json({ error: "Webhook processing failed", requestId }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
