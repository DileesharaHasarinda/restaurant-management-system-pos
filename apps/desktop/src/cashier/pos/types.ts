import type { MenuItem, MenuVariant, SelectedAddon } from "../../types";

export interface ProductSelection {
  item: MenuItem;

  variant: MenuVariant | null;

  addons: SelectedAddon[];

  quantity: number;

  notes: string;
}
