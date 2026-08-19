-- Material receipt confirmation
-- Concept: request -> fulfill (sent, in_transit) -> receive (completed).
-- Receiving branch confirms receipt; the fulfilling branch is notified.

-- 1. fulfill_material_request now only DEDUCTS the fulfiller's stock and
--    marks the request as in_transit. The requester confirms receipt.
CREATE OR REPLACE FUNCTION public.fulfill_material_request(
  p_transfer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_transfer RECORD;
  v_stock INT;
BEGIN
  SELECT * INTO v_transfer
  FROM public.material_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_transfer.status != 'requested' THEN
    RAISE EXCEPTION 'Request is not pending (status: %)', v_transfer.status;
  END IF;

  IF v_transfer.raw_material_id IS NULL THEN
    RAISE EXCEPTION 'Request has no raw material associated';
  END IF;

  SELECT quantity INTO v_stock
  FROM public.raw_inventory
  WHERE raw_material_id = v_transfer.raw_material_id AND branch_id = v_transfer.source_branch_id
  FOR UPDATE;

  IF v_stock IS NULL OR v_stock < v_transfer.quantity THEN
    RAISE EXCEPTION 'Insufficient stock (available: %)', COALESCE(v_stock, 0);
  END IF;

  UPDATE public.raw_inventory
  SET quantity = v_stock - v_transfer.quantity, updated_at = NOW()
  WHERE raw_material_id = v_transfer.raw_material_id AND branch_id = v_transfer.source_branch_id;

  UPDATE public.material_transfers
  SET status = 'in_transit', updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', p_transfer_id,
    'fulfiller_remaining_stock', v_stock - v_transfer.quantity
  );
END;
$$;

-- 2. Notify the requester when their requested materials are sent (need to confirm receipt).
CREATE OR REPLACE FUNCTION public.notify_material_sent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_source_name TEXT;
BEGIN
  IF NEW.status = 'in_transit' AND OLD.status = 'requested' THEN
    SELECT COALESCE(name, 'A branch') INTO v_source_name FROM public.branches WHERE id = NEW.source_branch_id;
    INSERT INTO public.notifications (branch_id, type, title, message, reference_id)
    VALUES (
      NEW.dest_branch_id,
      'material_transfer',
      'Requested Materials Sent',
      v_source_name || ' has sent your requested ' || NEW.quantity || ' x ' || COALESCE(NEW.product_name, 'Unknown') || '. Please confirm receipt.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_material_request_fulfilled ON public.material_transfers;
DROP TRIGGER IF EXISTS trg_notify_material_sent ON public.material_transfers;
CREATE TRIGGER trg_notify_material_sent
  AFTER UPDATE ON public.material_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_material_sent();

-- 3. Notify the fulfilling branch when the requesting branch confirms receipt.
CREATE OR REPLACE FUNCTION public.notify_material_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dest_name TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'in_transit' THEN
    SELECT COALESCE(name, 'A branch') INTO v_dest_name FROM public.branches WHERE id = NEW.dest_branch_id;
    INSERT INTO public.notifications (branch_id, type, title, message, reference_id)
    VALUES (
      NEW.source_branch_id,
      'material_transfer',
      'Materials Received',
      v_dest_name || ' has received the ' || NEW.quantity || ' x ' || COALESCE(NEW.product_name, 'Unknown') || ' you sent.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_material_received ON public.material_transfers;
CREATE TRIGGER trg_notify_material_received
  AFTER UPDATE ON public.material_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_material_received();

DROP FUNCTION IF EXISTS public.notify_material_request_fulfilled();
