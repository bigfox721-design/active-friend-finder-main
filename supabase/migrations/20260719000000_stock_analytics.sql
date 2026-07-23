ALTER TABLE public.inventory_logs
  DROP CONSTRAINT IF EXISTS inventory_logs_change_type_check,
  ADD CONSTRAINT inventory_logs_change_type_check
    CHECK (change_type IN ('SALE', 'PRODUCTION', 'ADJUSTMENT', 'TRANSFER', 'RETURN'));

UPDATE public.inventory_logs SET change_type = 'SALE' WHERE change_type = 'sale';
UPDATE public.inventory_logs SET change_type = 'PRODUCTION' WHERE change_type = 'production';
UPDATE public.inventory_logs SET change_type = 'ADJUSTMENT' WHERE change_type = 'manual';
UPDATE public.inventory_logs SET change_type = 'TRANSFER' WHERE change_type = 'transfer';

CREATE OR REPLACE FUNCTION public.reduce_stock(
  p_product_name TEXT,
  p_qty INT,
  p_change_type TEXT DEFAULT 'ADJUSTMENT',
  p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  matched BOOLEAN,
  previous_stock INT,
  new_stock INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous INT;
BEGIN
  SELECT quantity INTO v_previous
  FROM public.inventory
  WHERE LOWER(product_name) = LOWER(p_product_name)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  IF v_previous < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock: have %, need %', v_previous, p_qty
      USING HINT = 'Reduce the quantity or restock first';
  END IF;

  PERFORM set_config('app.inventory_change_type', p_change_type, true);
  IF p_reference_id IS NOT NULL THEN
    PERFORM set_config('app.inventory_reference_id', p_reference_id, true);
  END IF;

  UPDATE public.inventory
  SET
    quantity = v_previous - p_qty,
    updated_at = now()
  WHERE LOWER(product_name) = LOWER(p_product_name);

  RETURN QUERY SELECT true, v_previous, v_previous - p_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_sale(
  p_product_id UUID,
  p_quantity INT,
  p_branch_id UUID,
  p_sale_date DATE DEFAULT CURRENT_DATE,
  p_reference_no TEXT DEFAULT NULL
)
RETURNS TABLE(
  sale_id UUID,
  previous_stock INT,
  new_stock INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous INT;
  v_sale_id UUID;
BEGIN
  SELECT quantity INTO v_previous
  FROM public.inventory
  WHERE product_id = p_product_id AND branch_id = p_branch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in inventory for this branch';
  END IF;

  IF v_previous < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: have %, need %', v_previous, p_quantity
      USING HINT = 'Reduce the sale quantity or restock first';
  END IF;

  INSERT INTO public.sales_entries (branch_id, product_id, quantity, sale_date, reference_no, created_by)
  VALUES (p_branch_id, p_product_id, p_quantity, p_sale_date, p_reference_no, auth.uid())
  RETURNING id INTO v_sale_id;

  PERFORM set_config('app.inventory_change_type', 'SALE', true);
  IF p_reference_no IS NOT NULL THEN
    PERFORM set_config('app.inventory_reference_id', 'sale-' || p_reference_no, true);
  END IF;

  UPDATE public.inventory
  SET
    quantity = v_previous - p_quantity,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE product_id = p_product_id AND branch_id = p_branch_id;

  RETURN QUERY SELECT v_sale_id, v_previous, v_previous - p_quantity;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_production_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_delta INT;
  v_product_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := NEW.completed_qty;
  ELSIF TG_OP = 'UPDATE' THEN
    v_delta := NEW.completed_qty - OLD.completed_qty;
  END IF;

  IF v_delta = 0 THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_product_name FROM public.products WHERE id = NEW.product_id;

  PERFORM set_config('app.inventory_change_type', 'PRODUCTION', true);
  IF TG_OP = 'UPDATE' THEN
    PERFORM set_config('app.inventory_reference_id', 'prod-entry-' || NEW.id, true);
  END IF;

  INSERT INTO public.inventory (branch_id, product_id, product_name, quantity, updated_at)
  VALUES (NEW.branch_id, NEW.product_id, v_product_name, GREATEST(v_delta, 0), now())
  ON CONFLICT (branch_id, product_id)
  DO UPDATE SET
    quantity = GREATEST(inventory.quantity + v_delta, 0),
    updated_at = now(),
    product_name = COALESCE(NULLIF(v_product_name, ''), inventory.product_name);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_inventory_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_change_type TEXT;
  v_reference_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.quantity IS DISTINCT FROM NEW.quantity THEN
    BEGIN
      v_change_type := COALESCE(NULLIF(current_setting('app.inventory_change_type', true), ''), 'ADJUSTMENT');
    EXCEPTION WHEN OTHERS THEN
      v_change_type := 'ADJUSTMENT';
    END;
    BEGIN
      v_reference_id := NULLIF(current_setting('app.inventory_reference_id', true), '');
    EXCEPTION WHEN OTHERS THEN
      v_reference_id := NULL;
    END;
    INSERT INTO public.inventory_logs (
      product_id, product_name, change_type, quantity_change,
      previous_stock, new_stock, reference_id, created_by
    ) VALUES (
      NEW.product_id,
      NEW.product_name,
      v_change_type,
      NEW.quantity - OLD.quantity,
      OLD.quantity,
      NEW.quantity,
      v_reference_id,
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.daily_inventory_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_stock INT NOT NULL DEFAULT 0,
  closing_stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, product_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_snapshot_date ON public.daily_inventory_snapshot(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_snapshot_product ON public.daily_inventory_snapshot(product_id);

ALTER TABLE public.daily_inventory_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read daily_snapshot" ON public.daily_inventory_snapshot;
CREATE POLICY "Allow all authenticated read daily_snapshot"
  ON public.daily_inventory_snapshot FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated insert daily_snapshot" ON public.daily_inventory_snapshot;
CREATE POLICY "Allow all authenticated insert daily_snapshot"
  ON public.daily_inventory_snapshot FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.record_daily_snapshot(
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT := 0;
  v_prev RECORD;
BEGIN
  FOR v_prev IN
    SELECT i.branch_id, i.product_id, i.quantity, i.product_name,
           COALESCE(
             (SELECT closing_stock FROM public.daily_inventory_snapshot
              WHERE branch_id = i.branch_id
                AND product_id = i.product_id
                AND snapshot_date = p_snapshot_date - 1),
             i.quantity
           ) AS prev_closing
    FROM public.inventory i
    WHERE i.quantity > 0
  LOOP
    INSERT INTO public.daily_inventory_snapshot
      (branch_id, product_id, snapshot_date, opening_stock, closing_stock)
    VALUES (
      v_prev.branch_id,
      v_prev.product_id,
      p_snapshot_date,
      v_prev.prev_closing,
      v_prev.quantity
    )
    ON CONFLICT (branch_id, product_id, snapshot_date)
    DO UPDATE SET
      opening_stock = EXCLUDED.opening_stock,
      closing_stock = EXCLUDED.closing_stock;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stock_forecast(
  p_product_id UUID,
  p_branch_id UUID
)
RETURNS TABLE(
  current_stock INT,
  avg_daily_sales NUMERIC,
  days_remaining NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock INT;
  v_avg_sales NUMERIC;
BEGIN
  SELECT quantity INTO v_stock
  FROM public.inventory
  WHERE product_id = p_product_id AND branch_id = p_branch_id;

  SELECT COALESCE(SUM(quantity)::NUMERIC / 7.0, 0) INTO v_avg_sales
  FROM public.sales_entries
  WHERE product_id = p_product_id
    AND branch_id = p_branch_id
    AND sale_date >= CURRENT_DATE - 7;

  RETURN QUERY
  SELECT
    v_stock,
    ROUND(v_avg_sales, 1),
    CASE WHEN v_avg_sales > 0 THEN ROUND(v_stock / v_avg_sales, 1) ELSE NULL END;
END;
$$;
