'use client';

import { AppShell } from '@/components/layout/app-shell';
import { IngredientForm } from '@/components/ingredients/ingredient-form';

export default function NovoIngredientePage() {
  return (
    <AppShell>
      <IngredientForm />
    </AppShell>
  );
}
