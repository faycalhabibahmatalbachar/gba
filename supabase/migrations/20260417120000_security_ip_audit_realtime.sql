-- =============================================================================
-- Sécurité : IP lists actives, lecture audit_logs pour admins (Realtime),
-- paramètres accès géographique / plafond connexions (lu par Edge/middleware).
-- Exécuter après 20260404000000_gba_complete_schema.sql et audit_logs.
-- =============================================================================
-- Whitelist : statut + expiration (affichage admin)
ALTER TABLE public.ip_whitelist
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.ip_whitelist
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.ip_whitelist.is_active IS 'false = entrée désactivée sans suppression';
COMMENT ON COLUMN public.ip_whitelist.expires_at IS 'NULL = sans expiration';

-- Paramètres middleware (clé unique dans public.settings)
INSERT INTO public.settings (key, value)
VALUES (
  'security_access',
  jsonb_build_object(
    'blocked_countries', '[]'::jsonb,
    'max_admin_connections_per_hour', 200,
    'enforce_country_block', false,
    'updated_note', 'À appliquer dans Edge Function / middleware (non automatique ici)'
  )
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value)
VALUES (
  'password_policy',
  jsonb_build_object(
    'min_length', 10,
    'require_uppercase', true,
    'require_number', true,
    'max_age_days', null
  )
)
ON CONFLICT (key) DO NOTHING;

-- audit_logs : permettre SELECT aux admins authentifiés (client + Realtime)
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS audit_logs_no_select_client ON public.audit_logs';
    EXECUTE 'DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs';
    EXECUTE $pol$
      CREATE POLICY audit_logs_admin_select ON public.audit_logs
      FOR SELECT TO authenticated
      USING (public.is_admin())
    $pol$;
  END IF;
END $$;

-- Realtime : INSERT visibles (RLS admin). Pas besoin de REPLICA IDENTITY FULL pour INSERT seul.
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping supabase_realtime ADD TABLE (privileges)';
    WHEN OTHERS THEN
      RAISE NOTICE 'Realtime publication: %', SQLERRM;
    END;
  END IF;
END $$;
