-- A+B: Soft limit manager override
-- D: Reversal system (clean undo)
-- C: Edit locking (>24h read-only)

-- ──────────────────────────────────────
-- 1. Remove hard CHECK constraint so overrides can go negative
-- ──────────────────────────────────────
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS stock_non_negative;

-- ──────────────────────────────────────
-- 2. stock_override_requests table
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_override_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  requested_quantity INT NOT NULL,
  current_stock INT NOT NULL,
  params JSONB,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.stock_override_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read override requests"
  ON public.stock_override_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated can insert override requests"
  ON public.stock_override_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Only managers can update override requests"
  ON public.stock_override_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'));

-- ──────────────────────────────────────
-- 3. Add reversed_at / reversed_by to sales_entries
-- ──────────────────────────────────────
ALTER TABLE public.sales_entries ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE public.sales_entries ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ──────────────────────────────────────
-- 4. Replace record_sale — add override support
-- ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_sale(
  p_product_id UUID,
  p_quantity INT,
  p_branch_id UUID,
  p_sale_date DATE DEFAULT CURRENT_DATE,
  p_reference_no TEXT DEFAULT NULL,
  p_override_approved_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory_id UUID;
  v_previous INT;
  v_new_stock INT;
  v_is_manager BOOLEAN;
  v_override_id UUID;
BEGIN
  SELECT id, quantity INTO v_inventory_id, v_previous
  FROM public.inventory
  WHERE product_id = p_product_id AND branch_id = p_branch_id
  FOR UPDATE;

  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Product not found in inventory for this branch' USING HINT = 'Ensure the product exists in inventory before recording a sale.';
  END IF;

  IF v_previous < p_quantity AND p_override_approved_by IS NULL THEN
    RAISE EXCEPTION 'Insufficient stock: have %, need %. Ask a manager to approve an override.', v_previous, p_quantity;
  END IF;

  IF v_previous < p_quantity AND p_override_approved_by IS NOT NULL THEN
    SELECT role = 'manager' INTO v_is_manager
    FROM public.users WHERE id = p_override_approved_by;
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'Only managers can approve stock overrides.';
    END IF;

    INSERT INTO public.stock_override_requests (
      action_type, product_id, branch_id, requested_quantity, current_stock,
      params, requested_by, approved_by, status, reviewed_at
    ) VALUES (
      'sale', p_product_id, p_branch_id, p_quantity, v_previous,
      jsonb_build_object(
        'p_product_id', p_product_id,
        'p_quantity', p_quantity,
        'p_branch_id', p_branch_id,
        'p_sale_date', p_sale_date,
        'p_reference_no', p_reference_no
      ),
      p_override_approved_by, p_override_approved_by, 'approved', NOW()
    )
    RETURNING id INTO v_override_id;
  END IF;

  v_new_stock := v_previous - p_quantity;

  PERFORM set_config('app.inventory_change_type', 'SALE', true);
  PERFORM set_config('app.inventory_reference_id',
    COALESCE('override-' || v_override_id || '-sale-' || p_reference_no, 'manual-sale-' || p_reference_no),
    true
  );

  UPDATE public.inventory
  SET quantity = v_new_stock
  WHERE id = v_inventory_id;

  INSERT INTO public.sales_entries (branch_id, product_id, quantity, sale_date, reference_no, created_by)
  VALUES (p_branch_id, p_product_id, p_quantity, p_sale_date, p_reference_no, COALESCE(p_override_approved_by, auth.uid()));

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', v_previous,
    'new_stock', v_new_stock,
    'override_id', v_override_id
  );
END;
$$;

