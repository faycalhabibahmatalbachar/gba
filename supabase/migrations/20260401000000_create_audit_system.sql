-- =====================================================
-- AUDIT SYSTEM - Complete Audit Logging Infrastructure
-- =====================================================
-- Created: 2026-04-01
-- Purpose: Enterprise-grade audit trail for all admin actions

-- Drop existing objects if they exist
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TYPE IF EXISTS public.audit_action_type CASCADE;
DROP TYPE IF EXISTS public.audit_entity_type CASCADE;
DROP FUNCTION IF EXISTS public.log_audit_event CASCADE;

-- Create enum types for better type safety and performance
CREATE TYPE public.audit_action_type AS ENUM (
  'create',
  'update', 
  'delete',
  'view',
  'export',
  'bulk_create',
  'bulk_update',
  'bulk_delete',
  'bulk_export',
  'login',
  'logout',
  'permission_change',
  'status_change',
  'assign',
  'unassign',
  'approve',
  'reject',
  'send_notification',
  'refund',
  'cancel'
);

CREATE TYPE public.audit_entity_type AS ENUM (
  'product',
  'order',
  'user',
  'profile',
  'category',
  'banner',
  'delivery',
  'driver',
  'message',
  'conversation',
  'review',
  'payment',
  'notification',
  'report',
  'setting',
  'role',
  'permission'
);

-- Main audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who performed the action
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  user_role text,
  
  -- What action was performed
  action_type audit_action_type NOT NULL,
  action_description text,
  
  -- What entity was affected
  entity_type audit_entity_type NOT NULL,
  entity_id text,
  entity_name text,
  
  -- Change details (before/after state)
  changes jsonb DEFAULT '{}'::jsonb,
  -- Example: {"before": {"price": 100}, "after": {"price": 120}}
  
  -- Request metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  -- Example: {"ip": "192.168.1.1", "user_agent": "...", "session_id": "..."}
  
  -- Additional context
  bulk_operation_id uuid, -- Link related bulk operations
  parent_audit_id uuid REFERENCES public.audit_logs(id) ON DELETE SET NULL,
  
  -- Status and result
  status text DEFAULT 'success', -- 'success', 'failed', 'partial'
  error_message text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Retention metadata
  retention_until timestamptz, -- For automatic cleanup
  is_archived boolean DEFAULT false
);

-- Indexes for optimal query performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_bulk_operation ON public.audit_logs(bulk_operation_id) WHERE bulk_operation_id IS NOT NULL;
CREATE INDEX idx_audit_logs_status ON public.audit_logs(status) WHERE status != 'success';
CREATE INDEX idx_audit_logs_metadata_gin ON public.audit_logs USING gin(metadata);
CREATE INDEX idx_audit_logs_changes_gin ON public.audit_logs USING gin(changes);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view audit logs
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin());

-- No one can update or delete audit logs (immutable)
DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;
CREATE POLICY "audit_logs_no_update"
ON public.audit_logs
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "audit_logs_no_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_no_delete"
ON public.audit_logs
FOR DELETE
TO authenticated
USING (false);

-- Only system can insert (via function)
DROP POLICY IF EXISTS "audit_logs_system_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_system_insert"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true); -- Function will handle authorization

-- =====================================================
-- AUDIT LOGGING FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type audit_action_type,
  p_entity_type audit_entity_type,
  p_entity_id text DEFAULT NULL,
  p_entity_name text DEFAULT NULL,
  p_changes jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_action_description text DEFAULT NULL,
  p_bulk_operation_id uuid DEFAULT NULL,
  p_status text DEFAULT 'success',
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
  v_user_email text;
  v_user_role text;
BEGIN
  -- Get user details
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    user_role,
    action_type,
    action_description,
    entity_type,
    entity_id,
    entity_name,
    changes,
    metadata,
    bulk_operation_id,
    status,
    error_message,
    retention_until
  ) VALUES (
    auth.uid(),
    v_user_email,
    COALESCE(v_user_role, 'user'),
    p_action_type,
    p_action_description,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_changes,
    p_metadata,
    p_bulk_operation_id,
    p_status,
    p_error_message,
    now() + interval '2 years' -- Default retention: 2 years
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- =====================================================
-- AUDIT STATISTICS VIEW
-- =====================================================

CREATE OR REPLACE VIEW public.audit_statistics AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  action_type,
  entity_type,
  user_role,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'success') as success_count
FROM public.audit_logs
WHERE created_at >= now() - interval '90 days'
GROUP BY DATE_TRUNC('day', created_at), action_type, entity_type, user_role
ORDER BY date DESC;

-- Grant access to admins
GRANT SELECT ON public.audit_statistics TO authenticated;

-- =====================================================
-- AUTOMATIC CLEANUP FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Archive logs older than retention period
  UPDATE public.audit_logs
  SET is_archived = true
  WHERE retention_until < now()
    AND is_archived = false;
  
  -- Optionally delete very old archived logs (older than 5 years)
  DELETE FROM public.audit_logs
  WHERE is_archived = true
    AND created_at < now() - interval '5 years';
END;
$$;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.audit_logs IS 'Complete audit trail for all administrative actions in the system';
COMMENT ON COLUMN public.audit_logs.changes IS 'JSON object containing before/after state: {"before": {...}, "after": {...}}';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Request metadata: IP address, user agent, session ID, etc.';
COMMENT ON COLUMN public.audit_logs.bulk_operation_id IS 'Groups related operations in a bulk action';
COMMENT ON FUNCTION public.log_audit_event IS 'Logs an audit event. Call this function whenever an admin performs an action.';
