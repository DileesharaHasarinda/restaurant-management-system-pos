import type { CustomerPaymentMethod } from "./types";

export const makePaymentUuid = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = (Math.random() * 16) | 0;

      const value = character === "x" ? random : (random & 0x3) | 0x8;

      return value.toString(16);
    }
  );
};

export const paymentMoney = (
  value: number | string | null | undefined
): string => {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "Rs. 0.00";
  }

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
};

export const paymentMethodLabel = (method: string): string =>
  method.replace(/_/g, " ");

export const normaliseMoney = (value: number): number =>
  Math.round(value * 100) / 100;

export const isCashMethod = (method: CustomerPaymentMethod): boolean =>
  method === "CASH";

export const paymentDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-LK", {
    dateStyle: "medium",

    timeStyle: "short",
  });
};
