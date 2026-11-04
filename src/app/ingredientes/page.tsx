'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wheat,
  Plus,
  Search,
  History,
  Archive,
  Edit2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  getIngredients,
  archiveIngredient,
  getIngredientPriceHistory,
} from '@/lib/data-service';
import type { Ingredient, IngredientCategory, IngredientPriceHistory } from '@/lib/types';
import {
  formatCurrency,
  formatUnitCost,
  formatQuantity,
} from '@/lib/calculations';
import { toast } from 'sonner';

const categoryLabels: Record<IngredientCategory | 'todas', string> = {
  todas: 'Todas',
  laticinios: 'Laticínios',
  farinaceos: 'Farináceos',
  chocolates: 'Chocolates',
  frutas: 'Frutas',
  ovos: 'Ovos',
  coberturas: 'Coberturas',
  embalagens: 'Embalagens',
  outros: 'Outros',
};

export default function IngredientesPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    IngredientCategory | 'todas'
  >('todas');

  // History modal state
  const [selectedHistory, setSelectedHistory] = useState<{
    ingredient: Ingredient;
    records: IngredientPriceHistory[];
  } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getIngredients(false);
      setIngredients(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleArchive(ingredient: Ingredient) {
    if (
      !confirm(
        `Tem certeza que deseja arquivar "${ingredient.name}"? As receitas existentes continuarão funcionando com segurança.`
      )
    ) {
      return;
    }

    try {
      await archiveIngredient(ingredient.id);
      toast.success(`Ingrediente "${ingredient.name}" arquivado com sucesso.`);
      loadData();
    } catch {
      toast.error('Erro ao arquivar ingrediente.');
    }
  }

  async function openHistory(ingredient: Ingredient) {
    try {
      const records = await getIngredientPriceHistory(ingredient.id);
      setSelectedHistory({ ingredient, records });
    } catch {
      toast.error('Erro ao buscar histórico');
    }
  }

  // Filtered ingredients
  const filtered = ingredients.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'todas' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#4A2832] tracking-tight">
              Ingredientes
            </h1>
            <p className="text-sm text-[#7C6970]">
              Cadastre embalagens e preços de compra. O custo unitário é calculado automaticamente.
            </p>
          </div>

          <Link href="/ingredientes/novo">
            <Button className="w-full sm:w-auto shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Ingrediente
            </Button>
          </Link>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8989E]" />
            <Input
              type="text"
              placeholder="Buscar por nome ou marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(Object.keys(categoryLabels) as (IngredientCategory | 'todas')[]).map(
              (catKey) => (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === catKey
                      ? 'bg-[#C86D7F] text-white shadow-sm'
                      : 'bg-white text-[#5E4850] border border-[#EFE4E6] hover:bg-[#F8EEF0]'
                  }`}
                >
                  {categoryLabels[catKey]}
                </button>
              )
            )}
          </div>
        </div>

        {/* Ingredients Table / List */}
        <Card className="border-[#EFE4E6] bg-white overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-[#7C6970]">
              Carregando ingredientes...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Wheat className="h-10 w-10 text-[#C9B3B8] mx-auto" />
              <p className="text-sm font-medium text-[#5E4850]">
                Nenhum ingrediente encontrado.
              </p>
              <Link href="/ingredientes/novo">
                <Button size="sm" variant="outline">
                  Cadastrar Primeiro Ingrediente
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FDFBF9] border-b border-[#EFE4E6] text-[11px] font-semibold text-[#7C6970] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Ingrediente</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Embalagem Comprada</th>
                    <th className="py-3 px-4">Preço da Compra</th>
                    <th className="py-3 px-4">Custo Base Calculado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5ECED]">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[#FDFBF9]/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-[#2E2226]">
                        <div>
                          <span className="font-semibold">{item.name}</span>
                          {item.brand && (
                            <span className="block text-xs text-[#8C7A82]">
                              Marca: {item.brand}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant="secondary" className="capitalize text-[11px]">
                          {categoryLabels[item.category] || item.category}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-[#4A2832] font-medium">
                        {formatQuantity(item.package_quantity)}{' '}
                        {item.package_unit}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-[#2E2226]">
                        {formatCurrency(item.package_price)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#FDF0F3] text-[#8A3E50] font-mono font-semibold text-xs border border-[#F7D8DF]">
                          {formatUnitCost(item.cost_per_base_unit, item.base_unit)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="Histórico de alterações de preço"
                            onClick={() => openHistory(item)}
                            className="p-2 rounded-lg text-[#7C6970] hover:text-[#4A2832] hover:bg-[#F8EEF0] transition-colors"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          <Link
                            href={`/ingredientes/${item.id}`}
                            title="Editar ingrediente"
                            className="p-2 rounded-lg text-[#C86D7F] hover:text-[#B2586A] hover:bg-[#FDF0F3] transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Link>

                          <button
                            title="Arquivar ingrediente com segurança"
                            onClick={() => handleArchive(item)}
                            className="p-2 rounded-lg text-[#A82B35] hover:bg-[#FDF2F3] transition-colors"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal / Dialog de Histórico de Preço */}
        {selectedHistory && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <Card className="max-w-lg w-full bg-white border-[#EFE4E6] shadow-lg animate-in fade-in zoom-in-95">
              <div className="p-5 border-b border-[#F5ECED] flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base text-[#4A2832]">
                    Histórico de Preços
                  </h3>
                  <p className="text-xs text-[#7C6970]">
                    {selectedHistory.ingredient.name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedHistory(null)}
                >
                  Fechar
                </Button>
              </div>

              <div className="p-5 max-h-80 overflow-y-auto space-y-3">
                {selectedHistory.records.length === 0 ? (
                  <p className="text-sm text-[#7C6970] text-center py-6">
                    Ainda não há alterações de preço registradas para este ingrediente.
                  </p>
                ) : (
                  selectedHistory.records.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3.5 rounded-xl border border-[#EFE4E6] bg-[#FDFBF9] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#4A2832]">
                          {formatCurrency(rec.old_price)} →{' '}
                          <span className="text-[#C86D7F] font-bold">
                            {formatCurrency(rec.new_price)}
                          </span>
                        </span>
                        <span className="text-[#968289]">
                          {new Date(rec.changed_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#6E4F57]">
                        Custo unitário: {formatUnitCost(rec.old_cost_per_base_unit, selectedHistory.ingredient.base_unit)} →{' '}
                        {formatUnitCost(rec.new_cost_per_base_unit, selectedHistory.ingredient.base_unit)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
