-- Désactiver temporairement RLS pour débugger
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;

-- Créer des politiques permissives pour les tests
-- Permettre toutes les opérations sans restriction
CREATE POLICY "Allow all operations on chat_messages" ON chat_messages
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on chat_conversations" ON chat_conversations  
FOR ALL USING (true) WITH CHECK (true);

-- Note: Ces politiques sont temporaires pour le développement
-- Il faudra les remplacer par des politiques sécurisées en production
