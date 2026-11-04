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
  { value: 'g', label: 'Gramas (g)' },
  { value: 'kg', label: 'Quilogramas (kg)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'unidade', label: 'Unidades (un)' },
];

export function IngredientForm({ initialData }: IngredientFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState<IngredientCategory>(
    initialData?.category || 'laticinios'
  );
  const [packageQuantity, setPackageQuantity] = useState<string>(
    initialData ? String(initialData.package_quantity) : ''
  );
  const [packageUnit, setPackageUnit] = useState<UnitType>(
    initialData?.package_unit || 'g'
  );
  const [packagePrice, setPackagePrice] = useState<string>(
    initialData ? String(initialData.package_price) : ''
  );
  const [brand, setBrand] = useState(initialData?.brand || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [densityGPerMl, setDensityGPerMl] = useState<string>(
    initialData?.density_g_per_ml ? String(initialData.density_g_per_ml) : ''
  );
  const [unitWeightG, setUnitWeightG] = useState<string>(
    initialData?.unit_weight_g ? String(initialData.unit_weight_g) : ''
  );

  // Live calculation of base unit and cost
  let calculatedBaseUnit: BaseUnit = 'g';
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

    const numQty = parseFloat(packageQuantity.replace(',', '.'));
    const numPrice = parseFloat(packagePrice.replace(',', '.'));

    if (!name.trim()) {
      toast.error('Informe o nome do ingrediente.');
      return;
    }
    if (isNaN(numQty) || numQty <= 0) {
      toast.error('Informe uma quantidade comprada válida maior que zero.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error('Informe um preço de compra válido.');
      return;
    }

    setLoading(true);
    try {
      const baseUnit = getBaseUnit(packageUnit);

      await saveIngredient({
        ...(initialData ? { id: initialData.id } : {}),
        name: name.trim(),
        category,
        package_quantity: numQty,
        package_unit: packageUnit,
        package_price: numPrice,
        base_unit: baseUnit,
        brand: brand.trim() || null,
        notes: notes.trim() || null,
        density_g_per_ml: densityGPerMl
          ? parseFloat(densityGPerMl.replace(',', '.'))
          : null,
        unit_weight_g: unitWeightG
          ? parseFloat(unitWeightG.replace(',', '.'))
          : null,
      });

      toast.success(
        initialData
          ? 'Ingrediente atualizado! Receitas recalculadas com o novo preço.'
          : 'Ingrediente cadastrado com sucesso!'
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

        {/* Embalagem e Preço da Compra */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-[#4A2832]">
              Embalagem e Preço da Compra
            </CardTitle>
            <CardDescription className="text-xs text-[#7C6970]">
              Informe a quantidade líquida descrita na embalagem e o valor total que pagou.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Quantidade Comprada *
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Ex: 200, 1, 500..."
                  value={packageQuantity}
                  onChange={(e) => setPackageQuantity(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Unidade de Compra *
                </label>
                <select
                  value={packageUnit}
                  onChange={(e) => setPackageUnit(e.target.value as UnitType)}
                  className="flex h-11 w-full rounded-xl border border-[#EFE4E6] bg-white px-3.5 py-2 text-sm text-[#2E2226] focus:border-[#C86D7F] focus:outline-none focus:ring-2 focus:ring-[#C86D7F]/20"
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
                  Preço Total Pago (R$) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 10.00"
                  value={packagePrice}
                  onChange={(e) => setPackagePrice(e.target.value)}
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
                    Custo Unitário Calculado
                  </p>
                  <p className="text-lg font-bold font-mono text-[#4A2832]">
                    {liveBaseUnitCost !== null
                      ? formatUnitCost(liveBaseUnitCost, calculatedBaseUnit)
                      : 'Preencha quantidade e preço'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-[#7C6970]">
                <span>Unidade-base interna: </span>
                <strong className="text-[#4A2832]">{calculatedBaseUnit}</strong>
                <p className="text-[11px] text-[#968289]">
                  Sem arredondamentos prematuros
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações Avançadas (Opcionais) */}
        <Card className="border-[#EFE4E6] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-[#4A2832]">
              Conversões Especiais (Opcional)
            </CardTitle>
            <CardDescription className="text-xs text-[#7C6970]">
              Configure apenas se quiser que receitas convertam gramas em ml ou peças em peso para este ingrediente.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Densidade (g/ml)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="Ex: 1.03 para leite integral"
                  value={densityGPerMl}
                  onChange={(e) => setDensityGPerMl(e.target.value)}
                />
                <span className="text-[11px] text-[#8C7A82]">
                  Permite usar gramas em líquidos na receita.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#5E4850]">
                  Peso por Unidade (g)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 50 para ovo médio"
                  value={unitWeightG}
                  onChange={(e) => setUnitWeightG(e.target.value)}
                />
                <span className="text-[11px] text-[#8C7A82]">
                  Permite converter unidades em gramas.
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-[#5E4850]">
                Observações Culinárias
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Guardar em local refrigerado após abrir, fornecedor X..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-[#EFE4E6] bg-white p-3 text-sm text-[#2E2226] focus:border-[#C86D7F] focus:outline-none focus:ring-2 focus:ring-[#C86D7F]/20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/ingredientes">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="font-semibold shadow-sm">
            <Save className="h-4 w-4 mr-1.5" />
            {loading ? 'Salvando...' : 'Salvar Ingrediente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
