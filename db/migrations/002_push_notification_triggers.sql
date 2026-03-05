-- Migration: Create database webhook triggers for push notifications
-- These triggers call the send-push-notification Edge Function on relevant events
-- Run this in the Supabase SQL Editor AFTER deploying the Edge Function

-- 1. Create device_tokens table if not exists
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text DEFAULT 'android',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
DROP POLICY IF EXISTS "Users can insert own tokens" ON public.device_tokens;
CREATE POLICY "Users can insert own tokens"
  ON public.device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tokens" ON public.device_tokens;
CREATE POLICY "Users can update own tokens"
  ON public.device_tokens FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tokens" ON public.device_tokens;
CREATE POLICY "Users can delete own tokens"
  ON public.device_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can read all tokens (for sending notifications)
DROP POLICY IF EXISTS "Service role can read all tokens" ON public.device_tokens;
CREATE POLICY "Service role can read all tokens"
  ON public.device_tokens FOR SELECT
  USING (true);

-- 2. Create notification function for new products
-- NOTE: Supabase Database Webhooks are configured in the Dashboard:
-- Go to Database > Webhooks > Create Webhook
-- 
-- Webhook 1: New Product Notification
--   Table: products
--   Events: INSERT
--   URL: https://<project-ref>.supabase.co/functions/v1/send-push-notification
--   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   Body: { "type": "product_added", "record": {{record}} }
--
-- Webhook 2: New Order Notification  
--   Table: orders
--   Events: INSERT
--   URL: https://<project-ref>.supabase.co/functions/v1/send-push-notification
--   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   Body: { "type": "order_created", "record": {{record}} }
--
-- Webhook 3: Order Status Change Notification
--   Table: orders
--   Events: UPDATE
--   URL: https://<project-ref>.supabase.co/functions/v1/send-push-notification
--   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   Body: { "type": "order_status_changed", "record": {{record}}, "old_record": {{old_record}} }
--
-- Webhook 4: New Chat Message Notification
--   Table: chat_messages
--   Events: INSERT
--   URL: https://<project-ref>.supabase.co/functions/v1/send-push-notification
--   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   Body: { "type": "chat_message", "record": {{record}} }

-- 3. Alternative: Use pg_net extension for direct HTTP calls from triggers
-- This approach doesn't require Dashboard webhook configuration

-- Enable pg_net extension (if available)
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a helper function to call the Edge Function
CREATE OR REPLACE FUNCTION public.notify_push(event_type text, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- These should be set as database secrets or config
  edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification';
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Only proceed if configured
  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RETURN;
  END IF;

  -- Use pg_net to make async HTTP call (if extension is available)
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', event_type,
      'record', payload
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Silently fail - don't block the original operation
    RAISE NOTICE 'Push notification failed: %', SQLERRM;
END;
$$;
