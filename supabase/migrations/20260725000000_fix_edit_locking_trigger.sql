-- Fix edit locking trigger on production_entries to use entry_date instead of created_at
-- This allows editing today's entries even if the row was created earlier

CREATE OR REPLACE FUNCTION public.prevent_old_entry_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.entry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot edit production entries from past dates (entry date: %).', OLD.entry_date;
  END IF;
  RETURN NEW;
END;
$$;
