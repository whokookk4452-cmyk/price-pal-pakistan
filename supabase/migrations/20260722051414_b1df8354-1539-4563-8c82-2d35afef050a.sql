
CREATE OR REPLACE FUNCTION public.confirm_price_report(_report_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE POLICY "authenticated can confirm reports" ON public.price_reports
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
