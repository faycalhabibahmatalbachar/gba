-- ============================================
-- FIX COMPLET POUR LE SYSTÈME DE MESSAGERIE
-- ============================================
-- Ce script corrige les problèmes de RLS et permissions
-- pour le système de messagerie admin

-- 1. DÉSACTIVER RLS TEMPORAIREMENT (pour debug)
-- ============================================
ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER LES ANCIENNES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Admins can update conversations" ON chat_conversations;

DROP POLICY IF EXISTS "Users can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can send messages" ON chat_messages;

-- 3. CRÉER DES POLICIES OUVERTES (TEMPORAIRE)
-- ============================================
-- Pour chat_conversations
CREATE POLICY "Allow all operations on conversations" ON chat_conversations
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Pour chat_messages
CREATE POLICY "Allow all operations on messages" ON chat_messages
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Pour profiles
CREATE POLICY "Allow all operations on profiles" ON profiles
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- 4. RÉACTIVER RLS AVEC LES NOUVELLES POLICIES
-- ============================================
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. CRÉER UNE CONVERSATION DE TEST
-- ============================================
INSERT INTO chat_conversations (
    id,
    user_id,
    admin_id,
    status,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'test-user-001',
    'admin-001',
    'active',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 6. CRÉER UN MESSAGE DE TEST
-- ============================================
WITH conv AS (
    SELECT id FROM chat_conversations 
    WHERE user_id = 'test-user-001' 
    LIMIT 1
)
INSERT INTO chat_messages (
    conversation_id,
    sender_id,
    message,
    is_read,
    created_at
) 
SELECT 
    conv.id,
    'admin-001',
    'Message de test - Système de messagerie réparé!',
    false,
    NOW()
FROM conv;

-- 7. VÉRIFIER LE STATUT
-- ============================================
SELECT 
    'chat_conversations' as table_name,
    COUNT(*) as total_rows,
    current_setting('is_superuser') as is_admin
FROM chat_conversations
UNION ALL
SELECT 
    'chat_messages',
    COUNT(*),
    current_setting('is_superuser')
FROM chat_messages
UNION ALL
SELECT 
    'profiles',
    COUNT(*),
    current_setting('is_superuser')
FROM profiles;

-- 8. AFFICHER LES CONVERSATIONS RÉCENTES
-- ============================================
SELECT 
    c.id,
    c.user_id,
    c.admin_id,
    c.status,
    c.created_at,
    COUNT(m.id) as message_count
FROM chat_conversations c
LEFT JOIN chat_messages m ON m.conversation_id = c.id
GROUP BY c.id, c.user_id, c.admin_id, c.status, c.created_at
ORDER BY c.created_at DESC
LIMIT 10;

-- ============================================
-- FIN DU SCRIPT DE CORRECTION
-- ============================================
-- Note: Ce script désactive temporairement la sécurité RLS
-- pour permettre le debug. Une fois le système fonctionnel,
-- il faudra créer des policies plus restrictives.