-- ──────────────────────────────────────
-- 5. Replace reduce_stock — add override support
-- ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reduce_stock(
  p_product_name TEXT,
  p_qty INT,
  p_change_type TEXT DEFAULT 'ADJUSTMENT',
  p_reference_id TEXT DEFAULT NULL,
  p_override_approved_by UUID DEFAULT NULL
)
RETURNS TABLE(
  matched BOOLEAN,
  previous_stock INT,
  new_stock INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory RECORD;
  v_override_id UUID;
  v_is_manager BOOLEAN;
BEGIN
  SELECT id, quantity, product_id, branch_id INTO v_inventory
  FROM public.inventory
  WHERE LOWER(product_name) = LOWER(p_product_name)
  FOR UPDATE;

  IF NOT FOUND THEN
    matched := false;
    previous_stock := 0;
    new_stock := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_inventory.quantity < p_qty AND p_override_approved_by IS NULL THEN
    RAISE EXCEPTION 'Insufficient stock for "%": have %, need %', p_product_name, v_inventory.quantity, p_qty;
  END IF;

  IF v_inventory.quantity < p_qty AND p_override_approved_by IS NOT NULL THEN
    SELECT role = 'manager' INTO v_is_manager
    FROM public.users WHERE id = p_override_approved_by;
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'Only managers can approve stock overrides.';
    END IF;

    INSERT INTO public.stock_override_requests (
      action_type, product_id, branch_id, requested_quantity, current_stock,
      params, requested_by, approved_by, status, reviewed_at
    ) VALUES (
      'stock_reduction', v_inventory.product_id, v_inventory.branch_id, p_qty, v_inventory.quantity,
      jsonb_build_object('p_product_name', p_product_name, 'p_qty', p_qty),
      p_override_approved_by, p_override_approved_by, 'approved', NOW()
    )
    RETURNING id INTO v_override_id;
  END IF;

  PERFORM set_config('app.inventory_change_type', p_change_type, true);
  PERFORM set_config('app.inventory_reference_id',
    COALESCE(p_reference_id, 'override-' || v_override_id),
    true
  );

  UPDATE public.inventory
  SET quantity = v_inventory.quantity - p_qty
  WHERE id = v_inventory.id;

  matched := true;
  previous_stock := v_inventory.quantity;
  new_stock := v_inventory.quantity - p_qty;
  RETURN NEXT;
END;
$$;

-- ──────────────────────────────────────
-- 6. reverse_sale function
-- ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reverse_sale(
  p_sale_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale RECORD;
  v_inventory_id UUID;
  v_previous_stock INT;
  v_new_stock INT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_sale
  FROM public.sales_entries
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale entry not found';
  END IF;

  IF v_sale.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sale has already been reversed on %', v_sale.reversed_at;
  END IF;

  SELECT id, quantity INTO v_inventory_id, v_previous_stock
  FROM public.inventory
  WHERE product_id = v_sale.product_id AND branch_id = v_sale.branch_id
  FOR UPDATE;

  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Inventory record not found for this product and branch';
  END IF;

  v_new_stock := v_previous_stock + v_sale.quantity;

  UPDATE public.sales_entries
  SET reversed_at = NOW(), reversed_by = v_user_id
  WHERE id = p_sale_id;

  PERFORM set_config('app.inventory_change_type', 'RETURN', true);
  PERFORM set_config('app.inventory_reference_id', 'reverse-sale-' || p_sale_id, true);

  UPDATE public.inventory
  SET quantity = v_new_stock
  WHERE id = v_inventory_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', v_previous_stock,
    'new_stock', v_new_stock,
    'reversed_sale_id', p_sale_id
  );
END;
$$;

-- ──────────────────────────────────────
-- C: Edit locking — prevent updating entries older than 24 hours
-- ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_old_entry_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.created_at < NOW() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Cannot edit entries older than 24 hours (created at %).', OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_old_sale_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.created_at < NOW() - INTERVAL '24 hours' THEN
      RAISE EXCEPTION 'Cannot delete sale entries older than 24 hours. Use reverse instead.';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.created_at < NOW() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Cannot edit sale entries older than 24 hours (created at %).', OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_old_production_update ON public.production_entries;
CREATE TRIGGER trg_prevent_old_production_update
  BEFORE UPDATE ON public.production_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_old_entry_update();

DROP TRIGGER IF EXISTS trg_prevent_old_sale_update ON public.sales_entries;
CREATE TRIGGER trg_prevent_old_sale_update
  BEFORE UPDATE OR DELETE ON public.sales_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_old_sale_update();
