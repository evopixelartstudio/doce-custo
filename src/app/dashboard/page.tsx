'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wheat,
  BookOpenText,
  DollarSign,
  Plus,
  ArrowUpRight,
  Clock,
  Sparkles,
  TrendingUp,
  AlertCircle,
  ChefHat,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getIngredients, getRecipes, getUserSettings } from '@/lib/data-service';
import type { Ingredient, Recipe, UserSettings } from '@/lib/types';
import {
  formatCurrency,
  formatUnitCost,
  calculateRecipeBreakdown,
} from '@/lib/calculations';
import Decimal from 'decimal.js';

export default function DashboardPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [ingList, recList, userSet] = await Promise.all([
          getIngredients(false),
          getRecipes(false),
          getUserSettings(),
        ]);
        setIngredients(ingList);
        setRecipes(recList);
        setSettings(userSet);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute metrics
  const totalIngredients = ingredients.length;
  const totalRecipes = recipes.length;

  // Calculate average recipe cost
  let totalCostSum = new Decimal(0);
  const recipeBreakdowns = recipes.map((recipe) => {
    const itemsCost = (recipe.items || []).reduce((acc, item) => {
      return acc.plus(new Decimal(item.calculated_cost || 0));
    }, new Decimal(0));
    const breakdown = calculateRecipeBreakdown(
      recipe,
      itemsCost,
      recipe.additional_costs || []
    );
    totalCostSum = totalCostSum.plus(new Decimal(breakdown.totalCost));
    return {
      recipe,
      breakdown,
    };
  });

  const avgRecipeCost =
    totalRecipes > 0 ? totalCostSum.dividedBy(totalRecipes).toNumber() : 0;

  // Sort recent recipes
  const recentRecipes = [...recipeBreakdowns].sort(
    (a, b) =>
      new Date(b.recipe.updated_at).getTime() -
      new Date(a.recipe.updated_at).getTime()
  ).slice(0, 5);

  // Ingredients with recent updates
  const recentIngredients = [...ingredients].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ).slice(0, 5);

  return (
    <AppShell>
      <div className="space-y-7">
        {/* Top Header & Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#6D8576] uppercase tracking-wider bg-[#EFF5F1] px-2.5 py-0.5 rounded-full">
                {settings?.business_name || 'Confeitaria'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#35483E] tracking-tight mt-1">
              Painel de Custos & Produção
            </h1>
            <p className="text-sm text-[#6C7A72]">
              Visão consolidada de ingredientes, receitas e margens de venda.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Link href="/ingredientes/novo">
              <Button variant="outline" size="sm" className="font-medium">
                <Plus className="h-4 w-4 mr-1 text-[#6D8576]" />
                Novo Ingrediente
              </Button>
            </Link>
            <Link href="/receitas/nova">
              <Button size="sm" className="font-medium shadow-sm">
                <ChefHat className="h-4 w-4 mr-1" />
                Criar Receita
              </Button>
            </Link>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white border-[#E8E3DB]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#738078] uppercase tracking-wider">
                  Ingredientes
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-[#35483E] mt-1">
                  {loading ? '...' : totalIngredients}
                </p>
                <p className="text-xs text-[#7B8880] mt-1">
                  Cadastrados e com custo unitário
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#F0F5F2] flex items-center justify-center text-[#6D8576]">
                <Wheat className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#E8E3DB]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#738078] uppercase tracking-wider">
                  Receitas Ativas
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-[#35483E] mt-1">
                  {loading ? '...' : totalRecipes}
                </p>
                <p className="text-xs text-[#7B8880] mt-1">
                  Fichas técnicas calculadas
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#F0F5F2] flex items-center justify-center text-[#6D8576]">
                <BookOpenText className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#E8E3DB]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#738078] uppercase tracking-wider">
                  Custo Médio de Produção
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-[#35483E] mt-1">
                  {loading ? '...' : formatCurrency(avgRecipeCost)}
                </p>
                <p className="text-xs text-[#7B8880] mt-1">
                  Por fornada ou receita
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#F0F5F2] flex items-center justify-center text-[#6D8576]">
                <DollarSign className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2 Main Columns: Recent Recipes & Recent Ingredients */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Receitas Atualizadas Recentemente (Col 2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#35483E] flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-[#6D8576]" />
                Receitas & Preços Recentes
              </h2>
              <Link
                href="/receitas"
                className="text-xs font-medium text-[#6D8576] hover:underline flex items-center gap-0.5"
              >
                Ver todas as receitas
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <Card className="border-[#E8E3DB] bg-white">
              <div className="divide-y divide-[#EFEBE4]">
                {recentRecipes.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#738078]">
                    Nenhuma receita cadastrada ainda.
                  </div>
                ) : (
                  recentRecipes.map(({ recipe, breakdown }) => (
                    <Link
                      key={recipe.id}
                      href={`/receitas/${recipe.id}`}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#FAF8F5] transition-colors group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base text-[#28362F] group-hover:text-[#6D8576] transition-colors">
                            {recipe.name}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {recipe.yield_quantity} {recipe.yield_unit}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#7B8880]">
                          Categoria: {recipe.category}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 self-start sm:self-auto">
                        <div className="text-left sm:text-right">
                          <p className="text-[11px] text-[#7A8880] uppercase tracking-wider">
                            Custo de Produção
                          </p>
                          <p className="text-sm font-semibold text-[#35483E]">
                            {formatCurrency(breakdown.totalCost)}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-[11px] text-[#7A8880] uppercase tracking-wider">
                            Preço Sugerido
                          </p>
                          <p className="text-sm font-bold text-[#6D8576]">
                            {formatCurrency(breakdown.effectiveSalePrice)}
                          </p>
                        </div>

                        <div className="hidden sm:block">
                          <Badge
                            variant={breakdown.isMarginBelowTarget ? 'warning' : 'success'}
                            className="text-xs"
                          >
                            {breakdown.estimatedProfitMargin.toFixed(0)}% margem
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Ingredientes com Atualização Recente (Col 1/3) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#35483E] flex items-center gap-2">
                <Wheat className="h-5 w-5 text-[#6D8576]" />
                Preço de Ingredientes
              </h2>
              <Link
                href="/ingredientes"
                className="text-xs font-medium text-[#6D8576] hover:underline flex items-center gap-0.5"
              >
                Gerenciar
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <Card className="border-[#E8E3DB] bg-white">
              <div className="divide-y divide-[#EFEBE4]">
                {recentIngredients.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#738078]">
                    Nenhum ingrediente cadastrado.
                  </div>
                ) : (
                  recentIngredients.map((ing) => (
                    <div
                      key={ing.id}
                      className="p-4 flex items-center justify-between gap-2 hover:bg-[#FAF8F5] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-[#28362F] truncate">
                          {ing.name}
                        </p>
                        <p className="text-[11px] text-[#7B8880]">
                          Emb: {ing.package_quantity} {ing.package_unit} por{' '}
                          {formatCurrency(ing.package_price)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-semibold text-[#35483E] bg-[#F0F5F2] px-2 py-1 rounded-lg">
                          {formatUnitCost(ing.cost_per_base_unit, ing.base_unit)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Quick Helper Note for Confectioners */}
            <div className="bg-[#EFF5F1] border border-[#D5E4DB] rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-[#6D8576] shrink-0 mt-0.5" />
              <div className="text-xs text-[#38493F] space-y-1">
                <p className="font-semibold">Atualização em tempo real</p>
                <p className="text-[#59695F] leading-relaxed">
                  Quando você atualiza o preço de compra de qualquer ingrediente, todas as receitas que o utilizam são recalculadas automaticamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
