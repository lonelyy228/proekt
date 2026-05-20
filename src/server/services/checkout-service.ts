import { createHash, randomUUID } from "node:crypto";
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { cartService } from "@/server/services/cart-service";
import { orderRepository } from "@/server/repositories/order-repository";
import { stripe } from "@/lib/stripe";
import { env } from "@/config/env";
import { AppError, isAppError } from "@/server/utils/errors";
import { stripeEventRepository } from "@/server/repositories/stripe-event-repository";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { webhookObservability } from "@/server/utils/webhook-observability";
import type Stripe from "stripe";

const centsToStripeAmount = (amount: number): number => amount;
const CHECKOUT_IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 12;
const CHECKOUT_IDEMPOTENCY_LOCK_SECONDS = 30;
const CHECKOUT_IDEMPOTENCY_WAIT_MS = 5000;
const STRIPE_EVENT_LOCK_SECONDS = 45;
const STRIPE_PAYMENT_TERMINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.PAID,
  OrderStatus.FULFILLED,
  OrderStatus.REFUNDED
]);

type CheckoutSessionResult = {
  checkoutUrl: string | null;
  orderId: string;
};

type StripeEventProcessResult = {
  eventId: string;
  eventType: string;
  processed: boolean;
  duplicate: boolean;
  replayed: boolean;
  durationMs: number;
};

const appendQuery = (url: string, key: string, value: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const safelyReleaseRedisLock = async (key: string, token: string): Promise<void> => {
  try {
    await redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      1,
      key,
      token
    );
  } catch (error: unknown) {
    logger.warn({ err: error, key }, "Failed to release redis lock");
  }
};

const assertCheckoutRedirectUrl = (urlValue: string): string => {
  const redirectUrl = new URL(urlValue);
  const appOrigin = new URL(env.APP_URL).origin;

  if (redirectUrl.origin !== appOrigin) {
    throw new AppError("VALIDATION_ERROR", "Redirect URL checkout должен совпадать с APP_URL");
  }

  if (env.NODE_ENV === "production" && redirectUrl.protocol !== "https:") {
    throw new AppError("VALIDATION_ERROR", "Redirect URL checkout должен использовать HTTPS");
  }

  return redirectUrl.toString();
};

const buildCheckoutIdempotencyDigest = (params: {
  userId: string;
  successUrl: string;
  cancelUrl: string;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  cart: {
    subtotalCents: number;
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      customizationId: string | null;
      unitPriceCents: number;
    }>;
  };
}): string => {
  const stableItems = [...params.cart.items]
    .sort((a, b) => {
      const left = `${a.variantId}:${a.customizationId ?? "none"}`;
      const right = `${b.variantId}:${b.customizationId ?? "none"}`;
      return left.localeCompare(right);
    })
    .map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      customizationId: item.customizationId ?? null,
      unitPriceCents: item.unitPriceCents
    }));

  const signature = JSON.stringify({
    userId: params.userId,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    shippingAddress: params.shippingAddress,
    billingAddress: params.billingAddress ?? null,
    subtotalCents: params.cart.subtotalCents,
    items: stableItems
  });

  return createHash("sha256").update(signature).digest("hex");
};

const readCachedCheckoutSession = async (cacheKey: string): Promise<CheckoutSessionResult | null> => {
  const raw = await redis.get(cacheKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CheckoutSessionResult;
  } catch {
    return null;
  }
};

const withCheckoutIdempotency = async (
  userId: string,
  idempotencyDigest: string,
  createSession: () => Promise<CheckoutSessionResult>
): Promise<CheckoutSessionResult> => {
  const cacheKey = `checkout:idempotency:v1:${userId}:${idempotencyDigest}`;
  const lockKey = `${cacheKey}:lock`;
  const lockToken = randomUUID();

  try {
    const cached = await readCachedCheckoutSession(cacheKey);
    if (cached) {
      return cached;
    }

    const lockAcquired = await redis.set(
      lockKey,
      lockToken,
      "EX",
      CHECKOUT_IDEMPOTENCY_LOCK_SECONDS,
      "NX"
    );

    if (lockAcquired !== "OK") {
      const pollStepMs = 250;
      const attempts = Math.ceil(CHECKOUT_IDEMPOTENCY_WAIT_MS / pollStepMs);

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        await sleep(pollStepMs);
        const existing = await readCachedCheckoutSession(cacheKey);
        if (existing) {
          return existing;
        }
      }

      throw new AppError(
        "CONFLICT",
        "Checkout уже обрабатывается. Повторите попытку через несколько секунд."
      );
    }

    try {
      const created = await createSession();
      await redis.set(
        cacheKey,
        JSON.stringify(created),
        "EX",
        CHECKOUT_IDEMPOTENCY_TTL_SECONDS
      );
      return created;
    } finally {
      await safelyReleaseRedisLock(lockKey, lockToken);
    }
  } catch (error: unknown) {
    if (isAppError(error)) {
      throw error;
    }

    logger.warn({ err: error, cacheKey }, "Checkout idempotency layer degraded, falling back");
    return createSession();
  }
};

