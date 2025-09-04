-- ========================================
-- SCRIPT DE RECRÉATION DES TABLES DE MESSAGERIE
-- Compatible avec le code Flutter et React Admin
-- ========================================

-- Supprimer les anciennes tables et leurs dépendances
DROP TABLE IF EXISTS public.message_attachments CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_conversations CASCADE;

-- ========================================
-- TABLE CHAT_CONVERSATIONS
-- ========================================
CREATE TABLE public.chat_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id TEXT DEFAULT NULL, -- Référence optionnelle à une commande
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX idx_conversations_admin_id ON public.chat_conversations(admin_id);
CREATE INDEX idx_conversations_status ON public.chat_conversations(status);
CREATE INDEX idx_conversations_created_at ON public.chat_conversations(created_at DESC);

-- ========================================
-- TABLE CHAT_MESSAGES
-- ========================================
CREATE TABLE public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_messages_is_read ON public.chat_messages(is_read);

-- ========================================
-- TABLE MESSAGE_ATTACHMENTS
-- ========================================
CREATE TABLE public.message_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_attachments_message_id ON public.message_attachments(message_id);

-- ========================================
-- TRIGGER POUR METTRE À JOUR updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- POLITIQUES RLS (Row Level Security)
-- ========================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- Politiques pour chat_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.chat_conversations FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.uid() = admin_id
  );

CREATE POLICY "Users can create conversations"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their conversations"
  ON public.chat_conversations FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    auth.uid() = admin_id
  );

-- Politiques pour chat_messages
CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (
        chat_conversations.user_id = auth.uid() OR 
        chat_conversations.admin_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = conversation_id
      AND (
        chat_conversations.user_id = auth.uid() OR 
        chat_conversations.admin_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.chat_messages FOR UPDATE
  USING (
    auth.uid() = sender_id OR
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (
        chat_conversations.user_id = auth.uid() OR 
        chat_conversations.admin_id = auth.uid()
      )
    )
  );

-- Politiques pour message_attachments
CREATE POLICY "Users can view attachments in their conversations"
  ON public.message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages
      JOIN public.chat_conversations ON chat_conversations.id = chat_messages.conversation_id
      WHERE chat_messages.id = message_attachments.message_id
      AND (
        chat_conversations.user_id = auth.uid() OR 
        chat_conversations.admin_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add attachments to their messages"
  ON public.message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_messages
      JOIN public.chat_conversations ON chat_conversations.id = chat_messages.conversation_id
      WHERE chat_messages.id = message_id
      AND chat_messages.sender_id = auth.uid()
    )
  );

-- ========================================
-- FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour obtenir le nombre de messages non lus
CREATE OR REPLACE FUNCTION get_unread_messages_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.chat_messages
    JOIN public.chat_conversations ON chat_conversations.id = chat_messages.conversation_id
    WHERE chat_messages.is_read = false
    AND chat_messages.sender_id != user_uuid
    AND (chat_conversations.user_id = user_uuid OR chat_conversations.admin_id = user_uuid)
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- DONNÉES DE TEST (Optionnel)
-- ========================================
-- Décommentez si vous voulez ajouter des données de test

/*
-- Créer une conversation de test
INSERT INTO public.chat_conversations (user_id, status)
SELECT id, 'active'
FROM auth.users
LIMIT 1;

-- Ajouter un message de test
INSERT INTO public.chat_messages (conversation_id, sender_id, message)
SELECT 
  c.id,
  c.user_id,
  'Message de test - Bonjour!'
FROM public.chat_conversations c
LIMIT 1;
*/

-- ========================================
-- VÉRIFICATION
-- ========================================
-- Requêtes pour vérifier que les tables sont bien créées

SELECT 'chat_conversations' as table_name, COUNT(*) as row_count FROM public.chat_conversations
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM public.chat_messages
UNION ALL
SELECT 'message_attachments', COUNT(*) FROM public.message_attachments;
