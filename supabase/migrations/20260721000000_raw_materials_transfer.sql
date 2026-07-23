-- Raw materials transfer system
-- 1. Raw materials master list
-- 2. Raw inventory per branch
-- 3. Update material_transfers for raw materials
-- 4. Send/receive RPCs

-- ──────────────────────────────────────
-- 1. raw_materials table
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated can read raw materials" ON public.raw_materials;
CREATE POLICY "All authenticated can read raw materials"
  ON public.raw_materials FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "All authenticated can insert raw materials" ON public.raw_materials;
CREATE POLICY "All authenticated can insert raw materials"
  ON public.raw_materials FOR INSERT TO authenticated WITH CHECK (true);

-- ──────────────────────────────────────
-- 2. raw_inventory table
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.raw_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, raw_material_id)
);

ALTER TABLE public.raw_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated can read raw inventory" ON public.raw_inventory;
CREATE POLICY "All authenticated can read raw inventory"
  ON public.raw_inventory FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "All authenticated can insert raw inventory" ON public.raw_inventory;
CREATE POLICY "All authenticated can insert raw inventory"
  ON public.raw_inventory FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "All authenticated can update raw inventory" ON public.raw_inventory;
CREATE POLICY "All authenticated can update raw inventory"
  ON public.raw_inventory FOR UPDATE TO authenticated USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_raw_inventory_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_raw_inventory_updated_at ON public.raw_inventory;
CREATE TRIGGER trg_raw_inventory_updated_at
  BEFORE UPDATE ON public.raw_inventory FOR EACH ROW
  EXECUTE FUNCTION public.set_raw_inventory_updated_at();

-- ──────────────────────────────────────
-- 3. Update material_transfers
-- ──────────────────────────────────────
ALTER TABLE public.material_transfers ADD COLUMN IF NOT EXISTS raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE SET NULL;
ALTER TABLE public.material_transfers ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE public.material_transfers ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ──────────────────────────────────────
-- 4. send_raw_material RPC
-- ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_raw_material(
  p_raw_material_id UUID,
  p_quantity INT,
  p_source_branch_id UUID,
  p_dest_branch_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_material_name TEXT;
  v_transfer_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT name INTO v_material_name FROM public.raw_materials WHERE id = p_raw_material_id;

  INSERT INTO public.material_transfers (
    source_branch_id, dest_branch_id, raw_material_id, product_name,
    quantity, status, notes, requested_by
  ) VALUES (
    p_source_branch_id, p_dest_branch_id, p_raw_material_id, v_material_name,
    p_quantity, 'in_transit', p_notes, v_user_id
  )
  RETURNING id INTO v_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer_id
  );
END;
$$;

-- ──────────────────────────────────────
-- 5. receive_raw_material RPC
-- ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.receive_raw_material(
  p_transfer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_transfer RECORD;
  v_inventory_id UUID;
  v_current_qty INT;
  v_new_qty INT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_transfer
  FROM public.material_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status != 'in_transit' THEN
    RAISE EXCEPTION 'Transfer is not in transit (status: %)', v_transfer.status;
  END IF;

  IF v_transfer.raw_material_id IS NULL THEN
    RAISE EXCEPTION 'Transfer has no raw material associated';
  END IF;

  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.raw_inventory
  WHERE raw_material_id = v_transfer.raw_material_id AND branch_id = v_transfer.dest_branch_id
  FOR UPDATE;

  IF v_inventory_id IS NULL THEN
    INSERT INTO public.raw_inventory (branch_id, raw_material_id, quantity)
    VALUES (v_transfer.dest_branch_id, v_transfer.raw_material_id, v_transfer.quantity)
    RETURNING id, quantity INTO v_inventory_id, v_new_qty;
  ELSE
    v_new_qty := v_current_qty + v_transfer.quantity;
    UPDATE public.raw_inventory
    SET quantity = v_new_qty
    WHERE id = v_inventory_id;
  END IF;

  UPDATE public.material_transfers
  SET status = 'completed',
      received_at = NOW(),
      received_by = v_user_id,
      completed_by = v_user_id
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', p_transfer_id,
    'previous_stock', v_current_qty,
    'new_stock', v_new_qty
  );
END;
$$;

-- ──────────────────────────────────────
-- 6. Seed some raw materials
-- ──────────────────────────────────────
INSERT INTO public.raw_materials (name, unit) VALUES
  ('Steel Sheet', 'pcs'),
  ('Aluminum Bar', 'kg'),
  ('Copper Wire', 'm'),
  ('Plastic Granules', 'kg'),
  ('Rubber Grip', 'pcs')
ON CONFLICT DO NOTHING;
