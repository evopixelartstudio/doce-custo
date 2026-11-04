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
  AlertTriangle,
  Clock,
  Search,
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
  getCompatibleRecipeUnits,
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

  // Search input for quick ingredient addition
  const [ingredientSearch, setIngredientSearch] = useState('');

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
      setAllRecipes(recs.filter((r) => r.id !== initialData?.id));
      setSettings(sets);

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
  } catch {
    // handled gracefully
  }

  // Item management handlers
  function addIngredientItem() {
    const firstIng = allIngredients[0];
    const defaultUnit = firstIng
      ? getCompatibleRecipeUnits(firstIng.package_unit)[0]
      : 'g';
    const defaultQty = firstIng?.package_unit === 'unidade' ? '1' : '100';

    setItems((prev) => [
      ...prev,
      {
        item_type: 'ingredient',
        ingredient_id: firstIng?.id || '',
        sub_recipe_id: '',
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
        item_type: 'ingredient',
        ingredient_id: ing.id,
        sub_recipe_id: '',
        quantity: defaultQty,
        unit: defaultUnit,
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

    for (const item of items) {
      const q = parseFloat(item.quantity.replace(',', '.'));
      if (isNaN(q) || q <= 0) {
        toast.error('Informe quantidades válidas maiores que zero em todos os itens.');
        return;
      }
      if (item.item_type === 'ingredient') {
        if (!item.ingredient_id) {
          toast.error('Selecione um ingrediente para todos os itens da receita.');
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
            <ArrowLeft className="h-5 w-5 text-[#4A2832]" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#4A2832] tracking-tight">
            {initialData ? `Editar ${initialData.name}` : 'Nova Receita'}
          </h1>
          <p className="text-xs text-[#7C6970]">
            Componha os ingredientes, custos fixos e precifique com margem segura.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-[#4A2832]">
              1. Dados Gerais da Receita
            </CardTitle>
            <CardDescription className="text-xs text-[#7C6970]">
              Identificação, rendimento e tempo de produção.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-[#5E4850]">
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
                <label className="text-xs font-semibold text-[#5E4850]">
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
                <label className="text-xs font-semibold text-[#5E4850] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#C86D7F]" />
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
                <label className="text-xs font-semibold text-[#5E4850]">
                  Rendimento da Receita *
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="Ex: 15"
                  value={yieldQuantity}
                  onChange={(e) => setYieldQuantity(e.target.value)}
                  className="h-11 text-base sm:text-sm font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Unidade do Rendimento *
                </label>
                <select
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value as YieldUnit)}
                  className="flex h-11 w-full rounded-xl border border-[#EFE4E6] bg-white px-3.5 py-2 text-sm text-[#2E2226] focus:border-[#C86D7F] focus:outline-none focus:ring-2 focus:ring-[#C86D7F]/20"
                >
                  {yieldUnits.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-[#5E4850]">
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
                <label className="text-xs font-semibold text-[#5E4850]">
                  Modo de Preparo / Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Bater os ovos com o açúcar, incorporar o chocolate delicadamente..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#EFE4E6] bg-white p-3 text-sm text-[#2E2226] focus:border-[#C86D7F] focus:outline-none focus:ring-2 focus:ring-[#C86D7F]/20"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Ingredients & Sub-recipes */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base text-[#4A2832]">
                2. Ingredientes e Sub-Receitas
              </CardTitle>
              <CardDescription className="text-xs text-[#7C6970]">
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
                <Plus className="h-3.5 w-3.5 mr-1 text-[#C86D7F]" />
                Ingrediente
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addSubRecipeItem}
                className="text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-[#C86D7F]" />
                Sub-Receita
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Quick Search and Add Ingredient Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8989E]" />
              <Input
                type="text"
                placeholder="Pesquisar e adicionar ingrediente rápido..."
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                className="pl-10 h-11 text-sm bg-[#FDFBF9]"
              />
              {ingredientSearch.trim() && (
                <div className="absolute left-0 right-0 top-12 z-30 bg-white border border-[#EFE4E6] rounded-2xl shadow-xl max-h-56 overflow-y-auto p-1.5 space-y-1">
                  {allIngredients
                    .filter((ing) => {
                      const term = ingredientSearch.trim().toLowerCase();
                      return (
                        ing.name.toLowerCase().includes(term) ||
                        (ing.brand && ing.brand.toLowerCase().includes(term))
                      );
                    })
                    .map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={() => {
                          addSpecificIngredient(ing);
                          setIngredientSearch('');
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FDF0F3] text-left text-xs transition-colors group"
                      >
                        <div>
                          <span className="font-semibold text-[#2E2226] group-hover:text-[#C86D7F]">
                            {ing.name}
                          </span>
                          <span className="text-[#8C7A82] ml-2 font-mono">
                            ({formatQuantity(ing.package_quantity)} {ing.package_unit} = {formatCurrency(ing.package_price)})
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#C86D7F] bg-[#FDF0F3] px-2 py-0.5 rounded-md group-hover:bg-[#C86D7F] group-hover:text-white transition-colors">
                          + Adicionar
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#7C6970] border border-dashed border-[#EFE4E6] rounded-2xl space-y-2">
                <Wheat className="h-8 w-8 text-[#C9B3B8] mx-auto" />
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
                  const ing = item.ingredient_id ? ingredientMap.get(item.ingredient_id) : undefined;
                  const compatibleUnits = ing
                    ? getCompatibleRecipeUnits(ing.package_unit)
                    : availableUnits.map((u) => u.value);

                  return (
                    <div
                      key={index}
                      className="p-3.5 rounded-2xl border border-[#EFE4E6] bg-[#FDFBF9] flex flex-col sm:flex-row sm:items-center gap-3"
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

                      {/* Item Selector & Reference Display */}
                      <div className="flex-1 min-w-0">
                        {item.item_type === 'ingredient' ? (
                          <div>
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
                        ) : (
                          <select
                            value={item.sub_recipe_id}
                            onChange={(e) =>
                              updateItem(index, { sub_recipe_id: e.target.value })
                            }
                            className="w-full h-11 sm:h-10 rounded-xl border border-[#EFE4E6] bg-white px-3 text-sm text-[#2E2226] font-medium focus:border-[#C86D7F] focus:outline-none"
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
                      <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
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
                            className="w-full sm:w-24 h-11 sm:h-10 text-sm font-mono font-medium"
                          />

                          <select
                            value={item.unit}
                            onChange={(e) =>
                              updateItem(index, {
                                unit: e.target.value as UnitType,
                              })
                            }
                            className="h-11 sm:h-10 rounded-xl border border-[#EFE4E6] bg-white px-2.5 text-sm text-[#2E2226] font-medium focus:border-[#C86D7F] focus:outline-none min-w-[70px]"
                          >
                            {compatibleUnits.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Calculated Cost Display & Delete */}
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

        {/* Section 3: Additional Costs */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base text-[#4A2832]">
                3. Custos Adicionais da Produção
              </CardTitle>
              <CardDescription className="text-xs text-[#7C6970]">
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
                {additionalCosts.map((ac, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-[#EFE4E6] bg-[#FDFBF9] flex flex-col sm:flex-row sm:items-center gap-3"
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
                        <span className="text-xs text-[#7C6970]">R$</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="0.00"
                          value={ac.amount}
                          onChange={(e) =>
                            updateAdditionalCost(idx, { amount: e.target.value })
                          }
                          className="w-24 h-10 sm:h-9 text-sm sm:text-xs font-mono"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-[#5E4850] cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={ac.is_proportional}
                          onChange={(e) =>
                            updateAdditionalCost(idx, {
                              is_proportional: e.target.checked,
                            })
                          }
                          className="rounded text-[#C86D7F] focus:ring-[#C86D7F]"
                        />
                        <span>Proporcional ao lote</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeAdditionalCost(idx)}
                        className="p-1 rounded text-[#968289] hover:text-[#C44D56] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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

        {/* Section 4: Pricing & Selling Price Calculator */}
        <Card className="border-[#F7D8DF] bg-white shadow-sm overflow-hidden">
          <div className="bg-[#FDF0F3] p-4 border-b border-[#F7D8DF]">
            <CardTitle className="text-base text-[#4A2832] flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#C86D7F]" />
              4. Precificação e Margem de Venda
            </CardTitle>
            <CardDescription className="text-xs text-[#6E4F57] mt-0.5">
              Escolha entre Acréscimo sobre custo (Markup) ou Margem desejada sobre o preço de venda.
            </CardDescription>
          </div>

          <CardContent className="p-5 space-y-6">
            {/* Grand Total Cost Summary Box */}
            <div className="p-4 rounded-2xl bg-[#FDFBF9] border border-[#EFE4E6] grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-[11px] uppercase font-semibold text-[#8C7A82] block">
                  Custo Total de Produção
                </span>
                <span className="text-xl font-bold font-mono text-[#4A2832]">
                  {formatCurrency(grandTotalCost.toNumber())}
                </span>
                <span className="text-xs text-[#968289] block">
                  Ingredientes + Custos Adicionais
                </span>
              </div>

              <div className="border-t sm:border-t-0 sm:border-l border-[#EFE4E6] pt-2 sm:pt-0 sm:pl-4">
                <span className="text-[11px] uppercase font-semibold text-[#8C7A82] block">
                  Custo por Unidade / Porção
                </span>
                <span className="text-xl font-bold font-mono text-[#C86D7F]">
                  {pricingResult
                    ? formatCurrency(pricingResult.costPerUnit)
                    : 'R$ 0,00'}
                </span>
                <span className="text-xs text-[#968289] block">
                  Dividido por {numYield} {yieldUnit}
                </span>
              </div>
            </div>

            {/* Method Chooser */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#4A2832] block">
                Método de Formação do Preço:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPricingMethod('margin')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    pricingMethod === 'margin'
                      ? 'border-[#C86D7F] bg-[#FDF0F3] shadow-sm'
                      : 'border-[#EFE4E6] bg-white hover:bg-[#FDFBF9]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-[#4A2832]">
                      Método B: Margem sobre Venda
                    </span>
                    {pricingMethod === 'margin' && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#C86D7F]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#7C6970] leading-tight">
                    Recomendado para comércio: fixa a porcentagem real do preço final que fica como lucro.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingMethod('markup')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    pricingMethod === 'markup'
                      ? 'border-[#C86D7F] bg-[#FDF0F3] shadow-sm'
                      : 'border-[#EFE4E6] bg-white hover:bg-[#FDFBF9]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-[#4A2832]">
                      Método A: Markup sobre Custo
                    </span>
                    {pricingMethod === 'markup' && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#C86D7F]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#7C6970] leading-tight">
                    Multiplica o custo por um fator (ex: 100% de acréscimo dobra o valor do custo).
                  </p>
                </button>
              </div>
            </div>

            {/* Percentages Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {pricingMethod === 'margin' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#5E4850]">
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
                  <span className="text-[10px] text-[#968289]">
                    Ex: 50% significa que metade do preço é lucro.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#5E4850]">
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
                  <span className="text-[10px] text-[#968289]">
                    Ex: 100% adiciona uma vez o valor do custo.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
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
                <span className="text-[10px] text-[#968289]">
                  Incide sobre o valor da venda.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
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
                <span className="text-[10px] text-[#968289]">
                  Deixe vazio para usar o sugerido.
                </span>
              </div>
            </div>

            {/* Results & Margins Panel */}
            {pricingResult && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#FDFBF9] border border-[#EFE4E6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#7C6970] block">
                      Preço de Venda Efetivo:
                    </span>
                    <span className="text-2xl font-bold font-mono text-[#4A2832]">
                      {formatCurrency(pricingResult.effectiveSalePrice)}
                    </span>
                    <span className="text-xs text-[#7C6970] block">
                      (Sugerido: {formatCurrency(pricingResult.suggestedSalePrice)})
                    </span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[11px] uppercase font-semibold text-[#8C7A82] block">
                        Lucro Bruto Estimado
                      </span>
                      <span className="text-base font-bold font-mono text-[#2D6A4F]">
                        + {formatCurrency(pricingResult.estimatedGrossProfit)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase font-semibold text-[#8C7A82] block">
                        Margem Resultante
                      </span>
                      <span className="text-base font-bold font-mono text-[#4A2832]">
                        {pricingResult.estimatedProfitMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warning Alert if manual price puts margin below target */}
                {pricingResult.isMarginBelowTarget && (
                  <div className="p-3.5 rounded-xl bg-[#FFF6EE] border border-[#FCE3CB] flex items-center gap-3 text-xs text-[#A6601A]">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-[#D97724]" />
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
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4">
          <Link href="/receitas" className="w-full sm:w-auto">
            <Button type="button" variant="outline" className="w-full sm:w-auto h-12 sm:h-10 text-sm font-medium">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 sm:h-10 font-semibold shadow-sm text-sm">
            <Save className="h-4 w-4 mr-1.5" />
            {loading ? 'Salvando...' : 'Salvar Receita & Ficha Técnica'}
          </Button>
        </div>
      </form>
    </div>
  );
}
