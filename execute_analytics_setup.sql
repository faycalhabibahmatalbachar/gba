-- ========================================
-- SCRIPT COMPLET À EXÉCUTER DANS SUPABASE
-- ========================================

-- Exécutez ce script en PREMIER pour créer les tables nécessaires
-- Puis exécutez fix_orders_complete.sql pour le système de commandes

-- 1. D'abord, supprimer les tables si elles existent (pour repartir propre)
DROP TABLE IF EXISTS user_activity_metrics CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_activities CASCADE;
DROP VIEW IF EXISTS top_viewed_products CASCADE;
DROP VIEW IF EXISTS conversion_metrics CASCADE;
DROP FUNCTION IF EXISTS track_user_activity CASCADE;
DROP FUNCTION IF EXISTS get_realtime_analytics CASCADE;
DROP FUNCTION IF EXISTS get_user_activity_summary CASCADE;

-- 2. Maintenant exécuter le contenu de create_user_activities_system.sql
-- Copiez tout le contenu du fichier create_user_activities_system.sql ici

-- Note: Une fois ce script exécuté avec succès, 
-- la page Analytics dans l'admin fonctionnera correctement
