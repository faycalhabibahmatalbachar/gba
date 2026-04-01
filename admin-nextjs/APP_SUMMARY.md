# GBA Admin — Résumé complet de l'application

## Contexte
Application web d'administration pour **GBA (Global Business Amdar Adir)**, une plateforme e-commerce avec livraison. L'admin gère les commandes, produits, livreurs, utilisateurs, bannières et messagerie.

## Stack technique
- **Framework** : Next.js 16.1.6 (App Router, Turbopack)
- **UI Library** : Ant Design 6.3.0 + Ant Design Icons 6.1.0
- **Charts** : @ant-design/charts 2.6.7 (AntV G2)
- **CSS** : Tailwind CSS 4
- **Backend** : Supabase (Auth, Database PostgreSQL, Storage, Realtime)
- **Carte** : Leaflet + React-Leaflet 5
- **Langue** : TypeScript 5, React 19
- **Icônes** : Ant Design Icons + Lucide React

## Architecture
```
src/
├── app/
│   ├── (admin)/           ← Layout admin (sidebar + header)
│   │   ├── layout.tsx     ← Layout avec AdminSidebar + AdminHeader
│   │   ├── dashboard/
│   │   ├── orders/
│   │   ├── products/
│   │   │   └── categories/
│   │   ├── deliveries/
│   │   ├── delivery-tracking/
│   │   ├── drivers/
│   │   ├── users/
│   │   │   └── [userId]/
│   │   ├── messages/
│   │   ├── monitoring/
│   │   ├── banners/
│   │   └── settings/
│   ├── login/
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── AdminSidebar.tsx   ← Sidebar navigation
│   │   ├── AdminHeader.tsx    ← Header avec breadcrumb + theme toggle
│   │   └── ThemeProvider.tsx  ← Dark/Light mode
│   ├── ui/
│   │   ├── PageHeader.tsx
│   │   ├── EmptyState.tsx
│   │   └── ToastBridge.tsx
│   ├── orders/
│   │   └── OrderStatusBadge.tsx
│   ├── delivery/
│   │   └── DeliveryTrackingMap.tsx (Leaflet)
│   └── messaging/
│       └── ConversationThread.tsx
├── contexts/
│   └── AuthContext.tsx
├── lib/
│   ├── supabase/client.ts
│   ├── services/
│   │   ├── orders.ts
│   │   ├── products.ts
│   │   ├── deliveries.ts
│   │   ├── delivery-tracking.ts
│   │   └── users.ts
│   └── i18n/translations.ts
```

---

## LAYOUT GLOBAL

### AdminSidebar (sidebar gauche)
- Logo "G" avec gradient indigo→purple
- Titre "GBA Admin" + sous-titre "Panneau de gestion"
- Menu vertical sombre avec icônes :
  - Tableau de bord
  - Commandes
  - Surveillance
  - Produits (sous-menu : Tous les produits, Catégories)
  - Livraisons
  - Suivi livraisons
  - Livreurs
  - Utilisateurs
  - Messages
  - Bannières
  - Paramètres
- Section utilisateur en bas avec avatar "AD", statut "En ligne"
- Collapsible (peut se replier), largeur 264px, sticky

### AdminHeader (header haut)
- Bouton toggle sidebar (hamburger)
- Breadcrumb dynamique selon la route
- Bouton toggle dark/light mode (soleil/lune)
- Dropdown utilisateur avec email + avatar gradient + Déconnexion

### Login Page
- Fond gradient sombre (slate-950)
- Logo "G" centré
- Titre "GBA Admin"
- Formulaire : Email + Mot de passe + Bouton "Se connecter"
- Card avec ombre portée

---

## PAGE 1 : TABLEAU DE BORD (`/dashboard`)

### En-tête
- Titre : "Tableau de bord" (via PageHeader)

### KPIs (cartes en haut)
- **Commandes totales** : nombre total
- **En attente** : commandes pending
- **En cours** : commandes in progress
- **Livrées** : commandes delivered
- **Annulées** : commandes cancelled
- **Chiffre d'affaires** : somme des montants
- **Taux de rupture** : % produits hors stock
- **Produits en rupture** : nombre vs total

### Sélecteur de période
- Segmented : 24h / 7j / 30j

### Graphiques (4 charts)
- **Graphique linéaire** : évolution des commandes dans le temps
- **Graphique en barres** : commandes par statut (funnel)
- **Graphique camembert** : répartition des méthodes de paiement
- **Graphique en colonnes** : top produits vendus

### Tableau "Commandes récentes"
- Colonnes : N° commande, Date, Client, Statut (badge coloré), Montant, Action (voir)
- Clic sur une commande → Drawer latéral de détails

