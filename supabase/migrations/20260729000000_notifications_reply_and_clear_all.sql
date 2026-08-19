-- Allow authenticated users to clear all (DELETE) notifications
-- (Reply now navigates to the material transfer page instead of inserting.)

DROP POLICY IF EXISTS "Users can delete notifications for their branch" ON public.notifications;
CREATE POLICY "Users can delete notifications for their branch"
  ON public.notifications FOR DELETE TO authenticated
  USING (true);
