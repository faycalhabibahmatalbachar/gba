-- ============================================================
-- notification_logs: Audit trail for all push notifications
-- Enables monitoring, debugging, and analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who / What
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_token  TEXT,
  -- Notification content
  event_type    TEXT NOT NULL,                -- 'order_created', 'chat_message', etc.
  title         TEXT,
  body          TEXT,
  data          JSONB DEFAULT '{}'::JSONB,    -- Full data payload sent
  -- Delivery status
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'invalid_token'
  fcm_response  TEXT,                         -- FCM API response or error message
  -- Metadata
  platform      TEXT,                         -- 'android', 'ios', 'web'
  locale        TEXT,                         -- 'fr', 'en', 'ar'
  attempt       INT DEFAULT 1,               -- Retry attempt number
  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ                   -- When FCM accepted the message
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id     ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type  ON public.notification_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status      ON public.notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at  ON public.notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_device_token ON public.notification_logs(device_token);

-- RLS: only admin and service_role can read logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Admin can read all logs
DROP POLICY IF EXISTS "admin_read_notification_logs" ON public.notification_logs;
CREATE POLICY "admin_read_notification_logs"
  ON public.notification_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role (Edge Functions) can do everything
DROP POLICY IF EXISTS "service_role_all_notification_logs" ON public.notification_logs;
CREATE POLICY "service_role_all_notification_logs"
  ON public.notification_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can see their own notification logs
DROP POLICY IF EXISTS "user_own_notification_logs" ON public.notification_logs;
CREATE POLICY "user_own_notification_logs"
  ON public.notification_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- Cleanup function: delete logs older than 30 days
-- Can be called via pg_cron or manually
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_notification_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notification_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================
-- Cleanup function: remove stale device tokens (not seen in 60 days)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_device_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.device_tokens
  WHERE updated_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
