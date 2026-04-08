-- Static CMS pages (CGV, FAQ, À propos) for admin_gba

CREATE TABLE IF NOT EXISTS public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON public.cms_pages(slug);

DROP TRIGGER IF EXISTS trg_cms_pages_updated_at ON public.cms_pages;
CREATE TRIGGER trg_cms_pages_updated_at
BEFORE UPDATE ON public.cms_pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_pages_public_read" ON public.cms_pages;
CREATE POLICY "cms_pages_public_read"
ON public.cms_pages FOR SELECT
TO anon, authenticated
USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "cms_pages_admin_write" ON public.cms_pages;
CREATE POLICY "cms_pages_admin_write"
ON public.cms_pages FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

INSERT INTO public.cms_pages (slug, title, body_html, is_published)
VALUES
  ('a-propos', 'À propos', '<p></p>', false),
  ('cgv', 'Conditions générales de vente', '<p></p>', false),
  ('faq', 'Questions fréquentes', '<p></p>', false)
ON CONFLICT (slug) DO NOTHING;