const resolveOrderFromCheckoutSession = async (
  session: Stripe.Checkout.Session
): Promise<{
  id: string;
  userId: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  stripeCheckoutId: string | null;
} | null> => {
  const byCheckout = await orderRepository.findByCheckoutId(session.id);
  if (byCheckout) {
    return {
      id: byCheckout.id,
      userId: byCheckout.userId,
      status: byCheckout.status,
      totalCents: byCheckout.totalCents,
      currency: byCheckout.currency,
      stripeCheckoutId: byCheckout.stripeCheckoutId
    };
  }

  const metadataOrderId = typeof session.metadata?.orderId === "string" ? session.metadata.orderId : null;
  if (!metadataOrderId) {
    return null;
  }

  const byMetadata = await prisma.order.findUnique({
    where: { id: metadataOrderId },
    select: {
      id: true,
      userId: true,
      status: true,
      totalCents: true,
      currency: true,
      stripeCheckoutId: true,
      deletedAt: true
    }
  });

  if (!byMetadata || byMetadata.deletedAt !== null) {
    return null;
  }

  return {
    id: byMetadata.id,
    userId: byMetadata.userId,
    status: byMetadata.status,
    totalCents: byMetadata.totalCents,
    currency: byMetadata.currency,
    stripeCheckoutId: byMetadata.stripeCheckoutId
  };
};

const finalizeOrderFromStripeCheckoutSession = async (
  session: Stripe.Checkout.Session
): Promise<void> => {
  const order = await resolveOrderFromCheckoutSession(session);
  if (!order) {
    throw new AppError("NOT_FOUND", "Заказ для Stripe checkout-сессии не найден");
  }

  if (order.stripeCheckoutId && order.stripeCheckoutId !== session.id) {
    throw new AppError("CONFLICT", "Checkout session не совпадает с заказом");
  }

  if (typeof session.amount_total === "number" && session.amount_total !== order.totalCents) {
    throw new AppError("CONFLICT", "Сумма Stripe checkout не совпадает с суммой заказа");
  }

  if (typeof session.currency === "string" && session.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new AppError("CONFLICT", "Валюта Stripe checkout не совпадает с валютой заказа");
  }

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    throw new AppError("CONFLICT", "Checkout session не подтверждена как оплаченная");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" && session.payment_intent.length > 0
      ? session.payment_intent
      : null;

  await prisma.$transaction(async (tx) => {
    const freshOrder = await tx.order.findUnique({
      where: { id: order.id },
      select: {
        id: true,
        userId: true,
        status: true,
        totalCents: true,
        currency: true,
        stripeCheckoutId: true,
        items: {
          select: {
            variantId: true,
            quantity: true
          }
        }
      }
    });

    if (!freshOrder) {
      throw new AppError("NOT_FOUND", "Заказ не найден во время финализации");
    }

    if (freshOrder.stripeCheckoutId && freshOrder.stripeCheckoutId !== session.id) {
      throw new AppError("CONFLICT", "Checkout session привязана к другому заказу");
    }

    if (!freshOrder.stripeCheckoutId) {
      await tx.order.update({
        where: { id: freshOrder.id },
        data: { stripeCheckoutId: session.id }
      });
    }

    const shouldCommitInventory = !STRIPE_PAYMENT_TERMINAL_ORDER_STATUSES.has(freshOrder.status);
    if (shouldCommitInventory) {
      const variantIds = Array.from(new Set(freshOrder.items.map((item) => item.variantId)));
      const inventoryItems = await tx.inventoryItem.findMany({
        where: {
          variantId: {
            in: variantIds
          }
        },
        select: {
          variantId: true
        }
      });

      if (inventoryItems.length > 0) {
        const inventoryVariantSet = new Set(inventoryItems.map((item) => item.variantId));
        for (const item of freshOrder.items) {
          if (!inventoryVariantSet.has(item.variantId)) {
            throw new AppError("CONFLICT", "Не найден остаток для варианта товара");
          }

          const commitResult = await tx.inventoryItem.updateMany({
            where: {
              variantId: item.variantId,
              quantity: {
                gte: item.quantity
              }
            },
            data: {
              quantity: {
                decrement: item.quantity
              }
            }
          });

          if (commitResult.count !== 1) {
            throw new AppError("CONFLICT", "Недостаточно остатка для подтверждения оплаты");
          }
        }
      } else {
        logger.warn(
          { orderId: freshOrder.id },
          "Inventory rows are missing, skipping stock commit for backward compatibility"
        );
      }
    }

    if (paymentIntentId) {
      const existingPayment = await tx.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { id: true, orderId: true }
      });

      if (existingPayment && existingPayment.orderId !== freshOrder.id) {
        throw new AppError("CONFLICT", "PaymentIntent уже привязан к другому заказу");
      }

      if (!existingPayment) {
        await tx.payment.create({
          data: {
            orderId: freshOrder.id,
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.SUCCEEDED,
            amountCents: freshOrder.totalCents,
            currency: freshOrder.currency,
            stripePaymentIntentId: paymentIntentId,
            providerPayload: session as unknown as Prisma.InputJsonValue
          }
        });
      }
    } else {
      const existingSucceeded = await tx.payment.findFirst({
        where: {
          orderId: freshOrder.id,
          provider: PaymentProvider.STRIPE,
          status: PaymentStatus.SUCCEEDED
        },
        select: { id: true }
      });

      if (!existingSucceeded) {
        await tx.payment.create({
          data: {
            orderId: freshOrder.id,
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.SUCCEEDED,
            amountCents: freshOrder.totalCents,
            currency: freshOrder.currency,
            providerPayload: session as unknown as Prisma.InputJsonValue
          }
        });
      }
    }

    if (freshOrder.status !== OrderStatus.PAID) {
      await tx.order.update({
        where: { id: freshOrder.id },
        data: { status: OrderStatus.PAID }
      });
    }

    await tx.cartItem.deleteMany({
      where: {
        cart: {
          userId: freshOrder.userId
        }
      }
    });
  });
};

