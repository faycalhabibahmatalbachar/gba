-- ============================================================
-- GBA — Profiles: Presence tracking (last_seen_at, is_online)
-- Date: 2026-03-01
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Add presence columns to profiles
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen_at TIMESTAMPTZ;
    COMMENT ON COLUMN public.profiles.last_seen_at IS 'Last time this user was active (heartbeat)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_online'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_online BOOLEAN DEFAULT false;
    COMMENT ON COLUMN public.profiles.is_online IS 'Whether this user is currently online (set by heartbeat)';
  END IF;
END $$;

-- Index for online status queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles (is_online)
WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles (last_seen_at DESC NULLS LAST);

-- ────────────────────────────────────────────────────────────
-- 2. RPC function: update_user_presence()
--    Called by the client every ~3 minutes (heartbeat)
--    SECURITY DEFINER: runs as owner, so no RLS issues
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    last_seen_at = now(),
    is_online    = true
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_presence() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. Computed view: user_presence_status
--    Returns presence status based on last_seen_at
--    online  = last_seen_at within 2 minutes
--    away    = last_seen_at within 15 minutes
--    offline = older or NULL
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.user_presence_status
WITH (security_invoker = true)
AS
SELECT
  id,
  last_seen_at,
  is_online,
  CASE
    WHEN last_seen_at IS NULL                                        THEN 'offline'
    WHEN last_seen_at > now() - INTERVAL '2 minutes'                THEN 'online'
    WHEN last_seen_at > now() - INTERVAL '15 minutes'               THEN 'away'
    ELSE                                                                  'offline'
  END AS presence_status
FROM public.profiles;

GRANT SELECT ON public.user_presence_status TO authenticated;
GRANT SELECT ON public.user_presence_status TO anon;

-- ────────────────────────────────────────────────────────────
-- 4. RLS policy: allow authenticated users to update their own presence
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Drop duplicate policies if they exist from previous runs
  DROP POLICY IF EXISTS "profiles_update_own_presence" ON public.profiles;

  CREATE POLICY "profiles_update_own_presence"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Validation
DO $$
DECLARE
  has_last_seen BOOLEAN;
  has_is_online BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_at'
  ) INTO has_last_seen;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_online'
  ) INTO has_is_online;

  RAISE NOTICE '[PRESENCE] profiles.last_seen_at = %, profiles.is_online = %',
    has_last_seen, has_is_online;
END $$;
