import { NextRequest, NextResponse } from "next/server";
import { checkoutService } from "@/server/services/checkout-service";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<Response> {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    await checkoutService.processStripeWebhook(signature, rawBody);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error({ err: error, webhookSecretSet: Boolean(env.STRIPE_WEBHOOK_SECRET) }, "Stripe webhook processing failed");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
