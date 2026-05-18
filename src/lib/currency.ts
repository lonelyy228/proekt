import { env } from "@/config/env";

const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

const normalizeCurrency = (value: string): string => value.trim().toUpperCase();

const usdCentsToRubAmount = (usdCents: number): number => {
  const usd = usdCents / 100;
  return usd * env.STORE_USD_TO_RUB_RATE;
};

const rubCentsToRubAmount = (rubCents: number): number => rubCents / 100;

export const formatStoreMoney = (amountCents: number, currency: string): string => {
  const normalizedCurrency = normalizeCurrency(currency);

  if (normalizedCurrency === "RUB") {
    return rubFormatter.format(rubCentsToRubAmount(amountCents));
  }

  if (normalizedCurrency === "USD") {
    return rubFormatter.format(usdCentsToRubAmount(amountCents));
  }

  return rubFormatter.format(rubCentsToRubAmount(amountCents));
};
