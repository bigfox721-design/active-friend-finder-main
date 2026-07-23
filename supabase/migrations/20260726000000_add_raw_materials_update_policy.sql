-- Add missing UPDATE policy for raw_materials
-- The table had SELECT and INSERT policies but no UPDATE policy,
-- so editing a raw material's name/unit silently failed (0 rows affected, no error).

DROP POLICY IF EXISTS "All authenticated can update raw materials" ON public.raw_materials;
CREATE POLICY "All authenticated can update raw materials"
  ON public.raw_materials FOR UPDATE TO authenticated USING (true);
