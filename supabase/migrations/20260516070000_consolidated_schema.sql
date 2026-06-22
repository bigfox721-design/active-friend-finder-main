
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  product_name TEXT,
  sub_product TEXT,
  product_code TEXT,
  code TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_branch_name_uq ON public.products(branch_id, name);

CREATE TABLE IF NOT EXISTS public.sub_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_products_product ON public.sub_products(product_id);

CREATE TABLE IF NOT EXISTS public.production_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_qty INTEGER NOT NULL DEFAULT 0,
  completed_qty INTEGER NOT NULL DEFAULT 0,
  manpower INTEGER,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.production_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_entries_product_date ON public.production_entries(product_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_entries_branch_date ON public.production_entries(branch_id, entry_date DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_entries_updated_at ON public.production_entries;
CREATE TRIGGER trg_entries_updated_at
BEFORE UPDATE ON public.production_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sub_product_id UUID REFERENCES public.sub_products(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_qty INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_targets_scope
  ON public.monthly_targets (
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    product_id,
    COALESCE(sub_product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    year,
    month
  );

DROP TRIGGER IF EXISTS trg_monthly_targets_updated_at ON public.monthly_targets;
CREATE TRIGGER trg_monthly_targets_updated_at
BEFORE UPDATE ON public.monthly_targets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth all branches" ON public.branches;
CREATE POLICY "auth all branches" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon read branches" ON public.branches;
CREATE POLICY "anon read branches" ON public.branches FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "auth all products" ON public.products;
CREATE POLICY "auth all products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon read products" ON public.products;
CREATE POLICY "anon read products" ON public.products FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "auth all sub_products" ON public.sub_products;
CREATE POLICY "auth all sub_products" ON public.sub_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon read sub_products" ON public.sub_products;
CREATE POLICY "anon read sub_products" ON public.sub_products FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "auth all entries" ON public.production_entries;
CREATE POLICY "auth all entries" ON public.production_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon read entries" ON public.production_entries;
CREATE POLICY "anon read entries" ON public.production_entries FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "auth all monthly_targets" ON public.monthly_targets;
CREATE POLICY "auth all monthly_targets" ON public.monthly_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon read monthly_targets" ON public.monthly_targets;
CREATE POLICY "anon read monthly_targets" ON public.monthly_targets FOR SELECT TO anon USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images publicly readable" ON storage.objects;
CREATE POLICY "Avatar images publicly readable"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.branches (name)
SELECT 'Main Branch' WHERE NOT EXISTS (SELECT 1 FROM public.branches);

INSERT INTO public.products (branch_id, name, unit, product_name, product_code)
SELECT b.id, x.name, 'pcs', x.name, x.code
FROM public.branches b
CROSS JOIN (VALUES ('Trolley', 'TRL-001'), ('Wheels', 'WHL-001'), ('Frames', 'FRM-001')) AS x(name, code)
WHERE b.name = 'Main Branch'
  AND NOT EXISTS (SELECT 1 FROM public.products WHERE branch_id = b.id AND name = x.name);

CREATE TABLE IF NOT EXISTS public.smtp_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  smtp_email TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  smtp_host TEXT NOT NULL DEFAULT 'smtp.gmail.com',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "smtp own select" ON public.smtp_config;
CREATE POLICY "smtp own select" ON public.smtp_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "smtp own insert" ON public.smtp_config;
CREATE POLICY "smtp own insert" ON public.smtp_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "smtp own update" ON public.smtp_config;
CREATE POLICY "smtp own update" ON public.smtp_config FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "smtp own delete" ON public.smtp_config;
CREATE POLICY "smtp own delete" ON public.smtp_config FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_smtp_updated_at ON public.smtp_config;
CREATE TRIGGER trg_smtp_updated_at
BEFORE UPDATE ON public.smtp_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
