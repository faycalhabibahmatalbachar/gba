Owner: AI_CASCADE
Status: completed
Scope: supabase
Files (prévu):
- supabase/config.toml
- supabase/templates/confirmation.html
- supabase/templates/recovery.html
- supabase/templates/magic_link.html
- supabase/templates/email_change.html
- supabase/templates/reauthentication.html
- supabase/templates/invite.html
- .ai/updates/AI_CASCADE.md

Branch (si Git): feature/email-auth-templates-i18n

Definition of Done:
- Templates Supabase Auth prêts (HTML) pour:
  - confirmation email (signup)
  - reset password
  - magic link / OTP (si utilisé)
- Versions FR / EN / AR (contenu et RTL si nécessaire)
- Utilisation correcte des variables Supabase (ex: {{ .ConfirmationURL }}, {{ .Token }}, {{ .TokenHash }}, {{ .RedirectTo }}, {{ .SiteURL }}) + conditions Go template basées sur `{{ .Data.locale }}`
- Un update dans `.ai/updates/<AGENT_ID>.md` avec:
  - liens docs Supabase utilisés
  - instructions exactes pour copier/coller les templates dans Supabase

Notes:
- Prendre cette tâche en changeant Owner + Status=in_progress.
