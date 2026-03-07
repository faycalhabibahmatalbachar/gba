-- ============================================================
-- Driver Chat RLS + image_url column for chat_messages
-- 
-- Problem: Current chat RLS only allows user_id (customer) or admin.
-- Drivers are neither, so they cannot SELECT/INSERT/UPDATE messages
-- for conversations with their assigned customers.
--
-- Fix: Add PERMISSIVE policies that allow drivers to access
-- chat_conversations and chat_messages for customers whose orders
-- are assigned to them (orders.driver_id = auth.uid()).
--
-- Also adds image_url column to chat_messages for image sharing.
-- ============================================================

-- ── 1. Add image_url column to chat_messages ─────────────────────────
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ── 2. Helper function: is current user a driver for this customer? ──
CREATE OR REPLACE FUNCTION public.is_driver_for_customer(p_customer_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE driver_id = auth.uid()
      AND user_id = p_customer_id
    LIMIT 1
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_driver_for_customer(UUID) TO authenticated;

-- ── 3. chat_conversations: driver can SELECT conversations ───────────
-- Drivers can see conversations for customers whose orders they deliver
CREATE POLICY "chat_conv_driver_select"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (
    public.is_driver_for_customer(user_id)
  );

-- Drivers can create conversations with their assigned customers
CREATE POLICY "chat_conv_driver_insert"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_driver_for_customer(user_id)
  );

-- Drivers can update conversations (e.g. updated_at timestamp)
CREATE POLICY "chat_conv_driver_update"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (
    public.is_driver_for_customer(user_id)
  )
  WITH CHECK (
    public.is_driver_for_customer(user_id)
  );

-- ── 4. chat_messages: driver can SELECT/INSERT/UPDATE messages ───────
-- Drivers can read messages in conversations for their assigned customers
CREATE POLICY "chat_msg_driver_select"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND public.is_driver_for_customer(c.user_id)
    )
  );

-- Drivers can send messages (sender_id must be their own uid)
CREATE POLICY "chat_msg_driver_insert"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND public.is_driver_for_customer(c.user_id)
    )
  );

-- Drivers can update messages (e.g. mark as read)
CREATE POLICY "chat_msg_driver_update"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND public.is_driver_for_customer(c.user_id)
    )
  );

-- ── 5. Index for performance on the driver lookup ────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_driver_user
  ON public.orders (driver_id, user_id);
