-- Email / Broadcast / Media base schema (idempotent)

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text,
  recipients text,
  subject text,
  body_html text,
  status text DEFAULT 'pending',
  provider text,
  latency_ms integer,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  attachments jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE IF EXISTS public.email_logs
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS recipients text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.broadcast_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'in_app',
  target_filter jsonb DEFAULT '{}'::jsonb,
  message_body text,
  message_type text DEFAULT 'text',
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text DEFAULT 'completed'
);

ALTER TABLE IF EXISTS public.chat_conversations
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs((COALESCE(type, template_name)));
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_by ON public.email_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created_at ON public.broadcast_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_channel ON public.broadcast_logs(channel);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_logs_service_role_only ON public.email_logs;
CREATE POLICY email_logs_service_role_only ON public.email_logs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS broadcast_logs_service_role_only ON public.broadcast_logs;
CREATE POLICY broadcast_logs_service_role_only ON public.broadcast_logs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
