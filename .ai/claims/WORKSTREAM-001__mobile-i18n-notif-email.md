Owner: AI_CASCADE
Status: in_progress
Scope: flutter | backend | supabase
Files (prévu):
- .ai/claims/WORKSTREAM-001__mobile-i18n-notif-email.md

Branch (si Git): n/a

Definition of Done:
- Un agent a claim la partie Flutter (i18n + push templates)
- Un agent a claim la partie Email templates (Supabase Auth + transactional si prévu)
- Chaque agent poste des updates réguliers dans `.ai/updates/<AGENT_ID>.md`
- Pas de conflits: fichiers réservés respectés

Plan / Assignation recommandée:
- Flutter i18n & Push templates:
  - Agent: AI_CASCADE
  - Cible fichiers: lib/localization/app_localizations.dart, lib/services/notification_service.dart
- Email templates (Auth + transactionnel):
  - Agent: (à prendre)
  - Cible: templates HTML stockés dans le repo + instructions Supabase Dashboard
  - Bonus: proposer une Edge Function pour envoyer des emails transactionnels multilingues
- Push sending (serveur):
  - Agent: (à prendre)
  - Cible: proposer un mécanisme serveur (Edge Function / backend) qui lit `device_tokens` (locale) et envoie via FCM Admin SDK
