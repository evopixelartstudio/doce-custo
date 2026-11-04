'use client';

import { createClient, isSupabaseConfigured } from './supabase/client';
import type {
  Ingredient,
  Recipe,
  RecipeItem,
  AdditionalCost,
  UserSettings,
  IngredientPriceHistory,
} from './types';
import {
  calculateBaseUnitCost,
  calculateIngredientItemCost,
  calculateSubRecipeItemCost,
  hasCircularDependency,
  normalizeIngredientName,
} from './calculations';
import {
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  INITIAL_USER_SETTINGS,
} from './mock-data';

const STORAGE_KEY_INGREDIENTS = 'docecusto_ingredients_v2';
const STORAGE_KEY_RECIPES = 'docecusto_recipes_v2';
const STORAGE_KEY_SETTINGS = 'docecusto_settings_v2';
const STORAGE_KEY_PRICE_HISTORY = 'docecusto_price_history_v2';

// Helper to access localStorage safely
function getLocal<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Erro ao salvar no localStorage:', err);
  }
}

// Clean legacy mock data and initialize clean state if not already present
export function initializeDemoDataIfNeeded() {
  if (typeof window === 'undefined') return;
  // Clear legacy mock keys
  localStorage.removeItem('docecusto_ingredients_v1');
  localStorage.removeItem('docecusto_recipes_v1');
  localStorage.removeItem('docecusto_settings_v1');
  localStorage.removeItem('docecusto_price_history_v1');

  if (!localStorage.getItem(STORAGE_KEY_INGREDIENTS)) {
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEY_RECIPES)) {
    localStorage.setItem(STORAGE_KEY_RECIPES, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEY_SETTINGS)) {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(INITIAL_USER_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEY_PRICE_HISTORY)) {
    localStorage.setItem(STORAGE_KEY_PRICE_HISTORY, JSON.stringify([]));
  }
}

// ----------------------------------------------------------------------
// INGREDIENTES
// ----------------------------------------------------------------------

export async function getIngredients(includeArchived = false): Promise<Ingredient[]> {
  const supabase = createClient();
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('ingredients')
        .select('*')
        .order('name', { ascending: true });

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as Ingredient[];
      }
    } catch (err) {
      console.warn('Falha ao buscar do Supabase, usando dados locais:', err);
    }
  }

  // Fallback local storage
  const list = getLocal<Ingredient[]>(STORAGE_KEY_INGREDIENTS, INITIAL_INGREDIENTS);
  return includeArchived ? list : list.filter((item) => !item.is_archived);
}

