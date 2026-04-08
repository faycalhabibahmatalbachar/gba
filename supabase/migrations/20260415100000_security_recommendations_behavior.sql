-- =============================================================================
-- Sécurité : historique connexions admin + recommandations + comportement produit
-- Exécuter après le schéma GBA (settings, ip_blacklist, audit_logs, products).
-- =============================================================================

-- ── Historique tentatives de connexion (back-office / hooks auth à brancher) ─
CREATE TABLE IF NOT EXISTS public.admin_login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  user_agent text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_history_created ON public.admin_login_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_login_history_ip ON public.admin_login_history (ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_login_history_success ON public.admin_login_history (success, created_at DESC);

ALTER TABLE public.admin_login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_login_history_admin_select ON public.admin_login_history;
CREATE POLICY admin_login_history_admin_select
  ON public.admin_login_history FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_login_history_service_insert ON public.admin_login_history;
-- Inserts via service_role (API) — pas de policy INSERT pour authenticated client
-- Le service role bypass RLS.

-- ── Paramètres algorithme recommandations (ligne unique métier) ───────────────
CREATE TABLE IF NOT EXISTS public.recommendation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  algorithm text NOT NULL DEFAULT 'hybrid'
    CHECK (algorithm IN ('collaborative', 'content_based', 'hybrid', 'trending', 'manual')),
  weights jsonb NOT NULL DEFAULT '{
    "purchase_history": 0.4,
    "view_history": 0.2,
    "category_affinity": 0.25,
    "trending_boost": 0.1,
    "recency": 0.05
  }'::jsonb,
  min_interactions_threshold int NOT NULL DEFAULT 5,
  recommendation_count int NOT NULL DEFAULT 12,
  refresh_interval_hours int NOT NULL DEFAULT 6,
  exclude_out_of_stock boolean NOT NULL DEFAULT true,
  boost_new_products boolean NOT NULL DEFAULT true,
  boost_new_product_days int NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS trg_recommendation_settings_updated ON public.recommendation_settings;
CREATE TRIGGER trg_recommendation_settings_updated
  BEFORE UPDATE ON public.recommendation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.recommendation_settings (id)
SELECT '00000000-0000-4000-8000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM public.recommendation_settings LIMIT 1);

ALTER TABLE public.recommendation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendation_settings_admin_all ON public.recommendation_settings;
CREATE POLICY recommendation_settings_admin_all
  ON public.recommendation_settings FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Comportement utilisateur → alimentation reco (app client) ───────────────
CREATE TABLE IF NOT EXISTS public.user_behavior (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('view', 'add_to_cart', 'purchase', 'wishlist', 'share')),
  duration_seconds int,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_behavior_user_created ON public.user_behavior (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_product_action ON public.user_behavior (product_id, action);

ALTER TABLE public.user_behavior ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_behavior_select_own ON public.user_behavior;
CREATE POLICY user_behavior_select_own
  ON public.user_behavior FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_behavior_insert_own ON public.user_behavior;
CREATE POLICY user_behavior_insert_own
  ON public.user_behavior FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_behavior_admin_all ON public.user_behavior;
CREATE POLICY user_behavior_admin_all
  ON public.user_behavior FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.admin_login_history IS 'Tentatives connexion admin ; alimenter via Edge Function ou middleware login.';
COMMENT ON TABLE public.recommendation_settings IS 'Paramètres globaux recommandations admin + app mobile.';
COMMENT ON TABLE public.user_behavior IS 'Signaux comportement pour scoring reco (vues, panier, achats…).';
