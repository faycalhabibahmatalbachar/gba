# Guide de test des notifications push (FCM API V1)

## Identifiants de test

- **Email :** `freeanimations2@gmail.com`
- **Mot de passe :** `freeanimations2@gmail.com`

## Prérequis

1. **Clé Firebase** : Le fichier `android/app/globalbusinessamdaradir-fba45-firebase-adminsdk-fbsvc-0b9bbafd71.json` doit être configuré comme secret Supabase (voir [FCM_V1_SETUP.md](docs/FCM_V1_SETUP.md)).
2. **App mobile** : L’app Flutter doit avoir été lancée au moins une fois pour enregistrer le token FCM dans `device_tokens`.
3. **API FCM V1** : Utiliser Firebase Cloud Messaging (HTTP v1), pas l’ancienne API.

---

## 1. Configuration Postman

### Importer la collection

1. Ouvrir Postman.
2. **Import** > **File** > sélectionner `docs/Postman_Notifications_Collection.json`.

### Configurer les variables (sans exposer la clé)

Postman supprime automatiquement les clés API détectées dans les **workspaces publics** (Secret Scanner). Pour éviter cela et garder votre clé en sécurité :

**Recommandation : utiliser un Environnement Postman (local, non partagé)**

1. Importer l’environnement (optionnel) : **Import** > **File** > `docs/Postman_Environment_GBA_Local.json`, ou créer un environnement à la main.
2. Ouvrir l’environnement **GBA Local** et renseigner **Current value** de `SUPABASE_ANON_KEY` avec la clé anon (Supabase Dashboard > **Project Settings** > **API** > **anon public**).
3. **Save**, puis sélectionner cet environnement dans le menu déroulant en haut à droite (au lieu de « No Environment »).

**Sans fichier d’environnement :**

1. Dans Postman : **Environments** → **Create Environment** (ex. « GBA Local »).
2. Ajouter une variable :
   - **Variable** : `SUPABASE_ANON_KEY`
   - **Initial value** et **Current value** : coller la clé anon (Supabase Dashboard > **Project Settings** > **API** > **anon public**).
3. **Save**, puis sélectionner cet environnement dans le menu déroulant en haut à droite (au lieu de « No Environment »).
4. Laisser la variable `SUPABASE_ANON_KEY` **vide** dans l’onglet **Variables** de la collection (la valeur viendra de l’environnement).

Ainsi la clé n’est que dans votre environnement local ; elle n’est pas dans la collection ni dans un workspace public, et Postman ne la supprimera pas.

**Alternative :** utiliser un **workspace privé** pour vos tests et y mettre la collection + la variable ; ne pas partager ce workspace.

Dans la collection, renseigner au minimum :
- `SUPABASE_URL` : `https://uvlrgwdbjegoavjfdrzb.supabase.co`
- `SUPABASE_ANON_KEY` : via l’environnement ci-dessus (ou vide si vous utilisez l’environnement).

### Ordre des requêtes

1. **1. Auth - Connexion** : récupère `ACCESS_TOKEN` et `USER_ID`.
2. **2. Tokens - Liste des appareils** : liste les tokens FCM de l’utilisateur.
3. **3. Notification - Envoyer test** : envoie une notification de test au mobile.

---

## 2. Tester avec cURL / PowerShell (sans Postman)

Si Postman renvoie « Invalid API key » ou que vous préférez tester depuis le terminal :

1. **Récupérer la clé anon** : Supabase Dashboard > **Project Settings** > **API** > **anon** (public). Copier sans espace ni retour à la ligne.
2. **Exécuter le script** (PowerShell, à la racine du projet) :
   ```powershell
   $env:SUPABASE_ANON_KEY = "COLLEZ_ICI_LA_CLE_ANON"
   .\scripts\test-notifications-curl.ps1
   ```
   Le script enchaîne : connexion → liste des tokens → envoi d’une notification de test.
3. **Commandes cURL manuelles** : voir [docs/CURL_NOTIFICATIONS_TEST.md](docs/CURL_NOTIFICATIONS_TEST.md).

---

## 3. URLs et requêtes Postman

### Connexion (obtenir le token)

```
POST https://uvlrgwdbjegoavjfdrzb.supabase.co/auth/v1/token?grant_type=password
```

**Headers :**
- `apikey` : `VOTRE_ANON_KEY`
- `Content-Type` : `application/json`

