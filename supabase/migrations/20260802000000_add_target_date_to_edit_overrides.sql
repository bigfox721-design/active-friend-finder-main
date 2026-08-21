-- Add target_date column to edit_overrides for date-based override grants
-- This allows managers to grant override access for a specific date

ALTER TABLE public.edit_overrides ADD COLUMN IF NOT EXISTS target_date DATE;

-- Update the active overrides query to also consider target_date
-- An override is active if:
-- 1. expires_at is in the future, AND
-- 2. target_date matches the entry date (if target_date is set)

COMMENT ON COLUMN public.edit_overrides.target_date IS 'The specific date for which this override grants edit access. NULL means override applies to any date until expiration.';
