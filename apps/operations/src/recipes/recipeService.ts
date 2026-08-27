import { api } from "../lib/api";

import type { MenuItem } from "../menu/types";

import type {
  AddonRecipeResponse,
  ConsumptionPreviewPayload,
  ConsumptionPreviewResponse,
  MenuRecipeResponse,
  SaveRecipePayload,
} from "./types";

/*
  |--------------------------------------------------------------------------
  | Menu Item Detail
  |--------------------------------------------------------------------------
  */

export async function getRecipeMenuItem(menuItemId: number): Promise<MenuItem> {
  const response = await api.get<MenuItem>(`/menu/items/${menuItemId}`);

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Base Menu Recipe
  |--------------------------------------------------------------------------
  */

export async function getMenuRecipe(
  menuItemId: number
): Promise<MenuRecipeResponse> {
  const response = await api.get<MenuRecipeResponse>(
    `/recipes/menu-items/${menuItemId}`
  );

  return response.data;
}

export async function saveMenuRecipe(
  menuItemId: number,
  payload: SaveRecipePayload
): Promise<MenuRecipeResponse> {
  const response = await api.put<MenuRecipeResponse>(
    `/recipes/menu-items/${menuItemId}`,
    payload
  );

  return response.data;
}

export async function clearMenuRecipe(
  menuItemId: number
): Promise<MenuRecipeResponse> {
  const response = await api.delete<MenuRecipeResponse>(
    `/recipes/menu-items/${menuItemId}`
  );

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Variant Recipe
  |--------------------------------------------------------------------------
  */

export async function getVariantRecipe(
  menuItemId: number,
  variantId: number
): Promise<MenuRecipeResponse> {
  const response = await api.get<MenuRecipeResponse>(
    `/recipes/menu-items/${menuItemId}/variants/${variantId}`
  );

  return response.data;
}

export async function saveVariantRecipe(
  menuItemId: number,
  variantId: number,
  payload: SaveRecipePayload
): Promise<MenuRecipeResponse> {
  const response = await api.put<MenuRecipeResponse>(
    `/recipes/menu-items/${menuItemId}/variants/${variantId}`,
    payload
  );

  return response.data;
}

export async function clearVariantRecipe(
  menuItemId: number,
  variantId: number
): Promise<MenuRecipeResponse> {
  const response = await api.delete<MenuRecipeResponse>(
    `/recipes/menu-items/${menuItemId}/variants/${variantId}`
  );

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Add-on Recipe
  |--------------------------------------------------------------------------
  */

export async function getAddonRecipe(
  addonId: number
): Promise<AddonRecipeResponse> {
  const response = await api.get<AddonRecipeResponse>(
    `/recipes/addons/${addonId}`
  );

  return response.data;
}

export async function saveAddonRecipe(
  addonId: number,
  payload: SaveRecipePayload
): Promise<AddonRecipeResponse> {
  const response = await api.put<AddonRecipeResponse>(
    `/recipes/addons/${addonId}`,
    payload
  );

  return response.data;
}

export async function clearAddonRecipe(
  addonId: number
): Promise<AddonRecipeResponse> {
  const response = await api.delete<AddonRecipeResponse>(
    `/recipes/addons/${addonId}`
  );

  return response.data;
}

/*
  |--------------------------------------------------------------------------
  | Consumption Preview
  |--------------------------------------------------------------------------
  */

export async function previewRecipeConsumption(
  menuItemId: number,
  payload: ConsumptionPreviewPayload
): Promise<ConsumptionPreviewResponse> {
  const response = await api.post<ConsumptionPreviewResponse>(
    `/recipes/menu-items/${menuItemId}/consumption-preview`,
    payload
  );

  return response.data;
}
