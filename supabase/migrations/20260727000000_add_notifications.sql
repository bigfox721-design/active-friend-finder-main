-- Notifications system for material transfer requests

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read notifications for their branch" ON public.notifications;
CREATE POLICY "Users can read notifications for their branch"
  ON public.notifications FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update notifications for their branch" ON public.notifications;
CREATE POLICY "Users can update notifications for their branch"
  ON public.notifications FOR UPDATE TO authenticated
  USING (true);

-- Auto-create notification when a material transfer is sent
CREATE OR REPLACE FUNCTION public.notify_material_transfer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (branch_id, type, title, message, reference_id)
  VALUES (
    NEW.dest_branch_id,
    'material_transfer',
    'Material Transfer Received',
    'A material transfer of ' || NEW.quantity || ' x ' || COALESCE(NEW.product_name, 'Unknown') || ' has been sent to your branch.',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_material_transfer ON public.material_transfers;
CREATE TRIGGER trg_notify_material_transfer
  AFTER INSERT ON public.material_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_material_transfer();
