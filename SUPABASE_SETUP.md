# 🚀 Guide de Configuration Supabase pour GBA Store

## 1. Créer votre projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte gratuit
3. Créez un nouveau projet "GBA Store"
4. Attendez que le projet soit initialisé

## 2. Récupérer vos identifiants

Dans votre dashboard Supabase:
- **Project URL**: Dans Settings > API > Project URL
  - Format: `https://xxxxxxxxxxx.supabase.co`
- **Anon Key**: Dans Settings > API > Project API keys > anon public
  - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 3. Configurer la base de données

1. Allez dans l'éditeur SQL de votre projet Supabase
2. Copiez et exécutez le contenu du fichier `complete_supabase_schema.sql`
3. Cela créera toutes les tables nécessaires :
   - `profiles` - Profils utilisateurs
   - `products` - Catalogue produits
   - `categories` - Catégories
   - `cart_items` - Panier
   - `orders` - Commandes
   - `order_items` - Détails commandes
   - `wishlist` - Favoris
   - `addresses` - Adresses
   - `reviews` - Avis produits
   - `chat_conversations` - Conversations support
   - `chat_messages` - Messages chat

## 4. Configurer les Buckets Storage

Dans le dashboard Supabase, créez les buckets suivants :
1. **products** - Images des produits
2. **categories** - Images des catégories
3. **profiles** - Avatars utilisateurs
4. **assets** - Ressources générales (logo, bannières)

Pour chaque bucket :
- Définir comme **Public**
- Limite de taille : 5MB

## 5. Créer les fichiers .env

#### Pour l'application mobile (gba-mobile/.env):
```
REACT_APP_SUPABASE_URL=votre_url_supabase
REACT_APP_SUPABASE_ANON_KEY=votre_clé_anon
REACT_APP_SUPABASE_URL=https://demo.supabase.co
REACT_APP_SUPABASE_ANON_KEY=demo-key-12345
```
⚠️ Note: Cette config ne fonctionnera pas avec une vraie base de données

## 6. Vérifier l'installation

1. Lancez l'application mobile:
```bash
cd gba-mobile
npm start
```

2. Lancez l'interface admin:
```bash
cd admin-react
npm start
```

## 7. Première utilisation

1. Créez des catégories depuis l'admin
2. Ajoutez des produits
3. Vérifiez la synchronisation en temps réel dans l'app mobile
