CREATE OR REPLACE FUNCTION public.clear_all_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_manager BOOLEAN;
  v_tables TEXT[] := ARRAY[
    'daily_inventory_snapshot', 'inventory_logs', 'sales_entries',
    'stock_override_requests', 'stock_entries', 'production_entries',
    'monthly_targets', 'inventory', 'accessory_inventory', 'accessories',
    'material_transfers', 'raw_inventory', 'raw_materials',
    'status_updates', 'activity_logs', 'edit_overrides',
    'sub_products', 'products', 'processed_invoices'
  ];
  v_tbl TEXT;
BEGIN
  v_user_id := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = v_user_id AND role = 'manager'
  ) INTO v_is_manager;

  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'Only managers can clear all data';
  END IF;

  FOREACH v_tbl IN ARRAY v_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
      EXECUTE format('TRUNCATE TABLE public.%I CASCADE', v_tbl);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'message', 'All data cleared successfully');
END;
$$;
