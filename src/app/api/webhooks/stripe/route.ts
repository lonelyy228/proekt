import { NextRequest, NextResponse } from "next/server";
import { checkoutService } from "@/server/services/checkout-service";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { getRequestId } from "@/server/utils/request-context";
import { captureServerError, captureServerMessage } from "@/server/utils/sentry";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    const response = NextResponse.json({ error: "Missing stripe signature", requestId }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const rawBody = await request.text();

  try {
    const processed = await checkoutService.processStripeWebhook(signature, rawBody, { requestId });
    captureServerMessage("Stripe webhook processed", {
      requestId,
      endpoint: "/api/webhooks/stripe",
      method: "POST",
      area: "webhook",
      details: {
        duplicate: processed.duplicate,
        durationMs: processed.durationMs,
        replayed: processed.replayed
      }
    });
    const response = NextResponse.json(
      {
        received: true,
        requestId,
        eventId: processed.eventId,
        eventType: processed.eventType,
        duplicate: processed.duplicate,
        durationMs: processed.durationMs
      },
      { status: 200 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error: unknown) {
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
          webhookSecretSet: Boolean(env.STRIPE_WEBHOOK_SECRET)
        }
      },
      "Stripe webhook processing failed"
    );
    const response = NextResponse.json({ error: "Webhook processing failed", requestId }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
