-- Remove the insufficient-stock block from material fulfillment.
-- Sending always works; no stock is deducted from the fulfilling branch.

-- 1. fulfill_material_request: no stock check, no deduction, just mark in_transit.
CREATE OR REPLACE FUNCTION public.fulfill_material_request(
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

  IF v_transfer.status != 'requested' THEN
    RAISE EXCEPTION 'Request is not pending (status: %)', v_transfer.status;
  END IF;

  IF v_transfer.raw_material_id IS NULL THEN
    RAISE EXCEPTION 'Request has no raw material associated';
  END IF;

  UPDATE public.material_transfers
  SET status = 'in_transit', updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id);
END;
$$;

-- 2. cancel_material_request: no stock refund (stock is never deducted).
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

  UPDATE public.material_transfers
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id);
END;
$$;
