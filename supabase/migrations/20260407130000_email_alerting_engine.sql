-- Email alerting engine (SMTP/Resend observability + audit rules)

ALTER TABLE IF EXISTS public.email_logs
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retryable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS rule_id uuid;

CREATE TABLE IF NOT EXISTS public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  event_type text NOT NULL,
  action_types text[] NOT NULL DEFAULT '{}'::text[],
  entity_types text[] NOT NULL DEFAULT '{}'::text[],
  severities text[] NOT NULL DEFAULT '{}'::text[],
  recipient_override text[] NOT NULL DEFAULT '{}'::text[],
  delivery_mode text NOT NULL DEFAULT 'instant',
  throttle_sec integer NOT NULL DEFAULT 120,
  min_priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_dispatch_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL UNIQUE,
  last_processed_event_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.notification_rules(name, enabled, event_type, action_types, entity_types, delivery_mode, throttle_sec, min_priority)
SELECT
  'admin_ops_default',
  true,
  'audit_event',
  ARRAY['create', 'update', 'delete', 'assign', 'lockdown'],
  ARRAY['order', 'user', 'message', 'security'],
  'instant',
  120,
  'normal'
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_rules WHERE name = 'admin_ops_default'
);