export async function getIngredientById(id: string): Promise<Ingredient | null> {
  const all = await getIngredients(true);
  return all.find((item) => item.id === id) || null;
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
  const cleanName = ingredientData.name.trim();
  if (!cleanName) {
    throw new Error('Informe o nome do ingrediente.');
  }

  // Validação obrigatória: impedir duplicações pelo mesmo nome (case-insensitive e espaços)
  const allIngredients = await getIngredients(true);
  const normalizedNewName = normalizeIngredientName(cleanName);
  const duplicate = allIngredients.find(
    (i) =>
      i.id !== ingredientData.id &&
      !i.is_archived &&
      normalizeIngredientName(i.name) === normalizedNewName
  );
  if (duplicate) {
    throw new Error(
      `Já existe um ingrediente cadastrado com o nome "${cleanName}".`
    );
  }

  // Automatically calculate base unit cost
  const baseCost = calculateBaseUnitCost(
    ingredientData.package_price,
    ingredientData.package_quantity,
    ingredientData.package_unit
  ).toNumber();

  const now = new Date().toISOString();
  const supabase = createClient();

  if (isSupabaseConfigured() && supabase) {
    try {
      const payload = {
        ...ingredientData,
        name: cleanName,
        category: ingredientData.category || 'outros',
        cost_per_base_unit: baseCost,
        updated_at: now,
      };

      if (ingredientData.id) {
        const { data, error } = await supabase
          .from('ingredients')
          .update(payload)
          .eq('id', ingredientData.id)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const saved = data as Ingredient;
          const list = getLocal<Ingredient[]>(STORAGE_KEY_INGREDIENTS, []);
          const idx = list.findIndex((i) => i.id === saved.id);
          if (idx >= 0) list[idx] = saved;
          else list.push(saved);
          setLocal(STORAGE_KEY_INGREDIENTS, list);
          return saved;
        }
      } else {
        const { id, ...insertPayload } = payload;
        const { data, error } = await supabase
          .from('ingredients')
          .insert({ ...insertPayload, created_at: now })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const saved = data as Ingredient;
          const list = getLocal<Ingredient[]>(STORAGE_KEY_INGREDIENTS, []);
          list.push(saved);
          setLocal(STORAGE_KEY_INGREDIENTS, list);
          return saved;
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Já existe um ingrediente')) {
        throw err;
      }
      console.warn('Erro ao salvar ingrediente no Supabase, usando local:', err);
    }
  }

  // Local fallback
  const list = getLocal<Ingredient[]>(STORAGE_KEY_INGREDIENTS, INITIAL_INGREDIENTS);
  let result: Ingredient;

  if (ingredientData.id) {
    const oldIndex = list.findIndex((i) => i.id === ingredientData.id);
    const oldItem = list[oldIndex];

    // Log price history if price changed
    if (
      oldItem &&
      (oldItem.package_price !== ingredientData.package_price ||
        oldItem.package_quantity !== ingredientData.package_quantity)
    ) {
      const historyList = getLocal<IngredientPriceHistory[]>(
        STORAGE_KEY_PRICE_HISTORY,
        []
      );
      historyList.unshift({
        id: `hist-${Date.now()}`,
        ingredient_id: oldItem.id,
        old_price: oldItem.package_price,
        new_price: ingredientData.package_price,
        old_package_quantity: oldItem.package_quantity,
        new_package_quantity: ingredientData.package_quantity,
        old_cost_per_base_unit: oldItem.cost_per_base_unit,
        new_cost_per_base_unit: baseCost,
        changed_at: now,
        notes: 'Atualização de preço',
      });
      setLocal(STORAGE_KEY_PRICE_HISTORY, historyList);
    }

    result = {
      ...oldItem,
      ...ingredientData,
      name: cleanName,
      category: ingredientData.category || 'outros',
      cost_per_base_unit: baseCost,
      updated_at: now,
    } as Ingredient;

    if (oldIndex >= 0) {
      list[oldIndex] = result;
    } else {
      list.push(result);
    }
  } else {
    result = {
      id: `ing-${Date.now()}`,
      user_id: 'default',
      is_archived: false,
      ...ingredientData,
      name: cleanName,
      category: ingredientData.category || 'outros',
      cost_per_base_unit: baseCost,
      created_at: now,
      updated_at: now,
    } as Ingredient;
    list.unshift(result);
  }

  setLocal(STORAGE_KEY_INGREDIENTS, list);
  return result;
}

export async function archiveIngredient(id: string): Promise<void> {
  const supabase = createClient();
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('ingredients')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      return;
    } catch (err) {
      console.warn('Erro ao arquivar no Supabase:', err);
    }
  }

  const list = getLocal<Ingredient[]>(STORAGE_KEY_INGREDIENTS, INITIAL_INGREDIENTS);
  const updated = list.map((i) =>
    i.id === id ? { ...i, is_archived: true, updated_at: new Date().toISOString() } : i
  );
  setLocal(STORAGE_KEY_INGREDIENTS, updated);
}

export async function getIngredientPriceHistory(
  ingredientId: string
): Promise<IngredientPriceHistory[]> {
  const supabase = createClient();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('ingredient_price_history')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .order('changed_at', { ascending: false });

      if (!error && data) {
        return data as IngredientPriceHistory[];
      }
    } catch (err) {
      console.warn('Erro ao buscar histórico do Supabase:', err);
    }
  }

  const history = getLocal<IngredientPriceHistory[]>(STORAGE_KEY_PRICE_HISTORY, []);
  return history.filter((h) => h.ingredient_id === ingredientId);
}

// ----------------------------------------------------------------------
// RECEITAS
// ----------------------------------------------------------------------

