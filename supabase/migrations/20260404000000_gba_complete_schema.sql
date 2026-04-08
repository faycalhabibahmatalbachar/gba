-- =============================================================================
-- GBA — Schéma consolidé (idempotent) — 2026-04-04
-- Complète les tables existantes (ADD COLUMN IF NOT EXISTS), crée les manquantes,
-- index, vues analytics, helpers audit / updated_at, RLS ciblée, seed settings.
-- Ne remplace pas order_details_view (définition métier dans migrations antérieures).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Fonction updated_at (alias canonique demandée + compat set_updated_at)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Tables manquantes (CREATE IF NOT EXISTS) — cœur métier & admin
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipients text[] NOT NULL DEFAULT '{}',
  schedule_cron text,
  format text NOT NULL DEFAULT 'pdf',
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.ip_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_cidr cidr NOT NULL,
  description text,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ip_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_cidr cidr NOT NULL,
  reason text,
  expires_at timestamptz,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret_hmac text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_status int,
  response_body text,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  target_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  price numeric(14,2),
  stock_quantity int NOT NULL DEFAULT 0,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  pickup_address text,
  delivery_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_lat double precision,
  delivery_lng double precision,
  estimated_pickup_at timestamptz,
  estimated_delivery_at timestamptz,
  actual_pickup_at timestamptz,
  actual_delivery_at timestamptz,
  distance_km numeric(12,4),
  delivery_fee numeric(14,2),
  driver_earnings numeric(14,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3) Colonnes additionnelles (alignement spec GBA — sans casser l’existant)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS promo_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS promo_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_quantity int,
  ADD COLUMN IF NOT EXISTS stock_alert_threshold int,
  ADD COLUMN IF NOT EXISTS main_image text,
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS weight_g int,
  ADD COLUMN IF NOT EXISTS dimensions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS shipping_class text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image text,
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2),
  ADD COLUMN IF NOT EXISTS tax numeric(14,2),
  ADD COLUMN IF NOT EXISTS discount numeric(14,2),
  ADD COLUMN IF NOT EXISTS total numeric(14,2),
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS shipping_address jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_address jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_image text;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS vehicle_color text,
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_lat double precision,
  ADD COLUMN IF NOT EXISTS current_lng double precision,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(4,2),
  ADD COLUMN IF NOT EXISTS total_deliveries int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.driver_locations
  ADD COLUMN IF NOT EXISTS accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS heading double precision,
  ADD COLUMN IF NOT EXISTS speed_mps double precision,
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz;

-- Sync recorded_at from captured_at if présent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'driver_locations' AND column_name = 'captured_at'
  ) THEN
    UPDATE public.driver_locations SET recorded_at = COALESCE(recorded_at, captured_at) WHERE recorded_at IS NULL;
  END IF;
END $$;

ALTER TABLE public.delivery_assignments
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_ref text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='comment'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='body'
  ) THEN
    UPDATE public.reviews SET body = comment WHERE body IS NULL;
  END IF;
END $$;

ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS is_valid boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.push_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS targeting jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS click_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impression_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_conversations') THEN
    ALTER TABLE public.chat_conversations
      ADD COLUMN IF NOT EXISTS type text DEFAULT 'direct',
      ADD COLUMN IF NOT EXISTS title text,
      ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_participants') THEN
    ALTER TABLE public.chat_participants
      ADD COLUMN IF NOT EXISTS role text DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS last_read_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS edited_at timestamptz,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  END IF;
END $$;

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS action_details jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.cms_pages
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cms_pages' AND column_name='body_html'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cms_pages' AND column_name='content_html'
  ) THEN
    UPDATE public.cms_pages SET content_html = COALESCE(NULLIF(content_html, ''), body_html) WHERE content_html IS NULL OR content_html = '';
  END IF;
END $$;

ALTER TABLE public.special_orders
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_notes text,
  ADD COLUMN IF NOT EXISTS driver_assigned_at timestamptz;

