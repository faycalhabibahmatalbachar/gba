# Plan d'intégration des paiements - App Mobile GBA

## État actuel

L'application dispose déjà d'une intégration **Flutterwave** fonctionnelle via Supabase Edge Functions :
- `supabase/functions/create-flutterwave-payment/index.ts` — Crée un lien de paiement
- `supabase/functions/flutterwave-webhook/index.ts` — Reçoit les confirmations de paiement
- Conversion automatique XAF → USD (taux configurable via `XAF_PER_USD`)

---

## Options de paiement recommandées pour le Tchad (FCFA/XAF)

### 1. Flutterwave (✅ Déjà intégré)
- **Méthodes** : Carte bancaire (Visa/Mastercard), Mobile Money (MTN, Airtel)
- **Devises** : XAF (FCFA), USD, EUR
- **Frais** : ~1.4% local, 3.8% international
- **Avantages** : API robuste, support Mobile Money Afrique, déjà intégré
- **Configuration requise** :
  - Créer un compte sur [flutterwave.com](https://flutterwave.com)
  - Obtenir les clés API (test + production)
  - Configurer `FLW_SECRET_KEY` dans Supabase secrets
  - Configurer le webhook URL dans le dashboard Flutterwave

### 2. Mobile Money Direct (MTN MoMo / Airtel Money)
- **Couverture** : Très populaire au Tchad
- **Intégration** : Via Flutterwave (déjà supporté) ou API directe
- **Flux** :
  1. Client sélectionne Mobile Money
  2. Saisit son numéro de téléphone
  3. Reçoit une notification USSD sur son téléphone
  4. Confirme avec son code PIN
  5. Paiement confirmé via webhook
- **Configuration** : Ajouter `payment_method: 'mobilemoney'` dans la charge Flutterwave

### 3. Paiement à la livraison (Cash on Delivery)
- **Avantages** : Pas de frais de transaction, confiance client
- **Inconvénients** : Risque d'annulation, gestion de caisse
- **Implémentation** : Déjà possible (statut commande = `pending` → livreur confirme le paiement)

---

## Plan d'intégration Mobile Money via Flutterwave

### Étape 1 : Configuration Flutterwave
```bash
# Dans Supabase secrets
supabase secrets set FLW_SECRET_KEY=FLWSECK-xxxxxxxxxxxxxxxx
supabase secrets set XAF_PER_USD=600
```

### Étape 2 : Modifier l'Edge Function pour Mobile Money
La fonction `create-flutterwave-payment` supporte déjà les paiements par carte. Pour ajouter Mobile Money, il faut utiliser l'API v3 de Flutterwave avec le type `mobilemoneyfranco` pour les pays FCFA :

```typescript
// Pour Mobile Money FCFA (Cameroun, Tchad, etc.)
const flwResp = await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_franco', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${flwSecretKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tx_ref: txRef,
    amount: amountXaf,
    currency: 'XAF',
    network: 'MTN', // ou 'AIRTEL'
    phone_number: customerPhone,
    email: customerEmail,
    fullname: customerName,
  }),
});
```

### Étape 3 : UI Flutter (écran de checkout)
- Ajouter un sélecteur de méthode de paiement :
  - 💳 Carte bancaire (Flutterwave hosted page)
  - 📱 MTN Mobile Money
  - 📱 Airtel Money
  - 💵 Paiement à la livraison

### Étape 4 : Webhook de confirmation
Le webhook existant (`flutterwave-webhook/index.ts`) gère déjà les confirmations. Il met à jour le statut de la commande et du paiement dans Supabase.

---

## Sécurité

- **Ne jamais** exposer `FLW_SECRET_KEY` côté client
- Toutes les transactions passent par les Edge Functions Supabase (serveur)
- Vérifier le hash du webhook Flutterwave pour éviter les fraudes
- Vérifier le montant et la devise avant de confirmer la livraison

---

## Prochaines étapes

1. [ ] Créer un compte Flutterwave business (si pas déjà fait)
2. [ ] Configurer les secrets Supabase (`FLW_SECRET_KEY`, `FLW_WEBHOOK_HASH`)
3. [ ] Tester en mode sandbox avec des numéros de test
4. [ ] Ajouter le sélecteur de méthode de paiement dans l'UI Flutter
5. [ ] Créer une Edge Function dédiée pour Mobile Money Franco
6. [ ] Passer en production après validation