export async function getRecipes(includeArchived = false): Promise<Recipe[]> {
  const ingredients = await getIngredients(true);
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

  const supabase = createClient();
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('recipes')
        .select('*, items:recipe_items!recipe_items_recipe_id_fkey(*), additional_costs:recipe_additional_costs(*)')
        .order('name', { ascending: true });

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;
      if (!error && data) {
        const rawRecipes = data as Recipe[];
        return populateRecipes(rawRecipes, ingredientMap);
      }
    } catch (err) {
      console.warn('Erro ao buscar receitas do Supabase, usando local:', err);
    }
  }

  const localRecipes = getLocal<Recipe[]>(STORAGE_KEY_RECIPES, INITIAL_RECIPES);
  const filtered = includeArchived
    ? localRecipes
    : localRecipes.filter((r) => !r.is_archived);

  return populateRecipes(filtered, ingredientMap);
}

/**
 * Calculates item costs and links nested ingredients & sub-recipes dynamically.
 * When ingredient costs change, recipes display the updated current cost automatically.
 */
function populateRecipes(
  recipes: Recipe[],
  ingredientMap: Map<string, Ingredient>
): Recipe[] {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  return recipes.map((recipe) => {
    const items = (recipe.items || []).map((item) => {
      let populatedIngredient: Ingredient | undefined;
      let populatedSubRecipe: Recipe | undefined;
      let calculatedCost = 0;

      if (item.item_type === 'ingredient' && item.ingredient_id) {
        populatedIngredient = ingredientMap.get(item.ingredient_id) || (item.ingredient ?? undefined);
        if (populatedIngredient) {
          calculatedCost = calculateIngredientItemCost(
            populatedIngredient,
            item.quantity,
            item.unit
          ).toNumber();
        }
      } else if (item.item_type === 'sub_recipe' && item.sub_recipe_id) {
        populatedSubRecipe = recipeMap.get(item.sub_recipe_id) || (item.sub_recipe ?? undefined);
        if (populatedSubRecipe) {
          // Calculate sub-recipe total cost dynamically
          const subCost = calculateRecipeCostFromItems(
            populatedSubRecipe.items || [],
            ingredientMap,
            recipeMap
          );
          calculatedCost = calculateSubRecipeItemCost(
            populatedSubRecipe,
            item.quantity,
            item.unit,
            subCost
          ).toNumber();
        }
      }

      return {
        ...item,
        ingredient: populatedIngredient,
        sub_recipe: populatedSubRecipe,
        calculated_cost: calculatedCost,
      };
    });

    const additional_costs = (recipe.additional_costs || []).map((ac) => {
      const match = ac.description.match(/\[(\d+(?:\.\d+)?)%\]/);
      if (match) {
        return {
          ...ac,
          cost_type: 'percentage' as const,
          amount: parseFloat(match[1]),
          description: ac.description.replace(/\s*\[\d+(?:\.\d+)?%\]/, '').trim(),
        };
      }
      return {
        ...ac,
        cost_type: ac.cost_type || 'fixed',
      };
    });

    return {
      ...recipe,
      items,
      additional_costs,
    };
  });
}

