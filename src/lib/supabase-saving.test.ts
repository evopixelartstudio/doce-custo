import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://peziqgjedtilikcimlqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlemlxZ2plZHRpbGlrY2ltbHFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Nzc3MTEsImV4cCI6MjEwOTM1MzcxMX0.mVK88VqM5B0hX0p-8QMzx2kiYGEU6XfZQw2hjkaKn64';

describe('Supabase - Teste Real de Leitura e Gravação (Sem Login)', () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  it('salva, consulta, atualiza e exclui um ingrediente com sucesso', async () => {
    // 1. Inserir ingrediente
    const testIngredient = {
      name: `Farinha Teste Supabase ${Date.now()}`,
      category: 'farinaceos',
      package_quantity: 1,
      package_unit: 'kg',
      package_price: 5.5,
      base_unit: 'g',
      cost_per_base_unit: 0.0055,
      brand: 'Marca Teste',
      notes: 'Teste automatizado de salvamento',
      is_archived: false,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('ingredients')
      .insert(testIngredient)
      .select()
      .single();

    expect(insertErr).toBeNull();
    expect(inserted).toBeDefined();
    expect(inserted.id).toBeDefined();
    expect(inserted.name).toBe(testIngredient.name);

    const ingredientId = inserted.id;

    // 2. Atualizar preço do ingrediente
    const { data: updated, error: updateErr } = await supabase
      .from('ingredients')
      .update({ package_price: 6.0, cost_per_base_unit: 0.006 })
      .eq('id', ingredientId)
      .select()
      .single();

    expect(updateErr).toBeNull();
    expect(Number(updated.package_price)).toBe(6.0);

    // 3. Excluir item de teste
    const { error: deleteErr } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', ingredientId);

    expect(deleteErr).toBeNull();
  });

  it('salva uma receita completa com itens e custos adicionais e consulta com sucesso', async () => {
    // 1. Criar um ingrediente base para a receita
    const testIngName = `Ovo Teste Receita ${Date.now()}`;
    const { data: ing, error: ingErr } = await supabase
      .from('ingredients')
      .insert({
        name: testIngName,
        category: 'ovos',
        package_quantity: 12,
        package_unit: 'unidade',
        package_price: 12.0,
        base_unit: 'unidade',
        cost_per_base_unit: 1.0,
        is_archived: false,
      })
      .select()
      .single();

    expect(ingErr).toBeNull();
    expect(ing).toBeDefined();

    // 2. Criar a receita
    const { data: rec, error: recErr } = await supabase
      .from('recipes')
      .insert({
        name: 'Bolo Simples Teste',
        category: 'bolos',
        yield_quantity: 10,
        yield_unit: 'fatias',
        pricing_method: 'margin',
        markup_percentage: 100,
        target_margin_percentage: 50,
        card_fee_percentage: 3.5,
      })
      .select()
      .single();

    expect(recErr).toBeNull();
    expect(rec).toBeDefined();

    // 3. Inserir itens da receita
    const { error: itemErr } = await supabase.from('recipe_items').insert({
      recipe_id: rec.id,
      item_type: 'ingredient',
      ingredient_id: ing.id,
      quantity: 3,
      unit: 'unidade',
      order_index: 0,
    });
    expect(itemErr).toBeNull();

    // 4. Inserir custo adicional
    const { error: costErr } = await supabase.from('recipe_additional_costs').insert({
      recipe_id: rec.id,
      description: 'Embalagem Teste',
      amount: 4.5,
      is_proportional: true,
    });
    expect(costErr).toBeNull();

    // 5. Consultar a receita com nested items e costs
    const { data: fullRecipe, error: fetchErr } = await supabase
      .from('recipes')
      .select('*, items:recipe_items!recipe_items_recipe_id_fkey(*), additional_costs:recipe_additional_costs(*)')
      .eq('id', rec.id)
      .single();

    expect(fetchErr).toBeNull();
    expect(fullRecipe.name).toBe('Bolo Simples Teste');
    expect(fullRecipe.items.length).toBe(1);
    expect(fullRecipe.items[0].ingredient_id).toBe(ing.id);
    expect(fullRecipe.additional_costs.length).toBe(1);

    // 6. Limpar dados do teste
    await supabase.from('recipe_additional_costs').delete().eq('recipe_id', rec.id);
    await supabase.from('recipe_items').delete().eq('recipe_id', rec.id);
    await supabase.from('recipes').delete().eq('id', rec.id);
    await supabase.from('ingredients').delete().eq('id', ing.id);
  });

  it('salva e recupera configurações do usuário com sucesso', async () => {
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    let savedId = existing?.id;
    if (savedId) {
      const { data, error } = await supabase
        .from('user_settings')
        .update({
          business_name: 'Ateliê Doce Sabor Teste',
          default_target_margin_percentage: 55,
        })
        .eq('id', savedId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.business_name).toBe('Ateliê Doce Sabor Teste');
    } else {
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          business_name: 'Ateliê Doce Sabor Teste',
          default_target_margin_percentage: 55,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.business_name).toBe('Ateliê Doce Sabor Teste');
    }
  });
});
