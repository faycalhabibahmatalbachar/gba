---
### Update 2026-01-26 14:00
Good news:
- Protocole multi-AI RepoSync v1 mis en place dans `.ai/PROTOCOL.md`.
- Dossiers `.ai/updates`, `.ai/claims`, `.ai/bugs` créés (avec .gitkeep).
Changements:
- Ajout fichiers de coordination (pas de code applicatif modifié).
Tests / Build:
- Commandes exécutées:
- Résultats:
Bugs / Risques:
- Si 2 agents éditent le même fichier hors protocole, conflits possibles. Merci de "claim" avant.
Idées (backlog):
- Ajouter CI (GitHub Actions) backend + flutter + admin.
- Ajouter lint python (ruff) et dart analyze dans CI.
Next:
- Chaque agent choisit un `AGENT_ID`, crée son journal, et claim ses tâches dans `.ai/claims/`.
---

---
### Update 2026-01-26 18:05
Good news:
- Templates email Supabase Auth multilingues (FR/EN/AR) ajoutés via Go templates (condition `{{ .Data.locale }}`) + support RTL pour AR.
- Stockage/sync du `locale` utilisateur dans `auth.users.user_metadata` déjà en place côté Flutter (signup + changement de langue), prêt pour l'usage côté email templates.
Changements:
- Ajout des templates HTML:
  - `supabase/templates/confirmation.html`
  - `supabase/templates/recovery.html`
  - `supabase/templates/magic_link.html`
  - `supabase/templates/email_change.html`
  - `supabase/templates/reauthentication.html` (OTP via `{{ .Token }}`)
  - `supabase/templates/invite.html`
- Câblage `content_path` dans `supabase/config.toml` via:
  - `auth.email.template.confirmation`
  - `auth.email.template.recovery`
  - `auth.email.template.magic_link`
  - `auth.email.template.email_change`
  - `auth.email.template.reauthentication`
  - `auth.email.template.invite`
- Claims mis à jour:
  - `MOBILE-201` (push templates i18n): completed
  - `MOBILE-203` (store locale in user_metadata): completed
  - `EMAIL-301` (Supabase Auth email templates i18n): completed
Tests / Build:
- Commandes exécutées:
- Résultats:
Bugs / Risques:
- Les `subject` dans `supabase/config.toml` ne sont pas localisés (contenu HTML oui). Si besoin, choisir un sujet neutre ou gérer côté dashboard/API.
Docs / Références:
- https://supabase.com/docs/guides/local-development/customizing-email-templates
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/troubleshooting/customizing-emails-by-language-KZ_38Q
Déploiement (Hosted Supabase Dashboard):
- Dashboard -> Authentication -> Email Templates:
  - Ouvrir chaque template (Confirmation / Recovery / Magic Link / Email Change / Reauthentication / Invite)
  - Coller le contenu HTML correspondant depuis `supabase/templates/*.html`
  - Sauvegarder
Déploiement (Local/Self-hosted Supabase):
- Les templates sont chargés via `supabase/config.toml` (`content_path`) et les fichiers `supabase/templates/*.html`.
Next:
- (Optionnel) Exécuter `flutter analyze` pour valider (et ajouter le résultat ici).
---

---
### Update 2026-01-26 18:20
Good news:
- Audit i18n Flutter (textes hardcodés) lancé et synthèse prête.
Changements:
- Claim pris: `MOBILE-202__i18n-audit-hardcoded-strings`.
Findings (hotspots):
- Beaucoup de textes UI sont encore hardcodés (FR majoritairement, parfois EN/AR) dans les écrans "premium" et plusieurs flux clés (auth/onboarding).
- Principaux hotspots (beaucoup de `Text('...')`, `SnackBar(Text('...'))`, `labelText`, `hintText`, etc.):
  - `lib/screens/home_screen_premium.dart`
  - `lib/screens/checkout/ultra_checkout_screen.dart`
  - `lib/screens/profile_screen_ultra.dart`
  - `lib/screens/product_detail_screen_premium.dart`
  - `lib/screens/cart_screen_premium.dart`
  - `lib/screens/onboarding_flow_screen.dart`
  - `lib/screens/auth/login_screen.dart`
  - `lib/screens/register_screen.dart`
  - `lib/screens/orders/my_orders_screen.dart`
  - `lib/screens/chat/chat_screen.dart`
Autres fichiers avec textes hardcodés (liste non exhaustive):
- `lib/screens/special_orders/special_order_details_screen.dart`
- `lib/screens/categories_screen_premium.dart`
- `lib/screens/favorites_screen_premium.dart`
- `lib/screens/settings_screen_premium.dart`
- `lib/screens/auth/forgot_password_screen.dart`
- `lib/screens/auth/reset_password_screen.dart`
- `lib/screens/auth/change_password_screen.dart`
- `lib/screens/legal/terms_of_service_screen.dart`
- `lib/screens/legal/privacy_policy_screen.dart`
- `lib/widgets/app_drawer.dart`
- `lib/routes/app_routes.dart` (errorBuilder)
Proposition de clés i18n (à ajouter dans `lib/localization/app_localizations.dart`):
- Common UI:
  - `common_back`, `common_next`, `common_skip`, `common_finish`, `common_continue`, `common_retry`
  - `common_save`, `common_cancel`, `common_confirm`, `common_close`
  - `common_error_title`, `common_error_detail` (param: `{error}` via `translateParams`)
- Auth:
  - `auth_resend_confirmation_email`
  - `auth_confirmation_resent`
  - `auth_enter_email_first`
  - `auth_check_inbox`
  - `auth_account_created_check_email`
- Onboarding:
  - `onboarding_welcome`
  - `onboarding_percent_complete` (param: `{percent}`)
  - `onboarding_profile_title`, `onboarding_profile_subtitle`
  - `onboarding_language_title`, `onboarding_language_subtitle`
  - `onboarding_notifications_title`, `onboarding_notifications_subtitle`
  - `onboarding_notifications_enable`, `onboarding_notifications_orders`, `onboarding_notifications_promotions`, `onboarding_notifications_messages`
- Navigation:
  - `nav_menu`, `nav_favorites`, `nav_logout`, `nav_admin_support`
- Orders:
  - `orders_title_my_orders`, `orders_empty_title`, `orders_empty_subtitle`, `orders_continue_shopping`
Exemples de remplacements (pattern):
- `const Text('Passer')` -> `Text(localizations.translate('common_skip'))`
- `'$percent% complété'` -> `localizations.translateParams('onboarding_percent_complete', {'percent': percent.toString()})`
- `SnackBar(content: Text('Erreur: $e'))` -> `SnackBar(content: Text(localizations.translateParams('common_error_detail', {'error': e.toString()})))`
Ordre de migration recommandé (top 10):
1. `lib/screens/auth/login_screen.dart`
2. `lib/screens/register_screen.dart`
3. `lib/screens/auth/forgot_password_screen.dart`
4. `lib/screens/auth/reset_password_screen.dart`
5. `lib/screens/onboarding_flow_screen.dart`
6. `lib/widgets/app_drawer.dart`
7. `lib/routes/app_routes.dart`
8. `lib/screens/home_screen_premium.dart`
9. `lib/screens/cart_screen_premium.dart`
10. `lib/screens/checkout/ultra_checkout_screen.dart`
Next:
- Valider la liste des clés prioritaires, puis migrer écran par écran (en ajoutant FR/EN/AR pour chaque clé).
---
