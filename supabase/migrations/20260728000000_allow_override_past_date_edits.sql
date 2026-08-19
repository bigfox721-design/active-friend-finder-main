-- Allow managers and users with an active edit override to create/edit
-- production entries for PAST dates (missed evening targets, backfills).
--
--   * Managers can always touch past dates.
--   * A user with an active override (expires_at > now()) for the product —
--     or for the parent product of a sub-product — can touch past dates for
--     that product only.
--   * Everyone else stays locked to today.

CREATE OR REPLACE FUNCTION public.prevent_old_entry_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_date DATE;
  v_is_manager BOOLEAN;
  v_has_override BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_target_date := NEW.entry_date;
  ELSIF TG_OP = 'UPDATE' THEN
    v_target_date := OLD.entry_date;
  ELSE
    RETURN NEW;
  END IF;

  IF v_target_date < CURRENT_DATE THEN
    SELECT EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'
    ) INTO v_is_manager;

    IF NOT COALESCE(v_is_manager, false) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.edit_overrides eo
        WHERE eo.user_id = auth.uid()
          AND eo.expires_at > NOW()
          AND (
            eo.product_id = NEW.product_id
            OR eo.product_id IN (
              SELECT s.product_id FROM public.sub_products s WHERE s.id = NEW.product_id
            )
            OR NEW.product_id IN (
              SELECT s.id FROM public.sub_products s WHERE s.product_id = eo.product_id
            )
          )
      ) INTO v_has_override;

      IF NOT COALESCE(v_has_override, false) THEN
        RAISE EXCEPTION
          'Cannot create or edit production entries for past dates (entry date: %).',
          v_target_date;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_old_production_update ON public.production_entries;
CREATE TRIGGER trg_prevent_old_production_update
  BEFORE INSERT OR UPDATE ON public.production_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_old_entry_update();