### Drawer détails commande
- Informations client
- Statut avec Steps (timeline)
- Liste des articles (image + nom + quantité + prix)
- Méthode de paiement (traduite en français)
- Sélecteur pour assigner un livreur
- Boutons d'action (changer statut)

---

## PAGE 2 : COMMANDES (`/orders`)

### En-tête
- Titre : "Commandes"
- Bouton "Actualiser"

### KPIs (4 cartes)
- Total commandes / En attente / En cours / Livrées
- Avec icônes et tooltips

### Filtres
- Recherche par texte (nom client, numéro commande)
- Filtre par statut (dropdown)
- Filtre par date (RangePicker)
- Tri (date récent/ancien, montant croissant/décroissant, statut)

### Tableau principal
- Colonnes : N° commande, Date, Client, Statut (badge), Montant, Paiement, Livreur, Actions
- Sélection multiple (checkbox)
- Actions en lot : Changer statut / Assigner livreur / Supprimer
- Pagination serveur

### Drawer détails commande
- Même drawer que dashboard
- Informations complètes : client, adresse, articles, timeline statut
- Boutons : Assigner livreur, Changer statut, Copier numéro

---

## PAGE 3 : PRODUITS (`/products`)

### En-tête
- Titre : "Produits"
- Boutons : Ajouter produit, Actualiser
- Toggle vue : Tableau / Grille (cartes)

### Filtres
- Recherche texte
- Filtre par catégorie
- Filtre par stock (tous / en rupture / stock bas / en stock)
- Filtre par image (tous / sans image)

### Vue Tableau
- Colonnes : Image, Nom, SKU, Prix, Prix comparé, Stock, Catégorie, Statut (actif/inactif), Actions
- Sélection multiple pour suppression en lot

### Vue Grille (Cards)
- Carte produit avec : image, nom, prix, stock, catégorie
- Checkbox de sélection overlay

### Drawer détails/édition produit
- 3 étapes (Steps) : Informations / Média / Avancé
- Champs éditables : nom, SKU, prix, prix comparé, coût, stock, seuil stock bas, unité, poids, dimensions, catégorie, description, description courte, marque, modèle, code-barre, slug, tags, statut, featured, SEO (meta title, description, keywords)
- Upload d'images (Supabase Storage)
- Onglet Analytics 30j : vues, commandes, quantité vendue, CA (avec graphiques sparkline)
- Boutons : Sauvegarder, Supprimer

---

## PAGE 4 : CATÉGORIES (`/products/categories`)

### En-tête
- Titre : "Catégories"
- Boutons : Ajouter catégorie, Actualiser

### Tableau
- Colonnes : Icône (emoji), Nom, Slug, Description, Image, Ordre d'affichage, Statut (actif/inactif), Parent, Actions
- Actions par ligne : Éditer, Dupliquer, Supprimer

### Modal création/édition
- Champs : Nom, Slug (auto-généré), Description, Icône (sélecteur emoji), URL image, Catégorie parente, Ordre d'affichage, Actif (switch), Lien URL
- Upload image vers Supabase Storage

---

## PAGE 5 : LIVRAISONS (`/deliveries`)

### En-tête
- Titre : "Livraisons"
- Bouton "Actualiser", Export

### KPIs
- Total livraisons / En attente / En livraison / Livrées / Annulées

### Filtres
- Recherche texte
- Filtre par statut (pending, confirmed, processing, shipped, delivered, cancelled)
- Filtre par livreur
- Filtre par date (RangePicker)

### Tableau principal
- Colonnes : N° commande, Client, Adresse destination, Livreur, Statut (badge coloré), Paiement (payé/non payé), Montant, Date, Actions
- Actions : Changer statut, Assigner livreur
- Sélection multiple + actions en lot

### Drawer détails livraison
- Informations client + adresse
- Timeline de la livraison
- Assignation livreur

---

## PAGE 6 : SUIVI LIVRAISONS (`/delivery-tracking`)

### En-tête
- Titre : "Centre d'opérations de livraison"
- Sous-titre : "Centre de pilotage logistique temps réel"
- Bouton "Actualiser"

