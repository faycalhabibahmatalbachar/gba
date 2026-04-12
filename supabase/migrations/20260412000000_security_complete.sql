-- =============================================================================
-- Centre de sécurité — tables d’extension (alertes, GeoIP cache, anomalies, log urgence)
-- Idempotent : IF NOT EXISTS. Les routes BFF utilisent surtout audit_logs + settings ;
-- ces tables préparent des enrichissements futurs sans casser l’existant.
-- =============================================================================

-- Alertes persistées (synthèse / centre de notifications sécurité)
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'normal',
  channel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.security_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Traçabilité actions d’urgence (complément audit_logs)
CREATE TABLE IF NOT EXISTS public.emergency_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  reason text,
  performed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Cache GeoIP (évite appels répétés pour les mêmes IP)
CREATE TABLE IF NOT EXISTS public.ip_geoip_cache (
  ip inet PRIMARY KEY,
  country text,
  region text,
  city text,
  lat double precision,
  lng double precision,
  source text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Anomalies admin (enrichissement futur au-delà de l’heuristique audit)
CREATE TABLE IF NOT EXISTS public.admin_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'attention',
  description text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON public.security_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_actions_log_created ON public.emergency_actions_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_anomalies_admin ON public.admin_anomalies (admin_id, detected_at DESC);

-- Index audit (requêtes stream / anomalies / dashboards)
DO $$
BEGIN
  IF to_regclass ('public.audit_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs (user_id, created_at DESC)
      WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- Note : pays par défaut RU/CN/KP lorsque la liste est vide — géré côté API
-- GET /api/settings/security-access pour l’affichage cohérent sans imposer un ordre de migration.
