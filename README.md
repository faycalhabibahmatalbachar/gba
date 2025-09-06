# GBA - Plateforme E-commerce

🛍️ Application e-commerce complète avec Flutter (client mobile/web), React (dashboard admin) et Supabase (backend).

## ✨ Fonctionnalités principales

### 📱 Application Client (Flutter)
- 🎨 Interface moderne avec animations fluides
- 🛒 Panier et favoris
- 💬 Messagerie en temps réel avec l'admin
- 🔐 Authentification sécurisée
- 💰 Prix en FCFA
- 🌍 Multi-langue (FR/EN)
- 🌙 Mode sombre
- 📦 Gestion des commandes
- ⚡ Réactivité temps réel

### 👨‍💼 Dashboard Admin (React) 
- 📊 Tableau de bord analytics
- 👥 Gestion des utilisateurs
- 🚫 Système de blocage/déblocage
- 💬 Chat avec les clients
- 📦 Gestion des produits
- 📈 Statistiques de vente
- 🔔 Notifications temps réel

### 🔧 Backend (Supabase)
- 🗄️ Base de données PostgreSQL
- 🔐 Auth avec RLS (Row Level Security)
- 📨 Realtime subscriptions
- 🖼️ Storage pour les images
- 🔄 Synchronisation temps réel

## 🛠️ Technologies utilisées

- **Frontend Client**: Flutter 3.x, Riverpod, Go Router
- **Frontend Admin**: React 18, Vite, Material-UI
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **State Management**: Riverpod (Flutter), Context API (React)
- **Styling**: Material Design 3, CSS Modules

## 📦 Installation

### Prérequis
- Flutter SDK 3.x
- Node.js 18+
- Compte Supabase

### Client Flutter
```bash
# Installer les dépendances
flutter pub get

# Lancer l'application
flutter run -d chrome  # Pour le web
flutter run           # Pour mobile
```

### Admin React
```bash
cd admin-react
npm install
npm run dev
```

### Configuration Supabase
1. Créer un projet sur [Supabase](https://supabase.com)
2. Copier les clés API dans les fichiers `.env`
3. Exécuter les scripts SQL dans le dossier racine

## 🔑 Variables d'environnement

Créer un fichier `.env` dans `admin-react/`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## 🚀 Déploiement

### Flutter Web
```bash
flutter build web
# Déployer le dossier build/web
```

### Admin React
```bash
npm run build
# Déployer le dossier dist
```

## 📝 Licence

MIT

## 👥 Contributeurs

- Faycal Habib Ahmat

## 📞 Contact

Pour toute question: faycalhabibahmat@gmail.com

---

⭐ N'hésitez pas à mettre une étoile si ce projet vous a été utile!
