CREATE TABLE IF NOT EXISTS public.sales_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_no TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_entries_product ON public.sales_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_entries_date ON public.sales_entries(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_entries_branch ON public.sales_entries(branch_id);

ALTER TABLE public.sales_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read sales_entries" ON public.sales_entries;
CREATE POLICY "Allow all authenticated read sales_entries"
  ON public.sales_entries FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated insert sales_entries" ON public.sales_entries;
CREATE POLICY "Allow all authenticated insert sales_entries"
  ON public.sales_entries FOR INSERT
  WITH CHECK (true);

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
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in inventory for this branch';
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
    quantity = GREATEST(v_previous - p_quantity, 0),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE product_id = p_product_id AND branch_id = p_branch_id;

  RETURN QUERY SELECT v_sale_id, v_previous, GREATEST(v_previous - p_quantity, 0);
END;
$$;
