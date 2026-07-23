-- Review meeting features: Activity log, Inventory, Material transfers, Status updates, Edit overrides

-- 1. Activity log (Req 3)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'entry_created', 'entry_updated', 'target_set', 'delay_reason', 'inventory_adjust', 'transfer_init', 'transfer_complete', 'override_granted'
  description TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read" ON public.activity_logs;
CREATE POLICY "Allow all authenticated read" ON public.activity_logs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all authenticated insert" ON public.activity_logs;
CREATE POLICY "Allow all authenticated insert" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 2. Material transfers (Req 4)
CREATE TABLE IF NOT EXISTS public.material_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  dest_branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  notes TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.material_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read transfers" ON public.material_transfers;
CREATE POLICY "Allow all authenticated read transfers" ON public.material_transfers
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow manager insert transfer" ON public.material_transfers;
CREATE POLICY "Allow manager insert transfer" ON public.material_transfers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

DROP POLICY IF EXISTS "Allow manager update transfer" ON public.material_transfers;
CREATE POLICY "Allow manager update transfer" ON public.material_transfers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

-- 3. Inventory (Req 5)
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, product_id)
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read inventory" ON public.inventory;
CREATE POLICY "Allow all authenticated read inventory" ON public.inventory
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow manager write inventory" ON public.inventory;
CREATE POLICY "Allow manager write inventory" ON public.inventory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

-- 4. Status updates / live feed (Req 6)
CREATE TABLE IF NOT EXISTS public.status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  update_type TEXT NOT NULL DEFAULT 'info' CHECK (update_type IN ('info', 'warning', 'success', 'error', 'transfer', 'process_complete')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read updates" ON public.status_updates;
CREATE POLICY "Allow all authenticated read updates" ON public.status_updates
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all authenticated insert updates" ON public.status_updates;
CREATE POLICY "Allow all authenticated insert updates" ON public.status_updates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Edit overrides (Req 7)
CREATE TABLE IF NOT EXISTS public.edit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.edit_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read overrides" ON public.edit_overrides;
CREATE POLICY "Allow all authenticated read overrides" ON public.edit_overrides
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow manager manage overrides" ON public.edit_overrides;
CREATE POLICY "Allow manager manage overrides" ON public.edit_overrides
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS set_updated_at_material_transfers ON public.material_transfers;
CREATE TRIGGER set_updated_at_material_transfers
  BEFORE UPDATE ON public.material_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_inventory ON public.inventory;
CREATE TRIGGER set_updated_at_inventory
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
 