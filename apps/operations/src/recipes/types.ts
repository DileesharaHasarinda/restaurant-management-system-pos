import type { Ingredient, IngredientUnit } from "../ingredients/types";

import type { MenuAddon, MenuItem, MenuItemVariant } from "../menu/types";

/*
  |--------------------------------------------------------------------------
  | Recipe Component
  |--------------------------------------------------------------------------
  */

export interface RecipeComponentBaseUnit {
  id: number;

  name?: string;

  symbol: string;
}

export interface RecipeComponentIngredient {
  id: number;

  sku: string | null;

  name: string;

  current_stock: number;

  average_cost: number;

  base_unit: RecipeComponentBaseUnit;
}

export interface RecipeComponentUnit {
  id: number;

  name: string;

  symbol: string;
}

export interface RecipeComponent {
  id: number;

  ingredient: RecipeComponentIngredient;

  quantity: number;

  unit: RecipeComponentUnit;

  base_quantity: number;

  component_cost: number;
}

/*
  |--------------------------------------------------------------------------
  | Costing
  |--------------------------------------------------------------------------
  */

export interface RecipeCosting {
  recipe_cost: number;

  selling_price: number;

  gross_margin: number;

  gross_margin_percentage: number;

  cost_complete: boolean;

  uncosted_ingredients: string[];
}

/*
  |--------------------------------------------------------------------------
  | Menu Recipe
  |--------------------------------------------------------------------------
  */

export type MenuRecipeType = "BASE" | "VARIANT";

export interface RecipeMenuItemSummary {
  id: number;

  name: string;

  sku: string | null;
}

export interface RecipeVariantSummary {
  id: number;

  name: string;

  sku: string | null;
}

export interface MenuRecipeResponse {
  configured: boolean;

  menu_item: RecipeMenuItemSummary;

  variant: RecipeVariantSummary | null;

  recipe_type: MenuRecipeType;

  components: RecipeComponent[];

  costing: RecipeCosting;
}

/*
  |--------------------------------------------------------------------------
  | Add-on Recipe
  |--------------------------------------------------------------------------
  */

export interface AddonRecipeSummary {
  id: number;

  name: string;

  sku: string | null;

  consumes_inventory: boolean;
}

export interface AddonRecipeResponse {
  configured: boolean;

  addon: AddonRecipeSummary;

  components: RecipeComponent[];

  costing: RecipeCosting;
}

export type RecipeResponse = MenuRecipeResponse | AddonRecipeResponse;

/*
  |--------------------------------------------------------------------------
  | Editor Target
  |--------------------------------------------------------------------------
  */

export interface BaseRecipeEditorTarget {
  kind: "BASE";

  menuItem: MenuItem;

  variant: null;
}

export interface VariantRecipeEditorTarget {
  kind: "VARIANT";

  menuItem: MenuItem;

  variant: MenuItemVariant;
}

export interface AddonRecipeEditorTarget {
  kind: "ADDON";

  addon: MenuAddon;
}

export type RecipeEditorTarget =
  | BaseRecipeEditorTarget
  | VariantRecipeEditorTarget
  | AddonRecipeEditorTarget;

/*
  |--------------------------------------------------------------------------
  | Save Payload
  |--------------------------------------------------------------------------
  */

export interface SaveRecipeComponentPayload {
  ingredient_id: number;

  quantity: number;

  unit_id: number;
}

export interface SaveRecipePayload {
  components: SaveRecipeComponentPayload[];
}

/*
  |--------------------------------------------------------------------------
  | Consumption Preview
  |--------------------------------------------------------------------------
  */

export interface ConsumptionPreviewAddonPayload {
  addon_id: number;

  quantity: number;
}

export interface ConsumptionPreviewPayload {
  variant_id: number | null;

  item_quantity: number;

  addons: ConsumptionPreviewAddonPayload[];
}

export type ConsumptionSourceType = "BASE_RECIPE" | "VARIANT_RECIPE" | "ADDON";

export interface ConsumptionRequirementSource {
  type: ConsumptionSourceType;

  addon_id?: number;

  name: string;

  quantity: number;
}

export interface ConsumptionRequirement {
  ingredient_id: number;

  sku: string | null;

  name: string;

  base_unit: {
    id: number;

    symbol: string;
  };

  required_quantity: number;

  current_stock: number;

  average_cost: number;

  estimated_cost: number;

  enough_stock: boolean;

  shortage_quantity: number;

  sources: ConsumptionRequirementSource[];
}

export interface ConsumptionPreviewAddon {
  addon_id: number;

  name: string;

  consumes_inventory: boolean;

  quantity_per_item: number;

  item_quantity: number;

  effective_unit_price: number;

  selling_subtotal: number;

  estimated_ingredient_cost: number;
}

export interface ConsumptionPreviewCosting {
  base_recipe_cost: number;

  addon_recipe_cost: number;

  total_recipe_cost: number;

  base_selling_price: number;

  addon_selling_price: number;

  total_selling_price: number;

  gross_margin: number;

  gross_margin_percentage: number;

  cost_complete: boolean;

  uncosted_ingredients: string[];
}

export interface ConsumptionPreviewResponse {
  menu_item: RecipeMenuItemSummary;

  variant: RecipeVariantSummary | null;

  item_quantity: number;

  addons: ConsumptionPreviewAddon[];

  requirements: ConsumptionRequirement[];

  has_sufficient_stock: boolean;

  costing: ConsumptionPreviewCosting;
}

/*
  |--------------------------------------------------------------------------
  | Editor Catalogs
  |--------------------------------------------------------------------------
  */

export interface RecipeEditorCatalog {
  ingredients: Ingredient[];

  units: IngredientUnit[];
}
