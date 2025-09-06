-- ============================================
-- FIX UUID POUR LE SYSTÈME DE MESSAGERIE
-- ============================================
-- Ce script corrige les IDs pour utiliser des UUIDs valides

-- 1. Créer une conversation de test avec des UUIDs valides
INSERT INTO chat_conversations (
    id,
    user_id,
    admin_id,
    status,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'f47ac10b-58cc-4372-a567-0e02b2c3d479', -- UUID valide pour user
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', -- UUID valide pour admin
    'active',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Créer un message de test avec l'UUID admin valide
WITH conv AS (
    SELECT id FROM chat_conversations 
    WHERE admin_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
    LIMIT 1
)
INSERT INTO chat_messages (
    id,
    conversation_id,
    sender_id,
    message,
    is_read,
    created_at
) 
SELECT 
    gen_random_uuid(),
    conv.id,
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', -- UUID admin valide
    'Test message avec UUID valide - Système réparé!',
    false,
    NOW()
FROM conv;

-- 3. Si vous avez des données existantes avec "admin-001", les mettre à jour
-- ATTENTION: Ceci modifiera toutes les données existantes
UPDATE chat_messages 
SET sender_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
WHERE sender_id = 'admin-001';

UPDATE chat_conversations
SET admin_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
WHERE admin_id = 'admin-001';

-- 4. Mettre à jour les user_id non UUID
UPDATE chat_conversations
SET user_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
WHERE user_id = 'test-user-001';

UPDATE chat_messages
SET sender_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'  
WHERE sender_id = 'test-user-001';

-- 5. Vérifier les données
SELECT 
    'Conversations' as table_name,
    COUNT(*) as total,
    COUNT(DISTINCT admin_id) as admins_uniques,
    COUNT(DISTINCT user_id) as users_uniques
FROM chat_conversations
UNION ALL
SELECT 
    'Messages',
    COUNT(*),
    COUNT(DISTINCT sender_id),
    0
FROM chat_messages;

-- 6. Afficher les conversations récentes
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
LIMIT 5;
