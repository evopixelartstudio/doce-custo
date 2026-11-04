'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import type { Ingredient, IngredientPriceHistory } from '@/lib/types';
import { calculateBaseUnitCost, normalizeIngredientName } from '@/lib/calculations';

export async function getIngredientsAction(includeArchived = false): Promise<Ingredient[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('ingredients')
    .select('*')
    .order('name', { ascending: true });

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Server Action] Erro ao consultar ingredientes:', error);
    throw new Error(`Falha ao carregar ingredientes do Supabase: ${error.message}`);
  }

  return (data || []) as Ingredient[];
}

export async function getIngredientByIdAction(id: string): Promise<Ingredient | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[Server Action] Erro ao buscar ingrediente por ID:', error);
    throw new Error(`Erro ao buscar ingrediente: ${error.message}`);
  }

  return (data as Ingredient) || null;
}

export async function saveIngredientAction(
  ingredientData: Partial<Ingredient> & {
    name: string;
    category?: any;
    package_quantity: number;
    package_unit: any;
    package_price: number;
    base_unit: any;
  }
): Promise<Ingredient> {
  const cleanName = ingredientData.name?.trim();
  if (!cleanName) {
    throw new Error('Informe o nome do ingrediente.');
  }

  const supabase = getSupabaseServerClient();

  // Validação de unicidade no banco (case-insensitive)
  const normalizedNewName = normalizeIngredientName(cleanName);
  const { data: allActive, error: searchErr } = await supabase
    .from('ingredients')
    .select('id, name')
    .eq('is_archived', false);

  if (searchErr) {
    console.error('[Server Action] Erro ao verificar duplicidade:', searchErr);
    throw new Error(`Erro ao verificar duplicidade no Supabase: ${searchErr.message}`);
  }

  const duplicate = (allActive || []).find(
    (i) => i.id !== ingredientData.id && normalizeIngredientName(i.name) === normalizedNewName
  );

  if (duplicate) {
    throw new Error(`Já existe um ingrediente cadastrado com o nome "${cleanName}".`);
  }

  const baseCost = calculateBaseUnitCost(
    ingredientData.package_price,
    ingredientData.package_quantity,
    ingredientData.package_unit
  ).toNumber();

  const now = new Date().toISOString();

  const payload: any = {
    name: cleanName,
    category: ingredientData.category || 'outros',
    package_quantity: ingredientData.package_quantity,
    package_unit: ingredientData.package_unit,
    package_price: ingredientData.package_price,
    base_unit: ingredientData.base_unit,
    cost_per_base_unit: baseCost,
    brand: ingredientData.brand ? ingredientData.brand.trim() : null,
    notes: ingredientData.notes ? ingredientData.notes.trim() : null,
    density_g_per_ml: ingredientData.density_g_per_ml || null,
    unit_weight_g: ingredientData.unit_weight_g || null,
    updated_at: now,
  };

  // Se tiver ID válido (UUID), faz UPDATE; caso contrário, INSERT
  if (ingredientData.id && !ingredientData.id.startsWith('ing-')) {
    const { data: updated, error: updErr } = await supabase
      .from('ingredients')
      .update(payload)
      .eq('id', ingredientData.id)
      .select()
      .single();

    if (updErr) {
      console.error('[Server Action] Erro no UPDATE do ingrediente:', updErr);
      throw new Error(`Erro ao atualizar ingrediente no Supabase: ${updErr.message}`);
    }
    if (!updated) {
      throw new Error('Ingrediente não encontrado para atualização.');
    }
    return updated as Ingredient;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('ingredients')
      .insert({
        ...payload,
        is_archived: false,
        created_at: now,
      })
      .select()
      .single();

    if (insErr) {
      console.error('[Server Action] Erro no INSERT do ingrediente:', insErr);
      throw new Error(`Erro ao cadastrar ingrediente no Supabase: ${insErr.message}`);
    }
    if (!inserted) {
      throw new Error('Falha ao confirmar o cadastro do ingrediente no banco.');
    }
    return inserted as Ingredient;
  }
}

export async function archiveIngredientAction(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('ingredients')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[Server Action] Erro ao arquivar ingrediente:', error);
    throw new Error(`Erro ao arquivar ingrediente no Supabase: ${error.message}`);
  }
}

export async function getIngredientPriceHistoryAction(
  ingredientId: string
): Promise<IngredientPriceHistory[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ingredient_price_history')
    .select('*')
    .eq('ingredient_id', ingredientId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('[Server Action] Erro ao buscar histórico:', error);
    throw new Error(`Erro ao buscar histórico de preços: ${error.message}`);
  }

  return (data || []) as IngredientPriceHistory[];
}

