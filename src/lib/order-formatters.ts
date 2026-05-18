import { formatStoreMoney } from "@/lib/currency";

export const getOrderStatusLabel = (status: string): string => {
  switch (status) {
    case "PENDING":
      return "Ожидает оплаты";
    case "PAID":
      return "Оплачен";
    case "FULFILLED":
      return "Выполнен";
    case "CANCELLED":
      return "Отменен";
    case "REFUNDED":
      return "Возврат";
    default:
      return status;
  }
};

export const formatUsdCents = (value: number): string => formatStoreMoney(value, "USD");
