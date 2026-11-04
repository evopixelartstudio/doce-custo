-- ==============================================================================
-- SISTEMA DE GESTÃO DE RECEITAS E PRECIFICAÇÃO (DOCECUSTO)
-- MIGRATION 002: REMOVER OBRIGATORIEDADE DE AUTENTICAÇÃO E RLS PARA USO INDIVIDUAL
-- ==============================================================================

-- 1. Desativar RLS para permitir leitura e gravação livre com chave pública
ALTER TABLE public.ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_additional_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_price_history DISABLE ROW LEVEL SECURITY;

-- 2. Permitir que user_id seja nulo ou opcional
ALTER TABLE public.ingredients ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.recipes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.ingredient_price_history ALTER COLUMN user_id DROP NOT NULL;

-- 3. Remover chaves estrangeiras vinculadas à tabela auth.users
ALTER TABLE public.ingredients DROP CONSTRAINT IF EXISTS ingredients_user_id_fkey;
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_user_id_fkey;
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE public.ingredient_price_history DROP CONSTRAINT IF EXISTS ingredient_price_history_user_id_fkey;

-- 4. Garantir políticas permissivas no storage de fotos
DO $$
BEGIN
  CREATE POLICY "Public Access recipe-photos"
    ON storage.objects FOR ALL
    USING (bucket_id = 'recipe-photos')
    WITH CHECK (bucket_id = 'recipe-photos');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