### 4 cartes KPI (en ligne)
- **Livreurs en ligne** : nombre actifs / total — couleur success (#10B981)
- **Commandes actives** : nombre en cours — couleur accent (#3B82F6)
- **En retard** : livraisons > 2h — couleur warning (#F59E0B)
- **Surchargés** : livreurs > 5 commandes — couleur danger (#EF4444)

### Layout principal (2 colonnes)
**Colonne gauche — Sidebar livreurs :**
- Titre "Livreurs actifs" avec badge count
- Bouton masquer la sidebar
- Liste scrollable de driver cards :
  - Avatar avec initiales + badge statut online (pulse vert) ou offline (gris)
  - Nom du livreur
  - Statut : "Actif il y a X min" ou "Hors ligne depuis Xh"
  - Barre de progression de charge (vert/orange/rouge selon load)
  - Badge nombre de commandes
  - Indicateur retard si applicable
  - Clic → sélectionne le livreur sur la carte

**Colonne droite — Carte + contrôles :**
- Barre de sélection : tags pill (livreur sélectionné, commande, client localisé) + bouton plein écran
- Panel info : 2 selects (livreur, commande) + bouton "Voir commande" + bouton "Appeler"
- Carte Leaflet/OpenStreetMap interactive :
  - Marqueurs livreurs (position GPS temps réel)
  - Marqueur client
  - Trail (trajectoire)
  - Zoom controls
  - Mode plein écran

### Données temps réel
- Positions GPS des livreurs via Supabase
- Rafraîchissement automatique
- Calcul SLA (> 2h = en retard)
- Seuil surcharge : > 5 commandes (OVERLOAD_THRESHOLD)

---

## PAGE 7 : LIVREURS (`/drivers`)

### En-tête
- Titre : "Livreurs"
- Boutons : Ajouter livreur, Actualiser

### Recherche
- Input recherche par nom, email, téléphone

### Tableau
- Colonnes : Nom (first_name + last_name), Email, Téléphone, Ville, Disponibilité (switch on/off), Actions
- Actions : Voir détails, Éditer, Supprimer

### Drawer détails livreur
- Informations du livreur
- Liste des commandes assignées (status confirmé/processing/shipped)
- Tags de statut traduits en français

### Modal création livreur
- Champs : Email, Mot de passe, Prénom, Nom, Téléphone, Ville

### Modal édition livreur
- Champs : Prénom, Nom, Téléphone, Ville

---

## PAGE 8 : UTILISATEURS (`/users`)

### En-tête
- Titre : "Utilisateurs"

### KPIs
- Total utilisateurs / Clients / Livreurs / Admins

### Filtres
- Recherche texte (nom, email, téléphone)
- Filtre par rôle (tous, user, driver, admin)

### Tableau
- Colonnes : Avatar, Nom, Email, Téléphone, Rôle (tag coloré), Ville, Actions
- Actions dropdown : Voir profil, Copier ID, Changer rôle, Suspendre/Débloquer, Réinitialiser mot de passe
- Sélection multiple + actions en lot (changer rôle, toggle disponibilité)
- Pagination serveur (20 par page)

---

## PAGE 9 : DÉTAIL UTILISATEUR (`/users/[userId]`)

### En-tête
- Titre dynamique : nom de l'utilisateur

### Onglets (Tabs)
1. **Profil** : Informations personnelles éditables (prénom, nom, téléphone, ville, rôle, disponibilité) + boutons sauvegarder / suspendre / débloquer
2. **Commandes** : Tableau des commandes du user avec statut traduit, montant, date, actions. Pagination. Drawer détail commande avec données JSON brutes
3. **Panier** : Liste des articles dans le panier (produit, quantité, date ajout) + bouton vider le panier
4. **Favoris** : Liste des produits favoris + bouton supprimer
5. **Activité** : Journal d'activité enrichi (sessions, events)
6. **Engagement** : Métriques d'engagement (sessions, dernière localisation GPS, stats)

---

## PAGE 10 : MESSAGES (`/messages`)

### En-tête
- Titre : "Messages"

### Layout WhatsApp-like (2 colonnes)
**Colonne gauche — Liste conversations :**
- Recherche conversations
- Filtre par statut (toutes, ouvertes, fermées, en attente)
- Bouton "Nouvelle conversation"
- Liste des conversations avec :
  - Avatar utilisateur
  - Nom + dernier message
  - Badge non lu
  - Indicateur en ligne (présence temps réel)
  - Tag rôle (client/livreur/admin)

**Colonne droite — Conversation active :**
- En-tête : nom utilisateur, statut en ligne, boutons (assigner, fermer, plein écran)
- Zone messages scrollable (bulles type WhatsApp)
  - Messages texte + images + pièces jointes
  - Timestamp
  - Indicateur "vu"
  - Indicateur "en train d'écrire..."
- Zone de saisie : input texte + bouton envoyer + bouton pièce jointe (upload)
- Notifications sonores

### Mode mobile
- Drawer pour la liste des conversations
- Vue plein écran pour la conversation

### Fonctionnalités
- Conversations temps réel (Supabase Realtime)
- Présence en ligne (heartbeat)
- Indicateur de frappe
- Upload fichiers/images
- Suppression de messages (mode sélection)
- Modal "Nouvelle conversation" (recherche utilisateur)
- Statut conversation : ouverte/fermée/en attente
- Assignation à un agent

---

## PAGE 11 : SURVEILLANCE (`/monitoring`)

### En-tête
- Titre : "Surveillance"
- Bouton "Actualiser"

### Onglets (Tabs)
1. **Paniers** :
   - Liste des paniers actifs/abandonnés par utilisateur
   - Groupement par user : nom, nombre d'articles, montant total, dernière activité
   - Filtre : actifs vs abandonnés
   - Recherche
   - Expansion : détails des articles dans chaque panier

2. **Favoris** :
   - Top produits favoris (graphique bar chart)
   - Top catégories favorites (graphique pie chart)
   - Grille visuelle des produits les plus ajoutés en favoris (image, nom, compteur, prix)
   - Total de favoris

---

## PAGE 12 : BANNIÈRES (`/banners`)

### En-tête
- Titre : "Bannières"
- Boutons : Ajouter bannière, Actualiser

### Tableau
- Colonnes : Image (preview), Titre, Sous-titre, Route cible, Lien URL, Ordre d'affichage, Statut (actif/inactif avec switch), Période (dates début/fin), Actions
- Actions : Éditer, Dupliquer, Supprimer

### Modal création/édition
- Champs : Titre, Sous-titre, URL image, Route cible, Lien URL, Ordre d'affichage, Actif (switch), Date début, Date fin
- Upload image vers Supabase Storage (bucket "banners")
- Formats supportés : JPG, PNG, WebP, GIF, AVIF (max 5 Mo)

---

## PAGE 13 : PARAMÈTRES (`/settings`)

### En-tête
- Titre : "Paramètres"

### Onglets
1. **Profil** :
   - Informations : email, rôle, date d'inscription
   - Formulaire éditable : prénom, nom, téléphone, ville
   - Bouton sauvegarder

2. **Sécurité** :
   - Changement de mot de passe (actuel + nouveau + confirmation)

3. **Apparence** :
   - Toggle mode sombre / clair

4. **Notifications** :
   - Switches : Nouvelles commandes, Mises à jour livraisons, Inscriptions utilisateurs, Stock bas, Alertes paiement

---

## Design actuel (CSS)

### Thème clair
- Background : #F8F9FA
- Cards : blanc, border-radius 12px, ombre subtile
- Primary : #4F46E5 (indigo)
- Sidebar : #1E1B4B (bleu très sombre)

### Thème sombre
- Background : #0F1117
- Cards : #1E293B
- Primary : #6366F1

### Typographie
- Titres : DM Sans
- Corps : Inter
- Code/Mono : JetBrains Mono

### Composants récurrents
- **PageHeader** : titre h1 avec gradient indigo→purple + sous-titre
- **KPI Cards** : icône + valeur + label + tooltip
- **Tables** : Ant Design Table avec pagination, tri, filtres
- **Drawers** : panneau latéral pour détails/édition
- **Modals** : pour création/confirmation
- **Tags/Badges** : statuts colorés
- **Empty States** : illustration + message quand pas de données

---

## Base de données (tables Supabase principales)
- `profiles` : id, email, first_name, last_name, phone, city, role (user/driver/admin), is_available, created_at
- `orders` : id, order_number, status, total_amount, customer_name, driver_id, payment_method, payment_status, paid_at, created_at, address, items
- `products` : id, name, sku, price, compare_at_price, cost_price, quantity, main_image, images, description, category_id, is_active, is_featured, status, tags, specifications
- `categories` : id, name, slug, description, icon, image_url, is_active, display_order, parent_id
- `banners` : id, title, subtitle, image_url, image_path, target_route, link_url, is_active, display_order, starts_at, ends_at
- `conversations` : id, user_id, status, assigned_to, created_at
- `messages` : id, conversation_id, user_id, message, image_url, created_at
- `user_locations` : id, user_id, latitude, longitude, accuracy, captured_at
- `cart_items` : id, user_id, product_id, quantity
- `favorites` : id, user_id, product_id
- `order_items` : id, order_id, product_id, product_name, product_image, quantity, unit_price, total_price

## Statuts commande
pending → confirmed → processing → shipped → delivered (ou cancelled à tout moment)

## Langue
Toute l'interface est en **français**. Les statuts techniques (pending, confirmed, etc.) sont stockés en anglais dans la DB et traduits à l'affichage via `src/lib/i18n/translations.ts`.
