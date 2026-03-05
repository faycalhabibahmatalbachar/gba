# Plan d'amélioration avancée — Page Messages (admin-nextjs)

## Objectif
Transformer la page `/messages` en un outil de support professionnel, moderne et puissant, inspiré de WhatsApp/Intercom, avec des fonctionnalités avancées de gestion, collaboration et performance.

---

## Phase 1 — Fonctionnalités temps réel (P0)

### 1.1 Indicateur de frappe (Typing indicator)
- **Description**: Afficher "X est en train d'écrire..." quand l'utilisateur tape.
- **Implémentation**:
  - Créer une table `chat_typing` (conversation_id, user_id, updated_at)
  - Écouter les changements via Realtime
  - Côté client: envoyer un heartbeat toutes les 2s quand l'utilisateur tape
  - Afficher l'indicateur sous le header du chat
- **Critères**:
  - L'indicateur apparaît/disparaît en temps réel
  - Pas de spam (debounce + expiration après 3s)

### 1.2 Statut en ligne (Online presence)
- **Description**: Afficher un point vert si l'utilisateur est en ligne.
- **Implémentation**:
  - Table `user_presence` (user_id, last_seen, is_online)
  - Mettre à jour `last_seen` toutes les 30s côté client
  - Afficher badge vert sur avatar dans la liste et le header
- **Critères**:
  - Badge visible dans la liste des conversations
  - Badge visible dans le header du chat

### 1.3 Notifications sonores
- **Description**: Jouer un son discret à la réception d'un nouveau message.
- **Implémentation**:
  - Ajouter un fichier audio `/public/sounds/notification.mp3`
  - Jouer le son uniquement si la conversation n'est pas active
  - Ajouter un toggle on/off dans le header
- **Critères**:
  - Son joué pour nouveaux messages
  - Toggle fonctionnel

---

## Phase 2 — Gestion des conversations (P1)

### 2.1 Statut et assignation
- **Description**: Permettre de changer le statut d'une conversation (open, pending, resolved, spam) et l'assigner à un admin.
- **Implémentation**:
  - Ajouter champ `status` et `assigned_to` dans `chat_conversations`
  - Dropdown de statut dans le header du chat
  - Dropdown d'assignation (liste des admins)
  - Filtres par statut dans la sidebar
- **Critères**:
  - Changement de statut persisté
  - Assignation visible
  - Filtres fonctionnels

### 2.2 Archivage
- **Description**: Archiver les conversations résolues pour les cacher de la liste principale.
- **Implémentation**:
  - Champ `is_archived` dans `chat_conversations`
  - Bouton "Archiver" dans le header
  - Onglet "Archivées" dans la sidebar
- **Critères**:
  - Conversations archivées non visibles par défaut
  - Onglet archivées accessible

### 2.3 Tags/Catégorisation
- **Description**: Ajouter des tags aux conversations (ex: "Commande", "Réclamation", "Technique").
- **Implémentation**:
  - Table `chat_tags` (id, name, color)
  - Table de liaison `chat_conversation_tags`
  - UI pour ajouter/retirer des tags
  - Filtre par tag
- **Critères**:
  - Tags visibles sur les conversations
  - Filtrage par tag fonctionnel

---

## Phase 3 — Fonctionnalités de message (P1)

### 3.1 Réponses rapides (Quick replies)
- **Description**: Messages préenregistrés pour répondre rapidement (ex: "Bonjour, comment puis-je vous aider?").
- **Implémentation**:
  - Table `chat_quick_replies` (id, title, content, created_by)
  - Menu déroulant dans la zone de saisie
  - Gestion CRUD dans un modal
- **Critères**:
  - Liste de réponses rapides accessible
  - Envoi en 1 clic

### 3.2 Réponses à un message (Reply/Quote)
- **Description**: Citer un message spécifique pour répondre.
- **Implémentation**:
  - Champ `reply_to_id` dans `chat_messages`
  - UI: clic droit -> "Répondre"
  - Affichage du message cité en preview
- **Critères**:
  - Reply visible avec le message original cité
  - Clic sur le reply scroll vers le message original

### 3.3 Réactions emoji
- **Description**: Réagir à un message avec un emoji (👍, ❤️, etc.).
- **Implémentation**:
  - Table `chat_message_reactions` (message_id, user_id, emoji)
  - UI: survol message -> picker emoji
  - Affichage des réactions sous le message
