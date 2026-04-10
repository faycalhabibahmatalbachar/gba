# Journal des emails (admin GBA)

## Fonctionnalités

- Chaque envoi transactionnel est enregistré dans la table `email_logs` (statut, latence, identifiant fournisseur).
- Fournisseurs supportés : **Resend** ou **SMTP** (Brevo, etc.), selon `EMAIL_PROVIDER` et les variables d’environnement.
- Pour que les envois partent réellement, définir **`ENABLE_OUTBOUND_EMAIL=true`** sur le serveur (ex. Vercel) en plus de `RESEND_API_KEY` ou `SMTP_*`.

## Pièces jointes manuelles

Les fichiers attachés aux emails composés depuis l’admin transitent par le bucket configuré pour les pièces jointes (URLs signées ou publiques selon la route d’upload).

## Politique en cas d’erreur

Si le fournisseur est indisponible, l’action métier peut continuer : l’échec est journalisé dans `email_logs` avec message d’erreur.
