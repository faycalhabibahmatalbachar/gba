# État de l'intégration Client-Admin GBA Store

## 🔗 Architecture actuelle

### Base de données Supabase partagée
- **URL**: https://uvlrgwdbjegoavjfdrzb.supabase.co
- **Tables partagées**: products, categories, orders, users, etc.
- **Storage**: Bucket "products" pour les images

## ✅ Fonctionnalités implémentées

### Application Client (Flutter)
- [x] Authentification Supabase
- [x] Navigation avec Bottom Bar (5 onglets)
- [x] Écran d'accueil avec produits
- [x] Détails produit avec galerie
- [x] Gestion du panier (add/remove/update)
- [x] Gestion des favoris
- [x] Services pour cart et favorites
- [ ] Écran panier complet
- [ ] Écran favoris
- [ ] Processus de commande
- [ ] Profil utilisateur
- [ ] Historique des commandes
- [ ] Système de review

### Application Admin (React)
- [x] Authentification Supabase
- [x] Dashboard avec statistiques
- [x] Gestion des produits (CRUD)
- [x] Upload d'images produits
- [ ] Gestion des commandes
- [ ] Gestion des clients
- [ ] Gestion des catégories
- [ ] Rapports et analytics
- [ ] Gestion des coupons
- [ ] Modération des reviews

## 🚨 Traçabilité à implémenter

### 1. **Système de rôles utilisateurs**
```sql
-- Table à créer
CREATE TABLE user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('admin', 'customer', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### 2. **Logs d'activité admin**
```sql
-- Table à créer
CREATE TABLE admin_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. **Notifications**
```sql
-- Table à créer
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 📋 Plan d'intégration Admin

### Phase 1: Gestion des commandes (Priorité haute)
1. **Liste des commandes**
   - Filtres par statut, date, client
   - Recherche par numéro de commande
   - Export CSV/PDF

2. **Détails commande**
   - Informations client
   - Articles commandés
   - Historique des statuts
   - Actions: confirmer, expédier, annuler

3. **Dashboard temps réel**
   - Nouvelles commandes
   - Commandes en attente
   - Revenus du jour

### Phase 2: Gestion des clients
1. **Liste des clients**
   - Profils détaillés
   - Historique d'achats
   - Favoris et panier actuel

2. **Analytics clients**
   - Valeur client (CLV)
   - Fréquence d'achat
   - Produits préférés

### Phase 3: Marketing et promotion
1. **Gestion des coupons**
   - Création/édition
   - Suivi d'utilisation
   - Statistiques

2. **Notifications push**
   - Nouvelles commandes
   - Changements de statut
   - Promotions

## 🔐 Sécurité et permissions

### RLS (Row Level Security) actuel
- ✅ Clients: accès uniquement à leurs données
- ⚠️ Admin: nécessite des policies spécifiques
- ⚠️ Séparation admin/client à renforcer

### Permissions à implémenter
```javascript
// admin-react/src/utils/permissions.js
const permissions = {
  ADMIN: ['all'],
  MANAGER: ['products', 'orders', 'customers'],
  SUPPORT: ['orders', 'customers:read']
};
```

## 🚀 Prochaines étapes recommandées

1. **Immédiat**
   - [ ] Créer les tables de rôles et logs
   - [ ] Implémenter la gestion des commandes dans l'admin
   - [ ] Ajouter les policies RLS pour l'admin

2. **Court terme (1 semaine)**
   - [ ] Dashboard admin avec métriques temps réel
   - [ ] Écran panier et checkout dans le client
   - [ ] Système de notifications

3. **Moyen terme (2-3 semaines)**
   - [ ] Analytics avancées
   - [ ] Système de reviews
   - [ ] Export de rapports
   - [ ] Application mobile admin

## 📊 Métriques de traçabilité

### Ce qui est tracé actuellement
- ✅ Ajouts au panier
- ✅ Favoris
- ✅ Recherches effectuées
- ✅ Commandes créées

### À ajouter
- ⚠️ Temps passé sur chaque produit
- ⚠️ Taux d'abandon de panier
- ⚠️ Actions admin (CRUD produits, etc.)
- ⚠️ Connexions et déconnexions
- ⚠️ Changements de prix
- ⚠️ Modifications de stock

## 🔧 Configuration requise

### Variables d'environnement
```bash
# Client Flutter
SUPABASE_URL=https://uvlrgwdbjegoavjfdrzb.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Admin React
REACT_APP_SUPABASE_URL=https://uvlrgwdbjegoavjfdrzb.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_SUPABASE_SERVICE_KEY=your_service_key # Pour les opérations admin
```

## 📝 Notes importantes

1. **Authentification**: Les deux apps utilisent Supabase Auth
2. **Storage**: Images stockées dans le bucket "products" (public)
3. **Real-time**: Supabase Realtime peut être activé pour les mises à jour instantanées
4. **Backup**: Configurer des sauvegardes automatiques dans Supabase

---

*Document mis à jour le: 2025-01-02*
*Version: 1.0.0*
