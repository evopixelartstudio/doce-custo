'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Wheat,
  DollarSign,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  getIngredients,
  getUserSettings,
  saveRecipe,
} from '@/lib/data-service';
import type {
  Recipe,
  Ingredient,
  RecipeItem,
  AdditionalCost,
  UnitType,
  AdditionalCostType,
} from '@/lib/types';
import {
  calculateIngredientItemCost,
  calculateRecipePricing,
  formatCurrency,
  formatQuantity,
  getCompatibleRecipeUnits,
} from '@/lib/calculations';
import Decimal from 'decimal.js';
import { toast } from 'sonner';

interface RecipeFormProps {
  initialData?: Recipe | null;
}

export function RecipeForm({ initialData }: RecipeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);

  // 1. Dados da Receita - Somente o nome da receita é suficiente (rendimento padrão 1)
  const [name, setName] = useState(initialData?.name || '');
  const [yieldQuantity, setYieldQuantity] = useState<string>(
    initialData ? String(initialData.yield_quantity || 1) : '1'
  );

  // 2. Ingredientes da Receita
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [items, setItems] = useState<
    Array<{
      id?: string;
      ingredient_id: string;
      quantity: string;
      unit: UnitType;
    }>
  >(
    initialData?.items
      ?.filter((item) => item.item_type === 'ingredient' && item.ingredient_id)
      ?.map((item) => ({
        id: item.id,
        ingredient_id: item.ingredient_id || '',
        quantity: String(item.quantity),
        unit: item.unit,
      })) || []
  );

  // 3. Custos adicionais (Gás e energia, Mão de obra, Embalagem com opção de R$ ou %)
  const [additionalCosts, setAdditionalCosts] = useState<
    Array<{
      id?: string;
      description: string;
      amount: string;
      cost_type: AdditionalCostType;
      is_proportional: boolean;
    }>
  >(() => {
    if (initialData?.additional_costs && initialData.additional_costs.length > 0) {
      return initialData.additional_costs.map((ac) => ({
        id: ac.id,
        description: ac.description,
        amount: String(ac.amount),
        cost_type: ac.cost_type || (ac.description.includes('%') ? 'percentage' : 'fixed'),
        is_proportional: ac.is_proportional ?? true,
      }));
    }
    return [
      { description: 'Embalagem', amount: '0', cost_type: 'fixed', is_proportional: true },
      { description: 'Gás e energia', amount: '10', cost_type: 'percentage', is_proportional: true },
      { description: 'Mão de obra', amount: '20', cost_type: 'percentage', is_proportional: true },
    ];
  });

  // 4. Precificação simplificada (Margem de lucro % e Preço de venda)
  const [targetMarginPercentage, setTargetMarginPercentage] = useState<string>(
    initialData ? String(initialData.target_margin_percentage || 50) : '50'
  );
  const [manualSalePrice, setManualSalePrice] = useState<string>(
    initialData?.manual_sale_price ? String(initialData.manual_sale_price) : ''
  );

  // Carregar ingredientes do catálogo
  useEffect(() => {
    async function init() {
      const ings = await getIngredients(false);
      setAllIngredients(ings);
    }
    init();
  }, []);

  const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]));

  // Cálculo ao vivo do custo dos ingredientes
  let totalIngredientsCost = new Decimal(0);
  const calculatedItems = items.map((item) => {
    let itemCost = new Decimal(0);
    const numQty = parseFloat(item.quantity.replace(',', '.')) || 0;

    if (item.ingredient_id) {
      const ing = ingredientMap.get(item.ingredient_id);
      if (ing && numQty > 0) {
        try {
          itemCost = calculateIngredientItemCost(ing, numQty, item.unit);
        } catch {
          itemCost = new Decimal(0);
        }
      }
    }

    totalIngredientsCost = totalIngredientsCost.plus(itemCost);
    return { ...item, cost: itemCost.toNumber() };
  });

  // Cálculo ao vivo dos custos adicionais (R$ fixo ou % sobre os ingredientes)
  let totalAdditionalCosts = new Decimal(0);
  const calculatedAdditionalCosts = additionalCosts.map((ac) => {
    const rawVal = parseFloat(ac.amount.replace(',', '.')) || 0;
    let costInReais = new Decimal(0);

    if (rawVal > 0) {
      if (ac.cost_type === 'percentage') {
        costInReais = totalIngredientsCost.times(new Decimal(rawVal).dividedBy(100));
      } else {
        costInReais = new Decimal(rawVal);
      }
    }

    totalAdditionalCosts = totalAdditionalCosts.plus(costInReais);
    return { ...ac, costInReais: costInReais.toNumber() };
  });

  const grandTotalCost = totalIngredientsCost.plus(totalAdditionalCosts);
  const numYield = parseFloat(yieldQuantity.replace(',', '.')) || 1;

  // Precificação ao vivo
  let pricingResult = null;
  try {
    const numMargin = parseFloat(targetMarginPercentage.replace(',', '.')) || 50;
    const numManualPrice = manualSalePrice
      ? parseFloat(manualSalePrice.replace(',', '.'))
      : null;

    pricingResult = calculateRecipePricing(
      grandTotalCost,
      numYield > 0 ? numYield : 1,
      'margin',
      0,
      numMargin,
      0,
      numManualPrice
    );
  } catch {
    pricingResult = null;
  }

  // Filtrar ingredientes na pesquisa rápida
  const filteredQuickIngredients = ingredientSearch.trim()
    ? allIngredients
        .filter((ing) =>
          ing.name.toLowerCase().includes(ingredientSearch.toLowerCase())
        )
        .slice(0, 6)
    : [];

  function addIngredientItem() {
    const firstIng = allIngredients[0];
    const defaultUnit = firstIng
      ? getCompatibleRecipeUnits(firstIng.package_unit)[0]
      : 'g';
    const defaultQty = firstIng?.package_unit === 'unidade' ? '1' : '100';

    setItems((prev) => [
      ...prev,
      {
        ingredient_id: firstIng?.id || '',
        quantity: defaultQty,
        unit: defaultUnit,
      },
    ]);
  }

  function addSpecificIngredient(ing: Ingredient) {
    const defaultUnit = getCompatibleRecipeUnits(ing.package_unit)[0];
    const defaultQty = ing.package_unit === 'unidade' ? '1' : '100';

    setItems((prev) => [
      ...prev,
      {
        ingredient_id: ing.id,
        quantity: defaultQty,
        unit: defaultUnit,
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateItem(index: number, patch: Partial<(typeof items)[0]>) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      if (patch.ingredient_id) {
        const ing = ingredientMap.get(patch.ingredient_id);
        if (ing) {
          const compatible = getCompatibleRecipeUnits(ing.package_unit);
          if (!compatible.includes(copy[index].unit)) {
            copy[index].unit = compatible[0];
          }
          if (ing.package_unit === 'unidade') {
            copy[index].quantity = Math.max(1, Math.round(parseFloat(copy[index].quantity) || 1)).toString();
          }
        }
      }
      return copy;
    });
  }

  function addAdditionalCost() {
    setAdditionalCosts((prev) => [
      ...prev,
      {
        description: 'Outro custo',
        amount: '0',
        cost_type: 'fixed',
        is_proportional: true,
      },
    ]);
  }

  function removeAdditionalCost(index: number) {
    setAdditionalCosts((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateAdditionalCost(index: number, patch: Partial<(typeof additionalCosts)[0]>) {
    setAdditionalCosts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Informe o nome da receita.');
      return;
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos um ingrediente.');
      return;
    }

    for (const item of items) {
      const q = parseFloat(item.quantity.replace(',', '.'));
      if (isNaN(q) || q <= 0) {
        toast.error('Informe quantidades válidas maiores que zero em todos os ingredientes.');
        return;
      }
      if (!item.ingredient_id) {
        toast.error('Selecione um ingrediente válido.');
        return;
      }
      const ing = ingredientMap.get(item.ingredient_id);
      if (ing?.package_unit === 'unidade' && !Number.isInteger(q)) {
        toast.error(
          `O ingrediente "${ing.name}" foi cadastrado como unidade e aceita somente quantidades inteiras (1, 2, 3, 4...).`
        );
        return;
      }
    }

    setLoading(true);
    try {
      const recipePayload: any = {
        ...(initialData ? { id: initialData.id } : {}),
        name: name.trim(),
        category: 'Geral',
        description: null,
        photo_url: null,
        yield_quantity: numYield > 0 ? numYield : 1,
        yield_unit: 'unidades',
        prep_time_minutes: null,
        pricing_method: 'margin',
        markup_percentage: 0,
        target_margin_percentage:
          parseFloat(targetMarginPercentage.replace(',', '.')) || 50,
        card_fee_percentage: 0,
        manual_sale_price: manualSalePrice
          ? parseFloat(manualSalePrice.replace(',', '.'))
          : null,
      };

      const itemsPayload: RecipeItem[] = items.map((i) => ({
        id: i.id || '',
        recipe_id: initialData?.id || '',
        item_type: 'ingredient',
        ingredient_id: i.ingredient_id,
        sub_recipe_id: null,
        quantity: parseFloat(i.quantity.replace(',', '.')),
        unit: i.unit,
      }));

      const costsPayload: AdditionalCost[] = calculatedAdditionalCosts.map((ac) => ({
        id: ac.id || '',
        description: ac.description,
        amount: parseFloat(ac.amount.replace(',', '.')) || 0,
        cost_type: ac.cost_type,
        is_proportional: ac.is_proportional,
      }));

      const saved = await saveRecipe(recipePayload, itemsPayload, costsPayload);

      toast.success(
        initialData
          ? 'Receita atualizada com sucesso!'
          : 'Receita salva com sucesso!'
      );
      router.push(`/receitas/${saved.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar receita.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex items-center gap-4">
        <Link href="/receitas">
          <Button variant="ghost" size="icon" className="rounded-full text-[#7C6970] hover:text-[#4A2832]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#4A2832] tracking-tight">
            {initialData ? `Editar ${initialData.name}` : 'Nova Receita'}
          </h1>
          <p className="text-xs text-[#7C6970]">
            Cadastre os ingredientes e custos para calcular o valor de produção e venda automaticamente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Dados da Receita - Só o nome é suficiente */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#4A2832]">
              1. Identificação da Receita
            </CardTitle>
            <CardDescription className="text-xs text-[#7C6970]">
              Informe o nome da receita que você vai produzir.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5 sm:col-span-3">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Nome da Receita *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Bolo de Chocolate, Brigadeiro Gourmet, Torta de Morango..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 text-base font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-xs font-semibold text-[#5E4850]" title="Rendimento em unidades ou porções">
                  Rendimento (unidades)
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={yieldQuantity}
                  onChange={(e) => setYieldQuantity(e.target.value)}
                  className="h-12 text-base font-mono font-semibold text-center"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Ingredientes da Receita */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base text-[#4A2832]">
                2. Ingredientes da Receita
              </CardTitle>
              <CardDescription className="text-xs text-[#7C6970]">
                Selecione os ingredientes cadastrados e informe as quantidades utilizadas.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addIngredientItem}
              className="text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1 text-[#C86D7F]" />
              Adicionar Ingrediente
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Quick search input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#968289]" />
              <Input
                type="text"
                placeholder="Pesquisar e adicionar ingrediente rápido..."
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                className="pl-10 h-10 text-sm bg-[#FDFBF9] border-[#EFE4E6]"
              />
            </div>

            {/* Quick Suggestions Pills */}
            {filteredQuickIngredients.length > 0 && (
              <div className="p-3 bg-[#FDF0F3] rounded-xl border border-[#F7D8DF] space-y-1.5">
                <span className="text-[11px] font-semibold text-[#8A3E50] block">
                  Clique para adicionar à receita:
                </span>
                <div className="flex flex-wrap gap-2">
                  {filteredQuickIngredients.map((ing) => (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() => {
                        addSpecificIngredient(ing);
                        setIngredientSearch('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#EFE4E6] text-xs font-medium text-[#4A2832] hover:bg-[#C86D7F] hover:text-white transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="h-3 w-3" />
                      <span>{ing.name}</span>
                      <span className="text-[10px] opacity-75">
                        ({formatQuantity(ing.package_quantity)} {ing.package_unit} = {formatCurrency(ing.package_price)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ingredients Items List */}
            {items.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-[#EFE4E6] rounded-2xl bg-[#FDFBF9]/50">
                <Wheat className="h-8 w-8 mx-auto text-[#C86D7F]/60 mb-2" />
                <p className="text-sm font-semibold text-[#4A2832]">
                  Nenhum ingrediente adicionado
                </p>
                <p className="text-xs text-[#7C6970] mt-1 max-w-sm mx-auto">
                  Pesquise no campo acima ou clique no botão para adicionar os ingredientes.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={addIngredientItem}
                  className="mt-4 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar Primeiro Ingrediente
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item, index) => {
                  const calculatedCost = calculatedItems[index]?.cost || 0;
                  const ing = item.ingredient_id ? ingredientMap.get(item.ingredient_id) : undefined;
                  const compatibleUnits = ing
                    ? getCompatibleRecipeUnits(ing.package_unit)
                    : ['g', 'kg', 'ml', 'L', 'unidade'];

                  return (
                    <div
                      key={index}
                      className="p-3.5 rounded-2xl border border-[#EFE4E6] bg-[#FDFBF9] flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      {/* Ingredient Selector */}
                      <div className="flex-1 min-w-0">
                        <select
                          value={item.ingredient_id}
                          onChange={(e) =>
                            updateItem(index, { ingredient_id: e.target.value })
                          }
                          className="w-full h-11 sm:h-10 rounded-xl border border-[#EFE4E6] bg-white px-3 text-sm text-[#2E2226] font-medium focus:border-[#C86D7F] focus:outline-none"
                        >
                          <option value="">Selecione um ingrediente...</option>
                          {allIngredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({formatQuantity(i.package_quantity)} {i.package_unit} = {formatCurrency(i.package_price)})
                            </option>
                          ))}
                        </select>
                        {ing && (
                          <span className="text-[11px] text-[#7C6970] block mt-1">
                            Cadastrado: <strong>{formatQuantity(ing.package_quantity)} {ing.package_unit}</strong> = <strong>{formatCurrency(ing.package_price)}</strong>
                          </span>
                        )}
                      </div>

                      {/* Quantity & Unit */}
                      <div className="flex items-center gap-2">
                        <div className="w-24 sm:w-28">
                          <Input
                            type="number"
                            inputMode={ing?.package_unit === 'unidade' ? 'numeric' : 'decimal'}
                            step={ing?.package_unit === 'unidade' ? '1' : 'any'}
                            min={ing?.package_unit === 'unidade' ? '1' : '0.001'}
                            placeholder="Qtd"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, { quantity: e.target.value })
                            }
                            className="h-11 sm:h-10 text-sm font-mono font-medium"
                          />
                        </div>

                        <div className="w-24 sm:w-28">
                          <select
                            value={item.unit}
                            onChange={(e) =>
                              updateItem(index, { unit: e.target.value as UnitType })
                            }
                            className="w-full h-11 sm:h-10 rounded-xl border border-[#EFE4E6] bg-white px-2.5 text-xs font-semibold text-[#4A2832] focus:border-[#C86D7F] focus:outline-none"
                          >
                            {compatibleUnits.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Calculated Cost & Delete */}
                        <div className="flex items-center justify-end gap-2.5 min-w-[95px] shrink-0">
                          <span className="font-mono text-sm font-bold text-[#4A2832]">
                            {formatCurrency(calculatedCost)}
                          </span>

                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-2 sm:p-1.5 rounded-xl text-[#968289] hover:text-[#C44D56] hover:bg-[#FDF2F3] active:bg-[#FDF2F3] transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total Ingredients Cost Summary */}
            <div className="pt-2 flex justify-between items-center text-sm font-semibold border-t border-[#EFE4E6]">
              <span className="text-[#6E4F57]">Total dos Ingredientes:</span>
              <span className="font-mono text-base text-[#4A2832]">
                {formatCurrency(totalIngredientsCost.toNumber())}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Custos Adicionais da Produção (Gás, energia, mão de obra em R$ ou %) */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base text-[#4A2832]">
                3. Custos Adicionais da Produção
              </CardTitle>
              <CardDescription className="text-xs text-[#7C6970]">
                Embalagem, gás, energia e mão de obra (podem ser definidos em R$ fixo ou em % sobre os ingredientes).
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAdditionalCost}
              className="text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1 text-[#C86D7F]" />
              Adicionar Custo
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            {additionalCosts.length === 0 ? (
              <p className="text-xs text-[#7C6970] py-2 text-center">
                Nenhum custo adicional adicionado a esta receita.
              </p>
            ) : (
              <div className="space-y-2">
                {calculatedAdditionalCosts.map((ac, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-[#EFE4E6] bg-[#FDFBF9] flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <Input
                      type="text"
                      placeholder="Descrição (ex: Gás e energia, Mão de obra...)"
                      value={ac.description}
                      onChange={(e) =>
                        updateAdditionalCost(idx, {
                          description: e.target.value,
                        })
                      }
                      className="flex-1 h-10 text-xs font-medium"
                    />

                    <div className="flex items-center gap-2">
                      {/* Toggle R$ vs % */}
                      <div className="flex rounded-lg border border-[#EFE4E6] p-0.5 bg-white">
                        <button
                          type="button"
                          onClick={() => updateAdditionalCost(idx, { cost_type: 'fixed' })}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                            ac.cost_type === 'fixed'
                              ? 'bg-[#C86D7F] text-white shadow-xs'
                              : 'text-[#7C6970] hover:text-[#4A2832]'
                          }`}
                        >
                          R$
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAdditionalCost(idx, { cost_type: 'percentage' })}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                            ac.cost_type === 'percentage'
                              ? 'bg-[#C86D7F] text-white shadow-xs'
                              : 'text-[#7C6970] hover:text-[#4A2832]'
                          }`}
                        >
                          %
                        </button>
                      </div>

                      {/* Input for Amount */}
                      <div className="w-24">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          placeholder={ac.cost_type === 'percentage' ? 'Ex: 10' : '0.00'}
                          value={ac.amount}
                          onChange={(e) =>
                            updateAdditionalCost(idx, { amount: e.target.value })
                          }
                          className="h-10 text-xs font-mono font-bold"
                        />
                      </div>

                      {/* Live Calculated Equivalent */}
                      <div className="min-w-[85px] text-right font-mono text-xs font-bold text-[#4A2832]">
                        {formatCurrency(ac.costInReais)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAdditionalCost(idx)}
                        className="p-1.5 rounded-lg text-[#968289] hover:text-[#C44D56] hover:bg-[#FDF2F3] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-between items-center text-sm font-semibold border-t border-[#EFE4E6]">
              <span className="text-[#6E4F57]">Total dos Custos Adicionais:</span>
              <span className="font-mono text-base text-[#4A2832]">
                {formatCurrency(totalAdditionalCosts.toNumber())}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Precificação e Margem de Lucro */}
        <Card className="border-[#F7D8DF] bg-white shadow-sm overflow-hidden">
          <div className="bg-[#FDF0F3] p-4 border-b border-[#F7D8DF]">
            <CardTitle className="text-base text-[#4A2832] flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#C86D7F]" />
              4. Precificação e Preço de Venda
            </CardTitle>
            <CardDescription className="text-xs text-[#6E4F57] mt-0.5">
              Defina a sua margem de lucro para calcular automaticamente o preço de venda sugerido.
            </CardDescription>
          </div>

          <CardContent className="p-5 space-y-6">
            {/* Box Custo Total */}
            <div className="p-4 rounded-2xl bg-[#FDFBF9] border border-[#EFE4E6] grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-[11px] uppercase font-semibold text-[#8C7A82] block">
                  Custo Total de Produção
                </span>
                <span className="text-2xl font-bold font-mono text-[#4A2832]">
                  {formatCurrency(grandTotalCost.toNumber())}
                </span>
                <span className="text-xs text-[#968289] block">
                  Ingredientes + Custos Adicionais
                </span>
              </div>

              <div className="border-t sm:border-t-0 sm:border-l border-[#EFE4E6] pt-2 sm:pt-0 sm:pl-4">
                <span className="text-[11px] uppercase font-semibold text-[#8C7A82] block">
                  Custo por Unidade
                </span>
                <span className="text-2xl font-bold font-mono text-[#C86D7F]">
                  {pricingResult
                    ? formatCurrency(pricingResult.costPerUnit)
                    : 'R$ 0,00'}
                </span>
                <span className="text-xs text-[#968289] block">
                  Dividido por {numYield} unidade{numYield > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Inputs de Margem e Preço */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Margem de Lucro Desejada (%) *
                </label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="99"
                  value={targetMarginPercentage}
                  onChange={(e) => setTargetMarginPercentage(e.target.value)}
                  className="h-11 text-base font-mono font-bold"
                  required
                />
                <span className="text-[10px] text-[#968289]">
                  Ex: 50% significa que metade do preço final é lucro.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Preço Praticado Manualmente (R$)
                </label>
                <Input
                  type="number"
                  step="0.50"
                  placeholder={
                    pricingResult
                      ? formatCurrency(pricingResult.suggestedSalePrice)
                      : 'Opcional'
                  }
                  value={manualSalePrice}
                  onChange={(e) => setManualSalePrice(e.target.value)}
                  className="h-11 text-base font-mono font-bold"
                />
                <span className="text-[10px] text-[#968289]">
                  Deixe vazio para usar exatamente o preço sugerido.
                </span>
              </div>
            </div>

            {/* Resultados de Venda e Lucro */}
            {pricingResult && (
              <div className="p-4 rounded-2xl bg-[#FDFBF9] border border-[#EFE4E6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-medium text-[#7C6970] block">
                    Preço de Venda Final:
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#4A2832]">
                    {formatCurrency(pricingResult.effectiveSalePrice)}
                  </span>
                  <span className="text-xs text-[#7C6970] block">
                    (Sugerido pelo sistema: {formatCurrency(pricingResult.suggestedSalePrice)})
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[11px] uppercase font-semibold text-[#8C7A82] block">
                      Lucro Estimado
                    </span>
                    <span className="text-lg font-bold font-mono text-[#2D6A4F]">
                      + {formatCurrency(pricingResult.estimatedGrossProfit)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] uppercase font-semibold text-[#8C7A82] block">
                      Margem Real
                    </span>
                    <span className="text-lg font-bold font-mono text-[#4A2832]">
                      {pricingResult.estimatedProfitMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4">
          <Link href="/receitas" className="w-full sm:w-auto">
            <Button type="button" variant="outline" className="w-full sm:w-auto h-12 sm:h-10 text-sm font-medium">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 sm:h-10 font-semibold shadow-sm text-sm">
            <Save className="h-4 w-4 mr-1.5" />
            {loading ? 'Salvando...' : 'Salvar Receita'}
          </Button>
        </div>
      </form>
    </div>
  );
}
