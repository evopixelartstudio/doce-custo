'use client';

import { AppShell } from '@/components/layout/app-shell';
import { RecipeForm } from '@/components/recipes/recipe-form';

export default function NovaReceitaPage() {
  return (
    <AppShell>
      <RecipeForm />
    </AppShell>
  );
}
