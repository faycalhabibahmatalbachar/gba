# Vercel release checklist (`admin_gba`)

## Project settings

- Root Directory: `admin_gba`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `.next`
- Node.js: align with `package.json` engines (or latest LTS)

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
