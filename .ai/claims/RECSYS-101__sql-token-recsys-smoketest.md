Owner: AI_RECSYS_BACKEND
Status: in_progress
Scope: backend | supabase
Files (prévu):
- .ai/claims/RECSYS-101__sql-token-recsys-smoketest.md
- .ai/updates/AI_RECSYS_BACKEND.md
- backend/app.py
- db/maintenance/00_recreate_schema.sql

Branch (si Git): n/a

Definition of Done:
- Procédure validée pour exécuter les scripts SQL sans erreurs de syntaxe (pas de numéros de ligne copiés).
- Procédure validée pour récupérer un JWT Supabase (access_token) via terminal (PowerShell) sans exposer le mot de passe dans l'historique.
- Note claire: le système de recommandation reste à tester (smoketest /v1/me + /v1/recommendations avec JWT).
