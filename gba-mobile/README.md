# GBA Store - Application Mobile React Native

Application mobile moderne pour le GBA Store développée avec React Native.

## 🚀 Fonctionnalités

- **Authentification** : Connexion/Inscription via Supabase
- **Catalogue produits** : Navigation par catégories, recherche et filtres
- **Détails produit** : Galerie d'images, descriptions détaillées
- **Panier** : Gestion complète avec sauvegarde locale
- **Commandes** : Suivi des commandes et historique
- **Chat support** : Messagerie en temps réel avec le support
- **Profil utilisateur** : Gestion du compte et préférences

## 📱 Écrans

- Login/Signup
- Home (Accueil)
- Categories
- Product Detail
- Cart (Panier)
- Checkout
- Orders (Commandes)
- Chat
- Profile

## 🛠 Technologies

- React Native 0.72.6
- React Navigation 6
- Supabase pour le backend
- AsyncStorage pour le stockage local
- React Native Vector Icons
- Linear Gradient pour les UI modernes

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Pour iOS (Mac uniquement)
cd ios && pod install && cd ..

# Lancer l'application
npm run android  # Pour Android
npm run ios      # Pour iOS
```

## ⚙️ Configuration

1. Créer un fichier `.env` à la racine du projet
2. Ajouter les variables d'environnement Supabase :

```
REACT_APP_SUPABASE_URL=votre_url_supabase
REACT_APP_SUPABASE_ANON_KEY=votre_clé_anon_supabase
```

## 🎨 Design

- Thème principal : Violet/Bleu (#667eea, #764ba2)
- Interface moderne avec gradients
- Navigation intuitive avec bottom tabs
- Design responsive adapté mobile

## 📝 Structure du projet

```
gba-mobile/
├── src/
│   ├── config/         # Configuration (Supabase)
│   ├── contexts/       # Contextes React (Auth, Cart)
│   ├── navigation/     # Navigation de l'app
│   └── screens/        # Tous les écrans
├── App.js              # Point d'entrée
├── package.json        # Dépendances
└── README.md
```

## 🔐 Sécurité

- Authentification gérée par Supabase
- Sessions stockées de manière sécurisée
- Variables d'environnement pour les clés sensibles

## 🚧 Prochaines étapes

- Intégration des vraies données backend
- Tests sur appareil réel
- Optimisation des performances
- Publication sur les stores
