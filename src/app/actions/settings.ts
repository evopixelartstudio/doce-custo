'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import type { UserSettings } from '@/lib/types';
import { INITIAL_USER_SETTINGS } from '@/lib/mock-data';

export async function getUserSettingsAction(): Promise<UserSettings> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Server Action] Erro ao buscar configurações:', error);
    throw new Error(`Erro ao carregar configurações do Supabase: ${error.message}`);
  }

  if (data) {
    return data as UserSettings;
  }

  // Se não existir nenhuma configuração no banco, cria a padrão
  const now = new Date().toISOString();
  const { data: created, error: createErr } = await supabase
    .from('user_settings')
    .insert({
      business_name: 'Minha Confeitaria',
      default_pricing_method: 'margin',
      default_markup_percentage: 100,
      default_target_margin_percentage: 50,
      default_card_fee_percentage: 3.5,
      round_prices_to_cents: true,
      default_additional_costs: [],
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (createErr) {
    console.warn('[Server Action] Não foi possível criar configurações padrão:', createErr);
    return INITIAL_USER_SETTINGS;
  }

  return (created as UserSettings) || INITIAL_USER_SETTINGS;
}

export async function saveUserSettingsAction(
  settings: Partial<UserSettings>
): Promise<UserSettings> {
  const supabase = getSupabaseServerClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('user_settings')
    .select('id')
    .order('created_at', { ascending: true })
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
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Server Action] Erro ao salvar configurações:', error);
    throw new Error(`Erro ao salvar configurações no Supabase: ${error.message}`);
  }

  return data as UserSettings;
}

