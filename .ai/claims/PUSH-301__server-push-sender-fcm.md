Owner: UNASSIGNED
Status: blocked
Scope: backend | supabase | data
Files (prévu):
- (à créer) supabase/functions/<send-push>/index.ts (ou backend équivalent)
- (à créer) docs/push-templates.md (si accepté) ou instructions dans claim

Branch (si Git): feature/push-sender-fcm

Definition of Done:
- Un mécanisme serveur pour envoyer des push via Firebase Admin SDK
- Source des destinataires: table `device_tokens` (token + locale + platform)
- Support templates: `order_status`, `cart_abandoned`, `promotion`
- Le serveur choisit le texte selon `device_tokens.locale` (fr/en/ar)
- Logging + gestion erreurs + dry-run possible

Notes:
- Prendre cette tâche en changeant Owner + Status=in_progress.
- Pour éviter conflits, ne pas modifier `lib/services/notification_service.dart` (réservé par MOBILE-201) sauf accord.
