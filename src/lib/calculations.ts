import Decimal from 'decimal.js';
import type {
  UnitType,
  BaseUnit,
  Ingredient,
  Recipe,
  RecipeItem,
  AdditionalCost,
  RecipeCostBreakdown,
  SimulationResult,
} from './types';

// Configure Decimal precision and rounding mode (ROUND_HALF_UP)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitConversionError';
  }
}

export class CalculationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationValidationError';
  }
}

/**
 * Returns the base unit for a given unit type.
 */
export function getBaseUnit(unit: UnitType): BaseUnit {
  switch (unit) {
    case 'g':
    case 'kg':
      return 'g';
    case 'ml':
    case 'L':
      return 'ml';
    case 'unidade':
      return 'unidade';
    default:
      throw new UnitConversionError(`Unidade desconhecida: ${unit}`);
  }
}

/**
 * Converts a quantity to its canonical base unit (g, ml, or unidade).
 */
export function convertToBaseUnit(quantity: number | Decimal, unit: UnitType): Decimal {
  const q = new Decimal(quantity);
  if (q.isNegative()) {
    throw new CalculationValidationError('A quantidade não pode ser negativa.');
  }

  switch (unit) {
    case 'kg':
      return q.times(1000);
    case 'g':
      return q;
    case 'L':
      return q.times(1000);
    case 'ml':
      return q;
    case 'unidade':
      return q;
    default:
      throw new UnitConversionError(`Unidade incompatível: ${unit}`);
  }
}

/**
 * Converts a quantity between two units with strict validation.
 * Grams cannot be converted to milliliters or pieces without explicit factors.
 */
export function convertUnit(
  quantity: number | Decimal,
  fromUnit: UnitType,
  toUnit: UnitType,
  options?: { density_g_per_ml?: number | null; unit_weight_g?: number | null }
): Decimal {
  const q = new Decimal(quantity);
  if (q.isNegative()) {
    throw new CalculationValidationError('Quantidade não pode ser negativa.');
  }
  if (fromUnit === toUnit) return q;

  const baseFrom = getBaseUnit(fromUnit);
  const baseTo = getBaseUnit(toUnit);

  // First convert fromUnit to its base unit
  let inBaseUnit = convertToBaseUnit(q, fromUnit);

  // If bases differ, verify explicit conversion factors
  if (baseFrom !== baseTo) {
    // Weight <-> Volume conversion via density
    if (
      (baseFrom === 'g' && baseTo === 'ml') ||
      (baseFrom === 'ml' && baseTo === 'g')
    ) {
      if (!options?.density_g_per_ml || options.density_g_per_ml <= 0) {
        throw new UnitConversionError(
          `Não é possível converter entre ${fromUnit} e ${toUnit} sem um fator de densidade (g/ml) explicitamente cadastrado.`
        );
      }
      const density = new Decimal(options.density_g_per_ml);
      if (baseFrom === 'g' && baseTo === 'ml') {
        // ml = g / density
        inBaseUnit = inBaseUnit.dividedBy(density);
      } else {
        // g = ml * density
        inBaseUnit = inBaseUnit.times(density);
      }
    }
    // Unit piece <-> Weight conversion via unit_weight_g
    else if (
      (baseFrom === 'unidade' && baseTo === 'g') ||
      (baseFrom === 'g' && baseTo === 'unidade')
    ) {
      if (!options?.unit_weight_g || options.unit_weight_g <= 0) {
        throw new UnitConversionError(
          `Não é possível converter entre ${fromUnit} e ${toUnit} sem o peso unitário em gramas explicitamente cadastrado.`
        );
      }
      const unitWeight = new Decimal(options.unit_weight_g);
      if (baseFrom === 'unidade' && baseTo === 'g') {
        inBaseUnit = inBaseUnit.times(unitWeight);
      } else {
        inBaseUnit = inBaseUnit.dividedBy(unitWeight);
      }
    } else {
      throw new UnitConversionError(
        `Conversão incompatível entre ${fromUnit} e ${toUnit}.`
      );
    }
  }

  // Convert from destination base unit to destination unit
  switch (toUnit) {
    case 'kg':
      return inBaseUnit.dividedBy(1000);
    case 'g':
      return inBaseUnit;
    case 'L':
      return inBaseUnit.dividedBy(1000);
    case 'ml':
      return inBaseUnit;
    case 'unidade':
      return inBaseUnit;
    default:
      throw new UnitConversionError(`Unidade destino desconhecida: ${toUnit}`);
  }
}

