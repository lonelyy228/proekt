import { OrderStatus, PaymentProvider, PaymentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { cartService } from "@/server/services/cart-service";
import { orderRepository } from "@/server/repositories/order-repository";
import { stripe } from "@/lib/stripe";
import { env } from "@/config/env";
import { isCustomizerBaseBrand, CUSTOMIZER_BRAND_RESTRICTION_MESSAGE } from "@/config/customizer";
import { AppError } from "@/server/utils/errors";
import { stripeEventRepository } from "@/server/repositories/stripe-event-repository";
import { designRepository } from "@/server/repositories/design-repository";
import { productRepository } from "@/server/repositories/product-repository";
import { prisma } from "@/lib/prisma";
import { cartRepository } from "@/server/repositories/cart-repository";
import type Stripe from "stripe";

const centsToStripeAmount = (amount: number): number => amount;
const appendQuery = (url: string, key: string, value: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

const validateCheckoutItemReferences = async (
  userId: string,
  item: { productId: string; variantId: string; customizationId?: string | null }
): Promise<void> => {
  const [product, variant] = await Promise.all([
    productRepository.findById(item.productId),
    productRepository.findVariantById(item.variantId)
  ]);

  if (!product) {
    throw new AppError("NOT_FOUND", "Product not found");
  }

  if (!variant || variant.productId !== product.id) {
    throw new AppError("VALIDATION_ERROR", "Variant does not belong to the selected product");
  }

  if (!item.customizationId) {
    return;
  }

  if (!isCustomizerBaseBrand(product.brand)) {
    throw new AppError("FORBIDDEN", CUSTOMIZER_BRAND_RESTRICTION_MESSAGE);
  }

  const design = await designRepository.findById(item.customizationId, userId);

  if (!design) {
    throw new AppError("NOT_FOUND", "Customization design not found");
  }
};

const processCheckoutCompletedEvent = async (event: Stripe.Event): Promise<void> => {
  const session = event.data.object as Stripe.Checkout.Session;
  const checkoutId = session.id;
  const order = await orderRepository.findByCheckoutId(checkoutId);

  if (order && order.status !== OrderStatus.PAID) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID }
      }),
      prisma.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.STRIPE,
          status: PaymentStatus.SUCCEEDED,
          amountCents: order.totalCents,
          currency: order.currency,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          providerPayload: session as unknown as Prisma.InputJsonValue
        }
      }),
      cartRepository.clearByUserId(order.userId)
    ]);
  }
};

const processStripeEvent = async (
  event: Stripe.Event,
  options?: {
    forceReplay?: boolean;
  }
): Promise<{ duplicate?: boolean; processed: boolean }> => {
  const existing = await stripeEventRepository.findByEventId(event.id);
  if (existing?.processedAt && !options?.forceReplay) {
    return { duplicate: true, processed: true };
  }

  if (!existing) {
    await stripeEventRepository.create(event.id, event.type, event as unknown as object);
  } else if (options?.forceReplay) {
    await stripeEventRepository.resetProcessedAt(event.id);
  }

  if (event.type === "checkout.session.completed") {
    await processCheckoutCompletedEvent(event);
  }

  await stripeEventRepository.markProcessed(event.id);

  return { processed: true };
};

export const checkoutService = {
  createCheckoutSession: async (userId: string, payload: {
    successUrl: string;
    cancelUrl: string;
    shippingAddress: Record<string, unknown>;
    billingAddress?: Record<string, unknown>;
  }) => {
    const cart = await cartService.getCart(userId);

    if (cart.items.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Cart is empty");
    }

    await Promise.all(
      cart.items.map((item) =>
        validateCheckoutItemReferences(userId, {
          productId: item.productId,
          variantId: item.variantId,
          customizationId: item.customizationId
        })
      )
    );

    const subtotalCents = cart.subtotalCents;
    const shippingCents = subtotalCents >= 10000 ? 0 : 999;
    const taxCents = Math.round(subtotalCents * 0.08);
    const totalCents = subtotalCents + shippingCents + taxCents;

    const order = await orderRepository.createOrder({
      user: { connect: { id: userId } },
      status: OrderStatus.PENDING,
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
      currency: "USD",
      shippingAddressJson: payload.shippingAddress as Prisma.InputJsonValue,
      billingAddressJson: payload.billingAddress as Prisma.InputJsonValue | undefined,
      items: {
        create: cart.items.map((item) => ({
          product: { connect: { id: item.productId } },
          variant: { connect: { id: item.variantId } },
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
          currency: "USD",
          customization: item.customizationId ? { connect: { id: item.customizationId } } : undefined
        }))
      }
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: appendQuery(appendQuery(payload.successUrl, "order_id", order.id), "session_id", "{CHECKOUT_SESSION_ID}"),
      cancel_url: payload.cancelUrl,
      line_items: cart.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: env.STRIPE_PRICE_CURRENCY,
          unit_amount: centsToStripeAmount(item.unitPriceCents),
          product_data: {
            name: `${item.productName} - ${item.variantName}`
          }
        }
      })),
      metadata: {
        orderId: order.id,
        userId
      }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripeCheckoutId: session.id
      }
    });

    return {
      checkoutUrl: session.url,
      orderId: order.id
    };
  },

  processStripeWebhook: async (signature: string, rawBody: string) => {
    const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    return processStripeEvent(event);
  },

  replayStoredEvent: async (eventId: string) => {
    const existing = await stripeEventRepository.findByEventId(eventId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Webhook событие не найдено");
    }

    const event = existing.payload as unknown as Stripe.Event;
    return processStripeEvent(event, { forceReplay: true });
  }
};
