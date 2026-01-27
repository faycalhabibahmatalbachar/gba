---
### Update 2026-01-26 15:55
Good news:
- Protocole RepoSync v1 lu (PROMPT + PROTOCOL) et claims existants vérifiés.
Changements:
- Création du journal d'updates `AI_RECSYS_BACKEND`.
Tests / Build:
- Commandes exécutées:
- Résultats:
Bugs / Risques:
- Erreur SQL 42601 probable liée à un copier/coller incluant des numéros de ligne (ex: "7 last_updated ...").
Idées (backlog):
- Ajouter un script PowerShell "safe" pour récupérer un JWT Supabase sans exposer le mot de passe dans l'historique.
Next:
- Créer un claim dédié (SQL + récupération token + smoketest reco).
---

---
### Update 2026-01-26 16:10
Good news:
- Le script `db/maintenance/00_recreate_schema.sql` n'a plus le préfixe de numéro de ligne qui cassait la syntaxe (42601).
Changements:
- Claim `RECSYS-101` mis à jour pour réserver `db/maintenance/00_recreate_schema.sql`.
- Correction du début de `db/maintenance/00_recreate_schema.sql`:
  - Ajout `create extension if not exists pgcrypto;`
  - Ajout de la fonction trigger `public.set_updated_at()`
  - Restauration d'un `create table if not exists public.profiles (...)` complet (incluant `last_updated`)
Tests / Build:
- Commandes exécutées:
- Résultats:
Bugs / Risques:
- Le script n'a pas encore été re-joué côté DB: à valider en l'exécutant dans Supabase (ou via psql) pour confirmer qu'il passe sans erreurs.
Idées (backlog):
- Fournir une commande PowerShell "safe" (Read-Host -AsSecureString) pour récupérer un JWT Supabase via l'endpoint `/auth/v1/token`.
Next:
- Valider l'exécution SQL (plus d'erreur 42601).
- Récupérer un JWT Supabase via terminal et lancer un smoketest `/v1/me` + `/v1/recommendations`.
---

---
### Update 2026-01-26 18:45
Good news:
- Un JWT Supabase (access_token) a été récupéré avec succès via PowerShell (endpoint `/auth/v1/token?grant_type=password`).
Changements:
- `db/maintenance/00_recreate_schema.sql`
  - Fix erreur `42P16` (views): ajout `drop view if exists ...` avant `create or replace view` pour `public.special_order_details_view` et `public.order_details_view`.
  - Alignement schéma livraison: ajout des colonnes `delivery_lat`, `delivery_lng`, `delivery_accuracy`, `delivery_captured_at` sur `public.orders` et `public.special_orders` via `alter table ... add column if not exists`.
Tests / Build:
- Commandes exécutées:
- Résultats:
  - Backend `/v1/me` et `/v1/recommendations`: encore en 500 tant que `SUPABASE_URL` / `SUPABASE_ANON_KEY` ne sont pas visibles côté process (env/.env).
Bugs / Risques:
- `CREATE OR REPLACE VIEW` + `so.*` / `o.*` peut casser si les tables sous-jacentes ont reçu de nouvelles colonnes (ex: `delivery_lat`) => d'où le `drop view`.
Next:
- Rejouer `db/maintenance/00_recreate_schema.sql` côté DB pour valider que le `42P16` est résolu.
- Corriger la config backend (env vars) puis relancer le smoketest `/v1/me` + `/v1/recommendations` avec JWT.
---

 ---
 ### Update 2026-01-26 20:05
 Good news:
 - Diagnostic confirmé côté tests: le header `Authorization: Bearer ...` était vide quand `$jwt` n'était pas défini (=> "Missing bearer token").
 Changements:
 - `backend/app.py`
   - Robustesse Windows: strip du BOM UTF-8 (`\ufeff`) lors du parsing `.env` afin que `SUPABASE_URL` / `SUPABASE_ANON_KEY` soient correctement chargées.
 - Claim `RECSYS-101`: ajout de `backend/app.py` dans la liste des fichiers concernés.
 Tests / Build:
 - Commandes exécutées:
   - `GET /health`
   - `GET /v1/recommendations` (test curl)
 - Résultats:
   - Backend retourne encore `Supabase auth not configured` tant que le process ne voit pas `SUPABASE_URL` / `SUPABASE_ANON_KEY` (nécessite reload/redémarrage uvicorn après correction `.env`).
 Next:
 - Redémarrer uvicorn (ou vérifier reload) puis re-tester `/v1/me` et `/v1/recommendations` avec un vrai JWT Supabase (access_token).
 ---
