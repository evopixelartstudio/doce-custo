'use client';

import type {
  Ingredient,
  Recipe,
  RecipeItem,
  AdditionalCost,
  UserSettings,
  IngredientPriceHistory,
} from './types';
import {
  getIngredientsAction,
  getIngredientByIdAction,
  saveIngredientAction,
  archiveIngredientAction,
  getIngredientPriceHistoryAction,
} from '@/app/actions/ingredients';
import {
  getRecipesAction,
  getRecipeByIdAction,
  saveRecipeAction,
  archiveRecipeAction,
  duplicateRecipeAction,
} from '@/app/actions/recipes';
import {
  getUserSettingsAction,
  saveUserSettingsAction,
} from '@/app/actions/settings';

/**
 * Limpa chaves legadas antigas de cache do navegador se existirem
 */
export function initializeDemoDataIfNeeded() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('docecusto_ingredients_v1');
    localStorage.removeItem('docecusto_recipes_v1');
    localStorage.removeItem('docecusto_settings_v1');
    localStorage.removeItem('docecusto_price_history_v1');
  } catch {
    // Silently ignore localStorage restrictions
  }
}

// ----------------------------------------------------------------------
// INGREDIENTES (SUPABASE SERVER ACTIONS)
// ----------------------------------------------------------------------

export async function getIngredients(includeArchived = false): Promise<Ingredient[]> {
  return await getIngredientsAction(includeArchived);
}

export async function getIngredientById(id: string): Promise<Ingredient | null> {
  return await getIngredientByIdAction(id);
}

export async function saveIngredient(
  ingredientData: Partial<Ingredient> & {
    name: string;
    category?: any;
    package_quantity: number;
    package_unit: any;
    package_price: number;
    base_unit: any;
  }
): Promise<Ingredient> {
  return await saveIngredientAction(ingredientData);
}

export async function archiveIngredient(id: string): Promise<void> {
  await archiveIngredientAction(id);
}

export async function getIngredientPriceHistory(
  ingredientId: string
): Promise<IngredientPriceHistory[]> {
  return await getIngredientPriceHistoryAction(ingredientId);
}

// ----------------------------------------------------------------------
// RECEITAS (SUPABASE SERVER ACTIONS)
// ----------------------------------------------------------------------

export async function getRecipes(includeArchived = false): Promise<Recipe[]> {
  return await getRecipesAction(includeArchived);
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  return await getRecipeByIdAction(id);
}

export async function saveRecipe(
  recipeData: Partial<Recipe> & {
    name: string;
    yield_quantity: number;
    yield_unit: any;
  },
  itemsData: RecipeItem[],
  additionalCostsData: AdditionalCost[]
): Promise<Recipe> {
  return await saveRecipeAction(recipeData, itemsData, additionalCostsData);
}

export async function duplicateRecipe(id: string): Promise<Recipe> {
  return await duplicateRecipeAction(id);
}

export async function archiveRecipe(id: string): Promise<void> {
  await archiveRecipeAction(id);
}

// ----------------------------------------------------------------------
// CONFIGURAÇÕES (SUPABASE SERVER ACTIONS)
// ----------------------------------------------------------------------

export async function getUserSettings(): Promise<UserSettings> {
  return await getUserSettingsAction();
}

export async function saveUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  return await saveUserSettingsAction(settings);
}
