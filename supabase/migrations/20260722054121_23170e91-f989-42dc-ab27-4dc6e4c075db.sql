DROP POLICY IF EXISTS "authenticated can confirm reports" ON public.price_reports;

CREATE POLICY "owners can update their reports"
ON public.price_reports
FOR UPDATE
TO authenticated
USING (auth.uid() = reported_by)
WITH CHECK (auth.uid() = reported_by);

CREATE OR REPLACE FUNCTION public.confirm_price_report(_report_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  UPDATE public.price_reports
    SET still_accurate_count = still_accurate_count + 1
    WHERE id = _report_id
    RETURNING still_accurate_count INTO new_count;
  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_price_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_price_report(uuid) TO authenticated;