'use client';

import { Suspense, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { RecipeForm } from '@/components/recipes/recipe-form';
import { getRecipeById } from '@/lib/data-service';
import type { Recipe } from '@/lib/types';
import { toast } from 'sonner';

function EditarReceitaContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const item = await getRecipeById(resolvedParams.id);
        if (!item) {
          toast.error('Receita não encontrada.');
          router.push('/receitas');
          return;
        }
        setRecipe(item);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [resolvedParams.id, router]);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-[#738078]">
        Carregando dados da receita...
      </div>
    );
  }

  return <RecipeForm initialData={recipe} />;
}

export default function EditarReceitaPage({
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
        <EditarReceitaContent params={params} />
      </Suspense>
    </AppShell>
  );
}
