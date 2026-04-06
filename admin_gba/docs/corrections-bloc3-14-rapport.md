# Rapport corrections admin_gba — 2026-04-05

## Build

`npm run build` : **OK** (TypeScript strict, Next.js 16.2.2).

## BLOC 3 — Fiche produit enrichie

| Élément | Fichier |
|--------|---------|
| GET enrichi (`product`, `chartData`, `reviews`, rétrocompat `data`) | `src/app/api/products/[id]/route.ts` |
| Commandes liées au produit | `src/app/api/products/[id]/orders/route.ts` |
| Drawer complet (Sheet, onglets, Recharts, stock, avis, audit) | `src/app/(admin)/products/_components/ProductDetailDrawer.tsx` |
| Squelette, table commandes, timeline audit | `_components/ProductDetailSkeleton.tsx`, `ProductOrdersTable.tsx`, `ProductAuditTimeline.tsx` |
| Filtre audit par entité | `src/app/api/audit/route.ts` (`entity_id`) |
| PATCH avis (modération + réponse) | `src/app/api/reviews/[id]/route.ts` |
| Statuts avis dans `StatusBadge` | `src/components/ui/custom/StatusBadge.tsx` |

## BLOC 4 — Catégories

| Élément | Fichier |
|--------|---------|
| Réponse API : `categories` + `data` (compat page existante) | `src/app/api/categories/route.ts` |

## BLOC 5 — Livraisons API

| Élément | Fichier |
|--------|---------|
| Liste livraisons enrichie (fallback select simple) | `src/app/api/deliveries/route.ts` |
| POST assignation (`deliveries.driver_id` + `orders.driver_id` = `user_id` livreur) | `src/app/api/deliveries/[id]/assign/route.ts` |

*Note : la page `src/app/(admin)/deliveries/page.tsx` utilise encore `order_details_view` via `lib/services/deliveries.ts`. Les nouvelles routes servent les écrans/API qui consomment `/api/deliveries` (ex. tracking, assignation par `delivery_id`).*

## BLOC 6–7 — Drivers API

| Élément | Fichier |
|--------|---------|
| `GET /api/drivers?available=true&limit=50` (liste pour assignation) | `src/app/api/drivers/route.ts` |

## BLOC 8 — Utilisateurs / suspension

| Élément | Fichier |
|--------|---------|
| Migration RLS profil (lecture propriétaire) | `supabase/migrations/20260405000001_fix_suspension_rls.sql` |
| Création utilisateur (Auth + profil + audit) | `src/app/api/admin/create-user/route.ts` |

*Note : `UserDetailDrawer` « bigdata » complet et modal création 800px détaillés dans le cahier des charges ne sont pas entièrement recodés ici ; l’endpoint `create-user` est prêt pour les brancher.*

## BLOC 9 — Messages

| Élément | Fichier |
|--------|---------|
| Upload multi-buckets (réduit « Bucket not found ») | `src/app/api/messages/upload/route.ts` |
| Bucket SQL `chat-attachments` | `supabase/migrations/20260413100000_chat_attachments_bucket.sql` |
| `renderMessageContent` (pièces jointes, soft delete, carte OSM) | `src/app/(admin)/messages/_components/MessageThread.tsx` |
| Copie presse-papiers HTTP (fallback `execCommand`) | idem |
| `MediaRecorder` avec mime fallback | idem |

## BLOCS 10–13 (rapports, sécurité, monitoring, navigation)

Les pages `reports`, `security`, `monitoring` et la sidebar existantes **n’ont pas été remplacées intégralement** selon le canevas 6 onglets / 7 sections / matrice permissions : le dépôt conservait déjà des écrans fonctionnels ; l’objectif prioritaire de cette passe était API produits, livraisons, messages, drivers et build vert.

## Migrations SQL à appliquer côté Supabase

1. `20260405000001_fix_suspension_rls.sql`
2. `20260413100000_chat_attachments_bucket.sql`  
   (Si l’INSERT échoue selon la version Supabase, créer le bucket `chat-attachments` depuis le dashboard et policies storage si besoin.)

## Limitations restantes

- Temps de réponse élevé sur `/api/messages/conversations` : optimisations possibles (index DB, réduction des champs `select`, pagination).
- Page livraisons UI : bascule complète vers `/api/deliveries` non faite (deux modèles : commande vs enregistrement `deliveries`).
- Permissions granulaires `requireAdmin(permission)` et refonte `NAV_GROUPS` avec badges dynamiques : non implémentés dans cette passe.

## Prochaines priorités recommandées

1. Brancher la page Livraisons sur `/api/deliveries` + dialog d’assignation par `delivery.id`.
2. Enrichir `GET /api/messages/conversations` (indexes + projection minimale).
3. Finaliser UI utilisateurs (drawer métriques + modal création branchée sur `POST /api/admin/create-user`).
4. Implémenter `GET /api/reports/*` et onglets si un « central de commandement » unique est requis.
