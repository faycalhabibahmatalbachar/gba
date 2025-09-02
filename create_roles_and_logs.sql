-- =====================================================
-- TABLES POUR ROLES ET LOGS D'ACTIVITÉ
-- =====================================================

-- Table des rôles utilisateurs
DROP TABLE IF EXISTS user_roles CASCADE;
CREATE TABLE user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('admin', 'customer', 'manager', 'support')) DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Table des logs d'activité admin
DROP TABLE IF EXISTS admin_activity_logs CASCADE;
CREATE TABLE admin_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des notifications
DROP TABLE IF EXISTS notifications CASCADE;
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('order_status', 'promotion', 'system', 'product_back_in_stock', 'review_response')),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_admin_logs_admin_id ON admin_activity_logs(admin_id);
CREATE INDEX idx_admin_logs_entity ON admin_activity_logs(entity_type, entity_id);
CREATE INDEX idx_admin_logs_created_at ON admin_activity_logs(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour vérifier si un utilisateur est admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = $1 
    AND role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour logger les activités admin automatiquement
CREATE OR REPLACE FUNCTION log_admin_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Déterminer l'action
  IF TG_OP = 'INSERT' THEN
    v_action := 'create_' || TG_TABLE_NAME;
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update_' || TG_TABLE_NAME;
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete_' || TG_TABLE_NAME;
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  END IF;

  -- Insérer le log
  INSERT INTO admin_activity_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    details
  ) VALUES (
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_old_values,
    v_new_values,
    jsonb_build_object('operation', TG_OP)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS POUR LOGGING AUTOMATIQUE
-- =====================================================

-- Trigger pour logger les modifications de produits
DROP TRIGGER IF EXISTS log_products_changes ON products;
CREATE TRIGGER log_products_changes
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_admin_activity();

-- Trigger pour logger les modifications de commandes
DROP TRIGGER IF EXISTS log_orders_changes ON orders;
CREATE TRIGGER log_orders_changes
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_admin_activity();

-- Trigger pour logger les modifications de catégories
DROP TRIGGER IF EXISTS log_categories_changes ON categories;
CREATE TRIGGER log_categories_changes
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION log_admin_activity();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Policies pour user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles" ON user_roles
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Policies pour admin_activity_logs
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view logs" ON admin_activity_logs
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "System can insert logs" ON admin_activity_logs
  FOR INSERT WITH CHECK (true);

-- Policies pour notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage all notifications" ON notifications
  FOR ALL USING (is_admin(auth.uid()));

-- =====================================================
-- FONCTION POUR CRÉER UNE NOTIFICATION
-- =====================================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type VARCHAR(50),
  p_title VARCHAR(255),
  p_message TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION POUR NOTIFIER UN CHANGEMENT DE STATUT DE COMMANDE
-- =====================================================

CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM create_notification(
      NEW.user_id,
      'order_status',
      'Order Status Updated',
      format('Your order %s status has been updated to %s', NEW.order_number, NEW.status),
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour notifier les changements de statut
DROP TRIGGER IF EXISTS notify_order_status ON orders;
CREATE TRIGGER notify_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_order_status_change();

-- =====================================================
-- DONNÉES DE TEST
-- =====================================================

-- Créer un admin de test (à adapter avec un vrai user_id)
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ('YOUR_ADMIN_USER_ID', 'admin');

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue pour les statistiques d'activité admin
CREATE OR REPLACE VIEW admin_activity_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  admin_id,
  COUNT(*) as total_actions,
  COUNT(DISTINCT entity_type) as entities_modified,
  jsonb_agg(DISTINCT action) as actions_performed
FROM admin_activity_logs
GROUP BY DATE_TRUNC('day', created_at), admin_id;

-- Vue pour les notifications non lues
CREATE OR REPLACE VIEW unread_notifications AS
SELECT 
  user_id,
  COUNT(*) as unread_count,
  MAX(created_at) as latest_notification
FROM notifications
WHERE is_read = FALSE
GROUP BY user_id;

-- =====================================================
-- PERMISSIONS POUR LES VUES
-- =====================================================

GRANT SELECT ON admin_activity_stats TO authenticated;
GRANT SELECT ON unread_notifications TO authenticated;
