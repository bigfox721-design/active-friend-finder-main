CREATE TABLE IF NOT EXISTS public.quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  production_entry_id UUID REFERENCES public.production_entries(id) ON DELETE SET NULL,
  total_produced INT NOT NULL DEFAULT 0,
  passed_qty INT NOT NULL DEFAULT 0,
  rejected_qty INT NOT NULL DEFAULT 0,
  delivered_qty INT NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  quality_notes TEXT,
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_checks_branch ON public.quality_checks(branch_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_product ON public.quality_checks(product_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_date ON public.quality_checks(checked_at DESC);

ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read quality_checks" ON public.quality_checks;
CREATE POLICY "Allow all authenticated read quality_checks"
  ON public.quality_checks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated insert quality_checks" ON public.quality_checks;
CREATE POLICY "Allow all authenticated insert quality_checks"
  ON public.quality_checks FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated update quality_checks" ON public.quality_checks;
CREATE POLICY "Allow all authenticated update quality_checks"
  ON public.quality_checks FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated delete quality_checks" ON public.quality_checks;
CREATE POLICY "Allow all authenticated delete quality_checks"
  ON public.quality_checks FOR DELETE
  USING (true);
