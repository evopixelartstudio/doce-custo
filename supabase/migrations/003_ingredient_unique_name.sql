-- ==============================================================================
-- SISTEMA DE GESTÃO DE RECEITAS E PRECIPICAÇÃO (DOCECUSTO)
-- MIGRATION 003: ÍNDICE DE UNICIDADE DE NOME DE INGREDIENTES
-- Impede duplicações de ingredientes pelo mesmo nome (case-insensitive e sem espaços extras)
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_unique_name 
  ON public.ingredients (lower(trim(name))) 
  WHERE (is_archived = false);
