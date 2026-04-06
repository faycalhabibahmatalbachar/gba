# Page Paramètres (`/settings`)

Fonctionnalités exposées dans [`src/app/(admin)/settings/page.tsx`](../src/app/(admin)/settings/page.tsx).

## Onglet Profil

- Lecture du compte Supabase Auth (`getUser`) et de la ligne `profiles` (prénom, nom, téléphone, ville, email, rôle, date d’inscription).
- Mise à jour des champs profil via Supabase client (selon RLS).

## Onglet Sécurité

- Changement de mot de passe utilisateur (flux Auth côté client).

## Onglet Notifications

- Préférences locales (cases à cocher) pour types d’alertes métier : nouvelles commandes, livraisons, stock bas, paiements.  
  (Persistance selon implémentation branchée sur `settings` ou stockage local — vérifier le code associé dans la page.)

## Onglet Email

- **GET/PATCH** [`/api/settings/email`](../src/app/api/settings/email/route.ts) : préférences `email_notification_prefs` (notifications actives, email admin, CC, nom expéditeur, flags nouvelle commande / sécurité).
- Envoi d’email de test si l’action est câblée dans la page (bouton dédié).

## Onglet Apparence

- Thème clair / sombre / système via `next-themes` (`setTheme`).

## APIs liées (autres pages)

- Plafond requêtes admin, pays, IP : [`/api/settings/security-access`](../src/app/api/settings/security-access/route.ts) (utilisé surtout depuis **Sécurité**).
- Politique MDP : [`/api/settings/password-policy`](../src/app/api/settings/password-policy/route.ts).
- Métadonnées secrets (statut env) : [`/api/settings/secrets-metadata`](../src/app/api/settings/secrets-metadata/route.ts).

## Variables d’environnement utiles

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (routes serveur)
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` (emails)
