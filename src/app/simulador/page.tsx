'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Wheat,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getRecipes } from '@/lib/data-service';
import type { Recipe, SimulationResult } from '@/lib/types';
import {
  simulateRecipeProduction,
  formatCurrency,
  formatQuantity,
} from '@/lib/calculations';
import { toast } from 'sonner';

function SimuladorContent() {
  const searchParams = useSearchParams();
  const initialRecipeId = searchParams.get('recipeId') || '';

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(initialRecipeId);
  const [desiredYield, setDesiredYield] = useState<string>('');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list = await getRecipes(false);
        setRecipes(list);

        const target = list.find((r) => r.id === initialRecipeId) || list[0];
        if (target) {
          setSelectedRecipeId(target.id);
          const doubleYield = target.yield_quantity * 2;
          setDesiredYield(String(doubleYield));
          runSimulation(target, doubleYield);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialRecipeId]);

  function runSimulation(recipe: Recipe, targetYield: number) {
    if (targetYield <= 0) return;
    try {
      const res = simulateRecipeProduction(recipe, targetYield);
      setSimulation(res);
    } catch (err: any) {
      toast.error(err.message || 'Erro na simulação');
    }
  }

  function handleRecipeChange(id: string) {
    setSelectedRecipeId(id);
    const rec = recipes.find((r) => r.id === id);
    if (rec) {
      const newYield = rec.yield_quantity * 2;
      setDesiredYield(String(newYield));
      runSimulation(rec, newYield);
    }
  }

  function handleYieldChange(val: string) {
    setDesiredYield(val);
    const num = parseFloat(val.replace(',', '.'));
    const rec = recipes.find((r) => r.id === selectedRecipeId);
    if (rec && !isNaN(num) && num > 0) {
      runSimulation(rec, num);
    }
  }

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#4A2832] tracking-tight">
          Simulador de Produção em Escala
        </h1>
        <p className="text-sm text-[#7C6970]">
          Simule o aumento ou redução do lote. Os ingredientes e custos são recalculados automaticamente sem alterar a receita original.
        </p>
      </div>

      {/* Recipe Selection & Target Yield Control */}
      <Card className="border-[#EFE4E6] bg-white">
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-end">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-[#5E4850]">
                Selecione a Receita para Simular
              </label>
              <select
                value={selectedRecipeId}
                onChange={(e) => handleRecipeChange(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-[#EFE4E6] bg-white px-3.5 py-2 text-sm text-[#2E2226] font-medium focus:border-[#C86D7F] focus:outline-none focus:ring-2 focus:ring-[#C86D7F]/20"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Padrão: {r.yield_quantity} {r.yield_unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#5E4850]">
                Rendimento Desejado ({selectedRecipe?.yield_unit || 'un'}) *
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="Ex: 45"
                value={desiredYield}
                onChange={(e) => handleYieldChange(e.target.value)}
                className="font-mono text-base font-bold text-[#4A2832] h-11"
              />
            </div>

            {/* Quick Multipliers for mobile convenience */}
            <div className="flex flex-wrap gap-1.5 sm:col-span-3 pt-1">
              <span className="text-[11px] font-medium text-[#7C6970] self-center mr-1">
                Atalhos de escala:
              </span>
              {[0.5, 1, 2, 3, 5, 10].map((factor) => (
                <button
                  key={factor}
                  type="button"
                  onClick={() => {
                    if (selectedRecipe) {
                      const newYield = selectedRecipe.yield_quantity * factor;
                      setDesiredYield(String(newYield));
                      runSimulation(selectedRecipe, newYield);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl border border-[#EFE4E6] bg-[#FDFBF9] hover:bg-[#FDF0F3] active:scale-95 text-xs font-semibold text-[#5E4850] transition-all"
                >
                  {factor}x
                </button>
              ))}
            </div>
          </div>

          {selectedRecipe && simulation && (
            <div className="mt-4 pt-4 border-t border-[#F5ECED] flex flex-wrap items-center justify-between gap-3 text-xs text-[#7C6970]">
              <div>
                <span>Receita base: </span>
                <strong className="text-[#4A2832]">
                  {selectedRecipe.yield_quantity} {selectedRecipe.yield_unit}
                </strong>
                <span className="mx-2">→</span>
                <span>Simulando para: </span>
                <strong className="text-[#C86D7F] font-mono text-sm">
                  {simulation.simulatedYield} {selectedRecipe.yield_unit}
                </strong>
              </div>

              <div className="flex items-center gap-1.5 bg-[#FDF0F3] px-3 py-1 rounded-full text-[#8A3E50] font-medium border border-[#F7D8DF]">
                <Sparkles className="h-3.5 w-3.5 text-[#C86D7F]" />
                <span>Fator multiplicador: </span>
                <strong className="font-mono">
                  {simulation.multiplier.toFixed(2)}x
                </strong>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {simulation && selectedRecipe && (
        <div className="space-y-6">
          {/* 4 Financial Highlight Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-white border-[#EFE4E6]">
              <CardContent className="p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-[#8C7A82] block">
                  Custo Ingredientes
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-[#4A2832]">
                  {formatCurrency(simulation.totalIngredientsCost)}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#EFE4E6]">
              <CardContent className="p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-[#8C7A82] block">
                  Custos Adicionais
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-[#4A2832]">
                  {formatCurrency(simulation.totalAdditionalCosts)}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-[#FDF0F3] border-[#F7D8DF]">
              <CardContent className="p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-[#8A3E50] block">
                  Novo Custo Total
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-[#4A2832]">
                  {formatCurrency(simulation.newTotalCost)}
                </span>
                <span className="text-[10px] text-[#7C6970] block">
                  ({formatCurrency(simulation.newCostPerUnit)}/un)
                </span>
              </CardContent>
            </Card>

            <Card className="bg-[#FDFBF9] border-[#EFE4E6]">
              <CardContent className="p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-[#C86D7F] block">
                  Preço Sugerido Lote
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-[#C86D7F]">
                  {formatCurrency(simulation.suggestedSalePrice)}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Scaled Ingredients Table */}
          <Card className="border-[#EFE4E6] bg-white overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#F5ECED]">
              <CardTitle className="text-base text-[#4A2832] flex items-center gap-2">
                <Wheat className="h-5 w-5 text-[#C86D7F]" />
                Quantidades Ajustadas de Ingredientes
              </CardTitle>
              <CardDescription className="text-xs text-[#7C6970]">
                Lista de compras necessária para produzir o lote simulado de{' '}
                {simulation.simulatedYield} {selectedRecipe.yield_unit}.
              </CardDescription>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FDFBF9] border-b border-[#EFE4E6] text-[10px] font-bold text-[#7C6970] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Ingrediente / Item</th>
                    <th className="py-2.5 px-4">Qtd. Original</th>
                    <th className="py-2.5 px-4 bg-[#FDF0F3]/70 text-[#8A3E50]">
                      Qtd. Necessária no Lote
                    </th>
                    <th className="py-2.5 px-4">Custo Unitário</th>
                    <th className="py-2.5 px-4 text-right">Custo no Lote</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5ECED]">
                  {simulation.scaledItems.map((scaled, idx) => (
                    <tr key={idx} className="hover:bg-[#FDFBF9]/80">
                      <td className="py-3 px-4 font-semibold text-[#2E2226]">
                        {scaled.name}
                      </td>
                      <td className="py-3 px-4 text-[#8C7A82] font-mono">
                        {formatQuantity(scaled.originalQuantity)} {scaled.unit}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#4A2832] bg-[#FDF0F3]/40">
                        {formatQuantity(scaled.simulatedQuantity)} {scaled.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#7C6970]">
                        {formatCurrency(scaled.unitCost)}/{scaled.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#4A2832]">
                        {formatCurrency(scaled.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Scaled Additional Costs Table (Fixed vs Proportional) */}
          {simulation.scaledAdditionalCosts.length > 0 && (
            <Card className="border-[#EFE4E6] bg-white overflow-hidden">
              <CardHeader className="pb-3 border-b border-[#F5ECED]">
                <CardTitle className="text-base text-[#4A2832] flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-[#C86D7F]" />
                  Custos Adicionais: Proporcionais vs Fixos
                </CardTitle>
                <CardDescription className="text-xs text-[#7C6970]">
                  Custos proporcionais escalam com a quantidade produzida; custos fixos permanecem constantes por fornada.
                </CardDescription>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FDFBF9] border-b border-[#EFE4E6] text-[10px] font-bold text-[#7C6970] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Descrição</th>
                      <th className="py-2.5 px-4">Natureza</th>
                      <th className="py-2.5 px-4">Valor Original</th>
                      <th className="py-2.5 px-4 text-right">Valor no Lote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5ECED]">
                    {simulation.scaledAdditionalCosts.map((ac, idx) => (
                      <tr key={idx} className="hover:bg-[#FDFBF9]/80">
                        <td className="py-3 px-4 font-semibold text-[#2E2226]">
                          {ac.description}
                        </td>
                        <td className="py-3 px-4">
                          {ac.isProportional ? (
                            <Badge variant="default" className="text-[10px]">
                              Proporcional ({simulation.multiplier.toFixed(2)}x)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Fixo por fornada (1x)
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#8C7A82]">
                          {formatCurrency(ac.originalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#4A2832]">
                          {formatCurrency(ac.simulatedAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function SimuladorPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="p-12 text-center text-sm text-[#7C6970]">
            Carregando simulador...
          </div>
        }
      >
        <SimuladorContent />
      </Suspense>
    </AppShell>
  );
}
