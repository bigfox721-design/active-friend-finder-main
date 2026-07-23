-- Add plan/actual columns to existing inventory table
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS plan_qty INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_complete_qty INTEGER NOT NULL DEFAULT 0;

-- Accessories master table
CREATE TABLE IF NOT EXISTS public.accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accessories_branch ON public.accessories(branch_id);

-- Accessory inventory tracking
CREATE TABLE IF NOT EXISTS public.accessory_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES public.accessories(id) ON DELETE CASCADE,
  plan_qty INTEGER NOT NULL DEFAULT 0,
  actual_complete_qty INTEGER NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, accessory_id)
);

-- RLS
ALTER TABLE public.accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessory_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read accessories" ON public.accessories;
CREATE POLICY "Allow all authenticated read accessories"
  ON public.accessories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated manage accessories" ON public.accessories;
CREATE POLICY "Allow all authenticated manage accessories"
  ON public.accessories FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated update accessories" ON public.accessories;
CREATE POLICY "Allow all authenticated update accessories"
  ON public.accessories FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated delete accessories" ON public.accessories;
CREATE POLICY "Allow all authenticated delete accessories"
  ON public.accessories FOR DELETE
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated read accessory_inventory" ON public.accessory_inventory;
CREATE POLICY "Allow all authenticated read accessory_inventory"
  ON public.accessory_inventory FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated insert accessory_inventory" ON public.accessory_inventory;
CREATE POLICY "Allow all authenticated insert accessory_inventory"
  ON public.accessory_inventory FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated update accessory_inventory" ON public.accessory_inventory;
CREATE POLICY "Allow all authenticated update accessory_inventory"
  ON public.accessory_inventory FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated delete accessory_inventory" ON public.accessory_inventory;
CREATE POLICY "Allow all authenticated delete accessory_inventory"
  ON public.accessory_inventory FOR DELETE
  USING (true);
