# Guide de Configuration Flutterwave

## 1. Créer un compte Flutterwave

1. Allez sur [https://dashboard.flutterwave.com/signup](https://dashboard.flutterwave.com/signup)
2. Créez un compte avec votre email professionnel
3. Complétez la vérification KYC (identité + documents business)

## 2. Obtenir les clés API

1. Connectez-vous au [Dashboard Flutterwave](https://dashboard.flutterwave.com)
2. Allez dans **Settings → API Keys**
3. Copiez :
   - **Secret Key** (commence par `FLWSECK-...`)
   - **Public Key** (commence par `FLWPUBK-...`)
   - **Encryption Key**

> ⚠️ Utilisez d'abord les clés **Test** pour le développement, puis passez en **Live** pour la production.

## 3. Configurer les variables d'environnement Supabase

Exécutez ces commandes dans votre terminal (depuis le dossier du projet) :

```bash
# Clé secrète Flutterwave (obligatoire)
npx supabase secrets set FLW_SECRET_KEY="FLWSECK-votre_cle_secrete"

# Taux de change XAF/USD (optionnel, défaut: 600)
npx supabase secrets set XAF_PER_USD="600"

# URL du site (pour les redirections après paiement)
npx supabase secrets set SITE_URL="https://votre-domaine.com"
```

## 4. Déployer la Edge Function

```bash
npx supabase functions deploy create-flutterwave-payment
npx supabase functions deploy flutterwave-webhook
```

## 5. Configurer le Webhook Flutterwave

1. Dans le Dashboard Flutterwave → **Settings → Webhooks**
2. URL du webhook : `https://<votre-projet>.supabase.co/functions/v1/flutterwave-webhook`
3. Cochez les événements : `charge.completed`, `transfer.completed`
4. Copiez le **Secret Hash** et ajoutez-le dans Supabase :

```bash
npx supabase secrets set FLW_WEBHOOK_SECRET="votre_secret_hash"
```

## 6. Tester le paiement

### Mode Test
- Utilisez les cartes de test Flutterwave :
  - **Carte Visa** : `4242 4242 4242 4242` (date future, CVV: 123)
  - **PIN** : `3310` (si demandé)
  - **OTP** : `12345` (si demandé)

### Vérifier dans le Dashboard
- Allez dans **Transactions** pour voir les paiements test
- Vérifiez que le webhook met à jour le statut dans votre base Supabase

## 7. Passage en Production

1. Complétez la vérification KYC dans le Dashboard Flutterwave
2. Passez en mode **Live** dans Settings → API Keys
3. Mettez à jour la clé secrète :

```bash
npx supabase secrets set FLW_SECRET_KEY="FLWSECK-votre_cle_live"
```

4. Redéployez les fonctions :

```bash
npx supabase functions deploy create-flutterwave-payment
npx supabase functions deploy flutterwave-webhook
```

## Résolution de problèmes

### Erreur CORS
- Vérifiez que la Edge Function `create-flutterwave-payment` est bien déployée
- Les headers CORS sont déjà configurés dans le code
- Assurez-vous que `FLW_SECRET_KEY` est défini (sinon la fonction retourne 500)

### Paiement échoue
- Vérifiez les logs : `npx supabase functions logs create-flutterwave-payment`
- Assurez-vous que le montant minimum est de 1 USD
- Vérifiez que le taux `XAF_PER_USD` est correct

### Webhook ne fonctionne pas
- Vérifiez l'URL du webhook dans le Dashboard Flutterwave
- Vérifiez les logs : `npx supabase functions logs flutterwave-webhook`
- Assurez-vous que `FLW_WEBHOOK_SECRET` correspond au secret hash configuré