/**
 * Calculates the cost per base unit for an ingredient purchase.
 * Example:
 * 200 ml for R$ 10.00 -> 10 / 200 = R$ 0.05 per ml.
 * 1 kg for R$ 6.00 -> 1 kg = 1000 g -> 6 / 1000 = R$ 0.006 per g.
 */
export function calculateBaseUnitCost(
  packagePrice: number | Decimal,
  packageQuantity: number | Decimal,
  packageUnit: UnitType
): Decimal {
  const price = new Decimal(packagePrice);
  const qty = new Decimal(packageQuantity);

  if (price.isNegative()) {
    throw new CalculationValidationError('O preço de compra não pode ser negativo.');
  }
  if (qty.isNegative() || qty.isZero()) {
    throw new CalculationValidationError('A quantidade comprada deve ser maior que zero.');
  }

  const baseQuantity = convertToBaseUnit(qty, packageUnit);
  if (baseQuantity.isZero()) {
    throw new CalculationValidationError('Quantidade na unidade base não pode ser zero.');
  }

  return price.dividedBy(baseQuantity);
}

/**
 * Calculates the cost of an ingredient item in a recipe without intermediate rounding.
 */
export function calculateIngredientItemCost(
  ingredient: Pick<Ingredient, 'cost_per_base_unit' | 'base_unit' | 'density_g_per_ml' | 'unit_weight_g'>,
  quantityUsed: number | Decimal,
  unitUsed: UnitType
): Decimal {
  const qty = new Decimal(quantityUsed);
  if (qty.isNegative()) {
    throw new CalculationValidationError('A quantidade utilizada não pode ser negativa.');
  }
  if (qty.isZero()) {
    return new Decimal(0);
  }

  const convertedQuantityInBaseUnit = convertUnit(qty, unitUsed, ingredient.base_unit, {
    density_g_per_ml: ingredient.density_g_per_ml,
    unit_weight_g: ingredient.unit_weight_g,
  });

  const costPerBaseUnit = new Decimal(ingredient.cost_per_base_unit);
  return convertedQuantityInBaseUnit.times(costPerBaseUnit);
}

/**
 * Calculates the cost of a sub-recipe item in a recipe.
 * Example:
 * Recheio de Ninho produces 1.000 g and costs R$ 25,00.
 * Cake uses 400 g.
 * Cost = (400 / 1000) * 25 = R$ 10,00.
 */
export function calculateSubRecipeItemCost(
  subRecipe: Recipe,
  quantityUsed: number | Decimal,
  unitUsed: UnitType,
  subRecipeTotalCost: number | Decimal
): Decimal {
  const qty = new Decimal(quantityUsed);
  const totalCost = new Decimal(subRecipeTotalCost);
  const yieldQty = new Decimal(subRecipe.yield_quantity);

  if (yieldQty.isZero() || yieldQty.isNegative()) {
    throw new CalculationValidationError('O rendimento da sub-receita deve ser maior que zero.');
  }
  if (qty.isNegative()) {
    throw new CalculationValidationError('A quantidade utilizada não pode ser negativa.');
  }
  if (qty.isZero() || totalCost.isZero()) {
    return new Decimal(0);
  }

  // Convert quantity used to the unit of the sub-recipe yield
  let proportion: Decimal;
  const yieldUnit = subRecipe.yield_unit;

  if (yieldUnit === 'g' || yieldUnit === 'kg') {
    const yieldInGrams = yieldUnit === 'kg' ? yieldQty.times(1000) : yieldQty;
    const usedInGrams = convertUnit(qty, unitUsed, 'g');
    proportion = usedInGrams.dividedBy(yieldInGrams);
  } else {
    // For 'unidades', 'fatias', 'porções'
    proportion = qty.dividedBy(yieldQty);
  }

  return proportion.times(totalCost);
}

/**
 * Checks for circular dependency before adding or nesting a sub-recipe.
 * Returns true if a cycle is detected.
 */