const markOrderCancelledFromStripeCheckoutSession = async (
  session: Stripe.Checkout.Session
): Promise<void> => {
  const order = await resolveOrderFromCheckoutSession(session);
  if (!order) {
    logger.warn({ stripeSessionId: session.id }, "Stripe cancel event without linked order");
    return;
  }

  if (STRIPE_PAYMENT_TERMINAL_ORDER_STATUSES.has(order.status)) {
    return;
  }

  await prisma.order.updateMany({
    where: {
      id: order.id,
      status: {
        in: [OrderStatus.PENDING, OrderStatus.CANCELLED]
      }
    },
    data: {
      status: OrderStatus.CANCELLED
    }
  });
};

const markPaymentFailedFromPaymentIntent = async (
  paymentIntent: Stripe.PaymentIntent
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
      select: {
        id: true,
        orderId: true,
        status: true
      }
    });

    if (!payment) {
      return;
    }

    if (payment.status !== PaymentStatus.FAILED) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          providerPayload: paymentIntent as unknown as Prisma.InputJsonValue
        }
      });
    }

    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      select: {
        id: true,
        status: true
      }
    });

    if (!order) {
      return;
    }

    if (!STRIPE_PAYMENT_TERMINAL_ORDER_STATUSES.has(order.status) && order.status !== OrderStatus.CANCELLED) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED }
      });
    }
  });
};

const markRefundFromCharge = async (charge: Stripe.Charge): Promise<void> => {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: {
        id: true,
        orderId: true,
        status: true
      }
    });

    if (!payment) {
      return;
    }

    if (payment.status !== PaymentStatus.REFUNDED) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          stripeChargeId: charge.id,
          providerPayload: charge as unknown as Prisma.InputJsonValue
        }
      });
    }

    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      select: {
        id: true,
        status: true
      }
    });

    if (!order) {
      return;
    }

    if (order.status !== OrderStatus.REFUNDED) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.REFUNDED }
      });
    }
  });
};

