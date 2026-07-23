-- Add user_role column to activity_logs for role-based filtering
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS user_role TEXT;