export function hasCircularDependency(
  targetRecipeId: string,
  candidateSubRecipeId: string,
  getRecipeSubRecipeIds: (recipeId: string) => string[]
): boolean {
  if (targetRecipeId === candidateSubRecipeId) {
    return true;
  }

  const visited = new Set<string>();
  const stack = [candidateSubRecipeId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (currentId === targetRecipeId) {
      return true;
    }
    if (!visited.has(currentId)) {
      visited.add(currentId);
      const childIds = getRecipeSubRecipeIds(currentId);
      for (const childId of childIds) {
        if (childId === targetRecipeId) {
          return true;
        }
        if (!visited.has(childId)) {
          stack.push(childId);
        }
      }
    }
  }

  return false;
}

/**
 * Calculates suggested selling price and profit metrics.
 *
 * Method A (Markup):
 *   Price = TotalCost * (1 + markup% / 100)
 *
 * Method B (Desired Margin on Sale Price):
 *   NetRevenue = Price * (1 - cardFee% / 100)
 *   GrossProfit = NetRevenue - TotalCost
 *   Margin = GrossProfit / Price = 1 - (cardFee% / 100) - (TotalCost / Price)
 *   TotalCost / Price = 1 - (margin% + cardFee%) / 100
 *   Price = TotalCost / (1 - (margin% + cardFee%) / 100)
 *
 * Validates: (targetMargin% + cardFee%) < 100% and >= 0%.
 */
export function calculateRecipePricing(
  totalCost: number | Decimal,
  yieldQuantity: number | Decimal,
  pricingMethod: 'markup' | 'margin',
  markupPercentage: number | Decimal,
  targetMarginPercentage: number | Decimal,
  cardFeePercentage: number | Decimal = 0,
  manualSalePrice?: number | Decimal | null
): {
  suggestedSalePrice: Decimal;
  effectiveSalePrice: Decimal;
  costPerUnit: Decimal;
  estimatedGrossProfit: Decimal;
  estimatedProfitMargin: Decimal;
  cardFeeAmount: Decimal;
  netRevenue: Decimal;
  isMarginBelowTarget: boolean;
} {
  const cost = new Decimal(totalCost);
  const yieldQty = new Decimal(yieldQuantity);
  const markup = new Decimal(markupPercentage || 0);
  const targetMargin = new Decimal(targetMarginPercentage || 0);
  const cardFee = new Decimal(cardFeePercentage || 0);

  if (yieldQty.isZero() || yieldQty.isNegative()) {
    throw new CalculationValidationError('O rendimento deve ser maior que zero.');
  }

  const costPerUnit = cost.dividedBy(yieldQty);

  // Validate percentages
  if (markup.isNegative()) {
    throw new CalculationValidationError('O markup não pode ser negativo.');
  }
  if (targetMargin.isNegative() || targetMargin.greaterThanOrEqualTo(100)) {
    throw new CalculationValidationError('A margem desejada deve ser entre 0% e menor que 100%.');
  }
  if (cardFee.isNegative() || cardFee.greaterThanOrEqualTo(100)) {
    throw new CalculationValidationError('A taxa de cartão deve ser entre 0% e menor que 100%.');
  }

  let suggestedSalePrice: Decimal;

  if (pricingMethod === 'markup') {
    // Price = Cost * (1 + markup / 100)
    // If card fee exists, to maintain target markup after card fee:
    // Net = Price * (1 - fee/100) = Cost * (1 + markup/100)
    // Price = [Cost * (1 + markup/100)] / (1 - fee/100)
    const baseMarkupPrice = cost.times(new Decimal(1).plus(markup.dividedBy(100)));
    if (cardFee.greaterThan(0)) {
      const divisor = new Decimal(1).minus(cardFee.dividedBy(100));
      suggestedSalePrice = baseMarkupPrice.dividedBy(divisor);
    } else {
      suggestedSalePrice = baseMarkupPrice;
    }
  } else {
    // Target margin method
    // Price = Cost / (1 - (targetMargin + cardFee) / 100)
    const combinedPercentage = targetMargin.plus(cardFee);
    if (combinedPercentage.greaterThanOrEqualTo(100)) {
      throw new CalculationValidationError(
        'A soma da margem desejada e taxa de cartão não pode atingir ou ultrapassar 100%.'
      );
    }
    const divisor = new Decimal(1).minus(combinedPercentage.dividedBy(100));
    suggestedSalePrice = cost.dividedBy(divisor);
  }

  // Determine effective sale price (manual or suggested)
  const effectiveSalePrice =
    manualSalePrice !== null && manualSalePrice !== undefined && new Decimal(manualSalePrice).greaterThan(0)
      ? new Decimal(manualSalePrice)
      : suggestedSalePrice;

  // Calculate actual revenue and profit at effective sale price
  const cardFeeAmount = effectiveSalePrice.times(cardFee.dividedBy(100));
  const netRevenue = effectiveSalePrice.minus(cardFeeAmount);
  const estimatedGrossProfit = netRevenue.minus(cost);

  const estimatedProfitMargin = effectiveSalePrice.isZero()
    ? new Decimal(0)
    : estimatedGrossProfit.dividedBy(effectiveSalePrice).times(100);

  const isMarginBelowTarget = estimatedProfitMargin.lessThan(targetMargin);

  return {
    suggestedSalePrice,
    effectiveSalePrice,
    costPerUnit,
    estimatedGrossProfit,
    estimatedProfitMargin,
    cardFeeAmount,
    netRevenue,
    isMarginBelowTarget,
  };
}