const processStripeEvent = async (
  event: Stripe.Event,
  options?: {
    forceReplay?: boolean;
  }
): Promise<StripeEventProcessResult> => {
  const startedAt = Date.now();
  const replayed = Boolean(options?.forceReplay);
  const lockKey = `stripe:event:lock:${event.id}`;
  const lockToken = randomUUID();
  await webhookObservability.increment("received");
  if (replayed) {
    await webhookObservability.increment("replayed");
  }

  const lockAcquired = await redis
    .set(lockKey, lockToken, "EX", STRIPE_EVENT_LOCK_SECONDS, "NX")
    .catch((error: unknown) => {
      logger.warn({ err: error, eventId: event.id }, "Stripe event lock unavailable");
      return null;
    });

  if (lockAcquired !== "OK") {
    const existing = await stripeEventRepository.findByEventId(event.id);
    if (existing?.processedAt && !options?.forceReplay) {
      const durationMs = Date.now() - startedAt;
      await webhookObservability.increment("duplicate");
      return {
        eventId: event.id,
        eventType: event.type,
        processed: true,
        duplicate: true,
        replayed,
        durationMs
      };
    }

    const durationMs = Date.now() - startedAt;
    await webhookObservability.increment("duplicate");
    return {
      eventId: event.id,
      eventType: event.type,
      processed: true,
      duplicate: true,
      replayed,
      durationMs
    };
  }

  try {
    const existing = await stripeEventRepository.findByEventId(event.id);
    if (existing?.processedAt && !options?.forceReplay) {
      const durationMs = Date.now() - startedAt;
      await webhookObservability.increment("duplicate");
      return {
        eventId: event.id,
        eventType: event.type,
        processed: true,
        duplicate: true,
        replayed,
        durationMs
      };
    }

    await stripeEventRepository.upsertEvent(event.id, event.type, event as unknown as object);

    if (options?.forceReplay) {
      await stripeEventRepository.resetProcessedAt(event.id);
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await finalizeOrderFromStripeCheckoutSession(session);
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await markOrderCancelledFromStripeCheckoutSession(session);
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await markPaymentFailedFromPaymentIntent(paymentIntent);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      await markRefundFromCharge(charge);
    }

    await stripeEventRepository.markProcessed(event.id);
    const durationMs = Date.now() - startedAt;
    await webhookObservability.increment("processed");
    await webhookObservability.recordProcessDuration(durationMs);
    return {
      eventId: event.id,
      eventType: event.type,
      processed: true,
      duplicate: false,
      replayed,
      durationMs
    };
  } catch (error: unknown) {
    await webhookObservability.increment("failed");
    throw error;
  } finally {
    await safelyReleaseRedisLock(lockKey, lockToken);
  }
};

export const checkoutService = {
  createCheckoutSession: async (
    userId: string,
    payload: {
      successUrl: string;
      cancelUrl: string;
      shippingAddress: Record<string, unknown>;
      billingAddress?: Record<string, unknown>;
    },
    requestIdempotencyKey?: string
  ) => {
    const successUrl = assertCheckoutRedirectUrl(payload.successUrl);
    const cancelUrl = assertCheckoutRedirectUrl(payload.cancelUrl);
    const cart = await cartService.getCart(userId);

    if (cart.items.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Cart is empty");
    }

    const fallbackDigest = buildCheckoutIdempotencyDigest({
      userId,
      successUrl,
      cancelUrl,
      shippingAddress: payload.shippingAddress,
      billingAddress: payload.billingAddress,
      cart: {
        subtotalCents: cart.subtotalCents,
        items: cart.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          customizationId: item.customizationId ?? null,
          unitPriceCents: item.unitPriceCents
        }))
      }
    });

    const providedKey = requestIdempotencyKey?.trim();
    const effectiveDigest = providedKey
      ? createHash("sha256").update(`${userId}:${providedKey}:${fallbackDigest}`).digest("hex")
      : fallbackDigest;

    return withCheckoutIdempotency(userId, effectiveDigest, async () => {
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

      try {
        const session = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            success_url: appendQuery(
              appendQuery(successUrl, "order_id", order.id),
              "session_id",
              "{CHECKOUT_SESSION_ID}"
            ),
            cancel_url: cancelUrl,
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
          },
          {
            idempotencyKey: `checkout_${effectiveDigest}`
          }
        );

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
      } catch (error: unknown) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED
          }
        });

        throw error;
      }
    });
  },

  processStripeWebhook: async (
    signature: string,
    rawBody: string,
    context?: { requestId?: string }
  ) => {
    const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    const result = await processStripeEvent(event);

    logger.info(
      {
        requestId: context?.requestId,
        eventId: result.eventId,
        eventType: result.eventType,
        duplicate: result.duplicate,
        replayed: result.replayed,
        durationMs: result.durationMs
      },
      "Stripe webhook processed"
    );

    return result;
  },

  replayStoredEvent: async (eventId: string) => {
    const existing = await stripeEventRepository.findByEventId(eventId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Webhook событие не найдено");
    }

    const event = existing.payload as unknown as Stripe.Event;
    const result = await processStripeEvent(event, { forceReplay: true });
    logger.info(
      {
        eventId: result.eventId,
        eventType: result.eventType,
        duplicate: result.duplicate,
        replayed: result.replayed,
        durationMs: result.durationMs
      },
      "Stripe webhook replay processed"
    );

    return result;
  }
};
