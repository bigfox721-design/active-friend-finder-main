CREATE TABLE IF NOT EXISTS public.stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  accessory_id UUID REFERENCES public.accessories(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  plan_qty INTEGER NOT NULL DEFAULT 0,
  actual_complete_qty INTEGER NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'product' CHECK (category IN ('product', 'accessory')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_entries_product_date
  ON public.stock_entries(branch_id, entry_date, product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_entries_accessory_date
  ON public.stock_entries(branch_id, entry_date, accessory_id)
  WHERE accessory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_entries_branch_date ON public.stock_entries(branch_id, entry_date);

ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read stock_entries" ON public.stock_entries;
CREATE POLICY "Allow all authenticated read stock_entries"
  ON public.stock_entries FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated insert stock_entries" ON public.stock_entries;
CREATE POLICY "Allow all authenticated insert stock_entries"
  ON public.stock_entries FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated update stock_entries" ON public.stock_entries;
CREATE POLICY "Allow all authenticated update stock_entries"
  ON public.stock_entries FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated delete stock_entries" ON public.stock_entries;
CREATE POLICY "Allow all authenticated delete stock_entries"
  ON public.stock_entries FOR DELETE
  USING (true);