**Body (JSON) :**
```json
{
  "email": "freeanimations2@gmail.com",
  "password": "freeanimations2@gmail.com"
}
```

**Réponse :** `access_token`, `user.id` (à utiliser comme `USER_ID`).

---

### Liste des tokens d’appareils

```
GET https://uvlrgwdbjegoavjfdrzb.supabase.co/rest/v1/device_tokens?select=id,user_id,token,platform,last_seen_at
```

**Headers :**
- `apikey` : `VOTRE_ANON_KEY`
- `Authorization` : `Bearer <ACCESS_TOKEN>`
- `Content-Type` : `application/json`

---

### Envoyer une notification de test

```
POST https://uvlrgwdbjegoavjfdrzb.supabase.co/functions/v1/send-push-notification
```

**Headers :**
- `Authorization` : `Bearer VOTRE_ANON_KEY`
- `Content-Type` : `application/json`

**Body (JSON) – notification personnalisée :**
```json
{
  "type": "__passthrough",
  "user_ids": ["UUID_DE_L_UTILISATEUR"],
  "title": "Test Postman",
  "body": "Notification de test envoyée depuis Postman",
  "data": {
    "route": "/home",
    "category": "test"
  }
}
```

**Body – simulation changement de statut de commande :**
```json
{
  "type": "order_status_changed",
  "record": {
    "order_number": "TEST-001",
    "status": "shipped",
    "user_id": "UUID_DE_L_UTILISATEUR"
  }
}
```

---

## 4. Gestion des tokens et appareils

### Récupérer le `user_id`

1. Exécuter **1. Auth - Connexion**.
2. Dans la réponse, copier `user.id`.

### Vérifier les tokens en base

Dans Supabase Dashboard > **Table Editor** > `device_tokens` :

- Filtrer par `user_id` = UUID de l’utilisateur.
- Vérifier que `token` est renseigné et que `last_seen_at` est récent.

### Si aucun token n’apparaît

1. Lancer l’app Flutter sur un appareil ou émulateur.
2. Se connecter avec `freeanimations2@gmail.com`.
3. Vérifier les logs : `[FCM] token received`.
4. Attendre quelques secondes pour l’upsert dans `device_tokens`.

---

## 5. Types de notifications supportés

| Type                  | Description                    |
|-----------------------|--------------------------------|
| `__passthrough`       | Notification personnalisée    |
| `order_status_changed`| Mise à jour de commande       |
| `chat_message`        | Nouveau message (trigger DB)  |
| `driver_assigned`     | Livreur assigné               |
| `product_added`       | Nouveau produit               |
| `banner_created`      | Nouvelle promotion            |

---

## 6. Dépannage

### « Invalid API key » (requête 2 – Liste des appareils)

- **Tester sans Postman** : utiliser le script PowerShell (section 2 ci‑dessus) ou les commandes cURL dans [docs/CURL_NOTIFICATIONS_TEST.md](docs/CURL_NOTIFICATIONS_TEST.md). La clé est passée en clair dans le terminal (pas de scanner Postman).
- **Avec Postman** : renseigner `SUPABASE_ANON_KEY` dans un **Environnement** (pas dans la collection). Vérifier que la clé n’a **aucun espace ni retour à la ligne** au début ou à la fin.
- Vérifier que vous utilisez bien la clé **anon** (publique), pas la clé **service_role**, et qu’elle correspond au projet (Dashboard > Project Settings > API).

### « BOOT_ERROR » (requêtes 3, 4, 5)

1. Configurer le secret Firebase (PowerShell, racine du projet) :
   ```powershell
   supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(Get-Content -Raw -Path "android\app\globalbusinessamdaradir-fba45-firebase-adminsdk-fbsvc-0b9bbafd71.json")"
   ```
2. Redéployer : `supabase functions deploy send-push-notification`
3. Voir les logs : Dashboard > Edge Functions > send-push-notification > Logs

---

- **Pas de notification reçue** : vérifier que l’app a enregistré un token, que le secret FCM est configuré et que l’API FCM v1 est activée.
- **Erreur 500** : vérifier le secret `FIREBASE_SERVICE_ACCOUNT` dans Supabase.
- **`no device tokens found`** : l’utilisateur n’a pas de token en base ; lancer l’app et se connecter.
- **App fermée** : les notifications sont gérées par Firebase et s’affichent même quand l’app est fermée.