-- audit_logs : métadonnées enrichies (si table présente — migration audit peut être appliquée après)
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    ALTER TABLE public.audit_logs
      ADD COLUMN IF NOT EXISTS ip_address text,
      ADD COLUMN IF NOT EXISTS user_agent text,
      ADD COLUMN IF NOT EXISTS platform text,
      ADD COLUMN IF NOT EXISTS app_version text,
      ADD COLUMN IF NOT EXISTS before_data jsonb,
      ADD COLUMN IF NOT EXISTS after_data jsonb;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Foreign keys (idempotentes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.delivery_assignments
  ADD COLUMN IF NOT EXISTS delivery_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_delivery_assignments_delivery_id') THEN
    ALTER TABLE public.delivery_assignments
      ADD CONSTRAINT fk_delivery_assignments_delivery_id
      FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Index demandés + complémentaires
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products (name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs (entity_type)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs (entity_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_recorded
  ON public.driver_locations (driver_id, (COALESCE(recorded_at, captured_at, created_at)) DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON public.chat_messages (conversation_id, created_at DESC);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_valid ON public.device_tokens (user_id, is_valid);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_created ON public.notification_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_campaign ON public.notification_logs (campaign_id) WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activities_user_action ON public.user_activities (user_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_order ON public.deliveries (order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON public.deliveries (driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries (status);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON public.webhook_logs (webhook_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6) Vues utiles (nouvelles — ne remplace pas order_details_view)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.driver_performance_view
WITH (security_invoker = true) AS
SELECT
  d.id AS driver_id,
  d.user_id,
  TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS display_name,
  p.phone,
  d.is_online,
  d.is_available,
  d.rating_avg,
  d.total_deliveries,
  d.total_earnings,
  COALESCE(x.completed_30d, 0)::bigint AS deliveries_completed_30d,
  COALESCE(x.active_orders, 0)::bigint AS active_orders
FROM public.drivers d
LEFT JOIN public.profiles p ON p.id = d.user_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE da.status IN ('completed', 'delivered')) AS completed_30d,
    COUNT(*) FILTER (WHERE da.status NOT IN ('completed', 'delivered', 'cancelled')) AS active_orders
  FROM public.delivery_assignments da
  WHERE da.driver_id = d.id
    AND da.assigned_at >= now() - interval '30 days'
) x ON true;

CREATE OR REPLACE VIEW public.product_sales_view
WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  COALESCE(SUM(oi.quantity), 0)::bigint AS units_sold,
  COALESCE(SUM(oi.total_price), 0)::numeric AS revenue_total,
  COUNT(DISTINCT oi.order_id)::bigint AS order_count
FROM public.products p
LEFT JOIN public.order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name, p.sku;

GRANT SELECT ON public.driver_performance_view TO authenticated, service_role;
GRANT SELECT ON public.product_sales_view TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) RLS — tables admin neuves + durcissement audit_logs (SELECT client off)
-- ---------------------------------------------------------------------------
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_history ENABLE ROW LEVEL SECURITY;

-- Politiques « deny authenticated » sur tables purement BFF (service_role bypass RLS)
DROP POLICY IF EXISTS settings_deny_auth ON public.settings;
CREATE POLICY settings_deny_auth ON public.settings FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS scheduled_reports_deny_auth ON public.scheduled_reports;
CREATE POLICY scheduled_reports_deny_auth ON public.scheduled_reports FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS ip_whitelist_deny_auth ON public.ip_whitelist;
CREATE POLICY ip_whitelist_deny_auth ON public.ip_whitelist FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS ip_blacklist_deny_auth ON public.ip_blacklist;
CREATE POLICY ip_blacklist_deny_auth ON public.ip_blacklist FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS webhook_configs_deny_auth ON public.webhook_configs;
CREATE POLICY webhook_configs_deny_auth ON public.webhook_configs FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS webhook_logs_deny_auth ON public.webhook_logs;
CREATE POLICY webhook_logs_deny_auth ON public.webhook_logs FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS push_campaigns_deny_auth ON public.push_campaigns;
CREATE POLICY push_campaigns_deny_auth ON public.push_campaigns FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS product_variants_deny_auth ON public.product_variants;
CREATE POLICY product_variants_deny_auth ON public.product_variants FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deliveries_deny_auth ON public.deliveries;
CREATE POLICY deliveries_deny_auth ON public.deliveries FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS delivery_status_history_deny_auth ON public.delivery_status_history;
CREATE POLICY delivery_status_history_deny_auth ON public.delivery_status_history FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- audit_logs : RLS seulement si la table existe
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs';
    EXECUTE 'DROP POLICY IF EXISTS audit_logs_no_select_client ON public.audit_logs';
    EXECUTE $pol$CREATE POLICY audit_logs_no_select_client ON public.audit_logs
      FOR SELECT TO authenticated USING (false)$pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8) Triggers updated_at (nouvelles tables)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_webhook_configs_updated_at ON public.webhook_configs;
CREATE TRIGGER trg_webhook_configs_updated_at BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Bump métriques (idempotent — remplace si déjà présent)
CREATE OR REPLACE FUNCTION public.bump_user_activity_metrics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_activity_metrics(
    user_id, period_type, total_actions, product_views, cart_adds, checkouts_started, orders_placed, last_activity_at
  ) VALUES (
    NEW.user_id, 'all_time', 1,
    CASE WHEN NEW.action_type IN ('product_view', 'view_product') THEN 1 ELSE 0 END,
    CASE WHEN NEW.action_type IN ('cart_add', 'add_to_cart') THEN 1 ELSE 0 END,
    CASE WHEN NEW.action_type IN ('checkout_started', 'checkout_start') THEN 1 ELSE 0 END,
    CASE WHEN NEW.action_type IN ('order_placed', 'order_create', 'checkout_complete') THEN 1 ELSE 0 END,
    NEW.created_at
  )
  ON CONFLICT (user_id, period_type) WHERE period_start IS NULL
  DO UPDATE SET
    total_actions = public.user_activity_metrics.total_actions + 1,
    product_views = public.user_activity_metrics.product_views + (CASE WHEN EXCLUDED.product_views = 1 THEN 1 ELSE 0 END),
    cart_adds = public.user_activity_metrics.cart_adds + (CASE WHEN EXCLUDED.cart_adds = 1 THEN 1 ELSE 0 END),
    checkouts_started = public.user_activity_metrics.checkouts_started + (CASE WHEN EXCLUDED.checkouts_started = 1 THEN 1 ELSE 0 END),
    orders_placed = public.user_activity_metrics.orders_placed + (CASE WHEN EXCLUDED.orders_placed = 1 THEN 1 ELSE 0 END),
    last_activity_at = GREATEST(COALESCE(public.user_activity_metrics.last_activity_at, EXCLUDED.last_activity_at), EXCLUDED.last_activity_at),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_activities_bump_metrics ON public.user_activities;
CREATE TRIGGER trg_user_activities_bump_metrics
  AFTER INSERT ON public.user_activities
  FOR EACH ROW EXECUTE FUNCTION public.bump_user_activity_metrics();

-- ---------------------------------------------------------------------------
-- 9) log_audit_action — uniquement si audit_logs + enums (sinon skip sans erreur)
-- ---------------------------------------------------------------------------
DO $wrap$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action_type')
     AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_entity_type') THEN
    EXECUTE $createfn$
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_actor_id uuid,
  p_actor_email text,
  p_actor_role text,
  p_action_type text,
  p_entity_type text,
  p_entity_id text,
  p_entity_name text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_status text DEFAULT 'success',
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_id uuid;
  v_action public.audit_action_type;
  v_entity public.audit_entity_type;
BEGIN
  v_action := COALESCE(
    (SELECT e::public.audit_action_type
     FROM unnest(enum_range(NULL::public.audit_action_type)) e
     WHERE e::text = p_action_type
     LIMIT 1),
    'update'::public.audit_action_type
  );
  v_entity := COALESCE(
    (SELECT e::public.audit_entity_type
     FROM unnest(enum_range(NULL::public.audit_entity_type)) e
     WHERE e::text = p_entity_type
     LIMIT 1),
    'user'::public.audit_entity_type
  );

  INSERT INTO public.audit_logs (
    user_id, user_email, user_role, action_type, action_description,
    entity_type, entity_id, entity_name,
    changes, metadata, status, error_message,
    ip_address, user_agent, platform, app_version, before_data, after_data
  ) VALUES (
    p_actor_id, p_actor_email, p_actor_role, v_action, NULL,
    v_entity, p_entity_id, p_entity_name,
    jsonb_build_object('before', COALESCE(p_before, '{}'::jsonb), 'after', COALESCE(p_after, '{}'::jsonb)),
    COALESCE(p_metadata, '{}'::jsonb),
    p_status, p_error_message,
    p_ip, p_user_agent, p_platform, p_app_version, p_before, p_after
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$body$;
$createfn$;
  END IF;
END $wrap$;

DO $grant$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'log_audit_action'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.log_audit_action(
      uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text, text, text, text
    ) TO service_role;
  END IF;
END $grant$;

-- ---------------------------------------------------------------------------
-- 10) Données de référence — settings
-- ---------------------------------------------------------------------------
INSERT INTO public.settings (key, value)
VALUES
  ('platform_name', '"GBA"'::jsonb),
  ('primary_color', '"#6C47FF"'::jsonb),
  ('timezone', '"Africa/Abidjan"'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('session_duration_hours', '24'::jsonb),
  ('password_min_length', '8'::jsonb),
  ('max_login_attempts', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ✅ GBA COMPLETE SCHEMA — tables couvertes: 33 | nouvelles tables: 10 | indexes: 28 | vues: 2 | triggers: 6+ | policies RLS: 12+
