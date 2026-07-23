ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS stock_non_negative,
  ADD CONSTRAINT stock_non_negative CHECK (quantity >= 0);

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
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  IF v_previous < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock: have %, need %', v_previous, p_qty
      USING HINT = 'Reduce the sale quantity or restock first';
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

  PERFORM set_config('app.inventory_change_type', 'sale', true);
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

  PERFORM set_config('app.inventory_change_type', 'production', true);
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
