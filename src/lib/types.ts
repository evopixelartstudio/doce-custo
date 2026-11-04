export type UnitType = 'g' | 'kg' | 'ml' | 'L' | 'unidade';
export type BaseUnit = 'g' | 'ml' | 'unidade';

export type IngredientCategory =
  | 'laticinios'
  | 'farinaceos'
  | 'chocolates'
  | 'frutas'
  | 'ovos'
  | 'coberturas'
  | 'embalagens'
  | 'outros';

export interface Ingredient {
  id: string;
  user_id: string;
  name: string;
  category: IngredientCategory;
  package_quantity: number;
  package_unit: UnitType;
  package_price: number;
  base_unit: BaseUnit;
  cost_per_base_unit: number; // e.g. R$ per gram, ml, or piece
  brand?: string | null;
  notes?: string | null;
  is_archived: boolean;
  density_g_per_ml?: number | null; // Optional conversion factor if user enables weight <-> volume
  unit_weight_g?: number | null; // Optional weight per unit piece (e.g. 50g per egg)
  created_at: string;
  updated_at: string;
}

export interface IngredientPriceHistory {
  id: string;
  ingredient_id: string;
  old_price: number;
  new_price: number;
  old_package_quantity: number;
  new_package_quantity: number;
  old_cost_per_base_unit: number;
  new_cost_per_base_unit: number;
  changed_at: string;
  notes?: string | null;
}

export type YieldUnit = 'unidades' | 'fatias' | 'porções' | 'g' | 'kg';

export interface RecipeItem {
  id: string;
  recipe_id: string;
  item_type: 'ingredient' | 'sub_recipe';
  ingredient_id?: string | null;
  sub_recipe_id?: string | null;
  quantity: number;
  unit: UnitType;
  // Computed / cached values for fast rendering
  ingredient?: Ingredient | null;
  sub_recipe?: Recipe | null;
  calculated_cost?: number;
}

export interface AdditionalCost {
  id: string;
  recipe_id?: string;
  description: string;
  amount: number;
  is_proportional?: boolean; // if true, scales with simulated yield; if false, fixed per production batch
}

export type PricingMethod = 'markup' | 'margin';

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  category: string;
  description?: string | null;
  photo_url?: string | null;
  yield_quantity: number;
  yield_unit: YieldUnit;
  prep_time_minutes?: number | null;
  is_archived: boolean;
  pricing_method: PricingMethod;
  markup_percentage: number;
  target_margin_percentage: number;
  card_fee_percentage: number;
  manual_sale_price?: number | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  items?: RecipeItem[];
  additional_costs?: AdditionalCost[];
}

export interface UserSettings {
  id: string;
  user_id: string;
  business_name: string;
  default_pricing_method: PricingMethod;
  default_markup_percentage: number;
  default_target_margin_percentage: number;
  default_card_fee_percentage: number;
  round_prices_to_cents: boolean;
  default_additional_costs: {
    description: string;
    amount: number;
    is_proportional: boolean;
  }[];
  updated_at: string;
}

export interface RecipeCostBreakdown {
  ingredientsCost: number;
  additionalCosts: number;
  totalCost: number;
  costPerUnit: number;
  suggestedSalePrice: number;
  effectiveSalePrice: number;
  estimatedGrossProfit: number;
  estimatedProfitMargin: number; // percentage
  cardFeeAmount: number;
  netRevenue: number;
  isMarginBelowTarget: boolean;
}

export interface SimulationResult {
  recipe: Recipe;
  multiplier: number;
  simulatedYield: number;
  scaledItems: {
    item: RecipeItem;
    originalQuantity: number;
    simulatedQuantity: number;
    unit: UnitType;
    unitCost: number;
    totalCost: number;
    name: string;
  }[];
  scaledAdditionalCosts: {
    description: string;
    originalAmount: number;
    simulatedAmount: number;
    isProportional: boolean;
  }[];
  totalIngredientsCost: number;
  totalAdditionalCosts: number;
  newTotalCost: number;
  newCostPerUnit: number;
  suggestedSalePrice: number;
}
