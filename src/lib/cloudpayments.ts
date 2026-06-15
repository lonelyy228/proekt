import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/config/env";

const CLOUDPAYMENTS_API_URL = "https://api.cloudpayments.ru";

type CloudPaymentsCreateInvoiceInput = {
  amountCents: number;
  currency: string;
  description: string;
  email?: string;
  invoiceId: string;
  accountId: string;
  metadata?: Record<string, string>;
};

type CloudPaymentsCreateInvoiceResponse = {
  Success: boolean;
  Message?: string;
  Model?: {
    Url?: string;
    Id?: string | number;
  };
};

const getCloudPaymentsAuthHeader = (): string =>
  `Basic ${Buffer.from(`${env.CLOUDPAYMENTS_PUBLIC_ID}:${env.CLOUDPAYMENTS_API_SECRET}`).toString("base64")}`;

const buildAmount = (amountCents: number): number => Number((amountCents / 100).toFixed(2));

export const createCloudPaymentsInvoice = async (
  input: CloudPaymentsCreateInvoiceInput
): Promise<{ checkoutUrl: string; invoiceId: string; remoteId: string | null }> => {
  const response = await fetch(`${CLOUDPAYMENTS_API_URL}/orders/create`, {
    method: "POST",
    headers: {
      Authorization: getCloudPaymentsAuthHeader(),
      "Content-Type": "application/json",
      "X-Request-ID": input.invoiceId
    },
    body: JSON.stringify({
      Amount: buildAmount(input.amountCents),
      Currency: input.currency.toUpperCase(),
      InvoiceId: input.invoiceId,
      AccountId: input.accountId,
      Description: input.description,
      Email: input.email,
      JsonData: input.metadata
    })
  });

  const payload = (await response.json()) as CloudPaymentsCreateInvoiceResponse;

  if (!response.ok || !payload.Success || !payload.Model?.Url) {
    throw new Error(payload.Message ?? "CloudPayments invoice creation failed");
  }

  return {
    checkoutUrl: payload.Model.Url,
    invoiceId: input.invoiceId,
    remoteId: payload.Model.Id ? String(payload.Model.Id) : null
  };
};

export const verifyCloudPaymentsSignature = (rawBody: string, signature: string): boolean => {
  const expected = createHmac("sha256", env.CLOUDPAYMENTS_API_SECRET).update(rawBody, "utf8").digest("base64");
  const normalizedSignature = signature.trim();

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedSignature));
  } catch {
    return false;
  }
};

export const parseCloudPaymentsWebhookBody = (rawBody: string) => {
  const params = new URLSearchParams(rawBody);

  const amountValue = params.get("Amount");
  const amount = amountValue ? Number(amountValue) : Number.NaN;

  return {
    invoiceId: params.get("InvoiceId")?.trim() ?? "",
    transactionId: params.get("TransactionId")?.trim() || null,
    amount,
    amountCents: Number.isFinite(amount) ? Math.round(amount * 100) : null,
    currency: params.get("Currency")?.trim().toUpperCase() || null,
    email: params.get("Email")?.trim() || null,
    accountId: params.get("AccountId")?.trim() || null,
    cardFirstSix: params.get("CardFirstSix")?.trim() || null,
    cardLastFour: params.get("CardLastFour")?.trim() || null,
    raw: Object.fromEntries(params.entries())
  };
};
