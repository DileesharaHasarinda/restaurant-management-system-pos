import type { MenuItem, MenuVariant, SelectedAddon } from "../../types";

export interface ProductSelection {
  item: MenuItem;

  variant: MenuVariant | null;

  addons: SelectedAddon[];

  quantity: number;

  notes: string;
}

export interface DineInSubmissionData {
  clientOrderId: string;

  tableId: number;

  guestCount: number;

  customerName: string | null;

  customerPhone: string | null;

  notes: string | null;
}
