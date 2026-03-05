-- ═══════════════════════════════════════════════════════════════
-- RLS sécurisé pour chat_conversations + chat_messages
-- Principe : seul le participant (user_id ou admin) peut lire/écrire
-- ═══════════════════════════════════════════════════════════════

-- ─── chat_conversations ───────────────────────────────────────
ALTER TABLE IF EXISTS public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_select_participant"  ON public.chat_conversations;
DROP POLICY IF EXISTS "conv_insert_participant"  ON public.chat_conversations;
DROP POLICY IF EXISTS "conv_update_participant"  ON public.chat_conversations;
DROP POLICY IF EXISTS "conv_admin_all"           ON public.chat_conversations;

-- Admin voit et modifie toutes les conversations
CREATE POLICY "conv_admin_all"
  ON public.chat_conversations FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Utilisateur : voit uniquement ses conversations
CREATE POLICY "conv_select_participant"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Utilisateur : peut créer une conversation pour lui-même
CREATE POLICY "conv_insert_participant"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Utilisateur : peut mettre à jour sa propre conversation (updated_at)
CREATE POLICY "conv_update_participant"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── chat_messages ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msg_select_participant"  ON public.chat_messages;
DROP POLICY IF EXISTS "msg_insert_participant"  ON public.chat_messages;
DROP POLICY IF EXISTS "msg_update_own"          ON public.chat_messages;
DROP POLICY IF EXISTS "msg_admin_all"           ON public.chat_messages;

-- Admin voit et modifie tous les messages
CREATE POLICY "msg_admin_all"
  ON public.chat_messages FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Participant : lit les messages de ses conversations
CREATE POLICY "msg_select_participant"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- Participant : envoie un message dans sa conversation
CREATE POLICY "msg_insert_participant"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- Participant : marque ses messages comme lus (UPDATE is_read)
CREATE POLICY "msg_update_own"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- ─── Index performance ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON public.chat_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read
  ON public.chat_messages(conversation_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated
  ON public.chat_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id
  ON public.chat_conversations(user_id);

-- ─── Realtime ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
END $$;