- **Critères**:
  - Réactions visibles
  - Ajout/retrait fonctionnel

---

## Phase 4 — Recherche et performance (P2)

### 4.1 Recherche dans les messages
- **Description**: Rechercher par contenu de message, pas seulement par nom d'utilisateur.
- **Implémentation**:
  - Requête Supabase `ilike` sur `chat_messages.message`
  - Afficher les résultats avec contexte
  - Clic pour ouvrir la conversation au bon message
- **Critères**:
  - Recherche retourne des messages
  - Clic ouvre la conversation

### 4.2 Pagination infinie / Virtualisation
- **Description**: Charger les messages par lots et virtualiser le rendu pour les longues conversations.
- **Implémentation**:
  - Charger 50 messages, puis charger plus au scroll vers le haut
  - Utiliser une lib de virtualisation (ex: `@tanstack/virtual`)
- **Critères**:
  - Pas de lag même avec 1000+ messages
  - Scroll fluide

### 4.3 Export conversation
- **Description**: Exporter une conversation en PDF ou JSON.
- **Implémentation**:
  - Bouton "Exporter" dans le header
  - Générer un fichier JSON ou PDF (via `jspdf` ou API)
- **Critères**:
  - Export téléchargeable
  - Format lisible

---

## Phase 5 — UX avancée (P2)

### 5.1 Mode sombre
- **Description**: Adapter les couleurs pour un mode sombre cohérent.
- **Implémentation**:
  - Utiliser les variables CSS AntD
  - Toggle dans le header
  - Persister le choix en localStorage
- **Critères**:
  - Toggle fonctionnel
  - Tous les éléments adaptés

### 5.2 Raccourcis clavier
- **Description**: Naviguer et agir au clavier.
- **Implémentation**:
  - `Ctrl+K`: recherche globale
  - `↑/↓`: navigation dans les conversations
  - `Esc`: fermer le chat actif
- **Critères**:
  - Raccourcis documentés
  - Fonctionnels

### 5.3 Accessibilité (a11y)
- **Description**: Rendre l'interface accessible aux lecteurs d'écran.
- **Implémentation**:
  - Ajouter `aria-label` sur tous les boutons icônes
  - Focus visible sur tous les éléments interactifs
  - Annoncer les nouveaux messages via `aria-live`
- **Critères**:
  - Navigation clavier complète
  - Lecteur d'écran fonctionnel

---

## Phase 6 — Collaboration (P3)

### 6.1 Notes internes
- **Description**: Ajouter des notes visibles uniquement par les admins sur une conversation.
- **Implémentation**:
  - Table `chat_notes` (conversation_id, content, created_by, created_at)
  - Onglet "Notes" dans le panel de chat
- **Critères**:
  - Notes visibles par les admins
  - CRUD fonctionnel

### 6.2 Historique d'assignation
- **Description**: Voir qui a géré la conversation et quand.
- **Implémentation**:
  - Table `chat_assignment_history` (conversation_id, admin_id, action, created_at)
  - Afficher un timeline des actions
- **Critères**:
  - Historique visible
  - Actions horodatées

---

## Ordre d'implémentation recommandé

1. **Phase 1** (temps réel) — Impact immédiat sur l'expérience
2. **Phase 2** (gestion conversations) — Essentiel pour le support
3. **Phase 3** (fonctionnalités message) — Confort utilisateur
4. **Phase 4** (recherche/perf) — Scalabilité
5. **Phase 5** (UX avancée) — Finition
6. **Phase 6** (collaboration) — Pour les équipes

---

## Notes techniques

- **Base de données**: Toutes les nouvelles tables doivent être créées dans Supabase avec RLS approprié.
- **Realtime**: Activer Realtime sur les tables concernées dans le dashboard Supabase.
- **Performance**: Éviter les N+1 queries, utiliser des jointures ou des requêtes batch.
- **Sécurité**: Vérifier que seuls les admins peuvent accéder à ces endpoints.

---

## Fichiers concernés

- `src/app/(admin)/messages/page.tsx` — UI principale
- `src/lib/services/chat.ts` — Nouveau fichier pour la logique métier
- `supabase/migrations/` — Nouvelles migrations pour les tables
