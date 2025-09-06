-- Script pour créer des données de test pour le système de messagerie
-- Assurez-vous d'avoir des utilisateurs dans la table auth.users avant d'exécuter ce script

-- Récupérer les IDs des utilisateurs existants
DO $$
DECLARE
    admin_id UUID;
    customer_id UUID;
    conversation_id UUID;
BEGIN
    -- Récupérer un admin (ou créer un utilisateur test)
    SELECT id INTO admin_id FROM auth.users LIMIT 1;
    
    -- Si pas d'utilisateur, on utilise des UUIDs fixes pour les tests
    IF admin_id IS NULL THEN
        admin_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID;
    END IF;
    
    -- Créer un customer_id de test
    customer_id := 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID;
    
    -- Créer une conversation de test
    INSERT INTO chat_conversations (
        id,
        customer_id,
        order_id,
        subject,
        status,
        priority,
        created_at,
        updated_at,
        last_message_at
    ) VALUES (
        gen_random_uuid(),
        customer_id,
        NULL,
        'Question sur ma commande',
        'active',
        'normal',
        NOW() - INTERVAL '1 hour',
        NOW(),
        NOW()
    ) RETURNING id INTO conversation_id;
    
    -- Ajouter des messages de test
    INSERT INTO chat_messages (
        conversation_id,
        sender_id,
        sender_type,
        message,
        is_read,
        created_at
    ) VALUES 
    (
        conversation_id,
        customer_id,
        'customer',
        'Bonjour, j''aimerais savoir où en est ma commande ?',
        true,
        NOW() - INTERVAL '30 minutes'
    ),
    (
        conversation_id,
        admin_id,
        'admin',
        'Bonjour ! Je vais vérifier cela pour vous immédiatement.',
        true,
        NOW() - INTERVAL '25 minutes'
    ),
    (
        conversation_id,
        customer_id,
        'customer',
        'Merci beaucoup pour votre aide !',
        false,
        NOW() - INTERVAL '20 minutes'
    ),
    (
        conversation_id,
        admin_id,
        'admin',
        'Votre commande a été expédiée ce matin. Vous devriez la recevoir dans 2-3 jours.',
        false,
        NOW() - INTERVAL '15 minutes'
    );
    
    -- Créer une deuxième conversation
    INSERT INTO chat_conversations (
        id,
        customer_id,
        order_id,
        subject,
        status,
        priority,
        created_at,
        updated_at,
        last_message_at
    ) VALUES (
        gen_random_uuid(),
        'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::UUID,
        NULL,
        'Problème technique sur l''application',
        'active',
        'high',
        NOW() - INTERVAL '2 hours',
        NOW(),
        NOW() - INTERVAL '5 minutes'
    ) RETURNING id INTO conversation_id;
    
    -- Messages pour la deuxième conversation
    INSERT INTO chat_messages (
        conversation_id,
        sender_id,
        sender_type,
        message,
        is_read,
        created_at
    ) VALUES 
    (
        conversation_id,
        'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::UUID,
        'customer',
        'Je n''arrive pas à me connecter à l''application',
        true,
        NOW() - INTERVAL '45 minutes'
    ),
    (
        conversation_id,
        admin_id,
        'admin',
        'Pouvez-vous me dire quel message d''erreur vous recevez ?',
        true,
        NOW() - INTERVAL '40 minutes'
    ),
    (
        conversation_id,
        'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::UUID,
        'customer',
        'Il dit "Identifiants incorrects" mais je suis sûr de mon mot de passe',
        false,
        NOW() - INTERVAL '10 minutes'
    );
    
    -- Créer une conversation résolue
    INSERT INTO chat_conversations (
        id,
        customer_id,
        order_id,
        subject,
        status,
        priority,
        created_at,
        updated_at,
        last_message_at
    ) VALUES (
        gen_random_uuid(),
        'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14'::UUID,
        NULL,
        'Demande de remboursement',
        'resolved',
        'normal',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '6 hours',
        NOW() - INTERVAL '6 hours'
    ) RETURNING id INTO conversation_id;
    
    -- Messages pour la conversation résolue
    INSERT INTO chat_messages (
        conversation_id,
        sender_id,
        sender_type,
        message,
        is_read,
        created_at
    ) VALUES 
    (
        conversation_id,
        'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14'::UUID,
        'customer',
        'J''aimerais être remboursé pour ma dernière commande',
        true,
        NOW() - INTERVAL '1 day'
    ),
    (
        conversation_id,
        admin_id,
        'admin',
        'Le remboursement a été effectué. Vous devriez le recevoir dans 3-5 jours ouvrables.',
        true,
        NOW() - INTERVAL '6 hours'
    );
    
    RAISE NOTICE 'Données de test créées avec succès !';
END $$;

-- Afficher les conversations créées
SELECT 
    c.id,
    c.subject,
    c.status,
    c.priority,
    c.created_at,
    COUNT(m.id) as message_count
FROM chat_conversations c
LEFT JOIN chat_messages m ON c.id = m.conversation_id
GROUP BY c.id, c.subject, c.status, c.priority, c.created_at
ORDER BY c.created_at DESC;
