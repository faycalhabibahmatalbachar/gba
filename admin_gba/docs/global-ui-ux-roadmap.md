# Roadmap UX transversale admin

## Objectif
Uniformiser l'UX de toutes les pages admin apres stabilisation des incidents runtime/SQL/hydration.

## Standards UI communs
- Etats de chargement: utiliser `Skeleton` homogène (cartes, tableaux, panneaux latéraux).
- Etats vides: toujours afficher un message actionnable + CTA principal.
- Etats erreur: bannière courte, action de retry et code d'erreur si disponible.
- Formats: dates en `fr-FR`, montants en `XOF/FCFA`, latence en `ms`.
- Couleurs statut: succès (vert), attention (ambre), critique (rouge), info (bleu).

## Priorités par module
1. Drivers:
   - messages GPS plus précis (aucune donnée, données partielles, données obsolètes)
   - cohérence `live` vs `liste` sur statuts et badges
2. Security:
   - sessions/IP/pays avec fallback explicite `inconnu` vs `non collecté`
   - retours d'actions broadcast/emergency standardisés
3. Email logs:
   - clarifier provider SMTP uniquement
   - accélérer actions détaillées (resend, aperçu, upload)
4. Categories/Products:
   - compat schéma défensive
   - cohérence badge couleur/compteurs

## Résilience & observabilité
- Standardiser les erreurs réseau Supabase en `503` + message actionnable.
- Ajouter un mini panneau santé (db/smtp/storage/push) en page sécurité.
- Harmoniser les logs audit pour actions sensibles (email, broadcast, media, emergency).

## Critères d'acceptation
- Aucune erreur console sur pages critiques.
- Aucune page sans état vide explicite.
- Build TypeScript vert.
- Checklist manuelle validée sur `/drivers/live`, `/drivers`, `/email-logs`, `/products/categories`, `/security`.

