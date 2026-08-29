export type OrderTransitionAction =
  "confirm" | "send-to-kitchen" | "serve" | "complete";

export interface OrderActionPermissions {
  can_confirm: boolean;

  can_reject: boolean;

  can_send_to_kitchen: boolean;

  can_serve: boolean;

  can_complete: boolean;

  can_cancel: boolean;
}

export interface OrderDisplayAddon {
  id?: number;

  name: string;

  quantity: number;
}

export type OrderItemKitchenState = "WAITING" | "SENT" | "CANCELLED";

export interface OrderDisplayItem {
  id: number;

  name: string;

  variant: string | null;

  quantity: number;

  lineTotal: number;

  notes: string | null;

  status: string;

  sentToKitchenAt: string | null;

  cancelledAt: string | null;

  kitchenState: OrderItemKitchenState;

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
