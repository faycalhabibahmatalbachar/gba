-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION CONSOLIDÉE : RLS banners + is_admin() + chat FK guarantee
-- À COLLER DANS SUPABASE SQL EDITOR si les migrations précédentes
-- n'ont pas été appliquées
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Fonction is_admin() — version consolidée SECURITY DEFINER ────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
    OR COALESCE((auth.jwt() -> 'app_metadata'  ->> 'role'), '') = 'admin'
  );
$$;

-- ─── 2. ensure_admin_profile() — auto-promotion si JWT=admin ─────────────
CREATE OR REPLACE FUNCTION public.ensure_admin_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  OR COALESCE((auth.jwt() -> 'app_metadata'  ->> 'role'), '') = 'admin'
  THEN
    UPDATE public.profiles
    SET role = 'admin', updated_at = now()
    WHERE id = auth.uid()
      AND (role IS DISTINCT FROM 'admin');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_admin_profile() TO authenticated;

-- ─── 3. Force admin profile pour tout user dont JWT contient role=admin ───
UPDATE public.profiles p
SET role = 'admin', updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND p.role IS DISTINCT FROM 'admin'
  AND (
    (u.raw_user_meta_data ->> 'role') = 'admin'
    OR (u.raw_app_meta_data ->> 'role') = 'admin'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. BANNERS RLS — suppression complète puis recréation
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE _pol text; BEGIN
  FOR _pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'banners' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.banners', _pol);
  END LOOP;
END $$;

-- SELECT : bannières actives pour tous, admin voit tout
CREATE POLICY "banners_select"
  ON public.banners FOR SELECT
  USING (is_active = true OR public.is_admin());

-- INSERT : admin seulement
CREATE POLICY "banners_insert"
  ON public.banners FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE : admin seulement
CREATE POLICY "banners_update"
  ON public.banners FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE : admin seulement
CREATE POLICY "banners_delete"
  ON public.banners FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. CHAT CONVERSATIONS — garantir la structure + FK + RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Ajouter la FK si elle manque (ignore si existe déjà)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'chat_conversations'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'chat_conversations_user_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.chat_conversations
        ADD CONSTRAINT chat_conversations_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Créer la table messages si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies chat_conversations (supprimer anciennes + recréer)
DO $$ DECLARE _pol text; BEGIN
  FOR _pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'chat_conversations' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_conversations', _pol);
  END LOOP;
END $$;

CREATE POLICY "chat_conv_select"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "chat_conv_insert"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "chat_conv_update"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Policies chat_messages (supprimer anciennes + recréer)
DO $$ DECLARE _pol text; BEGIN
  FOR _pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'chat_messages' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_messages', _pol);
  END LOOP;
END $$;

CREATE POLICY "chat_msg_select"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "chat_msg_insert"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "chat_msg_update"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.is_admin())
    )
  );

-- Index performance
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_created
  ON public.chat_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conv_updated
  ON public.chat_conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conv_user
  ON public.chat_conversations (user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. PROFILES RLS — garantir admin peut UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'admin_update_profiles'
  ) THEN
    CREATE POLICY "admin_update_profiles"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (id = auth.uid() OR public.is_admin())
      WITH CHECK (id = auth.uid() OR public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'admin_delete_profiles'
  ) THEN
    CREATE POLICY "admin_delete_profiles"
      ON public.profiles FOR DELETE
      TO authenticated
      USING (public.is_admin());
  END IF;
END $$;
