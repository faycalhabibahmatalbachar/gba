# Guide Complet de Déploiement Vercel — GBA

Ce guide couvre le déploiement de **3 projets** du monorepo GBA sur Vercel :

| Projet | Dossier racine | Framework | URL type |
|--------|---------------|-----------|----------|
| **Backend API** | `backend/` | Python (FastAPI) | `gba-backend-xxx.vercel.app` |
| **Admin Next.js** | `admin-nextjs/` | Next.js | `gba-admin-xxx.vercel.app` |
| **Admin React** | `admin-react/` | Vite (React) | `gba-react-xxx.vercel.app` |

---

## Prérequis

1. Un compte [Vercel](https://vercel.com)
2. Le repo GBA poussé sur GitHub/GitLab
3. Les clés Supabase (Dashboard → Settings → API) :
   - `SUPABASE_URL` — ex: `https://uvlrgwdbjegoavjfdrzb.supabase.co`
   - `SUPABASE_ANON_KEY` — clé publique anon
   - `SUPABASE_SERVICE_ROLE_KEY` — clé service role (backend uniquement)

---

## 1. Projet Backend (FastAPI)

### 1.1 Créer le projet Vercel

1. Vercel Dashboard → **Add New → Project**
2. Importer le repo GBA
3. **Root Directory** → `backend/` ⚠️ **CRUCIAL** — sans ça, Vercel ne trouvera pas `api/index.py`
4. **Framework Preset** → `Other`
5. Ne pas modifier Build Command ni Output Directory

### 1.2 Variables d'environnement

| Variable | Valeur | Obligatoire |
|----------|--------|-------------|
| `SUPABASE_URL` | `https://uvlrgwdbjegoavjfdrzb.supabase.co` | ✅ |
| `SUPABASE_ANON_KEY` | Votre clé anon | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Votre clé service role | ✅ |

### 1.3 Fichier `vercel.json` (déjà présent dans `backend/`)

```json
{
  "functions": {
    "api/index.py": { "maxDuration": 30 }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "*" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/index.py" }
  ]
}
```

### 1.4 Vérification

Après déploiement, tester :
```
curl https://votre-backend.vercel.app/health
```

### 1.5 Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `The pattern 'api/index.py' doesn't match any Serverless Functions` | Root Directory mal configuré | Mettre **Root Directory = `backend/`** |
| `ModuleNotFoundError` | `requirements.txt` non trouvé | Vérifier que `backend/requirements.txt` existe |
| `CORS errors` | Headers manquants | Vérifier `vercel.json` headers |

---

## 2. Projet Admin Next.js

### 2.1 Créer le projet Vercel

1. Vercel Dashboard → **Add New → Project**
2. Importer le repo GBA
3. **Root Directory** → `admin-nextjs/`
4. **Framework Preset** → `Next.js` (auto-détecté)
5. Build Command : `next build` (par défaut)
6. Output Directory : `.next` (par défaut)

### 2.2 Variables d'environnement

| Variable | Valeur | Obligatoire |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uvlrgwdbjegoavjfdrzb.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Votre clé anon | ✅ |

> ⚠️ Les variables `NEXT_PUBLIC_*` sont exposées côté client. Ne **jamais** y mettre la `SERVICE_ROLE_KEY`.

### 2.3 Configuration images Next.js

Le fichier `next.config.ts` autorise déjà les images depuis Supabase Storage :

```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
  ],
},
```

### 2.4 Vérification

Après déploiement, ouvrir `https://votre-admin.vercel.app/login` et se connecter avec un compte admin.

### 2.5 Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Hydration mismatch` | Hash CSS-variable dynamique | Le `ThemeProvider` utilise déjà `cssVar: { key: 'gba' }` — vérifier qu'il est bien appliqué |
| `Image optimization` | Domaine non autorisé | Ajouter le domaine dans `next.config.ts` → `images.remotePatterns` |
| `401 Unauthorized` | Clés Supabase manquantes | Vérifier les env vars `NEXT_PUBLIC_*` dans Vercel |

---

## 3. Projet Admin React (Vite)

### 3.1 Créer le projet Vercel

1. Vercel Dashboard → **Add New → Project**
2. Importer le repo GBA
3. **Root Directory** → `admin-react/`
4. **Framework Preset** → `Vite`
5. Build Command : `npm run build` (par défaut)
6. Output Directory : `dist` (par défaut)

### 3.2 Variables d'environnement

| Variable | Valeur | Obligatoire |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | `https://uvlrgwdbjegoavjfdrzb.supabase.co` | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Votre clé anon | ✅ |

> ⚠️ Les variables `VITE_*` sont exposées côté client. Ne **jamais** y mettre la `SERVICE_ROLE_KEY`.

### 3.3 SPA Routing

Pour une Single Page Application React, ajouter un `vercel.json` dans `admin-react/` si ce n'est pas déjà fait :

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Cela évite les erreurs 404 lors du rechargement d'une page avec des routes côté client.

### 3.4 Vérification

Après déploiement, ouvrir `https://votre-react-admin.vercel.app` et se connecter.

---

## 4. Configuration commune

### 4.1 Domaines personnalisés

1. Vercel Dashboard → Projet → **Settings → Domains**
2. Ajouter votre domaine (ex: `admin.gba.com`)
3. Configurer le DNS chez votre registrar :
   - **CNAME** : `admin` → `cname.vercel-dns.com`
   - Ou **A record** : `76.76.21.21`

### 4.2 Variables d'environnement par environnement

Vercel permet de définir des variables par environnement :
- **Production** : variables de production
- **Preview** : variables pour les PR (branches de preview)
- **Development** : variables pour `vercel dev` en local

Pour configurer : Projet → Settings → Environment Variables → sélectionner les environnements cibles.

### 4.3 Déploiements automatiques

Par défaut, Vercel déploie automatiquement :
- **Push sur `main`** → déploiement en production
- **Push sur une branche** → déploiement de preview

Pour limiter les builds inutiles dans un monorepo, configurer **Ignored Build Step** :

1. Projet → Settings → General → **Root Directory**
2. Activer **Include source files outside of the Root Directory**
3. Dans **Ignored Build Step**, mettre :
   ```bash
   git diff HEAD^ HEAD --quiet -- backend/
   ```
   (remplacer `backend/` par le dossier du projet concerné)

### 4.4 Logs et monitoring

- **Functions logs** : Projet → Functions → Logs
- **Runtime logs** : Projet → Deployments → cliquer sur un déploiement → Logs
- **Analytics** (Pro) : Projet → Analytics

---

## 5. Déploiement local avec Vercel CLI

```bash
# Installer
npm i -g vercel

# Login
vercel login

# Déployer le backend en preview
cd backend
vercel

# Déployer le backend en production
vercel --prod

# Déployer admin-nextjs en preview
cd ../admin-nextjs
vercel

# Déployer admin-nextjs en production
vercel --prod
```

### Variables d'env en local

```bash
# Télécharger les env vars depuis Vercel
vercel env pull .env.local
```

---

## 6. Checklist avant mise en production

- [ ] Variables d'environnement configurées pour chaque projet
- [ ] Root Directory correctement défini pour chaque projet
- [ ] Tester les endpoints backend (`/health`, `/v1/...`)
- [ ] Tester la connexion admin sur les frontends
- [ ] Vérifier les images Supabase Storage dans Next.js
- [ ] Configurer les domaines personnalisés si nécessaire
- [ ] Activer les notifications de déploiement (Slack/email)

---

## 7. Référence des URLs

| Projet | URL Vercel |
|--------|-----------|
| Backend API | `https://gbabackend.vercel.app` |
| Frontend (site) | `https://globalbusinessamdaradir.vercel.app` |
| Admin Next.js | *(à configurer)* |
| Admin React | *(à configurer)* |

> Mettre à jour ce tableau après chaque nouveau déploiement.
