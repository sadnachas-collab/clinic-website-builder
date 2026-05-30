
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('owner', 'editor');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'editor')
  )
$$;

CREATE POLICY "Authenticated can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Owners manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- ============ ADMIN PROFILES (логин -> email маппинг) ============
CREATE TABLE public.admin_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  login TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_profiles TO authenticated;
GRANT ALL ON public.admin_profiles TO service_role;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view admin profiles"
  ON public.admin_profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Owners manage admin profiles"
  ON public.admin_profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Self can update own admin profile"
  ON public.admin_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ CONTENT TABLES ============

-- Услуги
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  name TEXT NOT NULL,
  price TEXT,
  description TEXT,
  sort_order INT DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Прайс-файлы
CREATE TABLE public.price_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Категории процедур (для прайс-листа)
CREATE TABLE public.procedure_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.procedure_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price TEXT,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Специалисты
CREATE TABLE public.specialists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT,
  description TEXT,
  photo_url TEXT,
  sort_order INT DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER specialists_updated BEFORE UPDATE ON public.specialists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Отзывы
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  review_date DATE,
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Акции
CREATE TABLE public.promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  starts_at DATE,
  ends_at DATE,
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER promos_updated BEFORE UPDATE ON public.promos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FAQ
CREATE TABLE public.faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Интерьер
CREATE TABLE public.interior_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Документы клиники (лицензии и т.д.)
CREATE TABLE public.clinic_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  category TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Уголок потребителя - категории
CREATE TABLE public.consumer_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Уголок потребителя - документы
CREATE TABLE public.consumer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.consumer_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT,
  content TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Контролирующие органы
CREATE TABLE public.authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Контент страниц (главная, подвал, контакты — key/value JSON)
CREATE TABLE public.page_content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER page_content_updated BEFORE UPDATE ON public.page_content FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Заявки
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new, in_progress, done
  source TEXT,
  crm_sent BOOLEAN NOT NULL DEFAULT false,
  crm_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER requests_updated BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GRANTS + RLS for content tables ============

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'services','price_files','procedure_categories','procedures','specialists',
    'reviews','promos','faq','interior_photos','clinic_documents',
    'consumer_categories','consumer_documents','authorities','page_content'
  ]) LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Public read %I" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Admins write %I" ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))', t, t);
  END LOOP;
END $$;

-- Requests: anyone INSERT, only admins SELECT/UPDATE/DELETE
GRANT INSERT ON public.requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit request"
  ON public.requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins view requests"
  ON public.requests FOR SELECT
  TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete requests"
  ON public.requests FOR DELETE
  TO authenticated USING (public.is_admin(auth.uid()));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT DO NOTHING;

-- Public read for both buckets
CREATE POLICY "Public read photos" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'photos');

CREATE POLICY "Public read documents" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'documents');

CREATE POLICY "Admins upload photos" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update photos" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete photos" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins upload documents" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'documents' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update documents" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete documents" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));
