
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Revoke direct EXECUTE on definer functions; RLS policies still call them via definer rights
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM anon, authenticated, public;

-- Replace permissive request INSERT policy with minimal validation
DROP POLICY IF EXISTS "Anyone can submit request" ON public.requests;
CREATE POLICY "Anyone can submit request"
  ON public.requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(name,'')) BETWEEN 1 AND 200
    AND length(coalesce(phone,'')) BETWEEN 1 AND 50
    AND length(coalesce(comment,'')) <= 2000
    AND length(coalesce(service,'')) <= 200
  );

-- Tighten storage.objects SELECT: only admins can list; public files still served via public URL
DROP POLICY IF EXISTS "Public read photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read documents" ON storage.objects;

CREATE POLICY "Admins list photos" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins list documents" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));
