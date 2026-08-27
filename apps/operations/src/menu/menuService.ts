import { api } from "../lib/api";

import type {
  CategoryStatePayload,
  CreateAddonGroupPayload,
  CreateAddonPayload,
  CreateCategoryPayload,
  CreateMenuItemPayload,
  MenuAddon,
  MenuAddonGroup,
  MenuCategory,
  MenuItem,
  MenuItemStatePayload,
  PaginationMeta,
  UpdateCategoryPayload,
  UpdateMenuItemPayload,
} from "./types";

/*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

function readNumber(
  value: unknown,

  fallback: number
): number {
  return typeof value === "number" ? value : fallback;
}

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): PaginationMeta {
  const raw = meta?.pagination;

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      current_page: 1,
      per_page: 30,
      total: 0,
      last_page: 1,
    };
  }

  const record = raw as Record<string, unknown>;

  return {
    current_page: readNumber(record.current_page, 1),

    per_page: readNumber(record.per_page, 30),

    total: readNumber(record.total, 0),

    last_page: readNumber(record.last_page, 1),
  };
}

/*
  |--------------------------------------------------------------------------
  | Categories
  |--------------------------------------------------------------------------
  */

export async function getMenuCategories(search = ""): Promise<MenuCategory[]> {
  const query =
    search.trim() !== "" ? `?search=${encodeURIComponent(search.trim())}` : "";

  const response = await api.get<MenuCategory[]>(`/menu/categories${query}`);

  return response.data;
}

export async function createMenuCategory(
  payload: CreateCategoryPayload
): Promise<MenuCategory> {
  const response = await api.post<MenuCategory>("/menu/categories", payload);

  return response.data;
}

export async function updateMenuCategory(
  id: number,

  payload: UpdateCategoryPayload
): Promise<MenuCategory> {
  const response = await api.put<MenuCategory>(
    `/menu/categories/${id}`,
    payload
  );

  return response.data;
}

export async function updateMenuCategoryState(
  id: number,

  payload: CategoryStatePayload
): Promise<MenuCategory> {
  const response = await api.patch<MenuCategory>(
    `/menu/categories/${id}/state`,
    payload
  );

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Menu Items
  |--------------------------------------------------------------------------
  */

export interface MenuItemFilters {
  page: number;

  search?: string;

  categoryId?: number | null;

  isActive?: boolean | null;

  isAvailable?: boolean | null;
}

export interface MenuItemListResult {
  items: MenuItem[];

  pagination: PaginationMeta;
}

export async function getMenuItems(
  filters: MenuItemFilters
): Promise<MenuItemListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.categoryId) {
    params.set("category_id", String(filters.categoryId));
  }

  if (filters.isActive !== null && filters.isActive !== undefined) {
    params.set("is_active", filters.isActive ? "1" : "0");
  }

  if (filters.isAvailable !== null && filters.isAvailable !== undefined) {
    params.set("is_available", filters.isAvailable ? "1" : "0");
  }

  const response = await api.get<MenuItem[]>(
    `/menu/items?${params.toString()}`
  );

  return {
    items: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

export async function createMenuItem(
  payload: CreateMenuItemPayload
): Promise<MenuItem> {
  const response = await api.post<MenuItem>("/menu/items", payload);

  return response.data;
}

export async function updateMenuItem(
  id: number,

  payload: UpdateMenuItemPayload
): Promise<MenuItem> {
  const response = await api.put<MenuItem>(`/menu/items/${id}`, payload);

  return response.data;
}

export async function updateMenuItemState(
  id: number,

  payload: MenuItemStatePayload
): Promise<MenuItem> {
  const response = await api.patch<MenuItem>(
    `/menu/items/${id}/state`,
    payload
  );

  return response.data;
}

export async function uploadMenuItemPhoto(
  id: number,

  photo: File
): Promise<MenuItem> {
  const body = new FormData();

  body.append("photo", photo);

  const response = await api.postForm<MenuItem>(
    `/menu/items/${id}/photo`,
    body
  );

  return response.data;
}

export async function removeMenuItemPhoto(id: number): Promise<MenuItem> {
  const response = await api.delete<MenuItem>(`/menu/items/${id}/photo`);

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Add-ons
  |--------------------------------------------------------------------------
  */

export async function getAddonGroups(): Promise<MenuAddonGroup[]> {
  const response = await api.get<MenuAddonGroup[]>("/menu/addon-groups");

  return response.data;
}

export async function getAddons(): Promise<MenuAddon[]> {
  const response = await api.get<MenuAddon[]>("/menu/addons");

  return response.data;
}

export async function createAddonGroup(
  payload: CreateAddonGroupPayload
): Promise<MenuAddonGroup> {
  const response = await api.post<MenuAddonGroup>(
    "/menu/addon-groups",
    payload
  );

  return response.data;
}

export async function createAddon(
  payload: CreateAddonPayload
): Promise<MenuAddon> {
  const response = await api.post<MenuAddon>("/menu/addons", payload);

  return response.data;
}