/**
 * Calculates complete recipe cost breakdown with items and additional costs.
 */
export function calculateRecipeBreakdown(
  recipe: Recipe,
  recipeItemsCost: Decimal,
  additionalCostsList: AdditionalCost[] = []
): RecipeCostBreakdown {
  const ingredientsCost = recipeItemsCost;

  let totalAdditional = new Decimal(0);
  for (const ac of additionalCostsList) {
    if (ac.amount > 0) {
      totalAdditional = totalAdditional.plus(new Decimal(ac.amount));
    }
  }

  const totalCost = ingredientsCost.plus(totalAdditional);

  const pricing = calculateRecipePricing(
    totalCost,
    recipe.yield_quantity || 1,
    recipe.pricing_method || 'margin',
    recipe.markup_percentage || 0,
    recipe.target_margin_percentage || 50,
    recipe.card_fee_percentage || 0,
    recipe.manual_sale_price
  );

  return {
    ingredientsCost: ingredientsCost.toNumber(),
    additionalCosts: totalAdditional.toNumber(),
    totalCost: totalCost.toNumber(),
    costPerUnit: pricing.costPerUnit.toNumber(),
    suggestedSalePrice: pricing.suggestedSalePrice.toNumber(),
    effectiveSalePrice: pricing.effectiveSalePrice.toNumber(),
    estimatedGrossProfit: pricing.estimatedGrossProfit.toNumber(),
    estimatedProfitMargin: pricing.estimatedProfitMargin.toNumber(),
    cardFeeAmount: pricing.cardFeeAmount.toNumber(),
    netRevenue: pricing.netRevenue.toNumber(),
    isMarginBelowTarget: pricing.isMarginBelowTarget,
  };
}

/**
 * Simulates production batch scaling.
 * Multiplies ingredients by (desiredYield / baseYield).
 * Handles proportional vs fixed additional costs cleanly without altering the original recipe.
 */
