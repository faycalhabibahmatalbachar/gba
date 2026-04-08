# Email: free alternative and admin templates

## Recommended strategy

- Primary: `Resend` (simple API, reliable delivery, easy templates)
- Fallback: SMTP provider (Brevo SMTP relay)
- Runtime choice: keep `EMAIL_PROVIDER=auto` so service uses Resend first, then SMTP

## Free-tier alternatives (quick comparison)

1. Resend
   - Pros: modern API, strong DX, easy domain setup
   - Limits: free tier monthly quota
2. Brevo SMTP/API
   - Pros: daily free volume, SMTP compatible
   - Limits: lower daily cap, stricter anti-abuse checks
3. Mailgun / Postmark (trial tiers)
   - Pros: excellent deliverability
   - Limits: short or restrictive free trial

## Environment variables

- `EMAIL_PROVIDER=auto`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `RESEND_API_KEY` (primary)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (fallback)

## Admin template catalog

1. New order
   - Subject: `[GBA] Nouvelle commande {{order_number}}`
   - Data: customer, amount, payment status, created_at

2. New special order / quote
   - Subject: `[GBA] Nouvelle commande speciale {{order_number}}`
   - Data: quote payload, requested specs, quote status

3. New user
   - Subject: `[GBA] Nouvel utilisateur {{email}}`
   - Data: name, role, signup source, country

4. New message (chat)
   - Subject: `[GBA] Nouveau message {{conversation_id}}`
   - Data: sender, order id, excerpt, unread count

5. Order status changed
   - Subject: `[GBA] Statut commande {{order_number}} -> {{status_fr}}`
   - Data: old status, new status, actor, timestamp

6. Security alert
   - Subject: `[GBA Securite] {{severity}} - {{title}}`
   - Data: category, ip, country, actor, remediation link

## Minimal template fields

- Header: logo + app name (`GBA Administration`)
- Body: concise event summary + action button
- Footer: environment (`production`/`preview`) + timestamp + trace id

## Operational recommendations

- Keep all event payloads logged in `email_logs`.
- Add `entity_id` and `event_type` metadata for auditability.
- Retry transient errors with exponential backoff (1m, 5m, 15m).
