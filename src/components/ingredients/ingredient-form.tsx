'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { saveIngredient } from '@/lib/data-service';
import type { Ingredient, IngredientCategory, UnitType, BaseUnit } from '@/lib/types';
import {
  calculateBaseUnitCost,
  getBaseUnit,
  formatUnitCost,
} from '@/lib/calculations';
import { toast } from 'sonner';

interface IngredientFormProps {
  initialData?: Ingredient | null;
}

const categories: { value: IngredientCategory; label: string }[] = [
  { value: 'laticinios', label: 'Laticínios' },
  { value: 'farinaceos', label: 'Farináceos' },
  { value: 'chocolates', label: 'Chocolates & Cacau' },
  { value: 'frutas', label: 'Frutas & Frutos Secos' },
  { value: 'ovos', label: 'Ovos' },
  { value: 'coberturas', label: 'Coberturas & Confeitos' },
  { value: 'embalagens', label: 'Embalagens & Descartáveis' },
  { value: 'outros', label: 'Outros Ingredientes' },
];

const unitOptions: { value: UnitType; label: string }[] = [
  { value: 'unidade', label: 'Unidade (un)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'L', label: 'Litro (L)' },
];

export function IngredientForm({ initialData }: IngredientFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState<IngredientCategory>(
    initialData?.category || 'laticinios'
  );
  const [packageQuantity, setPackageQuantity] = useState<string>(
    initialData ? String(initialData.package_quantity) : '1'
  );
  const [packageUnit, setPackageUnit] = useState<UnitType>(
    initialData?.package_unit || 'unidade'
  );
  const [packagePrice, setPackagePrice] = useState<string>(
    initialData ? String(initialData.package_price) : ''
  );
  const [brand, setBrand] = useState(initialData?.brand || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Live calculation of base unit and cost
  let calculatedBaseUnit: BaseUnit = 'unidade';
  let liveBaseUnitCost: number | null = null;

  try {
    calculatedBaseUnit = getBaseUnit(packageUnit);
    const numQty = parseFloat(packageQuantity.replace(',', '.'));
    const numPrice = parseFloat(packagePrice.replace(',', '.'));

    if (!isNaN(numQty) && !isNaN(numPrice) && numQty > 0 && numPrice >= 0) {
      liveBaseUnitCost = calculateBaseUnitCost(
        numPrice,
        numQty,
        packageUnit
      ).toNumber();
    }
  } catch {
    // handled gracefully
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = name.trim();
    const numQty = parseFloat(packageQuantity.replace(',', '.'));
    const numPrice = parseFloat(packagePrice.replace(',', '.'));

    if (!cleanName) {
      toast.error('Informe o nome do ingrediente.');
      return;
    }
    if (isNaN(numQty) || numQty <= 0) {
      toast.error('Informe uma quantidade de referência válida maior que zero.');
      return;
    }
    if (packageUnit === 'unidade' && !Number.isInteger(numQty)) {
      toast.error('Ingredientes em unidade devem utilizar quantidade de referência inteira (1, 2, 3...).');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error('Informe um preço de referência válido.');
      return;
    }

    setLoading(true);
    try {
      const baseUnit = getBaseUnit(packageUnit);

      await saveIngredient({
        ...(initialData ? { id: initialData.id } : {}),
        name: cleanName,
        category,
        package_quantity: numQty,
        package_unit: packageUnit,
        package_price: numPrice,
        base_unit: baseUnit,
        brand: brand.trim() || null,
        notes: notes.trim() || null,
      });

      toast.success(
        initialData
          ? 'Ingrediente atualizado! Todas as receitas foram recalculadas automaticamente.'
          : 'Ingrediente cadastrado no catálogo com sucesso!'
      );
      router.push('/ingredientes');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar ingrediente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <Link href="/ingredientes">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-5 w-5 text-[#4A2832]" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#4A2832] tracking-tight">
            {initialData ? 'Editar Ingrediente' : 'Novo Ingrediente'}
          </h1>
          <p className="text-xs text-[#7C6970]">
            Informe a embalagem adquirida e o preço pago no mercado ou atacado.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-[#4A2832]">
              Informações do Ingrediente
            </CardTitle>
            <CardDescription className="text-xs text-[#7C6970]">
              Dados de identificação e categoria culinária.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Nome do Ingrediente *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Leite condensado, Farinha especial..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Categoria *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IngredientCategory)}
                  className="flex h-11 w-full rounded-xl border border-[#EFE4E6] bg-white px-3.5 py-2 text-sm text-[#2E2226] focus:border-[#C86D7F] focus:outline-none focus:ring-2 focus:ring-[#C86D7F]/20"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Marca do Produto (Opcional)
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Nestlé, Dona Benta, Sicao..."
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referência de Compra e Preço */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-[#4A2832]">
              Referência de Compra e Preço
            </CardTitle>
            <CardDescription className="text-xs text-[#7C6970]">
              Informe a quantidade de referência e o preço correspondente. Representa apenas o catálogo de custos.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Quantidade de Referência *
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="Ex: 1, 200, 500..."
                  value={packageQuantity}
                  onChange={(e) => setPackageQuantity(e.target.value)}
                  className="h-11 text-base sm:text-sm font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Unidade de Referência *
                </label>
                <select
                  value={packageUnit}
                  onChange={(e) => setPackageUnit(e.target.value as UnitType)}
                  className="flex h-11 w-full rounded-xl border border-[#EFE4E6] bg-white px-3.5 py-2 text-base sm:text-sm text-[#2E2226] focus:border-[#C86D7F] focus:outline-none focus:ring-2 focus:ring-[#C86D7F]/20"
                >
                  {unitOptions.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Preço Correspondente (R$) *
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Ex: 10.00"
                  value={packagePrice}
                  onChange={(e) => setPackagePrice(e.target.value)}
                  className="h-11 text-base sm:text-sm font-medium"
                  required
                />
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="p-4 rounded-2xl bg-[#FDF0F3] border border-[#F7D8DF] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#C86D7F] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#8A3E50]">
                    Custo por Unidade Base
                  </p>
                  <p className="text-lg font-bold font-mono text-[#4A2832]">
                    {liveBaseUnitCost !== null
                      ? formatUnitCost(liveBaseUnitCost, calculatedBaseUnit)
                      : 'Preencha quantidade e preço'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-[#7C6970]">
                <span>Unidade calculada: </span>
                <strong className="text-[#4A2832]">{calculatedBaseUnit}</strong>
                <p className="text-[11px] text-[#968289]">
                  Cálculo automático proporcional para receitas
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-[#5E4850]">
                Observações (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Fornecedor, especificações do produto..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-[#EFE4E6] bg-white p-3 text-sm text-[#2E2226] focus:border-[#C86D7F] focus:outline-none focus:ring-2 focus:ring-[#C86D7F]/20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <Link href="/ingredientes" className="w-full sm:w-auto">
            <Button type="button" variant="outline" className="w-full sm:w-auto h-12 sm:h-10 text-sm font-medium">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 sm:h-10 font-semibold shadow-sm text-sm">
            <Save className="h-4 w-4 mr-1.5" />
            {loading ? 'Salvando...' : 'Salvar Ingrediente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
