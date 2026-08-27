export type OrderTransitionAction =
  "confirm" | "send-to-kitchen" | "serve" | "complete";

export interface OrderDisplayAddon {
  id?: number;

  name: string;

  quantity: number;
}

export interface OrderDisplayItem {
  id: number;

  name: string;

  variant: string | null;

  quantity: number;

  lineTotal: number;

  notes: string | null;

  addons: OrderDisplayAddon[];
}

export interface OrderDisplayMeta {
  tableName: string | null;

  token: string | null;

  orderType: string | null;

  orderSource: string | null;

  customerName: string | null;

  customerPhone: string | null;

  createdAt: string | null;
}
