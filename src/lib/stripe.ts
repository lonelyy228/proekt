import Stripe from "stripe";
import { env } from "@/config/env";

export const stripe =
  env.PAYMENT_PROVIDER === "stripe" && env.STRIPE_SECRET_KEY.length > 0
    ? new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: "2026-04-22.dahlia"
      })
    : null;
