import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  getBaseUnit,
  convertToBaseUnit,
  convertUnit,
  calculateBaseUnitCost,
  calculateIngredientItemCost,
  calculateSubRecipeItemCost,
  hasCircularDependency,
  calculateRecipePricing,
  simulateRecipeProduction,
  normalizeIngredientName,
  getCompatibleRecipeUnits,
  UnitConversionError,
  CalculationValidationError,
} from './calculations';
import type { Ingredient, Recipe, RecipeItem } from './types';

describe('Cálculos e Conversão de Unidades', () => {
  it('retorna a unidade base correta', () => {
    expect(getBaseUnit('g')).toBe('g');
    expect(getBaseUnit('kg')).toBe('g');
    expect(getBaseUnit('ml')).toBe('ml');
    expect(getBaseUnit('L')).toBe('ml');
    expect(getBaseUnit('unidade')).toBe('unidade');
  });

  it('converte corretamente para a unidade base', () => {
    expect(convertToBaseUnit(1.5, 'kg').toNumber()).toBe(1500);
    expect(convertToBaseUnit(500, 'g').toNumber()).toBe(500);
    expect(convertToBaseUnit(2, 'L').toNumber()).toBe(2000);
    expect(convertToBaseUnit(250, 'ml').toNumber()).toBe(250);
    expect(convertToBaseUnit(12, 'unidade').toNumber()).toBe(12);
  });

  it('impede conversão entre gramas e mililitros sem fator de densidade', () => {
    expect(() => convertUnit(500, 'g', 'ml')).toThrow(UnitConversionError);
    expect(() => convertUnit(500, 'ml', 'g')).toThrow(UnitConversionError);
  });

  it('permite conversão entre gramas e mililitros quando densidade é fornecida', () => {
    // 500 ml de leite com densidade 1.03 g/ml = 515 g
    const grams = convertUnit(500, 'ml', 'g', { density_g_per_ml: 1.03 });
    expect(grams.toNumber()).toBe(515);
  });

  it('impede conversão entre unidade e peso sem peso unitário', () => {
    expect(() => convertUnit(3, 'unidade', 'g')).toThrow(UnitConversionError);
  });

  it('calcula custo da unidade-base de acordo com os exemplos do prompt', () => {
    // Exemplo 1: Leite condensado: 200 ml por R$ 10,00 -> R$ 0,05 por ml
    const costMilk = calculateBaseUnitCost(10, 200, 'ml');
    expect(costMilk.toNumber()).toBe(0.05);

    // Exemplo 2: Farinha de trigo: 1 kg por R$ 6,00 -> 1000g -> R$ 0,006 por grama
    const costFlour = calculateBaseUnitCost(6, 1, 'kg');
    expect(costFlour.toNumber()).toBe(0.006);

    // Ovos: 12 unidades por R$ 12,00 -> R$ 1,00 por unidade
    const costEggs = calculateBaseUnitCost(12, 12, 'unidade');
    expect(costEggs.toNumber()).toBe(1.0);
  });

  it('calcula o custo dos itens da receita do Bolo de Chocolate exatamente como no prompt', () => {
    // Exemplo do prompt:
    // 3 ovos a R$ 0,25 = R$ 0,75
    // 600 ml de leite condensado a R$ 0,05/ml = R$ 30,00
    // 300 g de farinha a R$ 0,006/g = R$ 1,80
    // Custo total dos ingredientes = R$ 32,55

    const egg: Pick<Ingredient, 'cost_per_base_unit' | 'base_unit'> = {
      cost_per_base_unit: 0.25,
      base_unit: 'unidade',
    };
    const condensedMilk: Pick<Ingredient, 'cost_per_base_unit' | 'base_unit'> = {
      cost_per_base_unit: 0.05,
      base_unit: 'ml',
    };
    const flour: Pick<Ingredient, 'cost_per_base_unit' | 'base_unit'> = {
      cost_per_base_unit: 0.006,
      base_unit: 'g',
    };

    const eggCost = calculateIngredientItemCost(egg, 3, 'unidade');
    const milkCost = calculateIngredientItemCost(condensedMilk, 600, 'ml');
    const flourCost = calculateIngredientItemCost(flour, 300, 'g');

    expect(eggCost.toNumber()).toBe(0.75);
    expect(milkCost.toNumber()).toBe(30.0);
    expect(flourCost.toNumber()).toBe(1.8);

    const total = eggCost.plus(milkCost).plus(flourCost);
    expect(total.toNumber()).toBe(32.55);
  });

  it('calcula sub-receitas proporcionalmente conforme o exemplo do Recheio de Ninho', () => {
    // Exemplo do prompt:
    // Recheio de Ninho produz 1.000 g e custa R$ 25,00.
    // Bolo adiciona 400 g do recheio.
    // Cálculo: 400 / 1000 * 25 = R$ 10,00.
    const subRecipe: Recipe = {
      id: 'sub-1',
      user_id: 'user-1',
      name: 'Recheio de Ninho',
      category: 'recheios',
      yield_quantity: 1000,
      yield_unit: 'g',
      is_archived: false,
      pricing_method: 'margin',
      markup_percentage: 100,
      target_margin_percentage: 50,
      card_fee_percentage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const cost = calculateSubRecipeItemCost(subRecipe, 400, 'g', 25.0);
    expect(cost.toNumber()).toBe(10.0);
  });

  it('detecta dependência circular direta e indireta entre receitas', () => {
    // Receita A não pode incluir Receita A
    expect(hasCircularDependency('recA', 'recA', () => [])).toBe(true);

    // Receita A usa B, B usa C. Se C tentar usar A, detecta ciclo!
    const dependencies: Record<string, string[]> = {
      recA: ['recB'],
      recB: ['recC'],
      recC: [],
    };
    const getSubIds = (id: string) => dependencies[id] || [];

    // Tentar adicionar recA dentro de recC:
    expect(hasCircularDependency('recC', 'recA', getSubIds)).toBe(true);
    // Mas adicionar recC dentro de recA é permitido se recC não depende de recA
    expect(hasCircularDependency('recX', 'recB', getSubIds)).toBe(false);
  });

  it('calcula precificação por Markup (Método A)', () => {
    // Custo R$ 50,00 com 100% de markup -> Preço R$ 100,00
    const pricing = calculateRecipePricing(50, 1, 'markup', 100, 50, 0);
    expect(pricing.suggestedSalePrice.toNumber()).toBe(100);
    expect(pricing.costPerUnit.toNumber()).toBe(50);
    expect(pricing.estimatedGrossProfit.toNumber()).toBe(50);
    expect(pricing.estimatedProfitMargin.toNumber()).toBe(50);
  });

  it('calcula precificação por Margem Desejada (Método B) sem taxa de cartão', () => {
    // Custo R$ 50,00 com margem desejada de 50% -> Preço = 50 / (1 - 0.5) = R$ 100,00
    const pricing = calculateRecipePricing(50, 1, 'margin', 0, 50, 0);
    expect(pricing.suggestedSalePrice.toNumber()).toBe(100);
    expect(pricing.estimatedGrossProfit.toNumber()).toBe(50);
    expect(pricing.estimatedProfitMargin.toNumber()).toBe(50);
  });

  it('calcula precificação com taxa de cartão sem descontar duas vezes', () => {
    // Custo R$ 45,00, Margem 50%, Taxa cartão 5% -> divisor = 1 - (0.50 + 0.05) = 0.45
    // Preço sugerido = 45 / 0.45 = R$ 100,00
    // Taxa cartão = R$ 5,00
    // Receita líquida = R$ 95,00
    // Lucro bruto = R$ 95,00 - R$ 45,00 = R$ 50,00
    // Margem real sobre a venda = (50 / 100) * 100 = 50%
    const pricing = calculateRecipePricing(45, 1, 'margin', 0, 50, 5);
    expect(pricing.suggestedSalePrice.toNumber()).toBe(100);
    expect(pricing.cardFeeAmount.toNumber()).toBe(5);
    expect(pricing.netRevenue.toNumber()).toBe(95);
    expect(pricing.estimatedGrossProfit.toNumber()).toBe(50);
    expect(pricing.estimatedProfitMargin.toNumber()).toBe(50);
  });

  it('detecta quando o preço de venda manual deixa a margem abaixo do desejado', () => {
    // Preço manual R$ 70,00 com custo R$ 45,00 e margem desejada 50%
    // Lucro = 70 - 45 = 25 -> Margem = 25/70 = 35.7% < 50%
    const pricing = calculateRecipePricing(45, 1, 'margin', 0, 50, 0, 70);
    expect(pricing.effectiveSalePrice.toNumber()).toBe(70);
    expect(pricing.isMarginBelowTarget).toBe(true);
  });

  it('valida limites de porcentagem e divisões por zero', () => {
    // Margem >= 100% não é permitida
    expect(() => calculateRecipePricing(50, 1, 'margin', 0, 100, 0)).toThrow(
      CalculationValidationError
    );
    // Rendimento zero
    expect(() => calculateRecipePricing(50, 0, 'margin', 0, 50, 0)).toThrow(
      CalculationValidationError
    );
    // Quantidade comprada zero
    expect(() => calculateBaseUnitCost(10, 0, 'kg')).toThrow(CalculationValidationError);
  });

  it('simula produção multiplicando rendimento e separando custos fixos e proporcionais', () => {
    // Exemplo do prompt:
    // Receita produz 15 fatias.
    // Deseja produzir 45 fatias (multiplicador 3x).
    const mockRecipe: Recipe = {
      id: 'rec-1',
      user_id: 'user-1',
      name: 'Torta de Limão',
      category: 'tortas',
      yield_quantity: 15,
      yield_unit: 'fatias',
      is_archived: false,
      pricing_method: 'margin',
      markup_percentage: 100,
      target_margin_percentage: 50,
      card_fee_percentage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          id: 'item-1',
          recipe_id: 'rec-1',
          item_type: 'ingredient',
          ingredient_id: 'ing-1',
          quantity: 200,
          unit: 'g',
          calculated_cost: 10, // R$ 10 for 200g
        },
      ],
      additional_costs: [
        {
          id: 'ac-1',
          recipe_id: 'rec-1',
          description: 'Embalagem por fatia',
          amount: 5,
          is_proportional: true, // Scales with batch
        },
        {
          id: 'ac-2',
          recipe_id: 'rec-1',
          description: 'Gás do forno (fornada)',
          amount: 8,
          is_proportional: false, // Fixed per batch
        },
      ],
    };

    const simulation = simulateRecipeProduction(mockRecipe, 45);

    expect(simulation.multiplier).toBe(3);
    expect(simulation.simulatedYield).toBe(45);
    // Ingredient scaled 200g * 3 = 600g, cost 10 * 3 = 30
    expect(simulation.scaledItems[0].simulatedQuantity).toBe(600);
    expect(simulation.scaledItems[0].totalCost).toBe(30);

    // Proportional cost scaled: 5 * 3 = 15
    const propCost = simulation.scaledAdditionalCosts.find((c) => c.description.includes('Embalagem'));
    expect(propCost?.simulatedAmount).toBe(15);

    // Fixed cost remains constant: 8
    const fixedCost = simulation.scaledAdditionalCosts.find((c) => c.description.includes('Gás'));
    expect(fixedCost?.simulatedAmount).toBe(8);

    // Total cost = 30 (ingredients) + 15 (prop) + 8 (fixed) = 53
    expect(simulation.newTotalCost).toBe(53);
  });

  describe('Cenários Obrigatórios do Prompt — Cadastro Simples de Ingredientes', () => {
    // Cenário 1: Cinco ovos a R$ 1,00 = R$ 5,00
    it('Cenário 1: Cinco ovos a R$ 1,00 = R$ 5,00', () => {
      const ovo: Pick<
        Ingredient,
        'package_quantity' | 'package_unit' | 'package_price' | 'cost_per_base_unit' | 'base_unit'
      > = {
        package_quantity: 1,
        package_unit: 'unidade',
        package_price: 1.0,
        cost_per_base_unit: 1.0,
        base_unit: 'unidade',
      };

      const custo = calculateIngredientItemCost(ovo, 5, 'unidade');
      expect(custo.toNumber()).toBe(5.0);
    });

    // Cenário 2: Duas caixas de leite condensado a R$ 10,00 = R$ 20,00
    it('Cenário 2: Duas caixas de leite condensado a R$ 10,00 = R$ 20,00', () => {
      const leiteCondensado: Pick<
        Ingredient,
        'package_quantity' | 'package_unit' | 'package_price' | 'cost_per_base_unit' | 'base_unit'
      > = {
        package_quantity: 1,
        package_unit: 'unidade',
        package_price: 10.0,
        cost_per_base_unit: 10.0,
        base_unit: 'unidade',
      };

      const custo = calculateIngredientItemCost(leiteCondensado, 2, 'unidade');
      expect(custo.toNumber()).toBe(20.0);
    });

    // Cenário 3: 350 ml de chantilly cadastrado como 1 L por R$ 39,00 = R$ 13,65
    it('Cenário 3: 350 ml de chantilly cadastrado como 1 L por R$ 39,00 = R$ 13,65', () => {
      const chantilly: Pick<
        Ingredient,
        'package_quantity' | 'package_unit' | 'package_price' | 'cost_per_base_unit' | 'base_unit'
      > = {
        package_quantity: 1,
        package_unit: 'L',
        package_price: 39.0,
        cost_per_base_unit: 0.039,
        base_unit: 'ml',
      };

      const custo = calculateIngredientItemCost(chantilly, 350, 'ml');
      expect(custo.toNumber()).toBe(13.65);
    });

    // Cenário 4: 250 g de farinha cadastrada como 1 kg por R$ 6,00 = R$ 1,50
    it('Cenário 4: 250 g de farinha cadastrada como 1 kg por R$ 6,00 = R$ 1,50', () => {
      const farinha: Pick<
        Ingredient,
        'package_quantity' | 'package_unit' | 'package_price' | 'cost_per_base_unit' | 'base_unit'
      > = {
        package_quantity: 1,
        package_unit: 'kg',
        package_price: 6.0,
        cost_per_base_unit: 0.006,
        base_unit: 'g',
      };

      const custo = calculateIngredientItemCost(farinha, 250, 'g');
      expect(custo.toNumber()).toBe(1.5);
    });

    // Cenário 5: Alteração do preço de um ingrediente recalcula todas as receitas relacionadas
    it('Cenário 5: Alteração do preço do chantilly (R$ 39 -> R$ 45) recalcula o custo da receita automaticamente', () => {
      const chantillyOriginal: Pick<
        Ingredient,
        'package_quantity' | 'package_unit' | 'package_price' | 'cost_per_base_unit' | 'base_unit'
      > = {
        package_quantity: 1,
        package_unit: 'L',
        package_price: 39.0,
        cost_per_base_unit: 0.039,
        base_unit: 'ml',
      };

      const custoOriginal = calculateIngredientItemCost(chantillyOriginal, 350, 'ml');
      expect(custoOriginal.toNumber()).toBe(13.65);

      // Confeiteira atualizou o preço do litro para R$ 45,00:
      const chantillyAtualizado = {
        ...chantillyOriginal,
        package_price: 45.0,
        cost_per_base_unit: 0.045,
      };

      // Receita sem sofrer alteração na quantidade utilizada recalcula automaticamente para R$ 15,75
      const custoAtualizado = calculateIngredientItemCost(chantillyAtualizado, 350, 'ml');
      expect(custoAtualizado.toNumber()).toBe(15.75);
    });

    // Cenário 6: Utilizar ingredientes em receitas não altera nenhum dado do cadastro original
    it('Cenário 6: Utilizar ingredientes em receitas não altera nenhum dado do cadastro original', () => {
      const ingredienteCadastro: Readonly<
        Pick<Ingredient, 'package_quantity' | 'package_unit' | 'package_price' | 'cost_per_base_unit' | 'base_unit'>
      > = Object.freeze({
        package_quantity: 1,
        package_unit: 'kg',
        package_price: 15.0,
        cost_per_base_unit: 0.015,
        base_unit: 'g',
      });

      // Cálculo de uso de 300g
      const custoUso = calculateIngredientItemCost(ingredienteCadastro, 300, 'g');
      expect(custoUso.toNumber()).toBe(4.5);

      // Objeto de cadastro permanece intocado
      expect(ingredienteCadastro.package_quantity).toBe(1);
      expect(ingredienteCadastro.package_unit).toBe('kg');
      expect(ingredienteCadastro.package_price).toBe(15.0);
    });

    it('impede quantidades fracionadas em ingredientes do tipo unidade', () => {
      const ovo: Pick<
        Ingredient,
        'package_quantity' | 'package_unit' | 'package_price' | 'cost_per_base_unit' | 'base_unit'
      > = {
        package_quantity: 1,
        package_unit: 'unidade',
        package_price: 1.0,
        cost_per_base_unit: 1.0,
        base_unit: 'unidade',
      };

      expect(() => calculateIngredientItemCost(ovo, 2.5, 'unidade')).toThrow(
        CalculationValidationError
      );
      expect(() => calculateIngredientItemCost(ovo, 3, 'g')).toThrow(
        UnitConversionError
      );
    });

    it('identifica duplicações de nomes ignorando maiúsculas e espaços extras', () => {
      expect(normalizeIngredientName('  Chantilly  ')).toBe('chantilly');
      expect(normalizeIngredientName('CHANTILLY')).toBe('chantilly');
      expect(normalizeIngredientName('Ovo ')).toBe(normalizeIngredientName('  ovo'));
    });
  });
});

