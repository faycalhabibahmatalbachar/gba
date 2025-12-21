# DB Scripts pour GBA Store

Ce dossier regroupe les principaux scripts SQL de la base de données.

## Structure proposée

- `schema/` : scripts de schéma (tables, RLS, fonctions, vues…)
- `seeds/` : données de démo / test
- `maintenance/` : scripts de nettoyage / correction ponctuelle

## Seeds

- `seeds/01_demo_products.sql` :
  - nettoie certaines catégories de test
  - insère des produits de démo (iPhone, MacBook, PS5, etc.) de façon idempotente
- `seeds/02_messaging_test_data.sql` :
  - crée plusieurs conversations et messages de test pour le chat

## Reset / nettoyage

- `maintenance/01_cleanup_demo_data.sql` :
  - supprime les produits de démo identifiés par leurs SKU
  - supprime les catégories de test/démo

## Schéma

Le schéma principal est actuellement défini dans les fichiers suivants à la racine du projet :

- `complete_supabase_schema.sql`
- `create_user_activities_system.sql`
- autres `create_*.sql` et `fix_*.sql`

Recommandation :

1. Exécuter `complete_supabase_schema.sql` dans l'éditeur SQL Supabase.
2. Exécuter `create_user_activities_system.sql` pour le tracking avancé.
3. Exécuter les scripts `fix_*.sql` nécessaires selon ton contexte.
4. Utiliser ensuite les scripts de `db/seeds/` pour les données de démo.
