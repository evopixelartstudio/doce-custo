'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpenText,
  Plus,
  Search,
  Copy,
  Archive,
  Edit2,
  Calculator,
  ChefHat,
  Clock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getRecipes, duplicateRecipe, archiveRecipe } from '@/lib/data-service';
import type { Recipe } from '@/lib/types';
import { formatCurrency, calculateRecipeBreakdown } from '@/lib/calculations';
import Decimal from 'decimal.js';
import { toast } from 'sonner';

export default function ReceitasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');

  async function loadData() {
    setLoading(true);
    try {
      const data = await getRecipes(false);
      setRecipes(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDuplicate(recipe: Recipe) {
    try {
      await duplicateRecipe(recipe.id);
      toast.success(`Receita "${recipe.name}" duplicada com sucesso!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao duplicar receita.');
    }
  }

  async function handleArchive(recipe: Recipe) {
    if (
      !confirm(
        `Deseja arquivar a receita "${recipe.name}"? Ela não será excluída do histórico.`
      )
    ) {
      return;
    }

    try {
      await archiveRecipe(recipe.id);
      toast.success('Receita arquivada.');
      loadData();
    } catch {
      toast.error('Erro ao arquivar receita.');
    }
  }

  // Categories list
  const categories = Array.from(
    new Set(recipes.map((r) => r.category).filter(Boolean))
  );

  const filtered = recipes.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'todas' || r.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#4A2832] tracking-tight">
              Receitas & Fichas Técnicas
            </h1>
            <p className="text-sm text-[#7C6970]">
              Fórmulas, ingredientes, sub-receitas e custos calculados em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/simulador">
              <Button variant="outline" className="shadow-sm">
                <Calculator className="h-4 w-4 mr-1.5 text-[#C86D7F]" />
                Simulador de Fornada
              </Button>
            </Link>
            <Link href="/receitas/nova">
              <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Criar Receita
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8989E]" />
            <Input
              type="text"
              placeholder="Buscar receita por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('todas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'todas'
                  ? 'bg-[#C86D7F] text-white shadow-sm'
                  : 'bg-white text-[#5E4850] border border-[#EFE4E6] hover:bg-[#F8EEF0]'
              }`}
            >
              Todas as Categorias
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#C86D7F] text-white shadow-sm'
                    : 'bg-white text-[#5E4850] border border-[#EFE4E6] hover:bg-[#F8EEF0]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Recipes Grid */}
        {loading ? (
          <div className="p-12 text-center text-sm text-[#7C6970]">
            Carregando receitas...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-[#EFE4E6] bg-white p-12 text-center space-y-3">
            <ChefHat className="h-10 w-10 text-[#C9B3B8] mx-auto" />
            <p className="text-sm font-medium text-[#5E4850]">
              Nenhuma receita encontrada.
            </p>
            <Link href="/receitas/nova">
              <Button size="sm">Criar Minha Primeira Receita</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((recipe) => {
              const itemsCost = (recipe.items || []).reduce((acc, item) => {
                return acc.plus(new Decimal(item.calculated_cost || 0));
              }, new Decimal(0));

              const breakdown = calculateRecipeBreakdown(
                recipe,
                itemsCost,
                recipe.additional_costs || []
              );

              return (
                <Card
                  key={recipe.id}
                  className="border-[#EFE4E6] bg-white flex flex-col justify-between overflow-hidden group hover:border-[#E2CBD0] transition-all"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant="secondary" className="text-[10px] mb-1.5">
                          {recipe.category || 'Geral'}
                        </Badge>
                        <h2 className="text-base font-bold text-[#2E2226] group-hover:text-[#C86D7F] transition-colors leading-snug">
                          <Link href={`/receitas/${recipe.id}`}>
                            {recipe.name}
                          </Link>
                        </h2>
                      </div>

                      <Badge
                        variant={
                          breakdown.isMarginBelowTarget ? 'warning' : 'success'
                        }
                        className="text-xs shrink-0"
                      >
                        {breakdown.estimatedProfitMargin.toFixed(0)}% margem
                      </Badge>
                    </div>

                    {recipe.description && (
                      <p className="text-xs text-[#7C6970] line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-[#7C6970] pt-1">
                      <span className="font-medium">
                        Rendimento: {recipe.yield_quantity} {recipe.yield_unit}
                      </span>
                      {recipe.prep_time_minutes && (
                        <span className="flex items-center gap-1 text-[#968289]">
                          <Clock className="h-3.5 w-3.5" />
                          {recipe.prep_time_minutes} min
                        </span>
                      )}
                    </div>

                    {/* Cost Metrics Box */}
                    <div className="bg-[#FDFBF9] border border-[#EFE4E6] rounded-xl p-3 grid grid-cols-2 gap-2 text-center">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#8C7A82] block">
                          Custo Total
                        </span>
                        <span className="text-sm font-bold text-[#4A2832]">
                          {formatCurrency(breakdown.totalCost)}
                        </span>
                        <span className="text-[10px] text-[#968289] block">
                          ({formatCurrency(breakdown.costPerUnit)}/un)
                        </span>
                      </div>

                      <div className="border-l border-[#EFE4E6] pl-2">
                        <span className="text-[10px] uppercase font-semibold text-[#8C7A82] block">
                          Preço de Venda
                        </span>
                        <span className="text-sm font-bold text-[#C86D7F]">
                          {formatCurrency(breakdown.effectiveSalePrice)}
                        </span>
                        <span className="text-[10px] text-[#2D6A4F] font-medium block">
                          + {formatCurrency(breakdown.estimatedGrossProfit)} lucro
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="p-3 bg-[#FDFBF9]/80 border-t border-[#F5ECED] flex items-center justify-between gap-1 text-xs">
                    <Link href={`/receitas/${recipe.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
                        <BookOpenText className="h-3.5 w-3.5 mr-1 text-[#C86D7F]" />
                        Ficha Técnica
                      </Button>
                    </Link>

                    <div className="flex items-center gap-1">
                      <button
                        title="Duplicar receita"
                        onClick={() => handleDuplicate(recipe)}
                        className="p-1.5 rounded-lg text-[#7C6970] hover:text-[#4A2832] hover:bg-[#F8EEF0] transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      <Link
                        href={`/receitas/${recipe.id}/editar`}
                        title="Editar receita"
                        className="p-1.5 rounded-lg text-[#C86D7F] hover:text-[#B2586A] hover:bg-[#FDF0F3] transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Link>

                      <button
                        title="Arquivar receita"
                        onClick={() => handleArchive(recipe)}
                        className="p-1.5 rounded-lg text-[#A82B35] hover:bg-[#FDF2F3] transition-colors"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
