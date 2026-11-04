-- ==============================================================================
-- SISTEMA DE GESTÃO DE RECEITAS E PRECIFICAÇÃO (DOCECUSTO)
-- MIGRATION 001: ESTRUTURA COMPLETA, CONSTRAINTS, RLS E STORAGE
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PERFIS DE USUÁRIO
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  business_name TEXT DEFAULT 'Minha Confeitaria',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABELA DE CONFIGURAÇÕES DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT 'Confeitaria Artesanal',
  default_pricing_method TEXT NOT NULL DEFAULT 'margin' CHECK (default_pricing_method IN ('markup', 'margin')),
  default_markup_percentage NUMERIC(7, 2) NOT NULL DEFAULT 100.00 CHECK (default_markup_percentage >= 0),
  default_target_margin_percentage NUMERIC(7, 2) NOT NULL DEFAULT 50.00 CHECK (default_target_margin_percentage >= 0 AND default_target_margin_percentage < 100),
  default_card_fee_percentage NUMERIC(7, 2) NOT NULL DEFAULT 3.50 CHECK (default_card_fee_percentage >= 0 AND default_card_fee_percentage < 100),
  round_prices_to_cents BOOLEAN NOT NULL DEFAULT true,
  default_additional_costs JSONB NOT NULL DEFAULT '[
    {"description": "Embalagem padrão", "amount": 3.50, "is_proportional": true},
    {"description": "Gás e energia", "amount": 2.00, "is_proportional": false},
    {"description": "Mão de obra por produção", "amount": 10.00, "is_proportional": false}
  ]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABELA DE INGREDIENTES
CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'laticinios', 'farinaceos', 'chocolates', 'frutas', 
    'ovos', 'coberturas', 'embalagens', 'outros'
  )),
  package_quantity NUMERIC(14, 4) NOT NULL CHECK (package_quantity > 0),
  package_unit TEXT NOT NULL CHECK (package_unit IN ('g', 'kg', 'ml', 'L', 'unidade')),
  package_price NUMERIC(14, 4) NOT NULL CHECK (package_price >= 0),
  base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'unidade')),
  cost_per_base_unit NUMERIC(18, 8) NOT NULL CHECK (cost_per_base_unit >= 0),
  brand TEXT,
  notes TEXT,
  density_g_per_ml NUMERIC(10, 4) CHECK (density_g_per_ml > 0),
  unit_weight_g NUMERIC(10, 4) CHECK (unit_weight_g > 0),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ÍNDICES PARA INGREDIENTES
CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON public.ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON public.ingredients(user_id, category);
CREATE INDEX IF NOT EXISTS idx_ingredients_is_archived ON public.ingredients(user_id, is_archived);

-- 5. TABELA DE HISTÓRICO DE PREÇOS DE INGREDIENTES
CREATE TABLE IF NOT EXISTS public.ingredient_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_price NUMERIC(14, 4) NOT NULL,
  new_price NUMERIC(14, 4) NOT NULL,
  old_package_quantity NUMERIC(14, 4) NOT NULL,
  new_package_quantity NUMERIC(14, 4) NOT NULL,
  old_cost_per_base_unit NUMERIC(18, 8) NOT NULL,
  new_cost_per_base_unit NUMERIC(18, 8) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_price_history_ingredient_id ON public.ingredient_price_history(ingredient_id);

-- 6. TABELA DE RECEITAS
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'bolos',
  description TEXT,
  photo_url TEXT,
  yield_quantity NUMERIC(10, 2) NOT NULL CHECK (yield_quantity > 0),
  yield_unit TEXT NOT NULL CHECK (yield_unit IN ('unidades', 'fatias', 'porções', 'g', 'kg')),
  prep_time_minutes INTEGER CHECK (prep_time_minutes >= 0),
  pricing_method TEXT NOT NULL DEFAULT 'margin' CHECK (pricing_method IN ('markup', 'margin')),
  markup_percentage NUMERIC(7, 2) NOT NULL DEFAULT 100.00 CHECK (markup_percentage >= 0),
  target_margin_percentage NUMERIC(7, 2) NOT NULL DEFAULT 50.00 CHECK (target_margin_percentage >= 0 AND target_margin_percentage < 100),
  card_fee_percentage NUMERIC(7, 2) NOT NULL DEFAULT 0.00 CHECK (card_fee_percentage >= 0 AND card_fee_percentage < 100),
  manual_sale_price NUMERIC(14, 2) CHECK (manual_sale_price >= 0),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_is_archived ON public.recipes(user_id, is_archived);

