const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

const normalizeCurrency = (value: string): string => value.trim().toUpperCase();

const getUsdToRubRate = (): number => {
  const rawRate = process.env.NEXT_PUBLIC_STORE_USD_TO_RUB_RATE ?? process.env.STORE_USD_TO_RUB_RATE ?? "90";
  const parsedRate = Number(rawRate);

  return Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 90;
};

const usdCentsToRubAmount = (usdCents: number): number => {
  const usd = usdCents / 100;
  return usd * getUsdToRubRate();
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

