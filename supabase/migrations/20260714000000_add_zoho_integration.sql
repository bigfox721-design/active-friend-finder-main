CREATE TABLE IF NOT EXISTS public.processed_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_invoices_invoice_id
  ON public.processed_invoices(invoice_id);

ALTER TABLE public.processed_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated read processed_invoices" ON public.processed_invoices;
CREATE POLICY "Allow all authenticated read processed_invoices"
  ON public.processed_invoices FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated insert processed_invoices" ON public.processed_invoices;
CREATE POLICY "Allow all authenticated insert processed_invoices"
  ON public.processed_invoices FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated update processed_invoices" ON public.processed_invoices;
CREATE POLICY "Allow all authenticated update processed_invoices"
  ON public.processed_invoices FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Allow all authenticated delete processed_invoices" ON public.processed_invoices;
CREATE POLICY "Allow all authenticated delete processed_invoices"
  ON public.processed_invoices FOR DELETE
  USING (true);

CREATE OR REPLACE FUNCTION public.reduce_stock(
  p_product_name TEXT,
  p_qty INTEGER
)
RETURNS TABLE(
  matched BOOLEAN,
  previous_stock INTEGER,
  new_stock INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous INTEGER;
BEGIN
  SELECT quantity INTO v_previous
  FROM public.inventory
  WHERE LOWER(product_name) = LOWER(p_product_name)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  UPDATE public.inventory
  SET
    quantity = GREATEST(v_previous - p_qty, 0),
    updated_at = now()
  WHERE LOWER(product_name) = LOWER(p_product_name);

  RETURN QUERY SELECT true, v_previous, GREATEST(v_previous - p_qty, 0);
END;
$$;
