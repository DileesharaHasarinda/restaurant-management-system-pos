export interface MenuCategory {
  id: number;

  name: string;

  slug: string;

  description: string | null;

  sort_order: number;

  is_active: boolean;

  is_visible_on_website: boolean;

  is_visible_on_qr: boolean;

  menu_items_count: number | null;

  created_at: string | null;

  updated_at: string | null;
}

export interface MenuItemCategorySummary {
  id: number;

  name: string;

  slug: string;
}

export interface MenuItemVariant {
  id: number;

  sku: string | null;

  name: string;

  price: number;

  is_default: boolean;

  is_available: boolean;

  is_active: boolean;

  sort_order: number;
}

export interface MenuAddon {
  id: number;

  consumes_inventory: boolean;

  addon_group_id: number;

  sku: string | null;

  name: string;

  base_price: number;

  price: number;

  is_available: boolean;

  is_active: boolean;

  is_default: boolean;

  sort_order: number;
}

export interface MenuAddonGroup {
  id: number;

  name: string;

  description: string | null;

  is_required: boolean;

  is_active: boolean;

  sort_order: number;

  addons: MenuAddon[];
}

export interface MenuItem {
  id: number;

  category_id: number;

  sku: string | null;

  name: string;

  slug: string;

  description: string | null;

  photo_url: string | null;

  price: number;

  tax_rate: number;

  is_available: boolean;

  is_active: boolean;

  is_visible_on_website: boolean;

  is_visible_on_qr: boolean;

  has_variants: boolean;

  sort_order: number;

  category: MenuItemCategorySummary | null;

  variants: MenuItemVariant[];

  addons: MenuAddon[];

  created_at: string | null;

  updated_at: string | null;
}

export interface PaginationMeta {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

/*
  |--------------------------------------------------------------------------
  | Category Payloads
  |--------------------------------------------------------------------------
  */

export interface CreateCategoryPayload {
  name: string;

  description: string | null;

  sort_order: number;

  is_active: boolean;

  is_visible_on_website: boolean;

  is_visible_on_qr: boolean;
}

export interface UpdateCategoryPayload {
  name: string;

  description: string | null;

  sort_order: number;
}

export interface CategoryStatePayload {
  is_active?: boolean;

  is_visible_on_website?: boolean;

  is_visible_on_qr?: boolean;

  sort_order?: number;
}

/*
  |--------------------------------------------------------------------------
  | Menu Item Payloads
  |--------------------------------------------------------------------------
  */

export interface MenuVariantPayload {
  id?: number;

  name: string;

  price: number;

  is_default: boolean;

  is_available: boolean;

  is_active: boolean;

  sort_order: number;
}

export interface MenuItemAddonPayload {
  addon_id: number;

  price_override: number | null;

  is_default: boolean;

  sort_order: number;
}

export interface CreateMenuItemPayload {
  category_id: number;

  name: string;

  description: string | null;

  price: number;

  tax_rate: number | null;

  is_available: boolean;

  is_active: boolean;

  is_visible_on_website: boolean;

  is_visible_on_qr: boolean;

  sort_order: number;

  variants: MenuVariantPayload[];

  addons: MenuItemAddonPayload[];
}

export interface UpdateMenuItemPayload {
  category_id: number;

  name: string;

  description: string | null;

  price: number;

  tax_rate: number | null;

  sort_order: number;

  variants: MenuVariantPayload[];

  addons: MenuItemAddonPayload[];
}

export interface MenuItemStatePayload {
  is_active?: boolean;

  is_available?: boolean;

  is_visible_on_website?: boolean;

  is_visible_on_qr?: boolean;

  sort_order?: number;
}

/*
  |--------------------------------------------------------------------------
  | Add-on Payloads
  |--------------------------------------------------------------------------
  */

export interface CreateAddonGroupPayload {
  name: string;

  description: string | null;

  is_required: boolean;

  is_active: boolean;

  sort_order: number;
}

export interface CreateAddonPayload {
  addon_group_id: number;

  name: string;

  price: number;

  is_available: boolean;

  is_active: boolean;

  sort_order: number;
}

/*
  |--------------------------------------------------------------------------
  | Menu Item Editor
  |--------------------------------------------------------------------------
  */

export interface MenuItemEditorSubmission {
  category_id: number;

  name: string;

  description: string | null;

  price: number;

  tax_rate: number | null;

  sort_order: number;

  is_available: boolean;

  is_active: boolean;

  is_visible_on_website: boolean;

  is_visible_on_qr: boolean;

  variants: MenuVariantPayload[];

  addons: MenuItemAddonPayload[];

  photo: File | null;
}