function calculateRecipeCostFromItems(
  items: RecipeItem[],
  ingredientMap: Map<string, Ingredient>,
  recipeMap: Map<string, Recipe>
): number {
  let sum = 0;
  for (const item of items) {
    if (item.item_type === 'ingredient' && item.ingredient_id) {
      const ing = ingredientMap.get(item.ingredient_id);
      if (ing) {
        sum += calculateIngredientItemCost(ing, item.quantity, item.unit).toNumber();
      }
    } else if (item.item_type === 'sub_recipe' && item.sub_recipe_id) {
      const sub = recipeMap.get(item.sub_recipe_id);
      if (sub) {
        // Simple direct calculation to avoid recursion cycles
        const subItemsCost = (sub.items || []).reduce((acc, subItem) => {
          if (subItem.item_type === 'ingredient' && subItem.ingredient_id) {
            const i = ingredientMap.get(subItem.ingredient_id);
            return i
              ? acc + calculateIngredientItemCost(i, subItem.quantity, subItem.unit).toNumber()
              : acc;
          }
          return acc;
        }, 0);
        sum += calculateSubRecipeItemCost(
          sub,
          item.quantity,
          item.unit,
          subItemsCost
        ).toNumber();
      }
    }
  }
  return sum;
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const all = await getRecipes(true);
  return all.find((r) => r.id === id) || null;
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
  const allRecipes = await getRecipes(true);

  // Check circular dependencies for all sub-recipe items
  const currentId = recipeData.id || 'new_recipe';
  const getSubIds = (rId: string) => {
    const found = allRecipes.find((r) => r.id === rId);
    return (found?.items || [])
      .filter((i) => i.item_type === 'sub_recipe' && i.sub_recipe_id)
      .map((i) => i.sub_recipe_id!);
  };

  for (const item of itemsData) {
    if (item.item_type === 'sub_recipe' && item.sub_recipe_id) {
      if (hasCircularDependency(currentId, item.sub_recipe_id, getSubIds)) {
        throw new Error(
          `Dependência circular detectada! A sub-receita selecionada já depende desta receita.`
        );
      }
    }
  }

  const now = new Date().toISOString();
  const supabase = createClient();

  if (isSupabaseConfigured() && supabase) {
    try {
      let recipeId = recipeData.id;
      const recipePayload = {
        name: recipeData.name,
        category: recipeData.category || 'Geral',
        description: recipeData.description || null,
        photo_url: recipeData.photo_url || null,
        yield_quantity: recipeData.yield_quantity,
        yield_unit: recipeData.yield_unit,
        prep_time_minutes: recipeData.prep_time_minutes || null,
        pricing_method: recipeData.pricing_method || 'margin',
        markup_percentage: recipeData.markup_percentage ?? 100,
        target_margin_percentage: recipeData.target_margin_percentage ?? 50,
        card_fee_percentage: recipeData.card_fee_percentage ?? 0,
        manual_sale_price: recipeData.manual_sale_price || null,
        updated_at: now,
      };

      if (recipeId) {
        await supabase.from('recipes').update(recipePayload).eq('id', recipeId);
        // Delete existing items & costs to cleanly replace
        await supabase.from('recipe_items').delete().eq('recipe_id', recipeId);
        await supabase.from('recipe_additional_costs').delete().eq('recipe_id', recipeId);
      } else {
        const { data: newRec } = await supabase
          .from('recipes')
          .insert({ ...recipePayload, created_at: now })
          .select()
          .single();
        recipeId = newRec.id;
      }

      // Insert items
      if (itemsData.length > 0) {
        const itemsToInsert = itemsData.map((item, idx) => ({
          recipe_id: recipeId,
          item_type: item.item_type,
          ingredient_id: item.item_type === 'ingredient' ? item.ingredient_id : null,
          sub_recipe_id: item.item_type === 'sub_recipe' ? item.sub_recipe_id : null,
          quantity: item.quantity,
          unit: item.unit,
          order_index: idx,
        }));
        await supabase.from('recipe_items').insert(itemsToInsert);
      }

      // Insert additional costs
      if (additionalCostsData.length > 0) {
        const costsToInsert = additionalCostsData.map((cost) => {
          let desc = cost.description;
          if (cost.cost_type === 'percentage') {
            desc = `${cost.description.replace(/\s*\[\d+(?:\.\d+)?%\]/, '').trim()} [${cost.amount}%]`;
          }
          return {
            recipe_id: recipeId,
            description: desc,
            amount: cost.amount,
            is_proportional: cost.is_proportional ?? true,
          };
        });
        await supabase.from('recipe_additional_costs').insert(costsToInsert);
      }

      const reloaded = await getRecipeById(recipeId!);
      if (reloaded) return reloaded;
    } catch (err) {
      console.warn('Erro ao salvar receita no Supabase, usando local:', err);
    }
  }

  // Local fallback
  const list = getLocal<Recipe[]>(STORAGE_KEY_RECIPES, INITIAL_RECIPES);
  const recipeId = recipeData.id || `rec-${Date.now()}`;

  const savedRecipe: Recipe = {
    id: recipeId,
    user_id: 'confeiteira-admin',
    name: recipeData.name,
    category: recipeData.category || 'Geral',
    description: recipeData.description || null,
    photo_url: recipeData.photo_url || null,
    yield_quantity: recipeData.yield_quantity,
    yield_unit: recipeData.yield_unit,
    prep_time_minutes: recipeData.prep_time_minutes || null,
    pricing_method: recipeData.pricing_method || 'margin',
    markup_percentage: recipeData.markup_percentage ?? 100,
    target_margin_percentage: recipeData.target_margin_percentage ?? 50,
    card_fee_percentage: recipeData.card_fee_percentage ?? 0,
    manual_sale_price: recipeData.manual_sale_price || null,
    is_archived: false,
    created_at: recipeData.created_at || now,
    updated_at: now,
    items: itemsData.map((item) => ({
      ...item,
      id: item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipe_id: recipeId,
    })),
    additional_costs: additionalCostsData.map((cost) => ({
      ...cost,
      id: cost.id || `ac-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipe_id: recipeId,
    })),
  };

  const existingIdx = list.findIndex((r) => r.id === recipeId);
  if (existingIdx >= 0) {
    list[existingIdx] = savedRecipe;
  } else {
    list.unshift(savedRecipe);
  }

  setLocal(STORAGE_KEY_RECIPES, list);
  return savedRecipe;
}

export async function duplicateRecipe(id: string): Promise<Recipe> {
  const original = await getRecipeById(id);
  if (!original) throw new Error('Receita não encontrada para duplicação.');

  const duplicated: Partial<Recipe> = {
    name: `${original.name} (Cópia)`,
    category: original.category,
    description: original.description,
    photo_url: original.photo_url,
    yield_quantity: original.yield_quantity,
    yield_unit: original.yield_unit,
    prep_time_minutes: original.prep_time_minutes,
    pricing_method: original.pricing_method,
    markup_percentage: original.markup_percentage,
    target_margin_percentage: original.target_margin_percentage,
    card_fee_percentage: original.card_fee_percentage,
    manual_sale_price: original.manual_sale_price,
  };

  const items = (original.items || []).map((item) => ({
    ...item,
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  }));

  const costs = (original.additional_costs || []).map((c) => ({
    ...c,
    id: `ac-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  }));

  return saveRecipe(duplicated as any, items, costs);
}

export async function archiveRecipe(id: string): Promise<void> {
  const supabase = createClient();
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('recipes')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      return;
    } catch (err) {
      console.warn('Erro ao arquivar receita no Supabase:', err);
    }
  }

  const list = getLocal<Recipe[]>(STORAGE_KEY_RECIPES, INITIAL_RECIPES);
  const updated = list.map((r) =>
    r.id === id ? { ...r, is_archived: true, updated_at: new Date().toISOString() } : r
  );
  setLocal(STORAGE_KEY_RECIPES, updated);
}

// ----------------------------------------------------------------------
// CONFIGURAÇÕES DO USUÁRIO
// ----------------------------------------------------------------------

export async function getUserSettings(): Promise<UserSettings> {
  const supabase = createClient();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        return data as UserSettings;
      }
    } catch (err) {
      console.warn('Erro ao buscar configurações no Supabase:', err);
    }
  }

  return getLocal<UserSettings>(STORAGE_KEY_SETTINGS, INITIAL_USER_SETTINGS);
}

export async function saveUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const now = new Date().toISOString();
  const supabase = createClient();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      let query;
      if (existing?.id) {
        query = supabase
          .from('user_settings')
          .update({
            ...settings,
            updated_at: now,
          })
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        query = supabase
          .from('user_settings')
          .insert({
            ...settings,
            updated_at: now,
          })
          .select()
          .single();
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as UserSettings;
      }
    } catch (err) {
      console.warn('Erro ao salvar configurações no Supabase:', err);
    }
  }

  const current = getLocal<UserSettings>(STORAGE_KEY_SETTINGS, INITIAL_USER_SETTINGS);
  const updated: UserSettings = {
    ...current,
    ...settings,
    updated_at: now,
  };
  setLocal(STORAGE_KEY_SETTINGS, updated);
  return updated;
}

