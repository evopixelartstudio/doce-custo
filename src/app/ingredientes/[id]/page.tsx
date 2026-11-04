'use client';

import { Suspense, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { IngredientForm } from '@/components/ingredients/ingredient-form';
import { getIngredientById } from '@/lib/data-service';
import type { Ingredient } from '@/lib/types';
import { toast } from 'sonner';

function EditarIngredienteContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const item = await getIngredientById(resolvedParams.id);
        if (!item) {
          toast.error('Ingrediente não encontrado.');
          router.push('/ingredientes');
          return;
        }
        setIngredient(item);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [resolvedParams.id, router]);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-[#738078]">
        Carregando dados do ingrediente...
      </div>
    );
  }

  return <IngredientForm initialData={ingredient} />;
}

export default function EditarIngredientePage({
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
        <EditarIngredienteContent params={params} />
      </Suspense>
    </AppShell>
  );
}
