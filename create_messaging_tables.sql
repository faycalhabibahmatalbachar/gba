-- ========================================
-- TABLES SYSTÈME DE MESSAGERIE TEMPS RÉEL
-- ========================================

-- 1. Table des conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    subject VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'admin')),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'location', 'product_card')),
    content TEXT,
    metadata JSONB DEFAULT '{}', -- Pour stocker URLs fichiers, coordonnées GPS, etc.
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 3. Table des fichiers attachés
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des réponses rapides (templates)
CREATE TABLE IF NOT EXISTS quick_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50),
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table des notifications push
CREATE TABLE IF NOT EXISTS message_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    title VARCHAR(255),
    body TEXT,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table des participants aux conversations (pour multi-admin)
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('customer', 'admin', 'observer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    UNIQUE(conversation_id, user_id)
);

-- Index pour performance
CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);

-- Trigger pour mettre à jour last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_notifications ENABLE ROW LEVEL SECURITY;

-- Clients peuvent voir leurs propres conversations
CREATE POLICY "Customers can view own conversations" ON conversations
    FOR SELECT USING (
        auth.uid() = customer_id 
        OR auth.uid() IN (
            SELECT user_id FROM conversation_participants 
            WHERE conversation_id = conversations.id
        )
    );

-- Admins peuvent voir toutes les conversations
CREATE POLICY "Admins can view all conversations" ON conversations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Messages visibles pour participants
CREATE POLICY "Users can view conversation messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id
            AND (
                conversations.customer_id = auth.uid()
                OR auth.uid() IN (
                    SELECT user_id FROM conversation_participants 
                    WHERE conversation_id = conversations.id
                )
                OR EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'
                )
            )
        )
    );

-- Insertion messages pour participants
CREATE POLICY "Participants can send messages" ON messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id
            AND (
                conversations.customer_id = auth.uid()
                OR auth.uid() IN (
                    SELECT user_id FROM conversation_participants 
                    WHERE conversation_id = conversations.id
                )
                OR EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'
                )
            )
        )
    );
