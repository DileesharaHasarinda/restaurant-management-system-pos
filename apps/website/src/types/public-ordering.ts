export interface PublicTable {
  id: number;
  name: string;
  code: string | null;
  area: string | null;
  capacity: number | null;
  status: string | null;
  qrOrderingEnabled: boolean;
}

export interface MenuVariant {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface MenuAddon {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  consumesInventory: boolean;
  isAvailable: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  imageUrl: string | null;
  hasVariants: boolean;
  isAvailable: boolean;
  variants: MenuVariant[];
  addons: MenuAddon[];
}

export interface MenuCategory {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  items: MenuItem[];
}

export interface CartAddon {
  addonId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartLine {
  lineId: string;

  menuItemId: number;
  itemName: string;

  variantId: number | null;
  variantName: string | null;

  quantity: number;

  unitPrice: number;

  addons: CartAddon[];

  specialNotes: string;

  displayLineTotal: number;
}

export interface SubmitQrOrderPayload {
  client_order_id: string;

  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;

  items: Array<{
    menu_item_id: number;
    variant_id: number | null;
    quantity: number;
    special_notes: string | null;

    addons: Array<{
      addon_id: number;
      quantity: number;
    }>;
  }>;
}

export interface PublicOrderAddon {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PublicOrderItem {
  id: number;

  name: string;

  variant: string | null;

  quantity: number;

  unitPrice: number;

  lineTotal: number;

  status: string;

  kitchenStatus: string;

  sentToKitchenAt: string | null;

  specialNotes: string | null;

  addons: PublicOrderAddon[];
}

export interface PublicOrder {
  orderNumber: string;
  statusToken: string;
  status: string;
  customerStatus: string;

  table: {
    id: number;
    name: string;
  };

  orderType: string;

  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  serviceChargeTotal: number;
  grandTotal: number;

  customerNotes: string | null;

  items: PublicOrderItem[];

  submittedAt: string | null;
  updatedAt: string | null;
}

export interface AppendQrOrderPayload {
  client_submission_id: string;

  items: Array<{
    menu_item_id: number;
    variant_id: number | null;
    quantity: number;
    special_notes: string | null;

    addons: Array<{
      addon_id: number;
      quantity: number;
    }>;
  }>;
}
