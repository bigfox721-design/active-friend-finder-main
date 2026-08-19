-- Material request flow
-- Concept: Branch 1 REQUESTS raw materials from Branch 2 (requested).
--          Branch 2 is notified, then SENDS the requested materials to
--          Branch 1 (fulfill -> completed). Stock moves on fulfillment.
--
-- Row semantics: source_branch_id = the branch that sends/fulfills,
--                dest_branch_id   = the branch that requests/receives.

-- 1. Allow 'requested' status
ALTER TABLE public.material_transfers DROP CONSTRAINT IF EXISTS material_transfers_status_check;
ALTER TABLE public.material_transfers ADD CONSTRAINT material_transfers_status_check
  CHECK (status IN ('pending', 'requested', 'in_transit', 'completed', 'cancelled'));

-- 2. create_material_request RPC
CREATE OR REPLACE FUNCTION public.create_material_request(
  p_raw_material_id UUID,
  p_quantity INT,
  p_requesting_branch_id UUID,
  p_requested_from_branch_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_material_name TEXT;
  v_request_id UUID;
BEGIN
  SELECT name INTO v_material_name FROM public.raw_materials WHERE id = p_raw_material_id;
  IF v_material_name IS NULL THEN
    RAISE EXCEPTION 'Raw material not found';
  END IF;

  INSERT INTO public.material_transfers (
    source_branch_id, dest_branch_id, raw_material_id, product_name,
    quantity, status, notes, requested_by
  ) VALUES (
    p_requested_from_branch_id, p_requesting_branch_id, p_raw_material_id, v_material_name,
    p_quantity, 'requested', p_notes, auth.uid()
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- 3. fulfill_material_request RPC: deduct fulfiller stock, add to requester,
--    mark completed. The UPDATE notification trigger tells the requester.
CREATE OR REPLACE FUNCTION public.fulfill_material_request(
  p_transfer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_transfer RECORD;
  v_stock INT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

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

  INSERT INTO public.raw_inventory (branch_id, raw_material_id, quantity)
  VALUES (v_transfer.dest_branch_id, v_transfer.raw_material_id, v_transfer.quantity)
  ON CONFLICT (branch_id, raw_material_id)
  DO UPDATE SET quantity = raw_inventory.quantity + EXCLUDED.quantity, updated_at = NOW();

  UPDATE public.material_transfers
  SET status = 'completed',
      received_at = NOW(),
      received_by = v_user_id,
      completed_by = v_user_id,
      updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', p_transfer_id,
    'fulfiller_remaining_stock', v_stock - v_transfer.quantity
  );
END;
$$;

-- 4. cancel_material_request RPC (refunds fulfiller stock if it was deducted)
CREATE OR REPLACE FUNCTION public.cancel_material_request(
  p_transfer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_transfer RECORD;
BEGIN
  SELECT * INTO v_transfer
  FROM public.material_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_transfer.status NOT IN ('requested', 'in_transit') THEN
    RAISE EXCEPTION 'Cannot cancel a request with status %', v_transfer.status;
  END IF;

  IF v_transfer.status = 'in_transit' AND v_transfer.raw_material_id IS NOT NULL THEN
    INSERT INTO public.raw_inventory (branch_id, raw_material_id, quantity)
    VALUES (v_transfer.source_branch_id, v_transfer.raw_material_id, v_transfer.quantity)
    ON CONFLICT (branch_id, raw_material_id)
    DO UPDATE SET quantity = raw_inventory.quantity + EXCLUDED.quantity, updated_at = NOW();
  END IF;

  UPDATE public.material_transfers
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id);
END;
$$;

-- 5. Notifications: requests notify the fulfiller (source) branch;
--    other inserts still notify the destination branch.
CREATE OR REPLACE FUNCTION public.notify_material_transfer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_branch_name TEXT;
BEGIN
  IF NEW.status = 'requested' THEN
    SELECT COALESCE(name, 'A branch') INTO v_branch_name FROM public.branches WHERE id = NEW.dest_branch_id;
    INSERT INTO public.notifications (branch_id, type, title, message, reference_id)
    VALUES (
      NEW.source_branch_id,
      'material_transfer',
      'Material Request Received',
      v_branch_name || ' has requested ' || NEW.quantity || ' x ' || COALESCE(NEW.product_name, 'Unknown') || '.',
      NEW.id
    );
  ELSE
    INSERT INTO public.notifications (branch_id, type, title, message, reference_id)
    VALUES (
      NEW.dest_branch_id,
      'material_transfer',
      'Material Transfer Received',
      'A material transfer of ' || NEW.quantity || ' x ' || COALESCE(NEW.product_name, 'Unknown') || ' has been sent to your branch.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_material_transfer ON public.material_transfers;
CREATE TRIGGER trg_notify_material_transfer
  AFTER INSERT ON public.material_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_material_transfer();

-- 6. Notify the requester when their requested materials are sent.
CREATE OR REPLACE FUNCTION public.notify_material_request_fulfilled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_source_name TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'requested' THEN
    SELECT COALESCE(name, 'A branch') INTO v_source_name FROM public.branches WHERE id = NEW.source_branch_id;
    INSERT INTO public.notifications (branch_id, type, title, message, reference_id)
    VALUES (
      NEW.dest_branch_id,
      'material_transfer',
      'Requested Materials Sent',
      v_source_name || ' has sent your requested ' || NEW.quantity || ' x ' || COALESCE(NEW.product_name, 'Unknown') || '.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_material_request_fulfilled ON public.material_transfers;
CREATE TRIGGER trg_notify_material_request_fulfilled
  AFTER UPDATE ON public.material_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_material_request_fulfilled();
