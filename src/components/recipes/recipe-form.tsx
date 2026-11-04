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
  BookOpenText,
  DollarSign,
  AlertTriangle,
  Info,
  Clock,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getIngredients,
  getRecipes,
  getUserSettings,
  saveRecipe,
} from '@/lib/data-service';
import type {
  Recipe,
  Ingredient,
  RecipeItem,
  AdditionalCost,
  UnitType,
  YieldUnit,
  PricingMethod,
  UserSettings,
} from '@/lib/types';
import {
  calculateIngredientItemCost,
  calculateSubRecipeItemCost,
  calculateRecipePricing,
  formatCurrency,
  formatQuantity,
  hasCircularDependency,
} from '@/lib/calculations';
import Decimal from 'decimal.js';
import { toast } from 'sonner';

interface RecipeFormProps {
  initialData?: Recipe | null;
}

const yieldUnits: { value: YieldUnit; label: string }[] = [
  { value: 'unidades', label: 'Unidades (doces, potes)' },
  { value: 'fatias', label: 'Fatias' },
  { value: 'porções', label: 'Porções' },
  { value: 'g', label: 'Gramas (g)' },
  { value: 'kg', label: 'Quilogramas (kg)' },
];

const availableUnits: { value: UnitType; label: string }[] = [
  { value: 'g', label: 'Gramas (g)' },
  { value: 'kg', label: 'Quilogramas (kg)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'unidade', label: 'Unidades (un)' },
];

export function RecipeForm({ initialData }: RecipeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Recipe basic fields
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || 'Bolos');
  const [description, setDescription] = useState(initialData?.description || '');
  const [photoUrl, setPhotoUrl] = useState(initialData?.photo_url || '');
  const [yieldQuantity, setYieldQuantity] = useState<string>(
    initialData ? String(initialData.yield_quantity) : '10'
  );
  const [yieldUnit, setYieldUnit] = useState<YieldUnit>(
    initialData?.yield_unit || 'unidades'
  );
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<string>(
    initialData?.prep_time_minutes ? String(initialData.prep_time_minutes) : '30'
  );

  // Pricing fields
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(
    initialData?.pricing_method || 'margin'
  );
  const [markupPercentage, setMarkupPercentage] = useState<string>(
    initialData ? String(initialData.markup_percentage) : '100'
  );
  const [targetMarginPercentage, setTargetMarginPercentage] = useState<string>(
    initialData ? String(initialData.target_margin_percentage) : '50'
  );
  const [cardFeePercentage, setCardFeePercentage] = useState<string>(
    initialData ? String(initialData.card_fee_percentage) : '3.5'
  );
  const [manualSalePrice, setManualSalePrice] = useState<string>(
    initialData?.manual_sale_price ? String(initialData.manual_sale_price) : ''
  );

  // Items (ingredients & sub-recipes)
  const [items, setItems] = useState<
    Array<{
      id?: string;
      item_type: 'ingredient' | 'sub_recipe';
      ingredient_id: string;
      sub_recipe_id: string;
      quantity: string;
      unit: UnitType;
    }>
  >(
    initialData?.items?.map((item) => ({
      id: item.id,
      item_type: item.item_type,
      ingredient_id: item.ingredient_id || '',
      sub_recipe_id: item.sub_recipe_id || '',
      quantity: String(item.quantity),
      unit: item.unit,
    })) || []
  );

  // Additional costs
  const [additionalCosts, setAdditionalCosts] = useState<
    Array<{
      id?: string;
      description: string;
      amount: string;
      is_proportional: boolean;
    }>
  >(
    initialData?.additional_costs?.map((ac) => ({
      id: ac.id,
      description: ac.description,
      amount: String(ac.amount),
      is_proportional: ac.is_proportional ?? true,
    })) || []
  );

  // Load available ingredients, recipes, and user settings
  useEffect(() => {
    async function init() {
      const [ings, recs, sets] = await Promise.all([
        getIngredients(false),
        getRecipes(false),
        getUserSettings(),
      ]);
      setAllIngredients(ings);
      // Filter out self to avoid selecting self as subrecipe
      setAllRecipes(recs.filter((r) => r.id !== initialData?.id));
      setSettings(sets);

      // If new recipe and no additional costs yet, prefill from defaults
      if (!initialData && additionalCosts.length === 0 && sets.default_additional_costs) {
        setAdditionalCosts(
          sets.default_additional_costs.map((dac) => ({
            description: dac.description,
            amount: String(dac.amount),
            is_proportional: dac.is_proportional,
          }))
        );
        setPricingMethod(sets.default_pricing_method);
        setMarkupPercentage(String(sets.default_markup_percentage));
        setTargetMarginPercentage(String(sets.default_target_margin_percentage));
        setCardFeePercentage(String(sets.default_card_fee_percentage));
      }
    }
    init();
  }, [initialData]);

  // Lookup maps
  const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]));
  const recipeMap = new Map(allRecipes.map((r) => [r.id, r]));

  // Calculate live costs of each item
  let totalIngredientsCost = new Decimal(0);
  const calculatedItems = items.map((item) => {
    let itemCost = new Decimal(0);
    const numQty = parseFloat(item.quantity.replace(',', '.')) || 0;

    if (item.item_type === 'ingredient' && item.ingredient_id) {
      const ing = ingredientMap.get(item.ingredient_id);
      if (ing && numQty > 0) {
        try {
          itemCost = calculateIngredientItemCost(ing, numQty, item.unit);
        } catch {
          itemCost = new Decimal(0);
        }
      }
    } else if (item.item_type === 'sub_recipe' && item.sub_recipe_id) {
      const sub = recipeMap.get(item.sub_recipe_id);
      if (sub && numQty > 0) {
        try {
          const subTotalCost = (sub.items || []).reduce((acc, subItem) => {
            return acc.plus(new Decimal(subItem.calculated_cost || 0));
          }, new Decimal(0));
          itemCost = calculateSubRecipeItemCost(sub, numQty, item.unit, subTotalCost);
        } catch {
          itemCost = new Decimal(0);
        }
      }
    }

    totalIngredientsCost = totalIngredientsCost.plus(itemCost);
    return { ...item, cost: itemCost.toNumber() };
  });

  // Calculate total additional costs
  let totalAdditionalCosts = new Decimal(0);
  for (const ac of additionalCosts) {
    const amt = parseFloat(ac.amount.replace(',', '.')) || 0;
    if (amt > 0) {
      totalAdditionalCosts = totalAdditionalCosts.plus(new Decimal(amt));
    }
  }

  const grandTotalCost = totalIngredientsCost.plus(totalAdditionalCosts);
  const numYield = parseFloat(yieldQuantity.replace(',', '.')) || 1;

  // Live pricing metrics
  let pricingResult = null;
  try {
    const numMarkup = parseFloat(markupPercentage.replace(',', '.')) || 0;
    const numMargin = parseFloat(targetMarginPercentage.replace(',', '.')) || 50;
    const numCardFee = parseFloat(cardFeePercentage.replace(',', '.')) || 0;
    const numManualPrice = manualSalePrice
      ? parseFloat(manualSalePrice.replace(',', '.'))
      : null;

    pricingResult = calculateRecipePricing(
      grandTotalCost,
      numYield > 0 ? numYield : 1,
      pricingMethod,
      numMarkup,
      numMargin,
      numCardFee,
      numManualPrice
    );
  } catch (err) {
    // Graceful fallback during input
  }

  // Item management handlers
  function addIngredientItem() {
    const firstIng = allIngredients[0];
    setItems((prev) => [
      ...prev,
      {
        item_type: 'ingredient',
        ingredient_id: firstIng?.id || '',
        sub_recipe_id: '',
        quantity: '100',
        unit: firstIng?.base_unit || 'g',
      },
    ]);
  }

  function addSubRecipeItem() {
    const firstRec = allRecipes[0];
    setItems((prev) => [
      ...prev,
      {
        item_type: 'sub_recipe',
        ingredient_id: '',
        sub_recipe_id: firstRec?.id || '',
        quantity: '100',
        unit: 'g',
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
      // When changing ingredient, adapt default unit to ingredient's unit
      if (patch.ingredient_id) {
        const ing = ingredientMap.get(patch.ingredient_id);
        if (ing) {
          copy[index].unit = ing.base_unit;
        }
      }
      return copy;
    });
  }

  // Additional costs handlers
  function addAdditionalCost() {
    setAdditionalCosts((prev) => [
      ...prev,
      {
        description: 'Outro custo',
        amount: '0.00',
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

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Informe o nome da receita.');
      return;
    }
    if (numYield <= 0) {
      toast.error('Informe um rendimento maior que zero.');
      return;
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos um ingrediente ou sub-receita.');
      return;
    }

    // Validate items
    for (const item of items) {
      const q = parseFloat(item.quantity.replace(',', '.'));
      if (isNaN(q) || q <= 0) {
        toast.error('Informe quantidades válidas maiores que zero em todos os itens.');
        return;
      }
      if (item.item_type === 'ingredient' && !item.ingredient_id) {
        toast.error('Selecione um ingrediente para todos os itens da receita.');
        return;
      }
      if (item.item_type === 'sub_recipe' && !item.sub_recipe_id) {
        toast.error('Selecione uma sub-receita válida.');
        return;
      }
    }

    setLoading(true);
    try {
      const recipePayload: any = {
        ...(initialData ? { id: initialData.id } : {}),
        name: name.trim(),
        category: category.trim() || 'Geral',
        description: description.trim() || null,
        photo_url: photoUrl.trim() || null,
        yield_quantity: numYield,
        yield_unit: yieldUnit,
        prep_time_minutes: prepTimeMinutes ? parseInt(prepTimeMinutes, 10) : null,
        pricing_method: pricingMethod,
        markup_percentage: parseFloat(markupPercentage.replace(',', '.')) || 0,
        target_margin_percentage:
          parseFloat(targetMarginPercentage.replace(',', '.')) || 50,
        card_fee_percentage: parseFloat(cardFeePercentage.replace(',', '.')) || 0,
        manual_sale_price: manualSalePrice
          ? parseFloat(manualSalePrice.replace(',', '.'))
          : null,
      };

      const itemsPayload: RecipeItem[] = items.map((i) => ({
        id: i.id || '',
        recipe_id: initialData?.id || '',
        item_type: i.item_type,
        ingredient_id: i.item_type === 'ingredient' ? i.ingredient_id : null,
        sub_recipe_id: i.item_type === 'sub_recipe' ? i.sub_recipe_id : null,
        quantity: parseFloat(i.quantity.replace(',', '.')),
        unit: i.unit,
      }));

      const costsPayload: AdditionalCost[] = additionalCosts.map((ac) => ({
        id: ac.id || '',
        description: ac.description,
        amount: parseFloat(ac.amount.replace(',', '.')) || 0,
        is_proportional: ac.is_proportional,
      }));

      const saved = await saveRecipe(recipePayload, itemsPayload, costsPayload);

      toast.success(
        initialData
          ? 'Receita atualizada com sucesso!'
          : 'Receita e ficha técnica criadas com sucesso!'
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link href="/receitas">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-5 w-5 text-[#35483E]" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#35483E] tracking-tight">
            {initialData ? `Editar ${initialData.name}` : 'Nova Receita'}
          </h1>
          <p className="text-xs text-[#6C7A72]">
            Componha os ingredientes, custos fixos e precifique com margem segura.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <Card className="border-[#E8E3DB] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-[#35483E]">
              1. Dados Gerais da Receita
            </CardTitle>
            <CardDescription className="text-xs">
              Identificação, rendimento e tempo de produção.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-[#38463E]">
                  Nome da Receita *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Bolo de Chocolate com Ninho, Brigadeiro Gourmet..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E]">
                  Categoria
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Bolos, Recheios, Tortas, Docinhos..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#6D8576]" />
                  Tempo de Preparo (minutos)
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 60"
                  value={prepTimeMinutes}
                  onChange={(e) => setPrepTimeMinutes(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E]">
                  Rendimento da Receita *
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Ex: 15"
                  value={yieldQuantity}
                  onChange={(e) => setYieldQuantity(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E]">
                  Unidade do Rendimento *
                </label>
                <select
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value as YieldUnit)}
                  className="flex h-11 w-full rounded-xl border border-[#E5E0D8] bg-white px-3.5 py-2 text-sm text-[#232C27] focus:border-[#6D8576] focus:outline-none focus:ring-2 focus:ring-[#6D8576]/20"
                >
                  {yieldUnits.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-[#38463E]">
                  Foto da Receita (URL ou Storage)
                </label>
                <Input
                  type="url"
                  placeholder="https://exemplo.com/foto-bolo.jpg (opcional)"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-[#38463E]">
                  Modo de Preparo / Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Bater os ovos com o açúcar, incorporar o chocolate delicadamente..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E0D8] bg-white p-3 text-sm text-[#232C27] focus:border-[#6D8576] focus:outline-none focus:ring-2 focus:ring-[#6D8576]/20"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Ingredients & Sub-recipes */}
        <Card className="border-[#E8E3DB] bg-white">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base text-[#35483E]">
                2. Ingredientes e Sub-Receitas
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione os ingredientes ou preparações já cadastradas e informe as quantidades.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addIngredientItem}
                className="text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-[#6D8576]" />
                Ingrediente
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addSubRecipeItem}
                className="text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-[#6D8576]" />
                Sub-Receita
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#7A8880] border border-dashed border-[#E5E0D8] rounded-2xl space-y-2">
                <Wheat className="h-8 w-8 text-[#A8B4AD] mx-auto" />
                <p>Nenhum item adicionado à receita ainda.</p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addIngredientItem}
                  >
                    Adicionar Ingrediente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={addSubRecipeItem}
                  >
                    Adicionar Sub-Receita
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item, index) => {
                  const calculatedCost = calculatedItems[index]?.cost || 0;

                  return (
                    <div
                      key={index}
                      className="p-3.5 rounded-2xl border border-[#E7E2D8] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      {/* Item Type Badge */}
                      <div className="shrink-0 flex items-center justify-between sm:justify-start gap-2">
                        <Badge
                          variant={
                            item.item_type === 'ingredient'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {item.item_type === 'ingredient'
                            ? 'Ingrediente'
                            : 'Sub-Receita'}
                        </Badge>
                      </div>

                      {/* Item Selector */}
                      <div className="flex-1 min-w-0">
                        {item.item_type === 'ingredient' ? (
                          <select
                            value={item.ingredient_id}
                            onChange={(e) =>
                              updateItem(index, { ingredient_id: e.target.value })
                            }
                            className="w-full h-10 rounded-xl border border-[#E5E0D8] bg-white px-3 text-xs text-[#28362F] font-medium focus:border-[#6D8576] focus:outline-none"
                          >
                            <option value="">Selecione um ingrediente...</option>
                            {allIngredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.brand || ing.category})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={item.sub_recipe_id}
                            onChange={(e) =>
                              updateItem(index, { sub_recipe_id: e.target.value })
                            }
                            className="w-full h-10 rounded-xl border border-[#E5E0D8] bg-white px-3 text-xs text-[#28362F] font-medium focus:border-[#6D8576] focus:outline-none"
                          >
                            <option value="">Selecione uma sub-receita...</option>
                            {allRecipes.map((rec) => (
                              <option key={rec.id} value={rec.id}>
                                {rec.name} (Rende {rec.yield_quantity}{' '}
                                {rec.yield_unit})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Quantity & Unit Inputs */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="any"
                          placeholder="Qtd"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, { quantity: e.target.value })
                          }
                          className="w-24 h-10 text-xs font-mono"
                        />

                        <select
                          value={item.unit}
                          onChange={(e) =>
                            updateItem(index, {
                              unit: e.target.value as UnitType,
                            })
                          }
                          className="h-10 rounded-xl border border-[#E5E0D8] bg-white px-2.5 text-xs text-[#28362F] focus:border-[#6D8576] focus:outline-none"
                        >
                          {availableUnits.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.value}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Calculated Cost Display */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 min-w-[110px]">
                        <span className="font-mono text-xs font-bold text-[#35483E]">
                          {formatCurrency(calculatedCost)}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-1.5 rounded-lg text-[#8C9890] hover:text-[#C85A54] hover:bg-[#FBEBEA] transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total Ingredients Cost Summary */}
            <div className="pt-2 flex justify-between items-center text-sm font-semibold border-t border-[#EAE5DC]">
              <span className="text-[#59695F]">Total dos Ingredientes:</span>
              <span className="font-mono text-base text-[#35483E]">
                {formatCurrency(totalIngredientsCost.toNumber())}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Additional Costs (Embalagem, Gás, Mão de Obra, etc.) */}
        <Card className="border-[#E8E3DB] bg-white">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base text-[#35483E]">
                3. Custos Adicionais da Produção
              </CardTitle>
              <CardDescription className="text-xs">
                Embalagem, gás, energia, mão de obra e transporte.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAdditionalCost}
              className="text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1 text-[#6D8576]" />
              Adicionar Custo
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            {additionalCosts.length === 0 ? (
              <p className="text-xs text-[#7A8880] py-2 text-center">
                Nenhum custo adicional adicionado a esta receita.
              </p>
            ) : (
              <div className="space-y-2">
                {additionalCosts.map((ac, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-[#E7E2D8] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <Input
                      type="text"
                      placeholder="Descrição do custo..."
                      value={ac.description}
                      onChange={(e) =>
                        updateAdditionalCost(idx, {
                          description: e.target.value,
                        })
                      }
                      className="flex-1 h-9 text-xs"
                    />

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#6F7D74]">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={ac.amount}
                          onChange={(e) =>
                            updateAdditionalCost(idx, { amount: e.target.value })
                          }
                          className="w-24 h-9 text-xs font-mono"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-[#4E5B53] cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={ac.is_proportional}
                          onChange={(e) =>
                            updateAdditionalCost(idx, {
                              is_proportional: e.target.checked,
                            })
                          }
                          className="rounded text-[#6D8576] focus:ring-[#6D8576]"
                        />
                        <span>Proporcional ao lote</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeAdditionalCost(idx)}
                        className="p-1 rounded text-[#8C9890] hover:text-[#C85A54] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-between items-center text-sm font-semibold border-t border-[#EAE5DC]">
              <span className="text-[#59695F]">Total dos Custos Adicionais:</span>
              <span className="font-mono text-base text-[#35483E]">
                {formatCurrency(totalAdditionalCosts.toNumber())}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Pricing & Selling Price Calculator */}
        <Card className="border-[#6D8576]/30 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#EFF5F1] p-4 border-b border-[#D5E3DB]">
            <CardTitle className="text-base text-[#35483E] flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#6D8576]" />
              4. Precificação e Margem de Venda
            </CardTitle>
            <CardDescription className="text-xs text-[#526359] mt-0.5">
              Escolha entre Acréscimo sobre custo (Markup) ou Margem desejada sobre o preço de venda.
            </CardDescription>
          </div>

          <CardContent className="p-5 space-y-6">
            {/* Grand Total Cost Summary Box */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E7E2D8] grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-[11px] uppercase font-semibold text-[#6C7A72] block">
                  Custo Total de Produção
                </span>
                <span className="text-xl font-bold font-mono text-[#35483E]">
                  {formatCurrency(grandTotalCost.toNumber())}
                </span>
                <span className="text-xs text-[#7B8880] block">
                  Ingredientes + Custos Adicionais
                </span>
              </div>

              <div className="border-t sm:border-t-0 sm:border-l border-[#E5E0D8] pt-2 sm:pt-0 sm:pl-4">
                <span className="text-[11px] uppercase font-semibold text-[#6C7A72] block">
                  Custo por Unidade / Porção
                </span>
                <span className="text-xl font-bold font-mono text-[#6D8576]">
                  {pricingResult
                    ? formatCurrency(pricingResult.costPerUnit)
                    : 'R$ 0,00'}
                </span>
                <span className="text-xs text-[#7B8880] block">
                  Dividido por {numYield} {yieldUnit}
                </span>
              </div>
            </div>

            {/* Method Chooser */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#38463E] block">
                Método de Formação do Preço:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPricingMethod('margin')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    pricingMethod === 'margin'
                      ? 'border-[#6D8576] bg-[#EFF5F1] shadow-sm'
                      : 'border-[#E5E0D8] bg-white hover:bg-[#FAF8F5]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-[#35483E]">
                      Método B: Margem sobre Venda
                    </span>
                    {pricingMethod === 'margin' && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#6D8576]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#69766F] leading-tight">
                    Recomendado para comércio: fixa a porcentagem real do preço final que fica como lucro.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingMethod('markup')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    pricingMethod === 'markup'
                      ? 'border-[#6D8576] bg-[#EFF5F1] shadow-sm'
                      : 'border-[#E5E0D8] bg-white hover:bg-[#FAF8F5]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-[#35483E]">
                      Método A: Markup sobre Custo
                    </span>
                    {pricingMethod === 'markup' && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#6D8576]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#69766F] leading-tight">
                    Multiplica o custo por um fator (ex: 100% de acréscimo dobra o valor do custo).
                  </p>
                </button>
              </div>
            </div>

            {/* Percentages Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {pricingMethod === 'margin' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#38463E]">
                    Margem Desejada (%) *
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="99"
                    value={targetMarginPercentage}
                    onChange={(e) => setTargetMarginPercentage(e.target.value)}
                    required
                  />
                  <span className="text-[10px] text-[#78857E]">
                    Ex: 50% significa que metade do preço é lucro.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#38463E]">
                    Markup Desejado (%) *
                  </label>
                  <Input
                    type="number"
                    step="5"
                    min="0"
                    value={markupPercentage}
                    onChange={(e) => setMarkupPercentage(e.target.value)}
                    required
                  />
                  <span className="text-[10px] text-[#78857E]">
                    Ex: 100% adiciona uma vez o valor do custo.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E]">
                  Taxa de Cartão / Gateway (%)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={cardFeePercentage}
                  onChange={(e) => setCardFeePercentage(e.target.value)}
                />
                <span className="text-[10px] text-[#78857E]">
                  Incide sobre o valor da venda.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#38463E]">
                  Preço Manual Praticado (R$)
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
                />
                <span className="text-[10px] text-[#78857E]">
                  Deixe vazio para usar o sugerido.
                </span>
              </div>
            </div>

            {/* Results & Margins Panel */}
            {pricingResult && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E7E2D8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#6F7D74] block">
                      Preço de Venda Efetivo:
                    </span>
                    <span className="text-2xl font-bold font-mono text-[#35483E]">
                      {formatCurrency(pricingResult.effectiveSalePrice)}
                    </span>
                    <span className="text-xs text-[#6F7D74] block">
                      (Sugerido: {formatCurrency(pricingResult.suggestedSalePrice)})
                    </span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[11px] uppercase font-semibold text-[#7E8B83] block">
                        Lucro Bruto Estimado
                      </span>
                      <span className="text-base font-bold font-mono text-[#477A57]">
                        + {formatCurrency(pricingResult.estimatedGrossProfit)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase font-semibold text-[#7E8B83] block">
                        Margem Resultante
                      </span>
                      <span className="text-base font-bold font-mono text-[#35483E]">
                        {pricingResult.estimatedProfitMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warning Alert if manual price puts margin below target */}
                {pricingResult.isMarginBelowTarget && (
                  <div className="p-3.5 rounded-xl bg-[#FEF6EC] border border-[#F9E2C3] flex items-center gap-3 text-xs text-[#9A5A0A]">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-[#E08A1E]" />
                    <span>
                      Atenção: Com o preço manual informado de{' '}
                      <strong>{formatCurrency(pricingResult.effectiveSalePrice)}</strong>, a sua margem de lucro ficou em{' '}
                      <strong>{pricingResult.estimatedProfitMargin.toFixed(1)}%</strong>, abaixo da sua meta desejada de{' '}
                      <strong>{targetMarginPercentage}%</strong>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link href="/receitas">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="font-semibold shadow-sm">
            <Save className="h-4 w-4 mr-1.5" />
            {loading ? 'Salvando...' : 'Salvar Receita & Ficha Técnica'}
          </Button>
        </div>
      </form>
    </div>
  );
}
