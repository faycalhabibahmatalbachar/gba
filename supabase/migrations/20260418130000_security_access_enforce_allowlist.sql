-- Assure la clé enforce_ip_allowlist pour les déploiements ayant déjà security_access.
UPDATE public.settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('enforce_ip_allowlist', false)
WHERE key = 'security_access'
  AND (value->'enforce_ip_allowlist') IS NULL;
