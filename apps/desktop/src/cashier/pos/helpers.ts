import type { CartLine } from "../../types";

/*
|--------------------------------------------------------------------------
| Money
|--------------------------------------------------------------------------
*/

export const posMoney = (value: number | string | null | undefined): string => {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "Rs. 0.00";
  }

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
};

/*
|--------------------------------------------------------------------------
| Cart Unit Price
|--------------------------------------------------------------------------
*/

export const cartUnitPrice = (line: CartLine): number => {
  const base = line.variant
    ? Number(line.variant.price)
    : Number(line.item.price);

  const addons = line.addons.reduce(
    (total, selected) =>
      total + Number(selected.addon.price) * selected.quantity,

    0
  );

  return base + addons;
};

/*
|--------------------------------------------------------------------------
| Cart Line Total
|--------------------------------------------------------------------------
*/

export const cartLineTotal = (line: CartLine): number =>
  cartUnitPrice(line) * line.quantity;

/*
|--------------------------------------------------------------------------
| Cart Quantity
|--------------------------------------------------------------------------
*/

export const cartItemQuantity = (cart: CartLine[]): number =>
  cart.reduce(
    (total, line) => total + Number(line.quantity),

    0
  );
