-- ============================================
-- Correction des politiques RLS pour le chat
-- ============================================

-- Désactiver RLS temporairement pour appliquer les changements
ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Public read conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Public insert conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Public update conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can read own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Anyone can read conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Anyone can update conversations" ON chat_conversations;

DROP POLICY IF EXISTS "Public read messages" ON chat_messages;
DROP POLICY IF EXISTS "Public insert messages" ON chat_messages;
DROP POLICY IF EXISTS "Public update messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can read conversation messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can read messages" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can create messages" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can update messages" ON chat_messages;

-- ============================================
-- NOUVELLES POLITIQUES POUR CHAT_CONVERSATIONS
-- ============================================

-- Politique pour permettre la lecture publique (temporaire pour dev)
CREATE POLICY "Enable read access for all users" ON chat_conversations
    FOR SELECT
    USING (true);

-- Politique pour permettre l'insertion publique
CREATE POLICY "Enable insert for all users" ON chat_conversations
    FOR INSERT
    WITH CHECK (true);

-- Politique pour permettre la mise à jour publique
CREATE POLICY "Enable update for all users" ON chat_conversations
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================
-- NOUVELLES POLITIQUES POUR CHAT_MESSAGES
-- ============================================

-- Politique pour permettre la lecture publique
CREATE POLICY "Enable read access for all users" ON chat_messages
    FOR SELECT
    USING (true);

-- Politique pour permettre l'insertion publique
CREATE POLICY "Enable insert for all users" ON chat_messages
    FOR INSERT
    WITH CHECK (true);

-- Politique pour permettre la mise à jour publique
CREATE POLICY "Enable update for all users" ON chat_messages
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================
-- RÉACTIVER RLS
-- ============================================

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VÉRIFICATION DES DONNÉES EXISTANTES
-- ============================================

-- Afficher les conversations récentes
SELECT 
    id,
    user_id,
    admin_id,
    status,
    created_at,
    updated_at
FROM chat_conversations
ORDER BY created_at DESC
LIMIT 10;

-- Afficher les messages récents
SELECT 
    m.id,
    m.conversation_id,
    m.sender_id,
    m.message,
    m.is_read,
    m.created_at,
    c.user_id as conversation_user_id
FROM chat_messages m
LEFT JOIN chat_conversations c ON m.conversation_id = c.id
ORDER BY m.created_at DESC
LIMIT 20;

-- Compter les conversations et messages
SELECT 
    'Conversations' as type,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
    COUNT(CASE WHEN admin_id IS NOT NULL THEN 1 END) as assigned
FROM chat_conversations
UNION ALL
SELECT 
    'Messages' as type,
    COUNT(*) as total,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread,
    NULL as assigned
FROM chat_messages;

-- ============================================
-- NOTE IMPORTANTE
-- ============================================
-- Ces politiques sont très permissives (public access)
-- Pour la production, il faudra implémenter une authentification
-- admin appropriée avec JWT et des politiques plus restrictives