-- 7. TABELA DE ITENS DA RECEITA (INGREDIENTES OU SUB-RECEITAS)
CREATE TABLE IF NOT EXISTS public.recipe_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('ingredient', 'sub_recipe')),
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  sub_recipe_id UUID REFERENCES public.recipes(id) ON DELETE RESTRICT,
  quantity NUMERIC(14, 4) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'L', 'unidade')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  
  -- Constraint para garantir que ou ingredient_id ou sub_recipe_id está preenchido
  CONSTRAINT check_item_reference CHECK (
    (item_type = 'ingredient' AND ingredient_id IS NOT NULL AND sub_recipe_id IS NULL) OR
    (item_type = 'sub_recipe' AND sub_recipe_id IS NOT NULL AND ingredient_id IS NULL)
  ),
  -- Impede auto-referência direta
  CONSTRAINT check_not_self_referencing CHECK (recipe_id != sub_recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe_id ON public.recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient_id ON public.recipe_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_sub_recipe_id ON public.recipe_items(sub_recipe_id);

-- 8. TABELA DE CUSTOS ADICIONAIS DA RECEITA
CREATE TABLE IF NOT EXISTS public.recipe_additional_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  is_proportional BOOLEAN NOT NULL DEFAULT true, -- true = escala com o rendimento na simulação, false = fixo por fornada
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recipe_additional_costs_recipe_id ON public.recipe_additional_costs(recipe_id);

-- 9. FUNÇÃO E TRIGGER PARA HISTÓRICO DE PREÇO DE INGREDIENTE
CREATE OR REPLACE FUNCTION public.handle_ingredient_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.package_price IS DISTINCT FROM NEW.package_price OR 
      OLD.package_quantity IS DISTINCT FROM NEW.package_quantity OR
      OLD.cost_per_base_unit IS DISTINCT FROM NEW.cost_per_base_unit) THEN
    
    INSERT INTO public.ingredient_price_history (
      ingredient_id,
      user_id,
      old_price,
      new_price,
      old_package_quantity,
      new_package_quantity,
      old_cost_per_base_unit,
      new_cost_per_base_unit,
      changed_at
    ) VALUES (
      NEW.id,
      NEW.user_id,
      OLD.package_price,
      NEW.package_price,
      OLD.package_quantity,
      NEW.package_quantity,
      OLD.cost_per_base_unit,
      NEW.cost_per_base_unit,
      now()
    );
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ingredient_price_change ON public.ingredients;
CREATE TRIGGER trg_ingredient_price_change
BEFORE UPDATE ON public.ingredients
FOR EACH ROW
EXECUTE FUNCTION public.handle_ingredient_price_change();

-- 10. TRIGGER PARA CRIAR PERFIL E CONFIGURAÇÕES PADRÃO AO REGISTRAR USUÁRIO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, business_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Confeiteira'),
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'Minha Confeitaria')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, business_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'Minha Confeitaria')
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
CREATE TRIGGER trg_new_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 11. HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_additional_costs ENABLE ROW LEVEL SECURITY;

-- 12. POLÍTICAS RLS (ISOLAMENTO POR USUÁRIO AUTENTICADO)
-- Profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- User Settings
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ingredients
CREATE POLICY "Users can view their own ingredients"
  ON public.ingredients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ingredients"
  ON public.ingredients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ingredients"
  ON public.ingredients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ingredients"
  ON public.ingredients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ingredient Price History
CREATE POLICY "Users can view their own ingredient price history"
  ON public.ingredient_price_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into price history"
  ON public.ingredient_price_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Recipes
CREATE POLICY "Users can view their own recipes"
  ON public.recipes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipes"
  ON public.recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
  ON public.recipes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
  ON public.recipes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Recipe Items
CREATE POLICY "Users can view items of their recipes"
  ON public.recipe_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_items.recipe_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items into their recipes"
  ON public.recipe_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_items.recipe_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their recipes"
  ON public.recipe_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_items.recipe_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items in their recipes"
  ON public.recipe_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_items.recipe_id
      AND r.user_id = auth.uid()
    )
  );

-- Recipe Additional Costs
CREATE POLICY "Users can view additional costs of their recipes"
  ON public.recipe_additional_costs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_additional_costs.recipe_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert additional costs to their recipes"
  ON public.recipe_additional_costs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_additional_costs.recipe_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update additional costs in their recipes"
  ON public.recipe_additional_costs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_additional_costs.recipe_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete additional costs in their recipes"
  ON public.recipe_additional_costs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_additional_costs.recipe_id
      AND r.user_id = auth.uid()
    )
  );

-- 13. CONFIGURAÇÃO DE BUCKET DE ARMAZENAMENTO PARA FOTOS DE RECEITAS
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-photos', 'recipe-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Recipe photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe-photos');

CREATE POLICY "Authenticated users can upload recipe photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recipe-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can update their own recipe photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'recipe-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete their own recipe photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recipe-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

