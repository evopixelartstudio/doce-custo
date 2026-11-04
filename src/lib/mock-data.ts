import type { Ingredient, Recipe, UserSettings } from './types';

export const INITIAL_USER_SETTINGS: UserSettings = {
  id: 'set-default',
  user_id: 'default',
  business_name: 'Minha Confeitaria',
  default_pricing_method: 'margin',
  default_markup_percentage: 100,
  default_target_margin_percentage: 50,
  default_card_fee_percentage: 3.5,
  round_prices_to_cents: true,
  default_additional_costs: [],
  updated_at: new Date().toISOString(),
};

export const INITIAL_INGREDIENTS: Ingredient[] = [];

export const INITIAL_RECIPES: Recipe[] = [];
