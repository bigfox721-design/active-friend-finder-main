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

DROP TRIGGER IF EXISTS trg_sync_production_to_inventory ON public.production_entries;
CREATE TRIGGER trg_sync_production_to_inventory
  AFTER INSERT OR UPDATE OF completed_qty ON public.production_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_production_to_inventory();
