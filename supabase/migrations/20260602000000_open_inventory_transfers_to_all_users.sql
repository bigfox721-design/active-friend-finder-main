-- Allow all authenticated users to manage inventory and material transfers

-- Inventory: drop manager-only policy, allow all authenticated to write
DROP POLICY IF EXISTS "Allow manager write inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow all authenticated write inventory" ON public.inventory;
CREATE POLICY "Allow all authenticated write inventory" ON public.inventory
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Material transfers: drop manager-only policies, allow all authenticated
DROP POLICY IF EXISTS "Allow manager insert transfer" ON public.material_transfers;
CREATE POLICY "Allow all authenticated insert transfer" ON public.material_transfers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow manager update transfer" ON public.material_transfers;
CREATE POLICY "Allow all authenticated update transfer" ON public.material_transfers
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
