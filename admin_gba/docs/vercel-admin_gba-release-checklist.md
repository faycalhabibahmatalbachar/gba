# Vercel release checklist (`admin_gba`)

## Project settings

- Root Directory: **`admin_gba`** (required). If this is empty, `admin-nextjs`, or the repo root, production will **not** match local `npm run dev` inside `admin_gba` (for example `/orders` may show only a status filter instead of status **and** command type: *Toutes les commandes / Commandes spéciales / Commandes standard*).
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `.next`
- Node.js: align with `package.json` engines (or latest LTS)
- Production Branch: usually `main`. Confirm the deployed commit SHA on Vercel matches GitHub `main` after each release.
- Prefer **one** Vercel project as canonical production admin; duplicate projects (`*.vercel.app`) often drift on Root Directory or env vars—delete or use the second only for previews.

## Backend Vercel supprimé par erreur

Un projet Vercel effacé n’est pas récupérable tel quel. Recréez un projet (**Add New… → Project**), pointez vers le même dépôt, réglez le **Root Directory** sur le dossier du backend (ex. `backend` dans ce monorepo si c’est ce qui était déployé), recopiez les variables d’environnement, puis mettez à jour toutes les URLs clientes (`BACKEND_URL`, webhooks, etc.) vers le nouveau domaine `*.vercel.app`.

## Required environment variables (Production + Preview)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_PROVIDER` (`auto`, `resend`, or `smtp`)
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`

## Optional email variables

- `RESEND_API_KEY` (primary if present)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

## Pre-release validation

1. Local build: `cd admin_gba && npm run build`
1b. (Optionnel) Vérifier que Resend ou SMTP est défini sans envoyer d’email : `cd admin_gba && npm run check:email-env` (chargez les variables depuis votre shell ou `node --env-file=.env.local` si Node 20+).
2. Verify critical routes (no 500):
   - `/orders`
   - `/deliveries`
   - `/dashboard`
   - `/products/categories`
   - `/messages`
   - `/banners`
3. Verify email test from `/email-logs`
4. Verify driver assignment modal from `/deliveries`
5. Verify special mobile filters from `/orders?kind=special_mobile`

## Post-deploy smoke checks

- API: `/api/orders` returns 200 with list payload.
- Dashboard: 7 and 30 day views update and remain in French.
- Categories page loads even with partial DB schema (no `accent_color`/`icon_key`).
- Voice message upload/playback works on client + driver apps.
