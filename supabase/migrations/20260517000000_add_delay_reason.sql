ALTER TABLE public.production_entries
  ADD COLUMN IF NOT EXISTS delay_reason TEXT;
