-- Hub admin notifications : tables + extension push_campaigns
-- Accès données via service role (BFF) — RLS bloque le client JWT direct.

ALTER TABLE public.push_campaigns
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS total_targeted int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_detail text,
  ADD COLUMN IF NOT EXISTS invalid_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.push_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.push_campaigns(id) ON DELETE SET NULL,
  campaign_name text,
  target_type text NOT NULL DEFAULT 'segment'
    CHECK (target_type IN ('all', 'segment', 'single')),
  target_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_targeted int NOT NULL DEFAULT 0,
  total_sent int NOT NULL DEFAULT 0,
  delivered int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  invalid_tokens_removed int NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed', 'scheduled')),
  error_detail text,
  batch_results jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_push_logs_sent_at ON public.push_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_logs_campaign ON public.push_logs (campaign_id);

CREATE TABLE IF NOT EXISTS public.push_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  filename text,
  size_bytes int,
  mime_type text,
  used_in_campaigns int NOT NULL DEFAULT 0,
  storage_path text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_media_created ON public.push_media (created_at DESC);

CREATE TABLE IF NOT EXISTS public.push_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'transactional'
    CHECK (category IN ('promotional', 'transactional', 'alert', 'system')),
  title_template text NOT NULL,
  body_template text NOT NULL,
  image_url text,
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  variables text[] NOT NULL DEFAULT ARRAY[]::text[],
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_templates_category ON public.push_templates (category);

CREATE TABLE IF NOT EXISTS public.notification_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_devices int NOT NULL DEFAULT 0,
  last_estimated_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_notification_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week int,
  day_of_month int,
  send_time time NOT NULL DEFAULT '09:00:00',
  recipient_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
  format text NOT NULL DEFAULT 'push',
  active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_logs_deny_auth ON public.push_logs;
CREATE POLICY push_logs_deny_auth ON public.push_logs FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS push_media_deny_auth ON public.push_media;
CREATE POLICY push_media_deny_auth ON public.push_media FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS push_templates_deny_auth ON public.push_templates;
CREATE POLICY push_templates_deny_auth ON public.push_templates FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS notification_segments_deny_auth ON public.notification_segments;
CREATE POLICY notification_segments_deny_auth ON public.notification_segments FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS push_notification_schedules_deny_auth ON public.push_notification_schedules;
CREATE POLICY push_notification_schedules_deny_auth ON public.push_notification_schedules FOR ALL TO authenticated USING (false) WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
