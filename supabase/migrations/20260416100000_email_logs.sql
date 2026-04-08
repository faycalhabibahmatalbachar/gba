-- Journal des emails sortants (admin GBA) — lecture/écriture via service role uniquement.

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  message_id text,
  triggered_by_action text,
  triggered_by_entity_id text,
  triggered_by_actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON public.email_logs (template_name);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_logs_no_client ON public.email_logs;
CREATE POLICY email_logs_no_client ON public.email_logs FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMENT ON TABLE public.email_logs IS 'Traçabilité envois email (Resend/SMTP) — alimentée par l’admin Next.js.';
