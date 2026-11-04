'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import type { Recipe, RecipeItem, AdditionalCost, Ingredient } from '@/lib/types';
import {
  calculateIngredientItemCost,
  calculateSubRecipeItemCost,
  hasCircularDependency,
} from '@/lib/calculations';
import { getIngredientsAction } from './ingredients';

export async function getRecipesAction(includeArchived = false): Promise<Recipe[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('recipes')
    .select('*, items:recipe_items!recipe_items_recipe_id_fkey(*), additional_costs:recipe_additional_costs(*)')
    .order('name', { ascending: true });

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Server Action] Erro ao carregar receitas:', error);
    throw new Error(`Falha ao carregar receitas do Supabase: ${error.message}`);
  }

  const rawRecipes = (data || []) as Recipe[];
  const ingredients = await getIngredientsAction(true);
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

  return populateRecipes(rawRecipes, ingredientMap);
}

export async function getRecipeByIdAction(id: string): Promise<Recipe | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('recipes')
    .select('*, items:recipe_items!recipe_items_recipe_id_fkey(*), additional_costs:recipe_additional_costs(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[Server Action] Erro ao buscar receita por ID:', error);
    throw new Error(`Erro ao buscar receita: ${error.message}`);
  }

  if (!data) return null;

  const ingredients = await getIngredientsAction(true);
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
  const populated = populateRecipes([data as Recipe], ingredientMap);
  return populated[0] || null;
}

export async function saveRecipeAction(
  recipeData: Partial<Recipe> & {
    name: string;
    yield_quantity: number;
    yield_unit: any;
  },
  itemsData: RecipeItem[],
  additionalCostsData: AdditionalCost[]
): Promise<Recipe> {
  const supabase = getSupabaseServerClient();
  const allRecipes = await getRecipesAction(true);

  // Verificação de dependência circular para sub-receitas
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
          'Dependência circular detectada! A sub-receita selecionada já depende desta receita.'
        );
      }
    }
  }

  const now = new Date().toISOString();
  let recipeId = recipeData.id;

  const recipePayload = {
    name: recipeData.name.trim(),
    category: recipeData.category || 'Geral',
    description: recipeData.description || null,
    photo_url: recipeData.photo_url || null,
    yield_quantity: recipeData.yield_quantity,
    yield_unit: recipeData.yield_unit || 'unidades',
    prep_time_minutes: recipeData.prep_time_minutes || null,
    pricing_method: recipeData.pricing_method || 'margin',
    markup_percentage: recipeData.markup_percentage ?? 100,
    target_margin_percentage: recipeData.target_margin_percentage ?? 50,
    card_fee_percentage: recipeData.card_fee_percentage ?? 0,
    manual_sale_price: recipeData.manual_sale_price || null,
    updated_at: now,
  };

  // Se tiver ID válido no PostgreSQL, faz UPDATE; caso contrário, INSERT novo
  if (recipeId && !recipeId.startsWith('rec-')) {
    const { error: updErr } = await supabase
      .from('recipes')
      .update(recipePayload)
      .eq('id', recipeId);

    if (updErr) {
      console.error('[Server Action] Erro no UPDATE da receita:', updErr);
      throw new Error(`Erro ao atualizar receita no Supabase: ${updErr.message}`);
    }

    // Remove itens e custos antigos para substituir de forma limpa
    await supabase.from('recipe_items').delete().eq('recipe_id', recipeId);
    await supabase.from('recipe_additional_costs').delete().eq('recipe_id', recipeId);
  } else {
    const { data: newRec, error: insErr } = await supabase
      .from('recipes')
      .insert({
        ...recipePayload,
        is_archived: false,
        created_at: now,
      })
      .select()
      .single();

    if (insErr) {
      console.error('[Server Action] Erro no INSERT da receita:', insErr);
      throw new Error(`Erro ao salvar receita no Supabase: ${insErr.message}`);
    }
    if (!newRec) {
      throw new Error('Falha ao confirmar o salvamento da receita no banco.');
    }
    recipeId = newRec.id;
  }

  // Insere itens da receita
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

    const { error: itemsErr } = await supabase.from('recipe_items').insert(itemsToInsert);
    if (itemsErr) {
      console.error('[Server Action] Erro ao inserir itens da receita:', itemsErr);
      throw new Error(`Erro ao salvar ingredientes da receita: ${itemsErr.message}`);
    }
  }

  // Insere custos adicionais
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

    const { error: costsErr } = await supabase
      .from('recipe_additional_costs')
      .insert(costsToInsert);

    if (costsErr) {
      console.error('[Server Action] Erro ao inserir custos adicionais:', costsErr);
      throw new Error(`Erro ao salvar custos da receita: ${costsErr.message}`);
    }
  }

  const saved = await getRecipeByIdAction(recipeId!);
  if (!saved) {
    throw new Error('Receita gravada, mas não foi possível recarregá-la do banco.');
  }
  return saved;
}

export async function archiveRecipeAction(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('recipes')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[Server Action] Erro ao arquivar receita:', error);
    throw new Error(`Erro ao arquivar receita no Supabase: ${error.message}`);
  }
}

export async function duplicateRecipeAction(id: string): Promise<Recipe> {
  const original = await getRecipeByIdAction(id);
  if (!original) throw new Error('Receita original não encontrada.');

  const duplicatedPayload: any = {
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
    id: undefined as any,
  }));

  const costs = (original.additional_costs || []).map((c) => ({
    ...c,
    id: undefined as any,
  }));

  return saveRecipeAction(duplicatedPayload, items, costs);
}

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
        const subItemsCost = (sub.items || []).reduce((acc, subItem) => {
          if (subItem.item_type === 'ingredient' && subItem.ingredient_id) {
            const i = ingredientMap.get(subItem.ingredient_id);
            return i
              ? acc + calculateIngredientItemCost(i, subItem.quantity, subItem.unit).toNumber()
              : acc;
          }
          return acc;
        }, 0);
        sum += calculateSubRecipeItemCost(sub, item.quantity, item.unit, subItemsCost).toNumber();
      }
    }
  }
  return sum;
}

