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
3. Exécutez ensuite la migration Stripe: `supabase/migrations/20260129120000_add_payments_and_stripe_fields.sql`
4. Cela créera toutes les tables nécessaires :
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

#### Client Flutter (dart-define)

Le client Flutter lit la configuration via `--dart-define` (voir `lib/config/app_config.dart`).

```bash
flutter run --dart-define=SUPABASE_URL=https://xxxxxxxxxxx.supabase.co --dart-define=SUPABASE_ANON_KEY=eyJ... --dart-define=SITE_URL=https://globalbusinessamdaradir.vercel.app --dart-define=BACKEND_URL=https://gbabackend.vercel.app --dart-define=STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Si tu n'utilises pas Stripe, tu peux omettre `STRIPE_PUBLISHABLE_KEY`.

#### Admin React (admin-react/.env)

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 6. Stripe (Edge Functions)

### Variables / secrets côté Supabase

Les fonctions `create-checkout-session` et `stripe-webhook` attendent ces secrets :

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SIGNING_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Tu peux les définir via le dashboard Supabase (Edge Functions > Secrets) ou via la CLI :

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SIGNING_SECRET=whsec_... SUPABASE_URL=https://xxxxxxxxxxx.supabase.co SUPABASE_ANON_KEY=eyJ... SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Webhook Stripe

- L'endpoint webhook Supabase est la fonction `stripe-webhook`.
- Dans `supabase/config.toml`, `verify_jwt = false` pour `stripe-webhook` (Stripe n'envoie pas de JWT).

Pour tester en local avec Stripe CLI (si tu utilises `supabase start`) :

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

### Déployer les fonctions (prod)

```bash
supabase link --project-ref <project-ref>
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

### Configurer le webhook côté Stripe (prod)

Dans Stripe Dashboard > Developers > Webhooks :

- URL : `https://<project-ref>.functions.supabase.co/stripe-webhook`
- Events (minimum) :
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`

Le secret de signature fourni par Stripe doit être configuré dans Supabase : `STRIPE_WEBHOOK_SIGNING_SECRET`.

### Apple Pay / Google Pay (optionnel)

PaymentSheet peut afficher Apple Pay / Google Pay si :

- Ces méthodes sont activées dans Stripe (Settings > Payment methods)
- Le code Flutter passe les paramètres `applePay` / `googlePay` à `initPaymentSheet`

### Limitation Web

PaymentSheet n'est pas supportée sur Flutter Web dans ce projet (support web Stripe expérimental). Utilise Flutterwave ou paiement à la livraison sur web.

## 7. Vérifier l'installation

1. Lancez l'application Flutter:

```bash
flutter pub get
flutter run
```

2. Lancez l'interface admin:
```bash
cd admin-react
npm run dev
```

## 8. Première utilisation

1. Créez des catégories depuis l'admin
2. Ajoutez des produits
3. Vérifiez la synchronisation en temps réel dans l'app mobile
