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
import { assertAllowedCheckoutReturnUrl } from "@/server/utils/checkout-return-url";

const centsToStripeAmount = (amount: number): number => amount;
const appendQuery = (url: string, key: string, value: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

const PLACEHOLDER_STRIPE_KEY_MARKERS = ["xxx", "mock", "dummy", "placeholder"];

export const shouldUseLocalCheckoutFallback = (params: {
  nodeEnv: "development" | "test" | "production";
  stripeSecretKey: string;
}): boolean => {
  if (params.nodeEnv === "production") {
    return false;
  }

  const normalizedKey = params.stripeSecretKey.trim().toLowerCase();
  return PLACEHOLDER_STRIPE_KEY_MARKERS.some((marker) => normalizedKey.includes(marker));
};

const resolveCartCurrency = (items: Array<{ currency: string }>): string => {
  const currencies = new Set(items.map((item) => item.currency.trim().toUpperCase()));

  if (currencies.size !== 1) {
    throw new AppError("VALIDATION_ERROR", "Cart contains items with mixed currencies");
  }

  const [currency] = [...currencies];

  if (!currency || currency.length !== 3) {
    throw new AppError("VALIDATION_ERROR", "Cart currency is invalid");
  }

  return currency;
};

const buildCheckoutSuccessUrl = (successUrl: string, orderId: string, sessionId: string): string =>
  appendQuery(appendQuery(successUrl, "order_id", orderId), "session_id", sessionId);

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
    assertAllowedCheckoutReturnUrl(payload.successUrl);
    assertAllowedCheckoutReturnUrl(payload.cancelUrl);

    const cart = await cartService.getCart(userId);

    if (cart.items.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Cart is empty");
    }

    const checkoutCurrency = resolveCartCurrency(cart.items);
    const stripeCurrency = checkoutCurrency.toLowerCase();

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
      currency: checkoutCurrency,
      shippingAddressJson: payload.shippingAddress as Prisma.InputJsonValue,
      billingAddressJson: payload.billingAddress as Prisma.InputJsonValue | undefined,
      items: {
        create: cart.items.map((item) => ({
          product: { connect: { id: item.productId } },
          variant: { connect: { id: item.variantId } },
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
          currency: checkoutCurrency,
          customization: item.customizationId ? { connect: { id: item.customizationId } } : undefined
        }))
      }
    });

    if (shouldUseLocalCheckoutFallback({ nodeEnv: env.NODE_ENV, stripeSecretKey: env.STRIPE_SECRET_KEY })) {
      const localCheckoutId = `dev_checkout_${order.id}`;
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID,
            stripeCheckoutId: localCheckoutId
          }
        }),
        prisma.payment.create({
          data: {
            orderId: order.id,
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.SUCCEEDED,
            amountCents: totalCents,
            currency: checkoutCurrency,
            stripePaymentIntentId: `dev_payment_${order.id}`,
            providerPayload: {
              mode: "local-checkout-fallback",
              reason: "Stripe secret key is a non-production placeholder"
            }
          }
        }),
        cartRepository.clearByUserId(userId)
      ]);

      return {
        checkoutUrl: buildCheckoutSuccessUrl(payload.successUrl, order.id, localCheckoutId),
        orderId: order.id,
        mode: "local" as const
      };
    }

    let session: Stripe.Checkout.Session;

    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: buildCheckoutSuccessUrl(payload.successUrl, order.id, "{CHECKOUT_SESSION_ID}"),
        cancel_url: payload.cancelUrl,
        line_items: cart.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: stripeCurrency,
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
    } catch (error: unknown) {
      throw new AppError(
        "EXTERNAL_PROVIDER_ERROR",
        error instanceof Error ? `Stripe checkout failed: ${error.message}` : "Stripe checkout failed"
      );
    }

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
