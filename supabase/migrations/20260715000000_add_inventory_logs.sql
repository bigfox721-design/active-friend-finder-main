CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('sale', 'production', 'manual', 'transfer')),
  quantity_change INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reference_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON public.inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON public.inventory_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_change_type ON public.inventory_logs(change_type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_reference_id ON public.inventory_logs(reference_id);

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read inventory_logs" ON public.inventory_logs;
CREATE POLICY "Allow all authenticated read inventory_logs"
  ON public.inventory_logs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated insert inventory_logs" ON public.inventory_logs;
CREATE POLICY "Allow all authenticated insert inventory_logs"
  ON public.inventory_logs FOR INSERT
  WITH CHECK (true);

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
      v_change_type := COALESCE(NULLIF(current_setting('app.inventory_change_type', true), ''), 'manual');
    EXCEPTION WHEN OTHERS THEN
      v_change_type := 'manual';
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

DROP TRIGGER IF EXISTS trg_inventory_log_changes ON public.inventory;
CREATE TRIGGER trg_inventory_log_changes
  AFTER UPDATE OF quantity ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.log_inventory_changes();

DROP FUNCTION IF EXISTS public.reduce_stock(TEXT, INT);

CREATE OR REPLACE FUNCTION public.reduce_stock(
  p_product_name TEXT,
  p_qty INT,
  p_change_type TEXT DEFAULT 'manual',
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
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  PERFORM set_config('app.inventory_change_type', p_change_type, true);
  IF p_reference_id IS NOT NULL THEN
    PERFORM set_config('app.inventory_reference_id', p_reference_id, true);
  END IF;

  UPDATE public.inventory
  SET
    quantity = GREATEST(v_previous - p_qty, 0),
    updated_at = now()
  WHERE LOWER(product_name) = LOWER(p_product_name);

  RETURN QUERY SELECT true, v_previous, GREATEST(v_previous - p_qty, 0);
END;
$$;
