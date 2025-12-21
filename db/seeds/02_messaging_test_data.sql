-- Données de test pour le système de messagerie
-- Copié à partir de create_test_messaging_data.sql pour centraliser les seeds

-- Script pour créer des données de test pour le système de messagerie
-- Assurez-vous d'avoir des utilisateurs dans la table auth.users avant d'exécuter ce script

-- Récupérer les IDs des utilisateurs existants
DO $$
DECLARE
    admin_id UUID;
    customer_id UUID;
    conversation_id UUID;
BEGIN
    -- Récupérer un utilisateur qui servira d'admin de test
    SELECT id INTO admin_id FROM auth.users LIMIT 1;
    
    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'Aucun utilisateur trouvé dans auth.users. Créez au moins un utilisateur avant d''exécuter ce script.';
    END IF;

    -- Récupérer un autre utilisateur pour jouer le rôle de client
    SELECT id INTO customer_id FROM auth.users WHERE id <> admin_id LIMIT 1;

    -- Si aucun autre utilisateur, on réutilise le même id (admin et client identiques)
    IF customer_id IS NULL THEN
        customer_id := admin_id;
    END IF;
    
    -- Créer une première conversation de test
    INSERT INTO chat_conversations (
        user_id,
        admin_id,
        order_id,
        status
    ) VALUES (
        customer_id,
        admin_id,
        'TEST-ORDER-1',
        'active'
    ) RETURNING id INTO conversation_id;
    
    -- Ajouter des messages de test
    INSERT INTO chat_messages (
        conversation_id,
        sender_id,
        message,
        is_read,
        created_at
    ) VALUES 
    (
        conversation_id,
        customer_id,
        'Bonjour, j''aimerais savoir où en est ma commande ?',
        true,
        NOW() - INTERVAL '30 minutes'
    ),
    (
        conversation_id,
        admin_id,
        'Bonjour ! Je vais vérifier cela pour vous immédiatement.',
        true,
        NOW() - INTERVAL '25 minutes'
    ),
    (
        conversation_id,
        customer_id,
        'Merci beaucoup pour votre aide !',
        false,
        NOW() - INTERVAL '20 minutes'
    ),
    (
        conversation_id,
        admin_id,
        'Votre commande a été expédiée ce matin. Vous devriez la recevoir dans 2-3 jours.',
        false,
        NOW() - INTERVAL '15 minutes'
    );
    
    -- Créer une deuxième conversation
    INSERT INTO chat_conversations (
        user_id,
        admin_id,
        order_id,
        status
    ) VALUES (
        customer_id,
        admin_id,
        'TEST-ORDER-2',
        'active'
    ) RETURNING id INTO conversation_id;
    
    -- Messages pour la deuxième conversation
    INSERT INTO chat_messages (
        conversation_id,
        sender_id,
        message,
        is_read,
        created_at
    ) VALUES 
    (
        conversation_id,
        customer_id,
        'Je n''arrive pas à me connecter à l''application',
        true,
        NOW() - INTERVAL '45 minutes'
    ),
    (
        conversation_id,
        admin_id,
        'Pouvez-vous me dire quel message d''erreur vous recevez ?',
        true,
        NOW() - INTERVAL '40 minutes'
    ),
    (
        conversation_id,
        customer_id,
        'Il dit "Identifiants incorrects" mais je suis sûr de mon mot de passe',
        false,
        NOW() - INTERVAL '10 minutes'
    );
    
    -- Créer une conversation résolue (fermée)
    INSERT INTO chat_conversations (
        user_id,
        admin_id,
        order_id,
        status
    ) VALUES (
        customer_id,
        admin_id,
        'TEST-ORDER-3',
        'closed'
    ) RETURNING id INTO conversation_id;
    
    -- Messages pour la conversation résolue
    INSERT INTO chat_messages (
        conversation_id,
        sender_id,
        message,
        is_read,
        created_at
    ) VALUES 
    (
        conversation_id,
        customer_id,
        'J''aimerais être remboursé pour ma dernière commande',
        true,
        NOW() - INTERVAL '1 day'
    ),
    (
        conversation_id,
        admin_id,
        'Le remboursement a été effectué. Vous devriez le recevoir dans 3-5 jours ouvrables.',
        true,
        NOW() - INTERVAL '6 hours'
    );
    
    RAISE NOTICE 'Données de test créées avec succès !';
END $$;

-- Afficher les conversations créées
SELECT 
    c.id,
    c.user_id,
    c.admin_id,
    c.status,
    c.created_at,
    COUNT(m.id) as message_count
FROM chat_conversations c
LEFT JOIN chat_messages m ON c.id = m.conversation_id
GROUP BY c.id, c.user_id, c.admin_id, c.status, c.created_at
ORDER BY c.created_at DESC;
