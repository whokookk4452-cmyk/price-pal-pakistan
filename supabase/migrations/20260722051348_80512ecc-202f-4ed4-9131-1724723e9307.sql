
-- Restrict products SELECT to authenticated
DROP POLICY IF EXISTS "products readable by all" ON public.products;
CREATE POLICY "products readable by authenticated" ON public.products
  FOR SELECT TO authenticated USING (true);

-- Tighten products INSERT (no more WITH CHECK true)
DROP POLICY IF EXISTS "authenticated can add products" ON public.products;
CREATE POLICY "authenticated can add products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Restrict price_reports SELECT to authenticated (removes anon exposure of reported_by)
DROP POLICY IF EXISTS "reports readable by all" ON public.price_reports;
CREATE POLICY "reports readable by authenticated" ON public.price_reports
  FOR SELECT TO authenticated USING (true);

-- Revoke anon access on these tables
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.price_reports FROM anon;

-- Lock down SECURITY DEFINER function: revoke broad execute, grant only to authenticated
REVOKE ALL ON FUNCTION public.confirm_price_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_price_report(uuid) TO authenticated;
