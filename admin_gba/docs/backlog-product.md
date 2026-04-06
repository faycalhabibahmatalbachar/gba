# Backlog produit & technique (admin GBA)

## Court terme

- **Algorithme de recommandation** : UI complète sur `recommendation_settings` (poids, activation, nombre d’items), historique des changements, prévisualisation par segment utilisateur.
- **Ingestion `user_behavior`** : SDK / événements normalisés depuis l’app Flutter, file d’attente offline, validation schéma.
- **Historique livraison** : écriture automatique dans `delivery_status_history` à chaque changement de statut / assignation livreur (trigger ou service).
- **RBAC admin fin** : matrice permissions (lecture / édition / export / suppression / pages) stockée et appliquée côté middleware + API.
- **Endpoint agrégé sécurité** : un seul `GET` pour réduire la pression sur le plafond requêtes (même si superadmin est exclu du rate limit).

## Email & notifications

- Webhooks Resend (bounces, complaints), retries automatiques.
- Templates éditables en base + prévisualisation HTML.

## Qualité & observabilité

- Tests E2E (Playwright) sur flux critiques : login, security, settings, email-logs.
- Métriques Vercel + alertes sur taux 429/5xx des routes `/api/*`.

## Déploiement Vercel (rappel)

Projet : [gba sur Vercel](https://vercel.com/gbas-projects-38754d42/gba) — domaine exemple : `globalbusinessamdaradir.vercel.app`.

Variables typiques à renseigner :

| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service (API routes serveur uniquement) |
| `RESEND_API_KEY` | Envoi des emails transactionnels |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | Expéditeur |
| Secrets Firebase / FCM si push admin | Optionnel |

Après modification des secrets : **redéployer** et appliquer les **migrations SQL** sur le même projet Supabase que les variables.
