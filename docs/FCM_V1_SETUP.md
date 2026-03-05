# Configuration Firebase Cloud Messaging (API V1)

## 0. Build Android : `google-services.json` (obligatoire)

Pour compiler l’APK (`flutter build apk --flavor client --release`), le fichier **google-services.json** doit être présent (config Firebase côté client, FCM, Analytics).

1. [Firebase Console](https://console.firebase.google.com/) → projet **globalbusinessamdaradir-fba45**
2. **Paramètres du projet** (engrenage) → **Vos applications**
3. Sélectionner l’app **Android** (ou en ajouter une avec le package `com.gba.ecommerce_client`)
4. Télécharger **google-services.json** et le placer ici :
   ```
   android/app/google-services.json
   ```

Sans ce fichier, la tâche `processClientReleaseGoogleServices` échoue.

---

## 1. Clé de compte de service

Le fichier de clé Firebase Admin SDK se trouve ici :
```
android/app/globalbusinessamdaradir-fba45-firebase-adminsdk-fbsvc-0b9bbafd71.json
```

**Projet Firebase :** `globalbusinessamdaradir-fba45`  
**Compte de service :** `firebase-adminsdk-fbsvc@globalbusinessamdaradir-fba45.iam.gserviceaccount.com`

## 2. Activer l’API FCM V1

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionner le projet `globalbusinessamdaradir-fba45`
3. **APIs & Services** > **Enabled APIs**
4. Vérifier que **Firebase Cloud Messaging API** est activée
5. **Ne pas** utiliser l’ancienne API (Legacy) qui est dépréciée

## 3. Configurer le secret Supabase

Le secret `FIREBASE_SERVICE_ACCOUNT` doit contenir le JSON complet du fichier de clé.

### Option A : Copier dans le presse-papiers puis coller dans le Dashboard (recommandé sur Windows)

Sous Windows, le CLI tronque souvent le secret. Méthode fiable :

1. À la racine du projet, exécuter :
   ```powershell
   .\scripts\copy-firebase-secret-to-clipboard.ps1
   ```
2. Ouvrir [Supabase Dashboard > Edge Functions > Secrets](https://supabase.com/dashboard/project/uvlrgwdbjegoavjfdrzb/settings/functions).
3. Créer ou modifier **FIREBASE_SERVICE_ACCOUNT**, coller (Ctrl+V) puis Enregistrer.

### Option B : Script Node.js + CLI

Depuis la racine du projet :

```bash
node scripts/set-firebase-secret.mjs
```

Si vous obtenez encore « Invalid FIREBASE_SERVICE_ACCOUNT secret », utiliser l’option A (presse-papiers + Dashboard).

### Option C : Copier-coller manuel

1. Ouvrir le fichier `android/app/globalbusinessamdaradir-fba45-firebase-adminsdk-fbsvc-0b9bbafd71.json` dans un éditeur.
2. Tout sélectionner (Ctrl+A) et copier (Ctrl+C).
3. Dashboard > **Project Settings** > **Edge Functions** > **Secrets** > **FIREBASE_SERVICE_ACCOUNT** > coller et enregistrer.
    
## 4. Redéployer la fonction Edge

```bash
supabase functions deploy send-push-notification
```

## 5. Vérifier

Les notifications push utilisent l’API **Firebase Cloud Messaging (HTTP v1)**. Elles fonctionnent :
- App au premier plan
- App en arrière-plan
- App fermée (via le service Firebase)
