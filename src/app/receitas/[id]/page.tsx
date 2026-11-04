'use client';

import { Suspense, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  Copy,
  Edit2,
  Calculator,
  Wheat,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getRecipeById, duplicateRecipe, getUserSettings } from '@/lib/data-service';
import type { Recipe, UserSettings } from '@/lib/types';
import {
  formatCurrency,
  formatQuantity,
  formatUnitCost,
  calculateRecipeBreakdown,
} from '@/lib/calculations';
import Decimal from 'decimal.js';
import { toast } from 'sonner';

function FichaTecnicaContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rec, set] = await Promise.all([
          getRecipeById(resolvedParams.id),
          getUserSettings(),
        ]);
        if (!rec) {
          toast.error('Receita não encontrada.');
          router.push('/receitas');
          return;
        }
        setRecipe(rec);
        setSettings(set);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [resolvedParams.id, router]);

  async function handleDuplicate() {
    if (!recipe) return;
    try {
      const dup = await duplicateRecipe(recipe.id);
      toast.success(`Receita duplicada como "${dup.name}"`);
      router.push(`/receitas/${dup.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao duplicar receita');
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading || !recipe) {
    return (
      <div className="p-12 text-center text-sm text-[#738078]">
        Carregando ficha técnica...
      </div>
    );
  }

  const items = recipe.items || [];
  const additionalCosts = recipe.additional_costs || [];

  const itemsCost = items.reduce((acc, item) => {
    return acc.plus(new Decimal(item.calculated_cost || 0));
  }, new Decimal(0));

  const breakdown = calculateRecipeBreakdown(
    recipe,
    itemsCost,
    additionalCosts
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Toolbar (Hidden when printing) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/receitas">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="h-5 w-5 text-[#35483E]" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#35483E] tracking-tight">
                Ficha Técnica
              </h1>
              <Badge variant="secondary" className="text-xs">
                {recipe.category}
              </Badge>
            </div>
            <p className="text-xs text-[#6C7A72]">
              Atualizada em:{' '}
              {new Date(recipe.updated_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Link href={`/simulador?recipeId=${recipe.id}`}>
            <Button variant="outline" size="sm" className="font-medium">
              <Calculator className="h-4 w-4 mr-1 text-[#6D8576]" />
              Simular Lote
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            className="font-medium"
          >
            <Copy className="h-4 w-4 mr-1" />
            Duplicar
          </Button>

          <Link href={`/receitas/${recipe.id}/editar`}>
            <Button variant="outline" size="sm" className="font-medium">
              <Edit2 className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </Link>

          <Button size="sm" onClick={handlePrint} className="font-medium shadow-sm">
            <Printer className="h-4 w-4 mr-1" />
            Imprimir A4
          </Button>
        </div>
      </div>

      {/* Printable Technical Spec Document Container */}
      <div className="print-container bg-white border border-[#E7E2D8] rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between border-b border-[#EAE5DC] pb-6 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6D8576] uppercase tracking-wider">
              <span>{settings?.business_name || 'Confeitaria Artesanal'}</span>
              <span>•</span>
              <span>Ficha Técnica Oficial</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#35483E]">
              {recipe.name}
            </h2>
            {recipe.description && (
              <p className="text-sm text-[#6A7870] max-w-2xl leading-relaxed">
                {recipe.description}
              </p>
            )}
          </div>

          {recipe.photo_url && (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-[#E5E0D8] shrink-0 bg-[#FAF8F5]">
              <img
                src={recipe.photo_url}
                alt={recipe.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E7E2D8] text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#7E8B83] block">
              Rendimento
            </span>
            <span className="text-base font-bold text-[#35483E]">
              {recipe.yield_quantity} {recipe.yield_unit}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-[#7E8B83] block">
              Tempo de Preparo
            </span>
            <span className="text-base font-bold text-[#35483E]">
              {recipe.prep_time_minutes ? `${recipe.prep_time_minutes} min` : 'N/I'}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-[#7E8B83] block">
              Custo Total
            </span>
            <span className="text-base font-bold text-[#35483E]">
              {formatCurrency(breakdown.totalCost)}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-[#7E8B83] block">
              Custo por {recipe.yield_unit.replace(/s$/, '')}
            </span>
            <span className="text-base font-bold text-[#6D8576]">
              {formatCurrency(breakdown.costPerUnit)}
            </span>
          </div>
        </div>

        {/* Section: Ingredients and Sub-recipes Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#35483E] flex items-center gap-2">
            <Wheat className="h-4 w-4 text-[#6D8576]" />
            Composição de Ingredientes e Sub-Receitas
          </h3>

          <div className="border border-[#E7E2D8] rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#EAE5DC] text-[10px] font-bold text-[#67756D] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4">Item / Ingrediente</th>
                  <th className="py-2.5 px-4">Quantidade Utilizada</th>
                  <th className="py-2.5 px-4">Custo Unitário</th>
                  <th className="py-2.5 px-4 text-right">Custo Proporcional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE4]">
                {items.map((item, idx) => {
                  const isIngredient = item.item_type === 'ingredient';
                  const itemName = isIngredient
                    ? item.ingredient?.name || 'Ingrediente'
                    : item.sub_recipe?.name || 'Sub-receita';

                  const unitCostStr = isIngredient && item.ingredient
                    ? formatUnitCost(item.ingredient.cost_per_base_unit, item.ingredient.base_unit)
                    : item.sub_recipe
                    ? `R$ ${(item.calculated_cost! / item.quantity).toFixed(4)}/${item.unit}`
                    : '—';

                  return (
                    <tr key={idx} className="hover:bg-[#FAF8F5]/60">
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            isIngredient
                              ? 'bg-[#EFF5F1] text-[#283B31]'
                              : 'bg-[#F2EFEA] text-[#55635B]'
                          }`}
                        >
                          {isIngredient ? 'Ingrediente' : 'Sub-Receita'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#28362F]">
                        {itemName}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {formatQuantity(item.quantity)} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#6A7870]">
                        {unitCostStr}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#35483E]">
                        {formatCurrency(item.calculated_cost || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#FAF8F5] font-bold text-[#35483E] border-t border-[#EAE5DC]">
                <tr>
                  <td colSpan={4} className="py-2.5 px-4 text-right text-xs">
                    Subtotal Ingredientes:
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-sm">
                    {formatCurrency(breakdown.ingredientsCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section: Additional Costs */}
        {additionalCosts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#35483E] flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#6D8576]" />
              Custos Adicionais da Produção
            </h3>

            <div className="border border-[#E7E2D8] rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] border-b border-[#EAE5DC] text-[10px] font-bold text-[#67756D] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Descrição</th>
                    <th className="py-2.5 px-4">Natureza do Custo</th>
                    <th className="py-2.5 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEBE4]">
                  {additionalCosts.map((cost, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF8F5]/60">
                      <td className="py-3 px-4 font-medium text-[#28362F]">
                        {cost.description}
                      </td>
                      <td className="py-3 px-4 text-[#6A7870]">
                        {cost.is_proportional ? (
                          <span className="text-[#35483E]">Proporcional ao rendimento</span>
                        ) : (
                          <span className="text-[#7A8880]">Fixo por fornada</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#35483E]">
                        {formatCurrency(cost.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#FAF8F5] font-bold text-[#35483E] border-t border-[#EAE5DC]">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-4 text-right text-xs">
                      Subtotal Custos Adicionais:
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-sm">
                      {formatCurrency(breakdown.additionalCosts)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Section: Pricing & Sale Margins Breakdown */}
        <div className="p-6 rounded-2xl bg-[#EFF5F1] border border-[#D5E3DB] space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#283B31] flex items-center justify-between">
            <span>Análise Financeira & Precificação</span>
            <Badge variant="default" className="text-[10px] uppercase">
              {recipe.pricing_method === 'margin' ? 'Margem sobre Preço' : 'Markup'}
            </Badge>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-white p-3 rounded-xl border border-[#D5E3DB]">
              <span className="text-[10px] uppercase font-semibold text-[#7E8B83] block">
                Custo Total
              </span>
              <span className="text-sm font-bold font-mono text-[#35483E]">
                {formatCurrency(breakdown.totalCost)}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#D5E3DB]">
              <span className="text-[10px] uppercase font-semibold text-[#7E8B83] block">
                Preço Sugerido
              </span>
              <span className="text-sm font-bold font-mono text-[#6D8576]">
                {formatCurrency(breakdown.suggestedSalePrice)}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#D5E3DB]">
              <span className="text-[10px] uppercase font-semibold text-[#7E8B83] block">
                Preço de Venda
              </span>
              <span className="text-sm font-bold font-mono text-[#28362F]">
                {formatCurrency(breakdown.effectiveSalePrice)}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#D5E3DB]">
              <span className="text-[10px] uppercase font-semibold text-[#7E8B83] block">
                Lucro Bruto
              </span>
              <span className="text-sm font-bold font-mono text-[#477A57]">
                + {formatCurrency(breakdown.estimatedGrossProfit)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-[#526359] border-t border-[#D5E3DB] pt-3 gap-2">
            <div>
              <span>Margem de Lucro Efetiva: </span>
              <strong className="text-sm font-mono text-[#283B31]">
                {breakdown.estimatedProfitMargin.toFixed(1)}%
              </strong>
              {recipe.card_fee_percentage > 0 && (
                <span className="ml-2 text-[11px] text-[#738279]">
                  (Já deduzida taxa de cartão de {recipe.card_fee_percentage}%)
                </span>
              )}
            </div>

            {breakdown.isMarginBelowTarget && (
              <div className="text-[#9A5A0A] font-semibold flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Margem abaixo da meta de {recipe.target_margin_percentage}%!
              </div>
            )}
          </div>
        </div>

        {/* Document Footer (Visible in print) */}
        <div className="border-t border-[#EAE5DC] pt-4 flex items-center justify-between text-[10px] text-[#8C9890]">
          <span>DoceCusto — Sistema de Gestão Confeitaria</span>
          <span>Impresso em: {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </div>
  );
}

export default function FichaTecnicaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="p-12 text-center text-sm text-[#738078]">
            Carregando...
          </div>
        }
      >
        <FichaTecnicaContent params={params} />
      </Suspense>
    </AppShell>
  );
}