export function simulateRecipeProduction(
  recipe: Recipe,
  desiredYield: number | Decimal,
  options?: {
    getItemCost?: (item: RecipeItem, scaledQty: Decimal) => Decimal;
  }
): SimulationResult {
  const baseYield = new Decimal(recipe.yield_quantity);
  const targetYield = new Decimal(desiredYield);

  if (baseYield.isZero() || baseYield.isNegative()) {
    throw new CalculationValidationError('O rendimento original da receita deve ser maior que zero.');
  }
  if (targetYield.isZero() || targetYield.isNegative()) {
    throw new CalculationValidationError('O rendimento desejado para a simulação deve ser maior que zero.');
  }

  const multiplier = targetYield.dividedBy(baseYield);

  const items = recipe.items || [];
  let totalIngredientsCost = new Decimal(0);

  const scaledItems = items.map((item) => {
    const originalQty = new Decimal(item.quantity);
    const scaledQty = originalQty.times(multiplier);

    let cost = new Decimal(0);
    let name = 'Item';

    if (item.item_type === 'ingredient' && item.ingredient) {
      name = item.ingredient.name;
      cost = calculateIngredientItemCost(item.ingredient, scaledQty, item.unit);
    } else if (item.item_type === 'sub_recipe' && item.sub_recipe) {
      name = item.sub_recipe.name;
      if (options?.getItemCost) {
        cost = options.getItemCost(item, scaledQty);
      } else {
        const subCost = (item.sub_recipe as any).total_cost || 0;
        cost = calculateSubRecipeItemCost(item.sub_recipe, scaledQty, item.unit, subCost);
      }
    } else if (item.calculated_cost) {
      cost = new Decimal(item.calculated_cost).times(multiplier);
    }

    totalIngredientsCost = totalIngredientsCost.plus(cost);

    return {
      item,
      originalQuantity: originalQty.toNumber(),
      simulatedQuantity: scaledQty.toNumber(),
      unit: item.unit,
      unitCost: scaledQty.isZero() ? 0 : cost.dividedBy(scaledQty).toNumber(),
      totalCost: cost.toNumber(),
      name,
    };
  });

  const additionalCosts = recipe.additional_costs || [];
  let totalAdditionalCosts = new Decimal(0);

  const scaledAdditionalCosts = additionalCosts.map((ac) => {
    const originalAmount = new Decimal(ac.amount || 0);
    // If proportional, scale with multiplier; if fixed batch cost, stay same
    const isProportional = ac.is_proportional ?? true;
    const simulatedAmount = isProportional ? originalAmount.times(multiplier) : originalAmount;

    totalAdditionalCosts = totalAdditionalCosts.plus(simulatedAmount);

    return {
      description: ac.description,
      originalAmount: originalAmount.toNumber(),
      simulatedAmount: simulatedAmount.toNumber(),
      isProportional,
    };
  });

  const newTotalCost = totalIngredientsCost.plus(totalAdditionalCosts);
  const newCostPerUnit = newTotalCost.dividedBy(targetYield);

  const pricing = calculateRecipePricing(
    newTotalCost,
    targetYield,
    recipe.pricing_method || 'margin',
    recipe.markup_percentage || 0,
    recipe.target_margin_percentage || 50,
    recipe.card_fee_percentage || 0
  );

  return {
    recipe,
    multiplier: multiplier.toNumber(),
    simulatedYield: targetYield.toNumber(),
    scaledItems,
    scaledAdditionalCosts,
    totalIngredientsCost: totalIngredientsCost.toNumber(),
    totalAdditionalCosts: totalAdditionalCosts.toNumber(),
    newTotalCost: newTotalCost.toNumber(),
    newCostPerUnit: newCostPerUnit.toNumber(),
    suggestedSalePrice: pricing.suggestedSalePrice.toNumber(),
  };
}

/**
 * Format currency into standard pt-BR Brazilian Real (R$ 1.234,56).
 * Supports high-precision micro decimals when requested (e.g. R$ 0,006/g).
 */
export function formatCurrency(
  value: number | Decimal | undefined | null,
  options?: { minDecimals?: number; maxDecimals?: number }
): string {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 'R$ 0,00';
  }

  const d = new Decimal(value);
  const num = d.toNumber();

  const minDecimals = options?.minDecimals ?? 2;
  const maxDecimals = options?.maxDecimals ?? 2;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(num);
}

/**
 * Formats a unit cost with adaptive decimals (e.g. 0.006 -> R$ 0,0060/g, or 10.5 -> R$ 10,50/kg).
 */
export function formatUnitCost(
  value: number | Decimal | undefined | null,
  unitLabel: string
): string {
  if (value === undefined || value === null) return `R$ 0,00/${unitLabel}`;
  const d = new Decimal(value);

  // If cost is tiny (< 0.10), show 4 decimals for precision
  const decimals = d.lessThan(0.1) && !d.isZero() ? 4 : 2;
  return `${formatCurrency(d, { minDecimals: decimals, maxDecimals: decimals })}/${unitLabel}`;
}

/**
 * Format quantity into pt-BR decimal string.
 */
export function formatQuantity(
  value: number | Decimal | undefined | null,
  maxDecimals = 3
): string {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return '0';
  }
  const d = new Decimal(value);
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: maxDecimals,
  }).format(d.toNumber());
}

/**
 * Format percentage into pt-BR string (e.g. 50% or 33,3%).
 */
export function formatPercent(
  value: number | Decimal | undefined | null,
  decimals = 1
): string {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return '0%';
  }
  const d = new Decimal(value);
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(d.toNumber())}%`;
}

